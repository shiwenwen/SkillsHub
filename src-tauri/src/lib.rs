//! SkillsHub Tauri Application

mod commands;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            // Skill commands
            list_installed_skills,
            get_skill_info,
            get_skill_detail,
            install_skill,
            uninstall_skill,
            update_skill,
            check_skill_updates,
            // Sync commands
            sync_skills,
            sync_single_skill,
            toggle_skill_tool_sync,
            check_drift,
            // Scan commands
            scan_skill,
            list_security_rules,
            // Tool commands
            list_tools,
            detect_tools,
            // Custom tool commands
            list_custom_tools,
            add_custom_tool,
            update_custom_tool,
            remove_custom_tool,
            get_security_scan_records,
            save_security_scan_records,
            // Registry commands
            search_skills,
            list_registries,
            add_registry,
            remove_registry,
            // Plugin commands
            scan_claude_plugins,
            list_claude_marketplaces,
            sync_plugin_skill,
            // Hub sync commands
            scan_all_skills,
            full_sync_skills,
            get_hub_status,
            // Config commands
            get_app_config,
            save_app_config,
            // Store info commands
            get_store_info,
            // Cloud sync commands
            detect_cloud_drives,
            cloud_sync_push,
            cloud_sync_pull,
            cloud_sync_full,
            // Utility commands
            open_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
