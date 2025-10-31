// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Emitter, Manager};
use tauri::menu::{Menu, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use serde::{Deserialize, Serialize};
use std::env;
use std::path::PathBuf;
use std::fs;
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
struct HttpFetchResponse {
    ok: bool,
    status: u16,
    body: String,
}

#[tauri::command]
async fn http_fetch_insecure(
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: Option<String>,
) -> Result<HttpFetchResponse, String> {
    // Create HTTP client that accepts invalid certificates
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    // Build request
    let mut request = match method.to_uppercase().as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        _ => return Err(format!("Unsupported HTTP method: {}", method)),
    };
    
    // Add headers
    for (key, value) in headers {
        request = request.header(key, value);
    }
    
    // Add body if provided
    if let Some(body_data) = body {
        request = request.body(body_data);
    }
    
    // Send request
    let response = request.send().await
        .map_err(|e| format!("HTTP request failed: {}", e))?;
    
    let status = response.status().as_u16();
    let ok = response.status().is_success();
    let body = response.text().await
        .map_err(|e| format!("Failed to read response body: {}", e))?;
    
    Ok(HttpFetchResponse {
        ok,
        status,
        body,
    })
}

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
    // First, try to load from saved settings
    if let Ok(Some(settings)) = load_app_settings() {
        if !settings.homemap_path.is_empty() {
            let path_buf = PathBuf::from(&settings.homemap_path);
            if path_buf.exists() {
                println!("Using homemap_path from settings: {:?}", path_buf);
                // Always sync built-in resources on startup
                sync_builtin_resources(&path_buf)?;
                return Ok(path_buf);
            } else {
                println!("Warning: Configured homemap_path does not exist: {:?}", path_buf);
            }
        }
    }
    
    // Create default location in app data directory
    let data_dir = dirs::data_dir()
        .ok_or("Could not find data directory")?
        .join("HomeMap")
        .join("homemapdata");
    
    // Create the directory if it doesn't exist
    if !data_dir.exists() {
        println!("Creating default homemapdata directory: {:?}", data_dir);
        fs::create_dir_all(&data_dir)
            .map_err(|e| format!("Failed to create homemapdata directory: {}", e))?;
        
        // Create default config.json
        initialize_default_config(&data_dir)?;
    } else {
        // Directory exists, just sync built-in resources
        sync_builtin_resources(&data_dir)?;
    }
    
    println!("Using default homemapdata: {:?}", data_dir);
    Ok(data_dir)
}

fn initialize_default_config(data_dir: &PathBuf) -> Result<(), String> {
    let config_file = data_dir.join("config.json");
    let is_new_install = !config_file.exists();
    
    if is_new_install {
        println!("Initializing homemapdata folder from template...");
        
        // Try to find homemapdata.example in project directory (dev mode) or app resources
        match find_template_directory() {
            Ok(template_dir) => {
                // Copy template contents to data directory
                copy_dir_recursive(&template_dir, data_dir)
                    .map_err(|e| format!("Failed to copy template: {}", e))?;
                
                println!("Successfully initialized homemapdata from template");
            }
            Err(e) => {
                println!("Warning: Could not find template directory: {}", e);
                println!("Creating minimal config.json...");
                
                // Create a minimal config.json if template not found
                let minimal_config = serde_json::json!({
                    "name": "HomeMap",
                    "icon": "🏠",
                    "floors": [],
                    "devices": []
                });
                
                fs::write(&config_file, serde_json::to_string_pretty(&minimal_config).unwrap())
                    .map_err(|e| format!("Failed to create minimal config.json: {}", e))?;
                
                // Create directory structure
                fs::create_dir_all(data_dir.join("widgets").join("built-in"))
                    .map_err(|e| format!("Failed to create widgets directory: {}", e))?;
                fs::create_dir_all(data_dir.join("widgets").join("packages"))
                    .map_err(|e| format!("Failed to create widgets/packages directory: {}", e))?;
                fs::create_dir_all(data_dir.join("icons").join("built-in"))
                    .map_err(|e| format!("Failed to create icons directory: {}", e))?;
                fs::create_dir_all(data_dir.join("icons").join("packages"))
                    .map_err(|e| format!("Failed to create icons/packages directory: {}", e))?;
                
                println!("Created minimal homemapdata structure");
            }
        }
        
        // Create installed-packages.json and widget-mappings.json
        let packages_file = data_dir.join("installed-packages.json");
        if !packages_file.exists() {
            let default_packages = serde_json::json!({
                "version": "1.0",
                "packages": {}
            });
            fs::write(&packages_file, serde_json::to_string_pretty(&default_packages).unwrap())
                .map_err(|e| format!("Failed to create installed-packages.json: {}", e))?;
        }
        
        let mappings_file = data_dir.join("widget-mappings.json");
        if !mappings_file.exists() {
            let default_mappings = serde_json::json!({
                "version": "1.0",
                "mappings": {},
                "defaults": {}
            });
            fs::write(&mappings_file, serde_json::to_string_pretty(&default_mappings).unwrap())
                .map_err(|e| format!("Failed to create widget-mappings.json: {}", e))?;
        }
    }
    
    // Try to sync built-in widgets and icons from template (on every startup)
    // If template not found, just skip the sync
    if let Ok(template_dir) = find_template_directory() {
        sync_builtin_resources_from_template(&template_dir, data_dir)?;
    } else {
        println!("Skipping built-in resource sync - template not found");
    }
    
    Ok(())
}

fn sync_builtin_resources(data_dir: &PathBuf) -> Result<(), String> {
    if let Ok(template_dir) = find_template_directory() {
        sync_builtin_resources_from_template(&template_dir, data_dir)?;
    } else {
        println!("Skipping built-in resource sync - template not found");
    }
    Ok(())
}

fn sync_builtin_resources_from_template(template_dir: &PathBuf, data_dir: &PathBuf) -> Result<(), String> {
    
    // Skip sync if data_dir is the same as template_dir parent (dev mode)
    // In dev mode, data_dir would be something like /path/to/project/homemapdata
    // and template_dir would be /path/to/project/homemapdata.example
    if let Some(template_parent) = template_dir.parent() {
        if let Some(data_parent) = data_dir.parent() {
            if template_parent == data_parent {
                // We're in the same directory as the template (dev mode)
                // Check if data_dir name is "homemapdata" (the dev folder)
                if let Some(dir_name) = data_dir.file_name() {
                    if dir_name == "homemapdata" {
                        println!("Dev mode - skipping folder sync");
                        return Ok(());
                    }
                }
            }
        }
    }
    
    println!("Syncing built-in widgets and icons...");
    
    // Copy config.json if it doesn't exist (don't overwrite user's config)
    let template_config = template_dir.join("config.json");
    let user_config = data_dir.join("config.json");
    
    if template_config.exists() && !user_config.exists() {
        fs::copy(&template_config, &user_config)
            .map_err(|e| format!("Failed to copy config.json: {}", e))?;
        println!("Copied config.json from template");
    }
    
    // Copy images folder if it doesn't exist (example floor plans)
    let template_images = template_dir.join("images");
    let user_images = data_dir.join("images");
    
    if template_images.exists() && !user_images.exists() {
        copy_dir_recursive(&template_images, &user_images)
            .map_err(|e| format!("Failed to copy images: {}", e))?;
        println!("Copied images folder from template");
    }
    
    // Sync widgets/built-in
    let template_widgets = template_dir.join("widgets").join("built-in");
    let user_widgets = data_dir.join("widgets").join("built-in");
    
    if template_widgets.exists() {
        // Remove old built-ins and replace with new ones
        if user_widgets.exists() {
            fs::remove_dir_all(&user_widgets)
                .map_err(|e| format!("Failed to remove old built-in widgets: {}", e))?;
        }
        
        // Create parent directory if needed
        if let Some(parent) = user_widgets.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create widgets directory: {}", e))?;
        }
        
        copy_dir_recursive(&template_widgets, &user_widgets)
            .map_err(|e| format!("Failed to sync built-in widgets: {}", e))?;
        
        println!("Synced built-in widgets");
    }
    
    // Sync icons/built-in
    let template_icons = template_dir.join("icons").join("built-in");
    let user_icons = data_dir.join("icons").join("built-in");
    
    if template_icons.exists() {
        // Remove old built-ins and replace with new ones
        if user_icons.exists() {
            fs::remove_dir_all(&user_icons)
                .map_err(|e| format!("Failed to remove old built-in icons: {}", e))?;
        }
        
        // Create parent directory if needed
        if let Some(parent) = user_icons.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create icons directory: {}", e))?;
        }
        
        copy_dir_recursive(&template_icons, &user_icons)
            .map_err(|e| format!("Failed to sync built-in icons: {}", e))?;
        
        println!("Synced built-in icons");
    }
    
    Ok(())
}

fn find_template_directory() -> Result<PathBuf, String> {
    println!("Searching for homemapdata.example template...");
    
    // First try exe directory (for built app)
    if let Ok(exe_path) = env::current_exe() {
        println!("Executable path: {:?}", exe_path);
        
        if let Some(exe_dir) = exe_path.parent() {
            // Try next to executable (Windows typically)
            let template = exe_dir.join("homemapdata.example");
            println!("Checking: {:?}", template);
            if template.exists() {
                println!("Found template at: {:?}", template);
                return Ok(template);
            }
            
            // Try _up_ directory next to exe (Windows with Tauri bundling)
            let up_dir = exe_dir.join("_up_").join("homemapdata.example");
            println!("Checking _up_ next to exe: {:?}", up_dir);
            if up_dir.exists() {
                println!("Found template in _up_: {:?}", up_dir);
                return Ok(up_dir);
            }
            
            // Also check in Resources (macOS bundle)
            let resources = exe_dir.parent()
                .and_then(|p| Some(p.join("Resources").join("homemapdata.example")));
            if let Some(res_template) = resources {
                println!("Checking: {:?}", res_template);
                if res_template.exists() {
                    println!("Found template in Resources: {:?}", res_template);
                    return Ok(res_template);
                }
            }
            
            // Check in ../Resources from MacOS folder (macOS app bundle structure)
            let macos_resources = exe_dir.join("..").join("Resources").join("homemapdata.example");
            println!("Checking: {:?}", macos_resources);
            if let Ok(canonical) = macos_resources.canonicalize() {
                if canonical.exists() {
                    println!("Found template in MacOS Resources: {:?}", canonical);
                    return Ok(canonical);
                }
            }
            
            // Check _up_ directory in Resources (macOS Tauri resource bundling pattern)
            let up_dir_macos = exe_dir.join("..").join("Resources").join("_up_").join("homemapdata.example");
            println!("Checking _up_ in Resources: {:?}", up_dir_macos);
            if let Ok(canonical) = up_dir_macos.canonicalize() {
                if canonical.exists() {
                    println!("Found template in _up_: {:?}", canonical);
                    return Ok(canonical);
                }
            }
        }
    }
    
    // Try to find in project directory (dev mode)
    if let Ok(exe_path) = env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let mut current = exe_dir;
            for _ in 0..5 {
                if let Some(parent) = current.parent() {
                    let template = parent.join("homemapdata.example");
                    if template.exists() {
                        println!("Found template in project: {:?}", template);
                        return Ok(template);
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
        let template = current_dir.join("homemapdata.example");
        if template.exists() {
            println!("Found template in cwd: {:?}", template);
            return Ok(template);
        }
    }
    
    Err("Could not find homemapdata.example template folder".to_string())
}

fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> std::io::Result<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }
    
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let file_name = entry.file_name();
        
        // Skip .DS_Store and other hidden files
        if file_name.to_string_lossy().starts_with('.') {
            continue;
        }
        
        let dest_path = dst.join(&file_name);
        
        if path.is_dir() {
            copy_dir_recursive(&path, &dest_path)?;
        } else {
            fs::copy(&path, &dest_path)?;
        }
    }
    
    Ok(())
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
    
    // Try built-in folder first
    let widget_path_builtin = homemap_path.join("widgets").join("built-in").join(format!("{}.json", widget_type));
    if widget_path_builtin.exists() {
        let content = fs::read_to_string(&widget_path_builtin)
            .map_err(|e| format!("Failed to read widget file: {}", e))?;
        return Ok(content);
    }
    
    // Fallback to root widgets folder (legacy)
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
    
    let mut items = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let file_name = entry.file_name();
        if let Some(name) = file_name.to_str() {
            let path = entry.path();
            if path.is_dir() {
                // Add trailing slash for directories
                items.push(format!("{}/", name));
            } else if path.is_file() {
                // Regular file
                items.push(name.to_string());
            }
        }
    }
    
    Ok(items)
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
    copy_dir_recursive(&template_path, &homemapdata_dest)
        .map_err(|e| format!("Failed to copy template: {}", e))?;
    
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
    // Try to load saved settings first
    if let Ok(Some(saved_settings)) = load_app_settings() {
        return Ok(saved_settings);
    }
    
    // Return defaults if no saved settings
    let default_homemap_path = dirs::data_dir()
        .ok_or("Could not find data directory")?
        .join("HomeMap")
        .join("homemapdata")
        .to_string_lossy()
        .to_string();
    
    let settings = AppSettings {
        hc3_host: String::new(),
        hc3_user: String::new(),
        hc3_password: String::new(),
        hc3_protocol: "http".to_string(),
        homemap_path: default_homemap_path,
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
fn is_hc3_configured() -> bool {
    // Check if settings.json exists and has non-empty HC3 host
    if let Ok(Some(settings)) = load_app_settings() {
        !settings.hc3_host.is_empty()
    } else {
        false
    }
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
            http_fetch_insecure,
            get_hc3_config, 
            is_hc3_configured,
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
            
            // Create app menu (first menu on macOS)
            let app_menu = SubmenuBuilder::new(app, "HomeMap")
                .item(&PredefinedMenuItem::about(app, None, None)?)
                .item(&check_updates)
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
                }
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
