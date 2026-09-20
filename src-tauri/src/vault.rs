use notify::{Event, EventKind, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};
use tempfile::NamedTempFile;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VaultInfo {
    pub path: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String, // Relative path from vault root (forward slashes)
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileChangeEvent {
    pub path: String, // Relative path from vault root
    pub kind: String, // "create" | "modify" | "remove" | "other"
}

pub struct VaultState {
    pub current_vault: Mutex<Option<PathBuf>>,
    pub watcher: Mutex<Option<notify::RecommendedWatcher>>,
}

impl Default for VaultState {
    fn default() -> Self {
        Self {
            current_vault: Mutex::new(None),
            watcher: Mutex::new(None),
        }
    }
}

/// Validates that `target_rel_or_abs` stays strictly within `vault_root`.
/// Returns the resolved canonical (or validated absolute) path within the vault.
pub fn validate_and_resolve_path(vault_root: &Path, user_path: &str) -> Result<PathBuf, String> {
    let raw_path = Path::new(user_path);

    // Disallow empty or parent directory components
    for comp in raw_path.components() {
        if let Component::ParentDir = comp {
            return Err("Security Error: Path traversal ('..') is not permitted".to_string());
        }
    }

    let resolved = if raw_path.is_absolute() {
        // If absolute, must start with vault_root
        if !raw_path.starts_with(vault_root) {
            return Err("Security Error: Absolute path is outside active Vault root".to_string());
        }
        raw_path.to_path_buf()
    } else {
        // Strip leading slash if any to treat as relative
        let cleaned = user_path.trim_start_matches(['/', '\\']);
        vault_root.join(cleaned)
    };

    // If file/directory exists, verify canonicalized path starts with canonical vault root
    if resolved.exists() {
        let canonical_root = vault_root
            .canonicalize()
            .map_err(|e| format!("Failed to canonicalize vault root: {}", e))?;
        let canonical_target = resolved
            .canonicalize()
            .map_err(|e| format!("Failed to canonicalize target path: {}", e))?;

        if !canonical_target.starts_with(&canonical_root) {
            return Err("Security Error: Resolved path escapes active Vault root".to_string());
        }
    } else {
        // For files/directories that do not exist yet, find nearest existing ancestor and verify
        let mut curr = resolved.as_path();
        while !curr.exists() {
            if let Some(parent) = curr.parent() {
                curr = parent;
            } else {
                break;
            }
        }
        if curr.exists() {
            let canonical_root = vault_root
                .canonicalize()
                .map_err(|e| format!("Failed to canonicalize vault root: {}", e))?;
            let canonical_curr = curr
                .canonicalize()
                .map_err(|e| format!("Failed to canonicalize ancestor path: {}", e))?;

            if !canonical_curr.starts_with(&canonical_root) {
                return Err("Security Error: Path escapes active Vault root".to_string());
            }
        }
    }

    Ok(resolved)
}

/// Recursively scans directory and builds nested `FileNode` hierarchy.
pub fn scan_directory(dir_path: &Path, vault_root: &Path) -> Result<Vec<FileNode>, String> {
    let mut entries = Vec::new();

    let read_dir = fs::read_dir(dir_path)
        .map_err(|e| format!("Failed to read directory {:?}: {}", dir_path, e))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Directory entry error: {}", e))?;
        let file_name = entry.file_name().to_string_lossy().to_string();

        // Ignore hidden files and system directories
        if file_name.starts_with('.') || file_name == "node_modules" || file_name == "target" {
            continue;
        }

        let full_path = entry.path();
        let is_dir = full_path.is_dir();

        // Compute clean relative path from vault root
        let rel_path = full_path
            .strip_prefix(vault_root)
            .map_err(|e| format!("Failed to compute relative path: {}", e))?
            .to_string_lossy()
            .replace('\\', "/");

        let children = if is_dir {
            Some(scan_directory(&full_path, vault_root)?)
        } else {
            None
        };

        entries.push(FileNode {
            name: file_name,
            path: rel_path,
            is_dir,
            children,
        });
    }

    // Sort: directories first, then alphabetically by name
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

fn get_config_file_path() -> Option<PathBuf> {
    dirs::config_dir().map(|p| p.join("janus-note").join("config.json"))
}

#[derive(Serialize, Deserialize)]
struct JanusConfig {
    last_vault: Option<String>,
}

fn load_persisted_vault() -> Option<PathBuf> {
    let config_path = get_config_file_path()?;
    if !config_path.exists() {
        return None;
    }
    let data = fs::read_to_string(config_path).ok()?;
    let cfg: JanusConfig = serde_json::from_str(&data).ok()?;
    let last = cfg.last_vault?;
    let path = PathBuf::from(last);
    if path.exists() && path.is_dir() {
        path.canonicalize().ok()
    } else {
        None
    }
}

fn persist_vault_path(path: &Path) {
    if let Some(config_path) = get_config_file_path() {
        if let Some(parent) = config_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let cfg = JanusConfig {
            last_vault: Some(path.to_string_lossy().to_string()),
        };
        if let Ok(json) = serde_json::to_string_pretty(&cfg) {
            let _ = fs::write(config_path, json);
        }
    }
}

#[tauri::command]
pub fn vault_get_current(
    state: State<'_, VaultState>,
    app_handle: AppHandle,
) -> Result<Option<VaultInfo>, String> {
    let mut lock = state.current_vault.lock().map_err(|e| e.to_string())?;

    // If no vault currently in memory, attempt to load persisted vault
    if lock.is_none() {
        if let Some(persisted) = load_persisted_vault() {
            // Setup watcher for persisted vault
            let _ = setup_vault_watcher(&persisted, &state, app_handle);
            *lock = Some(persisted);
        }
    }

    Ok(lock.as_ref().map(|path| {
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "Vault".to_string());
        VaultInfo {
            path: path.to_string_lossy().to_string(),
            name,
        }
    }))
}

#[tauri::command]
pub fn vault_set_folder(
    path: String,
    state: State<'_, VaultState>,
    app_handle: AppHandle,
) -> Result<VaultInfo, String> {
    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() || !path_buf.is_dir() {
        return Err(format!("Specified path does not exist or is not a directory: {}", path));
    }

    let canonical = path_buf
        .canonicalize()
        .map_err(|e| format!("Failed to resolve canonical path: {}", e))?;

    let name = canonical
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Vault".to_string());

    // Update current vault
    {
        let mut lock = state.current_vault.lock().map_err(|e| e.to_string())?;
        *lock = Some(canonical.clone());
    }

    // Persist to configuration
    persist_vault_path(&canonical);

    // Initialize watcher
    setup_vault_watcher(&canonical, &state, app_handle)?;

    Ok(VaultInfo {
        path: canonical.to_string_lossy().to_string(),
        name,
    })
}

#[tauri::command]
pub async fn vault_select_folder(
    state: State<'_, VaultState>,
    app_handle: AppHandle,
) -> Result<Option<VaultInfo>, String> {
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = std::sync::mpsc::channel();

    app_handle.dialog().file().pick_folder(move |folder_path| {
        let _ = tx.send(folder_path);
    });

    let selected = rx.recv().map_err(|e| format!("Dialog error: {}", e))?;

    match selected {
        Some(folder_path) => {
            let path_str = folder_path.to_string();
            let info = vault_set_folder(path_str, state, app_handle)?;
            Ok(Some(info))
        }
        None => Ok(None),
    }
}

pub fn read_file_impl(vault_root: &Path, path: &str) -> Result<String, String> {
    let target_path = validate_and_resolve_path(vault_root, path)?;
    if !target_path.exists() {
        return Err(format!("File not found: {}", path));
    }

    fs::read_to_string(&target_path)
        .map_err(|e| format!("Failed to read file {}: {}", path, e))
}

pub fn write_file_impl(vault_root: &Path, path: &str, content: &str) -> Result<(), String> {
    let target_path = validate_and_resolve_path(vault_root, path)?;

    // If target is a json file, validate JSON syntax first
    if path.ends_with(".json") {
        if let Err(e) = serde_json::from_str::<serde_json::Value>(content) {
            return Err(format!("Invalid JSON content: {}", e));
        }
    }

    // Ensure parent directory exists
    if let Some(parent) = target_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directories: {}", e))?;
        }
    }

    // Atomic write via tempfile in same parent directory
    let parent = target_path.parent().unwrap_or(vault_root);
    let mut temp_file = NamedTempFile::new_in(parent)
        .map_err(|e| format!("Failed to create temporary write buffer: {}", e))?;

    temp_file
        .write_all(content.as_bytes())
        .map_err(|e| format!("Failed to write content: {}", e))?;
    temp_file
        .flush()
        .map_err(|e| format!("Failed to flush content: {}", e))?;

    temp_file
        .persist(&target_path)
        .map_err(|e| format!("Failed to atomically persist file {}: {}", path, e))?;

    Ok(())
}

pub fn create_folder_impl(vault_root: &Path, rel_path: &str) -> Result<(), String> {
    let trimmed = rel_path.trim();
    if trimmed.is_empty() {
        return Err("Folder path cannot be empty".to_string());
    }

    let target_path = validate_and_resolve_path(vault_root, trimmed)?;
    if !target_path.exists() {
        fs::create_dir_all(&target_path)
            .map_err(|e| format!("Failed to create folder {:?}: {}", trimmed, e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn vault_read_file(path: String, state: State<'_, VaultState>) -> Result<String, String> {
    let vault_root = {
        let lock = state.current_vault.lock().map_err(|e| e.to_string())?;
        lock.clone()
            .ok_or_else(|| "No active Vault selected".to_string())?
    };

    read_file_impl(&vault_root, &path)
}

#[tauri::command]
pub fn vault_write_file(
    path: String,
    content: String,
    state: State<'_, VaultState>,
) -> Result<(), String> {
    let vault_root = {
        let lock = state.current_vault.lock().map_err(|e| e.to_string())?;
        lock.clone()
            .ok_or_else(|| "No active Vault selected".to_string())?
    };

    write_file_impl(&vault_root, &path, &content)
}

#[tauri::command]
pub fn vault_create_folder(path: String, state: State<'_, VaultState>) -> Result<(), String> {
    let vault_root = {
        let lock = state.current_vault.lock().map_err(|e| e.to_string())?;
        lock.clone()
            .ok_or_else(|| "No active Vault selected".to_string())?
    };

    create_folder_impl(&vault_root, &path)
}

#[tauri::command]
pub fn vault_list_files(state: State<'_, VaultState>) -> Result<Vec<FileNode>, String> {
    let vault_root = {
        let lock = state.current_vault.lock().map_err(|e| e.to_string())?;
        lock.clone()
            .ok_or_else(|| "No active Vault selected".to_string())?
    };

    scan_directory(&vault_root, &vault_root)
}

#[tauri::command]
pub fn vault_start_watcher(
    state: State<'_, VaultState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let vault_root = {
        let lock = state.current_vault.lock().map_err(|e| e.to_string())?;
        lock.clone()
            .ok_or_else(|| "No active Vault selected".to_string())?
    };

    setup_vault_watcher(&vault_root, &state, app_handle)
}

fn setup_vault_watcher(
    vault_root: &Path,
    state: &VaultState,
    app_handle: AppHandle,
) -> Result<(), String> {
    let root_clone = vault_root.to_path_buf();

    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        if let Ok(event) = res {
            let kind_str = match event.kind {
                EventKind::Create(_) => "create",
                EventKind::Modify(_) => "modify",
                EventKind::Remove(_) => "remove",
                _ => "other",
            };

            for path in event.paths {
                if let Ok(rel) = path.strip_prefix(&root_clone) {
                    let rel_str = rel.to_string_lossy().replace('\\', "/");
                    // Skip hidden files
                    if rel_str.starts_with('.') || rel_str.contains("/.") {
                        continue;
                    }

                    let payload = FileChangeEvent {
                        path: rel_str,
                        kind: kind_str.to_string(),
                    };

                    let _ = app_handle.emit("vault://file-changed", &payload);
                }
            }
        }
    })
    .map_err(|e| format!("Failed to initialize file watcher: {}", e))?;

    watcher
        .watch(vault_root, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch vault directory: {}", e))?;

    let mut watcher_lock = state.watcher.lock().map_err(|e| e.to_string())?;
    *watcher_lock = Some(watcher);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_path_containment_accepts_valid_subpaths() {
        let dir = tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();

        let valid_file = root.join("notes/today.md");
        fs::create_dir_all(valid_file.parent().unwrap()).unwrap();
        fs::write(&valid_file, "test content").unwrap();

        let resolved = validate_and_resolve_path(&root, "notes/today.md").unwrap();
        assert_eq!(resolved.canonicalize().unwrap(), valid_file.canonicalize().unwrap());
    }

    #[test]
    fn test_path_containment_rejects_parent_traversal() {
        let dir = tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();

        let result = validate_and_resolve_path(&root, "../secret.txt");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Path traversal"));

        let result2 = validate_and_resolve_path(&root, "subdir/../../escape.txt");
        assert!(result2.is_err());
    }

    #[test]
    fn test_atomic_file_write_and_read() {
        let dir = tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();

        // Test markdown write
        let content = "# Hello World\nThis is a note.";
        let write_res = write_file_impl(&root, "test.md", content);
        assert!(write_res.is_ok());

        let read_res = read_file_impl(&root, "test.md").unwrap();
        assert_eq!(read_res, content);

        // Test JSON write valid
        let json_content = r#"{"name": "Sprint 1", "tasks": []}"#;
        let json_write = write_file_impl(&root, "sprint.tasks.json", json_content);
        assert!(json_write.is_ok());

        // Test JSON write invalid syntax is rejected
        let bad_json = r#"{"name": "broken", tasks: }"#;
        let bad_write = write_file_impl(&root, "broken.json", bad_json);
        assert!(bad_write.is_err());
    }

    #[test]
    fn test_directory_tree_scanner() {
        let dir = tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();

        fs::create_dir_all(root.join("folder-a/nested")).unwrap();
        fs::write(root.join("folder-a/nested/doc.md"), "content").unwrap();
        fs::write(root.join("root-note.md"), "root content").unwrap();

        let nodes = scan_directory(&root, &root).unwrap();
        assert_eq!(nodes.len(), 2);
        assert!(nodes[0].is_dir);
        assert_eq!(nodes[0].name, "folder-a");
        assert_eq!(nodes[1].name, "root-note.md");
        assert!(!nodes[1].is_dir);
    }

    #[test]
    fn test_create_folder_nested_and_idempotent() {
        let dir = tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();

        // Test creating deep nested directory
        let res = create_folder_impl(&root, "projects/janus/specs");
        assert!(res.is_ok());
        assert!(root.join("projects/janus/specs").is_dir());

        // Test idempotency: creating existing directory succeeds without error
        let res2 = create_folder_impl(&root, "projects/janus/specs");
        assert!(res2.is_ok());

        // Test empty folder path rejected
        let res_empty = create_folder_impl(&root, "   ");
        assert!(res_empty.is_err());
    }

    #[test]
    fn test_create_folder_rejects_traversal() {
        let dir = tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();

        let res = create_folder_impl(&root, "../escaped_dir");
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Path traversal"));
    }
}
