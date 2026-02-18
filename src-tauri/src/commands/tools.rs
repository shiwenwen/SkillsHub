//! Tool detection and custom tool management commands

use std::path::PathBuf;

use skillshub_core::adapters::create_default_adapters;

use super::types::{CustomToolConfig, ToolInfo};

#[tauri::command]
pub async fn list_tools() -> Result<Vec<ToolInfo>, String> {
    let adapters = create_default_adapters();

    Ok(adapters
        .iter()
        .map(|adapter| {
            let detected = adapter.detect();
            let skills_dir = adapter.skills_dir().ok();

            let all_dirs = adapter.skills_dirs();
            let skills_dirs: Vec<String> =
                all_dirs.iter().map(|p| p.display().to_string()).collect();

            let mut skill_names = std::collections::HashSet::new();
            for dir in &all_dirs {
                if let Ok(entries) = std::fs::read_dir(dir) {
                    for entry in entries.filter_map(|e| e.ok()) {
                        if entry.path().is_dir() {
                            if let Some(name) = entry.path().file_name() {
                                skill_names.insert(name.to_string_lossy().to_string());
                            }
                        }
                    }
                }
            }

            ToolInfo {
                name: adapter.tool_type().display_name().to_string(),
                tool_type: format!("{:?}", adapter.tool_type()).to_lowercase(),
                detected,
                skills_dir: skills_dir.map(|p| p.display().to_string()),
                skills_dirs,
                skill_count: skill_names.len(),
            }
        })
        .collect())
}

#[tauri::command]
pub async fn detect_tools() -> Result<Vec<ToolInfo>, String> {
    list_tools().await
}

fn custom_tools_config_path() -> Result<PathBuf, String> {
    let data_dir = dirs::data_local_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join(".local").join("share")))
        .ok_or("Cannot determine data directory")?;
    Ok(data_dir.join("skillshub").join("custom_tools.json"))
}

fn load_custom_tools_from_file() -> Result<Vec<CustomToolConfig>, String> {
    let path = custom_tools_config_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read custom tools config: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse custom tools config: {}", e))
}

fn save_custom_tools_to_file(tools: &[CustomToolConfig]) -> Result<(), String> {
    let path = custom_tools_config_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    let content = serde_json::to_string_pretty(tools)
        .map_err(|e| format!("Failed to serialize custom tools: {}", e))?;
    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write custom tools config: {}", e))
}

#[tauri::command]
pub async fn list_custom_tools() -> Result<Vec<CustomToolConfig>, String> {
    load_custom_tools_from_file()
}

#[tauri::command]
pub async fn add_custom_tool(
    name: String,
    global_path: Option<String>,
    project_path: Option<String>,
) -> Result<CustomToolConfig, String> {
    let mut tools = load_custom_tools_from_file()?;

    let new_tool = CustomToolConfig {
        id: format!(
            "custom-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        ),
        name,
        global_path,
        project_path,
    };

    tools.push(new_tool.clone());
    save_custom_tools_to_file(&tools)?;

    Ok(new_tool)
}

#[tauri::command]
pub async fn update_custom_tool(
    id: String,
    name: String,
    global_path: Option<String>,
    project_path: Option<String>,
) -> Result<CustomToolConfig, String> {
    let mut tools = load_custom_tools_from_file()?;

    let tool = tools
        .iter_mut()
        .find(|t| t.id == id)
        .ok_or_else(|| format!("Custom tool with id '{}' not found", id))?;

    tool.name = name;
    tool.global_path = global_path;
    tool.project_path = project_path;

    let updated_tool = tool.clone();
    save_custom_tools_to_file(&tools)?;

    Ok(updated_tool)
}

#[tauri::command]
pub async fn remove_custom_tool(id: String) -> Result<(), String> {
    let mut tools = load_custom_tools_from_file()?;
    let original_len = tools.len();
    tools.retain(|t| t.id != id);

    if tools.len() == original_len {
        return Err(format!("Custom tool with id '{}' not found", id));
    }

    save_custom_tools_to_file(&tools)
}
