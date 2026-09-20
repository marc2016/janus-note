
pub mod vault;

use vault::VaultState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(VaultState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            vault::vault_get_current,
            vault::vault_set_folder,
            vault::vault_select_folder,
            vault::vault_read_file,
            vault::vault_write_file,
            vault::vault_create_folder,
            vault::vault_list_files,
            vault::vault_start_watcher
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
