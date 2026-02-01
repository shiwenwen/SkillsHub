//! SkillsHub Tauri Application

mod commands;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // Skill commands
            list_installed_skills,
            get_skill_info,
            install_skill,
            uninstall_skill,
            update_skill,
            check_skill_updates,
            // Sync commands
            sync_skills,
            check_drift,
            // Scan commands
            scan_skill,
            // Tool commands
            list_tools,
            detect_tools,
            // Custom tool commands
            list_custom_tools,
            add_custom_tool,
            update_custom_tool,
            remove_custom_tool,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
