// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Emitter, Manager};
use tauri::menu::{Menu, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use serde::{Deserialize, Serialize};
use std::env;
use std::path::PathBuf;
use std::fs;

#[derive(Debug, Serialize, Deserialize)]
struct HC3Config {
    host: String,
    user: String,
    password: String,
    protocol: String,
}

#[tauri::command]
fn get_hc3_config() -> Result<HC3Config, String> {
    // Try to load from .env file in the app's directory
    if let Ok(exe_path) = env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let env_path = exe_dir.join(".env");
            if env_path.exists() {
                println!("Loaded .env from: {:?}", env_path);
                let _ = dotenvy::from_path(&env_path);
            }
        }
    }
    
    // Also try home directory
    if let Some(home_dir) = dirs::home_dir() {
        let home_env = home_dir.join(".env");
        println!("Trying to load .env from home: {:?}", home_env);
        if home_env.exists() {
            let _ = dotenvy::from_path(&home_env);
            println!("Successfully loaded .env from home directory");
        }
    }
    
    let host = env::var("HC3_HOST").unwrap_or_else(|_| "192.168.1.1".to_string());
    let user = env::var("HC3_USER").unwrap_or_else(|_| "admin".to_string());
    let password = env::var("HC3_PASSWORD").unwrap_or_else(|_| "admin".to_string());
    let protocol = env::var("HC3_PROTOCOL").unwrap_or_else(|_| "http".to_string());
    
    println!("Reading HC3 config:");
    println!("  HC3_HOST: {}", if env::var("HC3_HOST").is_ok() { "set" } else { "NOT SET" });
    println!("  HC3_USER: {}", if env::var("HC3_USER").is_ok() { "set" } else { "NOT SET" });
    println!("  HC3_PASSWORD: {}", if env::var("HC3_PASSWORD").is_ok() { "set" } else { "NOT SET" });
    println!("  HC3_PROTOCOL: {}", if env::var("HC3_PROTOCOL").is_ok() { "set" } else { "NOT SET" });
    
    Ok(HC3Config {
        host,
        user,
        password,
        protocol,
    })
}

fn get_homemap_data_path() -> Result<PathBuf, String> {
    // First check for HC3_HOMEMAP environment variable
    if let Ok(path) = env::var("HC3_HOMEMAP") {
        let path_buf = PathBuf::from(path);
        if path_buf.exists() {
            println!("Using HC3_HOMEMAP: {:?}", path_buf);
            return Ok(path_buf);
        }
    }
    
    // Try executable directory first
    if let Ok(exe_path) = env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let homemap_path = exe_dir.join("homemapdata");
            if homemap_path.exists() {
                println!("Using homemapdata from exe dir: {:?}", homemap_path);
                return Ok(homemap_path);
            }
            
            // Go up directories to find project root (for dev mode)
            let mut current = exe_dir;
            for _ in 0..5 {
                if let Some(parent) = current.parent() {
                    let homemap_path = parent.join("homemapdata");
                    if homemap_path.exists() {
                        println!("Using homemapdata from parent: {:?}", homemap_path);
                        return Ok(homemap_path);
                    }
                    current = parent;
                } else {
                    break;
                }
            }
        }
    }
    
    // Try current working directory
    if let Ok(current_dir) = env::current_dir() {
        let homemap_path = current_dir.join("homemapdata");
        if homemap_path.exists() {
            println!("Using homemapdata from cwd: {:?}", homemap_path);
            return Ok(homemap_path);
        }
    }
    
    Err("Could not find homemapdata folder. Set HC3_HOMEMAP environment variable or create homemapdata folder in project root.".to_string())
}

#[tauri::command]
fn get_homemap_config() -> Result<serde_json::Value, String> {
    let data_path = get_homemap_data_path()?;
    let config_file = data_path.join("config.json");
    
    if !config_file.exists() {
        return Err(format!("Config file not found at: {:?}", config_file));
    }
    
    let content = fs::read_to_string(&config_file)
        .map_err(|e| format!("Failed to read config file: {}", e))?;
    
    let config: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config JSON: {}", e))?;
    
    Ok(config)
}

#[tauri::command]
fn get_data_path() -> Result<String, String> {
    get_homemap_data_path()
        .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn read_image_as_base64(image_path: String) -> Result<String, String> {
    let full_path = PathBuf::from(&image_path);
    
    if !full_path.exists() {
        return Err(format!("Image not found: {:?}", full_path));
    }
    
    let data = fs::read(&full_path)
        .map_err(|e| format!("Failed to read image: {}", e))?;
    
    // Detect image type from extension
    let extension = full_path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase();
    
    let mime_type = match extension.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        _ => "image/jpeg"
    };
    
    let base64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &data);
    Ok(format!("data:{};base64,{}", mime_type, base64))
}

#[tauri::command]
fn read_widget_json(widget_type: String) -> Result<String, String> {
    let homemap_path = get_homemap_data_path()?;
    let widget_path = homemap_path.join("widgets").join(format!("{}.json", widget_type));
    
    let content = fs::read_to_string(&widget_path)
        .map_err(|e| format!("Failed to read widget file: {}", e))?;
    
    Ok(content)
}

#[tauri::command]
fn save_config(config_json: String) -> Result<(), String> {
    let homemap_path = get_homemap_data_path()?;
    let config_path = homemap_path.join("config.json");
    
    fs::write(&config_path, config_json)
        .map_err(|e| format!("Failed to write config file: {}", e))?;
    
    println!("Saved config to: {:?}", config_path);
    Ok(())
}

fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> Result<(), String> {
    if !dst.exists() {
        fs::create_dir_all(dst)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    let entries = fs::read_dir(src)
        .map_err(|e| format!("Failed to read directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let src_path = entry.path();
        let file_name = entry.file_name();
        let dst_path = dst.join(&file_name);
        
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("Failed to copy file: {}", e))?;
        }
    }
    
    Ok(())
}

#[tauri::command]
fn create_config_folder(app: tauri::AppHandle, destination_path: String) -> Result<String, String> {
    let dest = PathBuf::from(&destination_path);
    let homemapdata_dest = dest.join("homemapdata");
    
    // Check if homemapdata already exists
    if homemapdata_dest.exists() {
        return Err("A 'homemapdata' folder already exists at this location.".to_string());
    }
    
    // Find the template (homemapdata.example)
    // First try to resolve from bundled resources (production)
    let template_path = if let Some(resource_path) = app.path().resource_dir().ok() {
        let template = resource_path.join("homemapdata.example");
        println!("Checking bundled resource: {:?}", template);
        if template.exists() {
            println!("Found template in bundled resources");
            template
        } else {
            // Fallback to development mode - look in parent directories
            println!("Template not in bundled resources, checking parent dirs");
            if let Ok(exe_path) = env::current_exe() {
                if let Some(exe_dir) = exe_path.parent() {
                    let mut current = exe_dir;
                    let mut found = None;
                    for _ in 0..5 {
                        if let Some(parent) = current.parent() {
                            let template = parent.join("homemapdata.example");
                            if template.exists() {
                                println!("Found template in parent: {:?}", template);
                                found = Some(template);
                                break;
                            }
                            current = parent;
                        }
                    }
                    found.ok_or("Could not find homemapdata.example template")?
                } else {
                    return Err("Could not determine executable directory".to_string());
                }
            } else {
                return Err("Could not determine executable path".to_string());
            }
        }
    } else {
        return Err("Could not access resource directory".to_string());
    };
    
    println!("Copying template from: {:?}", template_path);
    println!("Copying template to: {:?}", homemapdata_dest);
    
    // Copy the template
    copy_dir_recursive(&template_path, &homemapdata_dest)?;
    
    Ok(homemapdata_dest.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![get_hc3_config, get_homemap_config, get_data_path, read_image_as_base64, read_widget_json, save_config, create_config_folder])
        .setup(|app| {
            // Create menu items
            let toggle_devtools = MenuItemBuilder::with_id("toggle_devtools", "Toggle DevTools")
                .accelerator("CmdOrCtrl+Shift+I")
                .build(app)?;
            
            let check_updates = MenuItemBuilder::with_id("check-for-updates", "Check for Updates...")
                .build(app)?;
            
            let create_config = MenuItemBuilder::with_id("create-config", "Create Configuration...")
                .build(app)?;
            
            // Create app menu (first menu on macOS)
            let app_menu = SubmenuBuilder::new(app, "HomeMap")
                .item(&PredefinedMenuItem::about(app, None, None)?)
                .item(&check_updates)
                .item(&create_config)
                .separator()
                .item(&PredefinedMenuItem::services(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::hide(app, None)?)
                .item(&PredefinedMenuItem::hide_others(app, None)?)
                .item(&PredefinedMenuItem::show_all(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::quit(app, None)?)
                .build()?;
            
            let view_menu = SubmenuBuilder::new(app, "View")
                .item(&toggle_devtools)
                .build()?;
            
            let menu = Menu::new(app)?;
            menu.append(&app_menu)?;
            menu.append(&view_menu)?;
            
            app.set_menu(menu)?;
            
            // Handle menu events
            app.on_menu_event(move |app, event| {
                println!("Menu event triggered: {:?}", event.id());
                if event.id() == "toggle_devtools" {
                    println!("Toggle devtools event received");
                    if let Some(window) = app.get_webview_window("main") {
                        println!("Got window 'main'");
                        if window.is_devtools_open() {
                            println!("Closing devtools");
                            window.close_devtools();
                        } else {
                            println!("Opening devtools");
                            window.open_devtools();
                        }
                    } else {
                        println!("Could not find window 'main'");
                    }
                } else if event.id() == "check-for-updates" {
                    println!("Check for updates event received");
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("check-for-updates", ());
                    }
                } else if event.id() == "create-config" {
                    println!("Create configuration event received");
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("create-config", ());
                    }
                }
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
