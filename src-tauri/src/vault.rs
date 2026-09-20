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

/// Checks if a relative path points to a protected system file that cannot be deleted or relocated.
pub fn is_protected_system_file(rel_path: &str) -> bool {
    let clean = rel_path.trim().trim_matches(['/', '\\']).replace('\\', "/");
    clean.eq_ignore_ascii_case("inbox.md")
}

/// Ensures the default Inbox.md exists at the Vault root.
pub fn ensure_inbox_initialized(vault_root: &Path) -> Result<(), String> {
    let inbox_path = vault_root.join("Inbox.md");
    if !inbox_path.exists() {
        let default_content = "# 📥 Inbox\n\nWelcome to your quick capture inbox. Jot down thoughts, tasks, and ideas freely here.\nUse the Triage button (or Cmd+Shift+T) to file notes into your vault.\n";
        write_file_impl(vault_root, "Inbox.md", default_content)?;
    }
    Ok(())
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
            let _ = ensure_inbox_initialized(&persisted);
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

    // Ensure default Inbox.md exists in vault root
    let _ = ensure_inbox_initialized(&canonical);

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

#[derive(Debug)]
struct PathMovePlan {
    source_abs: PathBuf,
    dest_abs: PathBuf,
    dest_rel: String,
}

pub fn move_paths_impl(
    vault_root: &Path,
    source_paths: &[String],
    destination_folder: &str,
) -> Result<Vec<String>, String> {
    if source_paths.is_empty() {
        return Ok(Vec::new());
    }

    let trimmed_dest = destination_folder.trim().trim_matches(['/', '\\']);
    let (dest_dir, dest_dir_rel) = if trimmed_dest.is_empty() || trimmed_dest == "." {
        (vault_root.to_path_buf(), "".to_string())
    } else {
        let resolved = validate_and_resolve_path(vault_root, trimmed_dest)?;
        if !resolved.exists() {
            return Err(format!("Destination folder does not exist: {}", trimmed_dest));
        }
        if !resolved.is_dir() {
            return Err(format!("Destination is not a directory: {}", trimmed_dest));
        }
        (resolved, trimmed_dest.replace('\\', "/"))
    };

    let canonical_dest_dir = dest_dir
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize destination folder: {}", e))?;

    let mut plans = Vec::new();
    let mut target_dest_paths = std::collections::HashSet::new();

    for source_rel in source_paths {
        let clean_source = source_rel.trim().trim_matches(['/', '\\']).replace('\\', "/");
        if clean_source.is_empty() {
            return Err("Source path cannot be empty".to_string());
        }

        if is_protected_system_file(&clean_source) {
            return Err("Protected System Error: 'Inbox.md' is a protected system document and cannot be moved or renamed".to_string());
        }

        let source_abs = validate_and_resolve_path(vault_root, &clean_source)?;
        if !source_abs.exists() {
            return Err(format!("Source path does not exist: {}", clean_source));
        }

        let file_name = source_abs
            .file_name()
            .ok_or_else(|| format!("Invalid source path: {}", clean_source))?
            .to_string_lossy()
            .to_string();

        let dest_abs = dest_dir.join(&file_name);

        // If source is already in the destination directory (same path), skip as no-op
        if source_abs == dest_abs {
            continue;
        }

        // Cycle check: If source is a directory, ensure destination is not inside source
        if source_abs.is_dir() {
            let canonical_source = source_abs
                .canonicalize()
                .map_err(|e| format!("Failed to canonicalize source path: {}", e))?;

            if canonical_dest_dir.starts_with(&canonical_source) {
                return Err(format!(
                    "Cannot move directory '{}' into itself or its subdirectory",
                    clean_source
                ));
            }
        }

        // Destination collision check on disk
        if dest_abs.exists() {
            return Err(format!(
                "An item named '{}' already exists in the destination folder",
                file_name
            ));
        }

        // Destination collision check within the same batch
        if !target_dest_paths.insert(dest_abs.clone()) {
            return Err(format!(
                "Multiple items in the batch resolve to the same destination name '{}'",
                file_name
            ));
        }

        let dest_rel = if dest_dir_rel.is_empty() {
            file_name
        } else {
            format!("{}/{}", dest_dir_rel, file_name)
        };

        plans.push(PathMovePlan {
            source_abs,
            dest_abs,
            dest_rel,
        });
    }

    // Execution phase (all validations passed)
    let mut moved_paths = Vec::new();
    for plan in plans {
        fs::rename(&plan.source_abs, &plan.dest_abs)
            .map_err(|e| format!("Failed to move {:?} to {:?}: {}", plan.source_abs, plan.dest_abs, e))?;
        moved_paths.push(plan.dest_rel);
    }

    Ok(moved_paths)
}

#[tauri::command]
pub fn vault_move_paths(
    source_paths: Vec<String>,
    destination_folder: String,
    state: State<'_, VaultState>,
) -> Result<Vec<String>, String> {
    let vault_root = {
        let lock = state.current_vault.lock().map_err(|e| e.to_string())?;
        lock.clone()
            .ok_or_else(|| "No active Vault selected".to_string())?
    };

    move_paths_impl(&vault_root, &source_paths, &destination_folder)
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

pub fn delete_item_impl(vault_root: &Path, rel_path: &str) -> Result<(), String> {
    let clean = rel_path.trim().trim_matches(['/', '\\']).replace('\\', "/");
    if clean.is_empty() {
        return Err("Path cannot be empty".to_string());
    }

    if is_protected_system_file(&clean) {
        return Err("Protected System Error: 'Inbox.md' is a protected system document and cannot be deleted".to_string());
    }

    let target = validate_and_resolve_path(vault_root, &clean)?;
    if !target.exists() {
        return Err(format!("Item not found: {}", clean));
    }

    if target.is_dir() {
        fs::remove_dir_all(&target)
            .map_err(|e| format!("Failed to delete directory {}: {}", clean, e))?;
    } else {
        fs::remove_file(&target)
            .map_err(|e| format!("Failed to delete file {}: {}", clean, e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn vault_delete_item(path: String, state: State<'_, VaultState>) -> Result<(), String> {
    let vault_root = {
        let lock = state.current_vault.lock().map_err(|e| e.to_string())?;
        lock.clone()
            .ok_or_else(|| "No active Vault selected".to_string())?
    };

    delete_item_impl(&vault_root, &path)
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

    #[test]
    fn test_move_paths_files_and_directories() {
        let dir = tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();

        fs::create_dir_all(root.join("folder-a")).unwrap();
        fs::create_dir_all(root.join("folder-b")).unwrap();
        fs::write(root.join("folder-a/doc.md"), "doc content").unwrap();

        // Move file into folder-b
        let moved = move_paths_impl(&root, &["folder-a/doc.md".to_string()], "folder-b").unwrap();
        assert_eq!(moved, vec!["folder-b/doc.md"]);
        assert!(!root.join("folder-a/doc.md").exists());
        assert!(root.join("folder-b/doc.md").exists());

        // Move file to vault root ("")
        let moved_root = move_paths_impl(&root, &["folder-b/doc.md".to_string()], "").unwrap();
        assert_eq!(moved_root, vec!["doc.md"]);
        assert!(root.join("doc.md").exists());
        assert!(!root.join("folder-b/doc.md").exists());

        // Move entire folder-a into folder-b
        let moved_dir = move_paths_impl(&root, &["folder-a".to_string()], "folder-b").unwrap();
        assert_eq!(moved_dir, vec!["folder-b/folder-a"]);
        assert!(root.join("folder-b/folder-a").is_dir());
        assert!(!root.join("folder-a").exists());
    }

    #[test]
    fn test_move_paths_batch_multiple_items() {
        let dir = tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();

        fs::create_dir_all(root.join("archive")).unwrap();
        fs::write(root.join("note1.md"), "1").unwrap();
        fs::write(root.join("note2.md"), "2").unwrap();

        let sources = vec!["note1.md".to_string(), "note2.md".to_string()];
        let moved = move_paths_impl(&root, &sources, "archive").unwrap();
        assert_eq!(moved.len(), 2);
        assert!(root.join("archive/note1.md").exists());
        assert!(root.join("archive/note2.md").exists());
        assert!(!root.join("note1.md").exists());
        assert!(!root.join("note2.md").exists());
    }

    #[test]
    fn test_move_paths_cycle_rejection() {
        let dir = tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();

        fs::create_dir_all(root.join("parent/child/grandchild")).unwrap();

        // Move folder into itself
        let res_self = move_paths_impl(&root, &["parent".to_string()], "parent");
        assert!(res_self.is_err());
        assert!(res_self.unwrap_err().contains("Cannot move directory"));

        // Move folder into its own child
        let res_child = move_paths_impl(&root, &["parent".to_string()], "parent/child");
        assert!(res_child.is_err());
        assert!(res_child.unwrap_err().contains("Cannot move directory"));

        // Move folder into its own grandchild
        let res_grandchild = move_paths_impl(&root, &["parent".to_string()], "parent/child/grandchild");
        assert!(res_grandchild.is_err());
        assert!(res_grandchild.unwrap_err().contains("Cannot move directory"));
    }

    #[test]
    fn test_move_paths_collision_rejection() {
        let dir = tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();

        fs::create_dir_all(root.join("dest")).unwrap();
        fs::write(root.join("dest/file.md"), "existing").unwrap();
        fs::write(root.join("file.md"), "source").unwrap();

        let res = move_paths_impl(&root, &["file.md".to_string()], "dest");
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("already exists"));

        // Destination unchanged
        assert_eq!(fs::read_to_string(root.join("dest/file.md")).unwrap(), "existing");
        assert_eq!(fs::read_to_string(root.join("file.md")).unwrap(), "source");
    }

    #[test]
    fn test_move_paths_traversal_rejection() {
        let dir = tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();

        let res = move_paths_impl(&root, &["../outside.md".to_string()], "");
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Path traversal"));
    }

    #[test]
    fn test_move_paths_same_folder_noop() {
        let dir = tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();

        fs::create_dir_all(root.join("folder")).unwrap();
        fs::write(root.join("folder/note.md"), "content").unwrap();

        let moved = move_paths_impl(&root, &["folder/note.md".to_string()], "folder").unwrap();
        assert!(moved.is_empty());
        assert!(root.join("folder/note.md").exists());
    }

    #[test]
    fn test_ensure_inbox_initialized() {
        let dir = tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();

        assert!(!root.join("Inbox.md").exists());
        ensure_inbox_initialized(&root).unwrap();
        assert!(root.join("Inbox.md").exists());

        let content = fs::read_to_string(root.join("Inbox.md")).unwrap();
        assert!(content.contains("# 📥 Inbox"));

        // Second call should not overwrite existing content
        fs::write(root.join("Inbox.md"), "custom content").unwrap();
        ensure_inbox_initialized(&root).unwrap();
        let content_after = fs::read_to_string(root.join("Inbox.md")).unwrap();
        assert_eq!(content_after, "custom content");
    }

    #[test]
    fn test_inbox_protected_against_delete() {
        let dir = tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();

        ensure_inbox_initialized(&root).unwrap();
        assert!(root.join("Inbox.md").exists());

        let res = delete_item_impl(&root, "Inbox.md");
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("protected system document"));
        assert!(root.join("Inbox.md").exists());

        // Also case-insensitive check
        let res2 = delete_item_impl(&root, "inbox.md");
        assert!(res2.is_err());
        assert!(res2.unwrap_err().contains("protected system document"));
        assert!(root.join("Inbox.md").exists());
    }

    #[test]
    fn test_inbox_protected_against_move() {
        let dir = tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();

        ensure_inbox_initialized(&root).unwrap();
        fs::create_dir_all(root.join("archive")).unwrap();

        let res = move_paths_impl(&root, &["Inbox.md".to_string()], "archive");
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("protected system document"));
        assert!(root.join("Inbox.md").exists());
        assert!(!root.join("archive/Inbox.md").exists());
    }

    #[test]
    fn test_delete_normal_file_and_dir() {
        let dir = tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();

        fs::write(root.join("temp.md"), "temporary").unwrap();
        assert!(root.join("temp.md").exists());
        delete_item_impl(&root, "temp.md").unwrap();
        assert!(!root.join("temp.md").exists());

        fs::create_dir_all(root.join("temp_dir/nested")).unwrap();
        assert!(root.join("temp_dir").exists());
        delete_item_impl(&root, "temp_dir").unwrap();
        assert!(!root.join("temp_dir").exists());
    }
}
