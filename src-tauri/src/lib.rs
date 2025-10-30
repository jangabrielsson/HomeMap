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
    // First priority: Try to load from settings.json
    if let Ok(Some(settings)) = load_app_settings() {
        if !settings.hc3_host.is_empty() {
            println!("Using HC3 config from settings.json");
            return Ok(HC3Config {
                host: settings.hc3_host,
                user: settings.hc3_user,
                password: settings.hc3_password,
                protocol: settings.hc3_protocol,
            });
        }
    }
    
    // Second priority: Try to load from .env file in the app's directory
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
fn read_file_as_text(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file {}: {}", file_path, e))
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
fn list_directory(path: String) -> Result<Vec<String>, String> {
    let path_buf = PathBuf::from(&path);
    
    // Security check: ensure path is within homemap data directory
    let homemap_path = get_homemap_data_path()?;
    if !path_buf.starts_with(&homemap_path) {
        return Err("Access denied: path must be within homemap data directory".to_string());
    }
    
    let entries = fs::read_dir(&path_buf)
        .map_err(|e| format!("Failed to read directory: {}", e))?;
    
    let mut files = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let file_name = entry.file_name();
        if let Some(name) = file_name.to_str() {
            // Only include files (not directories)
            if entry.path().is_file() {
                files.push(name.to_string());
            }
        }
    }
    
    Ok(files)
}

#[tauri::command]
fn save_config(file_path: String, content: String) -> Result<(), String> {
    // Validate path is within homemap data directory
    let homemap_path = get_homemap_data_path()?;
    let target_path = PathBuf::from(&file_path);
    
    // Ensure the path is within homemap data directory
    if !target_path.starts_with(&homemap_path) {
        return Err("Access denied: path must be within homemap data directory".to_string());
    }
    
    // Create parent directories if needed
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directories: {}", e))?;
    }
    
    fs::write(&target_path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    println!("Saved file to: {:?}", target_path);
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
        // Try direct path first (if we change tauri.conf.json later)
        let template = resource_path.join("homemapdata.example");
        
        if template.exists() {
            template
        } else {
            // Try _up_ folder (current structure with ../homemapdata.example in config)
            let template = resource_path.join("_up_").join("homemapdata.example");
            
            if template.exists() {
                template
            } else {
                // Fallback to development mode - look in parent directories
                if let Ok(exe_path) = env::current_exe() {
                    if let Some(exe_dir) = exe_path.parent() {
                        let mut current = exe_dir;
                        let mut found = None;
                        for _ in 0..5 {
                            if let Some(parent) = current.parent() {
                                let template = parent.join("homemapdata.example");
                                if template.exists() {
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
        }
    } else {
        return Err("Could not access resource directory".to_string());
    };
    
    println!("Copying template from: {:?}", template_path);
    println!("Copying template to: {:?}", homemapdata_dest);
    
    // Copy the template
    copy_dir_recursive(&template_path, &homemapdata_dest)?;
    
    // Create package directory structure
    let widgets_builtin = homemapdata_dest.join("widgets").join("built-in");
    let widgets_packages = homemapdata_dest.join("widgets").join("packages");
    let icons_builtin = homemapdata_dest.join("icons").join("built-in");
    let icons_packages = homemapdata_dest.join("icons").join("packages");
    
    fs::create_dir_all(&widgets_builtin)
        .map_err(|e| format!("Failed to create widgets/built-in: {}", e))?;
    fs::create_dir_all(&widgets_packages)
        .map_err(|e| format!("Failed to create widgets/packages: {}", e))?;
    fs::create_dir_all(&icons_builtin)
        .map_err(|e| format!("Failed to create icons/built-in: {}", e))?;
    fs::create_dir_all(&icons_packages)
        .map_err(|e| format!("Failed to create icons/packages: {}", e))?;
    
    // Move existing widgets to built-in (if any)
    let widgets_dir = homemapdata_dest.join("widgets");
    if let Ok(entries) = fs::read_dir(&widgets_dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                let file_name = entry.file_name();
                
                // Skip the built-in and packages directories we just created
                if file_name == "built-in" || file_name == "packages" {
                    continue;
                }
                
                // Move JSON files to built-in
                if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                    let dest = widgets_builtin.join(&file_name);
                    fs::rename(&path, &dest)
                        .map_err(|e| format!("Failed to move widget to built-in: {}", e))?;
                }
            }
        }
    }
    
    // Move existing icon sets to built-in (if any)
    let icons_dir = homemapdata_dest.join("icons");
    if let Ok(entries) = fs::read_dir(&icons_dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                let file_name = entry.file_name();
                
                // Skip the built-in and packages directories we just created
                if file_name == "built-in" || file_name == "packages" {
                    continue;
                }
                
                // Move directories to built-in
                if path.is_dir() {
                    let dest = icons_builtin.join(&file_name);
                    fs::rename(&path, &dest)
                        .map_err(|e| format!("Failed to move icon set to built-in: {}", e))?;
                }
            }
        }
    }
    
    // Create temp directory for package installation
    let temp_dir = homemapdata_dest.join("temp");
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    
    println!("Package directory structure created successfully");
    
    Ok(homemapdata_dest.to_string_lossy().to_string())
}

#[derive(Debug, Serialize, Deserialize)]
struct AppSettings {
    hc3_host: String,
    hc3_user: String,
    hc3_password: String,
    hc3_protocol: String,
    homemap_path: String,
}

#[tauri::command]
fn get_app_settings() -> Result<AppSettings, String> {
    // Load from environment variables or .env file
    if let Some(home_dir) = dirs::home_dir() {
        let home_env = home_dir.join(".env");
        if home_env.exists() {
            let _ = dotenvy::from_path(&home_env);
        }
    }
    
    let settings = AppSettings {
        hc3_host: env::var("HC3_HOST").unwrap_or_default(),
        hc3_user: env::var("HC3_USER").unwrap_or_default(),
        hc3_password: env::var("HC3_PASSWORD").unwrap_or_default(),
        hc3_protocol: env::var("HC3_PROTOCOL").unwrap_or_else(|_| "http".to_string()),
        homemap_path: env::var("HC3_HOMEMAP").unwrap_or_default(),
    };
    
    Ok(settings)
}

#[tauri::command]
fn save_app_settings(settings: AppSettings) -> Result<(), String> {
    // Save to app config directory
    let config_dir = dirs::config_dir()
        .ok_or("Could not find config directory")?
        .join("HomeMap");
    
    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config directory: {}", e))?;
    
    let config_file = config_dir.join("settings.json");
    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    
    fs::write(&config_file, json)
        .map_err(|e| format!("Failed to write settings file: {}", e))?;
    
    println!("Settings saved to: {:?}", config_file);
    Ok(())
}

#[tauri::command]
async fn select_homemap_folder<R: tauri::Runtime>(_app: tauri::AppHandle<R>) -> Result<Option<String>, String> {
    let folder = tauri::async_runtime::spawn(async move {
        rfd::AsyncFileDialog::new()
            .set_title("Select HomeMap Data Folder")
            .pick_folder()
            .await
    })
    .await
    .map_err(|e| format!("Failed to show dialog: {}", e))?;
    
    Ok(folder.map(|p| p.path().to_string_lossy().to_string()))
}

#[tauri::command]
fn load_app_settings() -> Result<Option<AppSettings>, String> {
    let config_dir = dirs::config_dir()
        .ok_or("Could not find config directory")?
        .join("HomeMap");
    
    let config_file = config_dir.join("settings.json");
    
    if !config_file.exists() {
        return Ok(None);
    }
    
    let json = fs::read_to_string(&config_file)
        .map_err(|e| format!("Failed to read settings file: {}", e))?;
    
    let settings: AppSettings = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse settings: {}", e))?;
    
    Ok(Some(settings))
}

// Package management structures
#[derive(Debug, Serialize, Deserialize)]
struct PackageManifest {
    id: String,
    name: String,
    version: String,
    author: String,
    description: String,
    requires: PackageRequires,
    provides: PackageProvides,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    homepage: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    license: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    device_types: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct PackageRequires {
    #[serde(rename = "homeMapVersion")]
    home_map_version: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct PackageProvides {
    widgets: Vec<String>,
    #[serde(rename = "iconSets")]
    icon_sets: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ExtractedPackage {
    manifest: PackageManifest,
    #[serde(rename = "tempDir")]
    temp_dir: String,
}

#[tauri::command]
fn extract_widget_package(hwp_path: String, data_path: String) -> Result<ExtractedPackage, String> {
    use zip::ZipArchive;
    
    println!("Extracting package from: {}", hwp_path);
    
    // Open the ZIP file
    let file = fs::File::open(&hwp_path)
        .map_err(|e| format!("Failed to open package file: {}", e))?;
    
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Failed to read ZIP archive: {}", e))?;
    
    // Create temporary directory within the data path
    let temp_dir = PathBuf::from(&data_path).join("temp").join(format!("package_{}", 
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    ));
    
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    
    println!("Extracting to temp dir: {:?}", temp_dir);
    
    // Extract all files
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read file from archive: {}", e))?;
        
        let outpath = match file.enclosed_name() {
            Some(path) => temp_dir.join(path),
            None => continue,
        };
        
        if file.name().ends_with('/') {
            // Directory
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        } else {
            // File
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p)
                        .map_err(|e| format!("Failed to create parent directory: {}", e))?;
                }
            }
            
            let mut outfile = fs::File::create(&outpath)
                .map_err(|e| format!("Failed to create file: {}", e))?;
            
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to extract file: {}", e))?;
        }
    }
    
    // Read and parse manifest
    let manifest_path = temp_dir.join("manifest.json");
    if !manifest_path.exists() {
        return Err("Package is missing manifest.json file".to_string());
    }
    
    let manifest_content = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read manifest: {}", e))?;
    
    let manifest: PackageManifest = serde_json::from_str(&manifest_content)
        .map_err(|e| format!("Failed to parse manifest: {}", e))?;
    
    println!("Package extracted: {} v{}", manifest.name, manifest.version);
    
    Ok(ExtractedPackage {
        manifest,
        temp_dir: temp_dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn copy_file(src: String, dst: String) -> Result<(), String> {
    std::fs::copy(&src, &dst)
        .map_err(|e| format!("Failed to copy file from {} to {}: {}", src, dst, e))?;
    Ok(())
}

#[tauri::command]
fn create_dir(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path)
        .map_err(|e| format!("Failed to create directory {}: {}", path, e))?;
    Ok(())
}

#[tauri::command]
fn path_exists(path: String) -> Result<bool, String> {
    Ok(std::path::Path::new(&path).exists())
}

#[tauri::command]
fn is_directory(path: String) -> Result<bool, String> {
    Ok(std::path::Path::new(&path).is_dir())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_hc3_config, 
            get_homemap_config, 
            get_data_path, 
            read_image_as_base64,
            read_file_as_text,
            read_widget_json,
            list_directory,
            save_config, 
            create_config_folder,
            get_app_settings,
            save_app_settings,
            select_homemap_folder,
            load_app_settings,
            extract_widget_package,
            copy_file,
            create_dir,
            path_exists,
            is_directory
        ])
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
