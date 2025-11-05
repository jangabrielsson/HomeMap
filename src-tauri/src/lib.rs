// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
#[cfg(not(any(target_os = "ios", target_os = "android")))]
use tauri::menu::{Menu, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
#[cfg(not(any(target_os = "ios", target_os = "android")))]
use tauri::Emitter;
use serde::{Deserialize, Serialize};
use std::env;
use std::path::PathBuf;
use std::fs;
use std::collections::HashMap;
use base64::Engine;

#[cfg(target_os = "android")]
use tauri_plugin_fs::FsExt;

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
fn is_mobile_platform() -> bool {
    #[cfg(any(target_os = "ios", target_os = "android"))]
    {
        true
    }
    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    {
        false
    }
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
    #[cfg(target_os = "android")]
    let data_dir = {
        // On Android, use /data/data/<package>/files/homemapdata
        PathBuf::from("/data/data/com.gabrielsson.homemap/files/homemapdata")
    };
    
    #[cfg(target_os = "ios")]
    let data_dir = {
        // On iOS, use Documents directory (writable)
        // The path is typically: /Users/.../Library/Developer/CoreSimulator/Devices/{UUID}/data/Containers/Data/Application/{UUID}/Documents
        // On device it's: /var/mobile/Containers/Data/Application/{UUID}/Documents
        use std::env;
        let home = env::var("HOME").unwrap_or_else(|_| String::from("/"));
        PathBuf::from(home).join("Documents").join("homemapdata")
    };
    
    #[cfg(not(any(target_os = "ios", target_os = "android")))]
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
                println!("NOTE: On Android, built-in widgets/icons are not available without template extraction");
                println!("TODO: Implement Android APK asset extraction for homemapdata.example");
                
                // Create a minimal config.json with default floor if template not found
                let minimal_config = serde_json::json!({
                    "name": "HomeMap",
                    "icon": "🏠",
                    "floors": [{
                        "id": "default-floor",
                        "name": "Main Floor",
                        "image": "images/default-floor.png"
                    }],
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
                fs::create_dir_all(data_dir.join("images"))
                    .map_err(|e| format!("Failed to create images directory: {}", e))?;
                
                // On mobile, embed the default floor image at compile time
                let default_floor_path = data_dir.join("images").join("default-floor.png");
                if !default_floor_path.exists() {
                    println!("Creating default floor image from embedded resource");
                    
                    #[cfg(any(target_os = "android", target_os = "ios"))]
                    {
                        // Embed the actual default floor image from homemapdata.example
                        let embedded_floor = include_bytes!("../../homemapdata.example/images/default-floor.png");
                        fs::write(&default_floor_path, embedded_floor)
                            .map_err(|e| format!("Failed to write embedded floor image: {}", e))?;
                        println!("Wrote embedded floor image ({} bytes)", embedded_floor.len());
                    }
                    
                    #[cfg(not(any(target_os = "android", target_os = "ios")))]
                    {
                        // Desktop doesn't need embedded - it uses template directory
                        println!("Skipping floor image on desktop (uses template)");
                    }
                }
                
                // On mobile, JavaScript will copy bundled assets from asset:// protocol
                // No need to embed widgets here anymore
                #[cfg(any(target_os = "android", target_os = "ios"))]
                {
                    println!("Mobile platform - widgets will be copied via asset extraction");
                }
                
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

// Extract bundled resources on Android/iOS from APK assets  
#[cfg(any(target_os = "android", target_os = "ios"))]
fn extract_bundled_template(_app: &tauri::AppHandle, dest_dir: &PathBuf) -> Result<(), String> {
    println!("Attempting to extract bundled template resources...");
    
    let resolver = _app.path();
    
    // Get the resource directory (will be asset:// URL on Android)
    if let Ok(resource_dir) = resolver.resource_dir() {
        println!("Resource directory: {:?}", resource_dir);
        
        #[cfg(target_os = "android")]
        {
            // On Android, we need to copy files from asset:// to filesystem
            // The assets are at asset://localhost/homemapdata.example/*
            // JavaScript will handle copying via fetch + write_file_base64
            
            println!("Android: Assets will be copied by JavaScript using asset:// protocol");
            return Err("Android asset extraction handled by JavaScript".to_string());
        }
        
        #[cfg(target_os = "ios")]
        {
            let template_in_resources = resource_dir.join("homemapdata.example");
            println!("Looking for template at: {:?}", template_in_resources);
            
            if template_in_resources.exists() {
                println!("Found template in resources, copying to {:?}", dest_dir);
                copy_dir_recursive(&template_in_resources, dest_dir)
                    .map_err(|e| format!("Failed to copy template from resources: {}", e))?;
                println!("Successfully extracted template from app resources");
                return Ok(());
            }
        }
    }
    
    Err("Could not extract bundled template".to_string())
}

fn find_template_directory() -> Result<PathBuf, String> {
    println!("Searching for homemapdata.example template...");
    
    // On Android/iOS, check if we can access via resource directory
    // Tauri bundles resources in assets/_up_/ on Android
    #[cfg(target_os = "android")]
    {
        // Try common Android asset extraction paths
        let android_paths = [
            // Where Tauri might extract assets
            "/data/data/com.gabrielsson.homemap/cache/_up_/homemapdata.example",
            "/data/data/com.gabrielsson.homemap/files/_up_/homemapdata.example",
            // Direct APK assets (won't work but try anyway)
            "/data/app/com.gabrielsson.homemap/base.apk/assets/_up_/homemapdata.example",
        ];
        
        for path in &android_paths {
            let template = PathBuf::from(path);
            println!("Checking Android path: {:?}", template);
            if template.exists() {
                println!("Found template at: {:?}", template);
                return Ok(template);
            }
        }
        
        // On Android, assets are in the APK and need to be extracted
        // For now, this will fail and we'll use the fallback
        println!("Template not found in Android paths, will use minimal fallback");
    }
    
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
    
    // Security check: on mobile platforms, ensure path is within homemap data directory
    #[cfg(any(target_os = "ios", target_os = "android"))]
    {
        let homemap_path = get_homemap_data_path()?;
        if !path_buf.starts_with(&homemap_path) {
            return Err("Access denied: path must be within homemap data directory".to_string());
        }
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
    // Validate path is within homemap data directory (mobile platforms only)
    #[cfg(any(target_os = "ios", target_os = "android"))]
    {
        let homemap_path = get_homemap_data_path()?;
        let target_path = PathBuf::from(&file_path);
        
        // Ensure the path is within homemap data directory
        if !target_path.starts_with(&homemap_path) {
            return Err("Access denied: path must be within homemap data directory".to_string());
        }
    }
    
    let target_path = PathBuf::from(&file_path);
    
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

// UI preferences that should be backed up and restored
#[derive(Debug, Serialize, Deserialize, Clone)]
struct UiPreferences {
    widget_background_enabled: Option<bool>,
    widget_background_color: Option<String>,
    widget_background_opacity: Option<i32>,
    // Add other UI preferences here as needed
}

#[tauri::command]
fn get_app_settings() -> Result<AppSettings, String> {
    // Try to load saved settings first
    if let Ok(Some(saved_settings)) = load_app_settings() {
        return Ok(saved_settings);
    }
    
    // Return defaults if no saved settings
    // On mobile platforms, use the same path as get_homemap_data_path
    #[cfg(any(target_os = "ios", target_os = "android"))]
    let default_homemap_path = {
        #[cfg(target_os = "ios")]
        let path = dirs::document_dir()
            .ok_or("Could not find document directory")?
            .join("homemapdata");
        
        #[cfg(target_os = "android")]
        let path = PathBuf::from("/data/data/com.gabrielsson.homemap/files/homemapdata");
        
        path.to_string_lossy().to_string()
    };
    
    #[cfg(not(any(target_os = "ios", target_os = "android")))]
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
    // Save to app config directory (platform-specific)
    #[cfg(any(target_os = "ios", target_os = "android"))]
    let config_dir = {
        #[cfg(target_os = "ios")]
        let dir = dirs::document_dir()
            .ok_or("Could not find document directory")?
            .join(".config")
            .join("HomeMap");
        
        #[cfg(target_os = "android")]
        let dir = PathBuf::from("/data/data/com.gabrielsson.homemap/files/.config/HomeMap");
        
        dir
    };
    
    #[cfg(not(any(target_os = "ios", target_os = "android")))]
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

#[cfg(not(any(target_os = "ios", target_os = "android")))]
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

#[cfg(any(target_os = "ios", target_os = "android"))]
#[tauri::command]
async fn select_homemap_folder<R: tauri::Runtime>(_app: tauri::AppHandle<R>) -> Result<Option<String>, String> {
    // On mobile, return the app's documents directory
    Err("Folder selection not supported on mobile".to_string())
}

#[tauri::command]
fn load_app_settings() -> Result<Option<AppSettings>, String> {
    // Load from app config directory (platform-specific)
    #[cfg(any(target_os = "ios", target_os = "android"))]
    let config_dir = {
        #[cfg(target_os = "ios")]
        let dir = dirs::document_dir()
            .ok_or("Could not find document directory")?
            .join(".config")
            .join("HomeMap");
        
        #[cfg(target_os = "android")]
        let dir = PathBuf::from("/data/data/com.gabrielsson.homemap/files/.config/HomeMap");
        
        dir
    };
    
    #[cfg(not(any(target_os = "ios", target_os = "android")))]
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

#[tauri::command]
fn write_file_base64(file_path: String, b64: String) -> Result<(), String> {
    // Decode base64 and write binary file to given filesystem path
    use base64::engine::general_purpose::STANDARD as BASE64_STD;
    match BASE64_STD.decode(&b64) {
        Ok(bytes) => {
            let path = std::path::PathBuf::from(&file_path);
            if let Some(parent) = path.parent() {
                if !parent.exists() {
                    std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent dirs: {}", e))?;
                }
            }
            std::fs::write(&path, &bytes).map_err(|e| format!("Failed to write file {}: {}", file_path, e))?;
            println!("Wrote file from base64 to: {}", file_path);
            Ok(())
        }
        Err(e) => Err(format!("Base64 decode error: {}", e)),
    }
}

// Save temporary file from byte array (for mobile file uploads)
#[tauri::command]
fn save_temp_file(file_name: String, data: Vec<u8>) -> Result<String, String> {
    // Get the app data directory
    let data_dir = get_homemap_data_path()?;
    
    // Create temp directory if it doesn't exist
    let temp_dir = data_dir.join("temp");
    if !temp_dir.exists() {
        fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    }
    
    // Generate temp file path
    let temp_file = temp_dir.join(&file_name);
    
    // Write the file
    fs::write(&temp_file, data)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;
    
    println!("Saved temp file: {:?}", temp_file);
    
    // Return the absolute path as string
    temp_file.to_str()
        .ok_or_else(|| "Failed to convert path to string".to_string())
        .map(|s| s.to_string())
}

// Read bundled asset file and return as base64
// Used to access files from APK assets that aren't accessible via fetch()
#[tauri::command]
fn read_bundled_asset(app: tauri::AppHandle, asset_path: String) -> Result<String, String> {
    use base64::Engine;
    use base64::engine::general_purpose::STANDARD as BASE64_STD;
    
    #[cfg(target_os = "android")]
    {
        // On Android, read from the APK zip file directly
        if asset_path == "asset-manifest.json" {
            // Embed manifest at compile time since it's small  
            let embedded_manifest = include_bytes!("../../homemapdata.example/asset-manifest.json");
            println!("Returning embedded manifest: {} bytes", embedded_manifest.len());
            return Ok(BASE64_STD.encode(embedded_manifest));
        }
        
        println!("Reading {} from APK...", asset_path);
        
        // Get the APK path from the Android context
        // The app's code path contains the APK location
        use std::env;
        let apk_path = env::var("ANDROID_APP_PATH")
            .or_else(|_| {
                // Fallback: try to find base.apk by reading /proc/self/maps
                let maps = std::fs::read_to_string("/proc/self/maps")
                    .map_err(|e| format!("Failed to read /proc/self/maps: {}", e))?;
                
                for line in maps.lines() {
                    if line.contains("base.apk") {
                        // The line format is: <address-range> <perms> <offset> <dev> <inode> <spaces> <path>
                        // We need to extract the path which comes after a lot of spaces
                        if let Some(path_start) = line.rfind("/data/app/") {
                            // From the start of /data/app/ to the end of the line is the path
                            let path = &line[path_start..].trim_end();
                            println!("Using APK path: {}", path);
                            return Ok(path.to_string());
                        }
                    }
                }
                Err("APK path not found in /proc/self/maps".to_string())
            })?;
        
        println!("Using APK path: {}", apk_path);
        
        use std::fs::File;
        use std::io::Read;
        use zip::ZipArchive;
        
        let file = File::open(&apk_path)
            .map_err(|e| format!("Failed to open APK at {}: {}", apk_path, e))?;
        
        let mut archive = ZipArchive::new(file)
            .map_err(|e| format!("Failed to read APK as zip: {}", e))?;
        
        let asset_path_in_apk = format!("assets/_up_/homemapdata.example/{}", asset_path);
        
        let mut zip_file = archive.by_name(&asset_path_in_apk)
            .map_err(|e| format!("Asset not found in APK: {} ({})", asset_path_in_apk, e))?;
        
        let mut buffer = Vec::new();
        zip_file.read_to_end(&mut buffer)
            .map_err(|e| format!("Failed to read from APK: {}", e))?;
        
        println!("Successfully read {} bytes for {} from APK zip", buffer.len(), asset_path);
        Ok(BASE64_STD.encode(&buffer))
    }
    
    #[cfg(not(target_os = "android"))]
    {
        // On desktop, read from filesystem
        let resolver = app.path();
        let resource_dir = resolver.resource_dir()
            .map_err(|e| format!("Failed to get resource dir: {}", e))?;
        let full_path = resource_dir.join("homemapdata.example").join(&asset_path);
        
        println!("Reading desktop asset from: {:?}", full_path);
        
        let bytes = std::fs::read(&full_path)
            .map_err(|e| format!("Failed to read asset {}: {}", asset_path, e))?;
        
        Ok(BASE64_STD.encode(&bytes))
    }
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

#[tauri::command]
fn create_backup(source_path: String, dest_path: String) -> Result<(), String> {
    use std::fs::File;
    use zip::write::{FileOptions, ZipWriter};
    use walkdir::WalkDir;
    
    let source = PathBuf::from(&source_path);
    let dest = PathBuf::from(&dest_path);
    
    // Create zip file
    let file = File::create(&dest)
        .map_err(|e| format!("Failed to create backup file: {}", e))?;
    
    let mut zip = ZipWriter::new(file);
    let options: FileOptions<()> = FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);
    
    // Walk through source directory and add files to zip
    for entry in WalkDir::new(&source).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = path.strip_prefix(&source)
            .map_err(|e| format!("Failed to strip prefix: {}", e))?;
        
        // Skip the root directory itself
        if name.as_os_str().is_empty() {
            continue;
        }
        
        let name_str = name.to_str()
            .ok_or_else(|| "Invalid UTF-8 in path".to_string())?;
        
        if path.is_file() {
            println!("Adding file to backup: {}", name_str);
            zip.start_file(name_str, options)
                .map_err(|e| format!("Failed to start file in zip: {}", e))?;
            
            let file_data = fs::read(path)
                .map_err(|e| format!("Failed to read file {}: {}", name_str, e))?;
            
            use std::io::Write;
            zip.write_all(&file_data)
                .map_err(|e| format!("Failed to write file to zip: {}", e))?;
        } else if path.is_dir() {
            println!("Adding directory to backup: {}", name_str);
            zip.add_directory(name_str, options)
                .map_err(|e| format!("Failed to add directory to zip: {}", e))?;
        }
    }
    
    zip.finish()
        .map_err(|e| format!("Failed to finalize zip: {}", e))?;
    
    println!("Backup created successfully at: {}", dest_path);
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
struct RestoreOptions {
    backup_existing: bool,
    restore_config: bool,
    restore_images: bool,
    restore_icons: bool,
    restore_widgets: bool,
    restore_ui_preferences: bool,
}

#[tauri::command]
fn restore_homemap_data(backup_path: String, target_path: String, options: RestoreOptions) -> Result<String, String> {
    use std::fs::File;
    use std::io::Read;
    use zip::read::ZipArchive;
    
    let backup_file_path = PathBuf::from(&backup_path);
    let target_dir = PathBuf::from(&target_path);
    
    // Validate backup file exists
    if !backup_file_path.exists() {
        return Err("Backup file does not exist".to_string());
    }
    
    // Open and validate ZIP file
    let file = File::open(&backup_file_path)
        .map_err(|e| format!("Failed to open backup file: {}", e))?;
    
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Failed to read backup archive: {}", e))?;
    
    // Validate backup file structure and contents
    let mut has_config = false;
    let mut file_count = 0;
    let mut config_size = 0;
    
    for i in 0..archive.len() {
        let file = archive.by_index(i)
            .map_err(|e| format!("Failed to read archive entry: {}", e))?;
        
        file_count += 1;
        let file_name = file.name();
        
        if file_name == "config.json" {
            has_config = true;
            config_size = file.size();
            
            // Basic config.json validation - should be valid JSON and reasonable size
            if config_size < 10 {
                return Err("Invalid backup file: config.json is too small".to_string());
            }
            if config_size > 10_000_000 { // 10MB limit
                return Err("Invalid backup file: config.json is too large".to_string());
            }
        }
        
        // Check for suspicious files that shouldn't be in a HomeMap backup
        if file_name.contains("..") || file_name.starts_with("/") {
            return Err(format!("Invalid backup file: suspicious file path '{}'", file_name));
        }
    }
    
    if !has_config {
        return Err("Invalid backup file: missing config.json. This doesn't appear to be a HomeMap backup.".to_string());
    }
    
    if file_count == 0 {
        return Err("Invalid backup file: archive is empty".to_string());
    }
    
    println!("Backup validation passed: {} files, config.json size: {} bytes", file_count, config_size);
    
    // Validate config.json structure and version compatibility
    let mut archive_for_validation = ZipArchive::new(File::open(&backup_file_path)
        .map_err(|e| format!("Failed to reopen backup file: {}", e))?)
        .map_err(|e| format!("Failed to read backup archive for validation: {}", e))?;
    
    for i in 0..archive_for_validation.len() {
        let mut file = archive_for_validation.by_index(i)
            .map_err(|e| format!("Failed to read archive entry: {}", e))?;
        
        if file.name() == "config.json" {
            let mut config_content = String::new();
            file.read_to_string(&mut config_content)
                .map_err(|e| format!("Failed to read config.json: {}", e))?;
            
            // Parse JSON to validate structure
            let config_json: serde_json::Value = serde_json::from_str(&config_content)
                .map_err(|e| format!("Invalid config.json format: {}", e))?;
            
            // Check if it looks like a HomeMap config
            if !config_json.is_object() {
                return Err("Invalid config.json: not a JSON object".to_string());
            }
            
            let config_obj = config_json.as_object().unwrap();
            
            // Check for required fields (devices array is most important)
            if !config_obj.contains_key("devices") {
                return Err("Invalid config.json: missing 'devices' field. This may not be a HomeMap backup.".to_string());
            }
            
            // Warn about version compatibility if version info is available
            if let Some(version) = config_obj.get("version").and_then(|v| v.as_str()) {
                println!("Backup created with HomeMap version: {}", version);
                // Note: We don't fail here, just log for now
                // Future versions could add compatibility checks
            }
            
            // Check if devices is an array
            if !config_obj["devices"].is_array() {
                return Err("Invalid config.json: 'devices' field is not an array".to_string());
            }
            
            println!("Config.json validation passed");
            
            // Extract UI preferences from the backup if requested
            let ui_preferences = if options.restore_ui_preferences {
                match extract_ui_preferences_from_config(&config_content) {
                    Ok(prefs) => {
                        println!("Extracted UI preferences from backup");
                        Some(prefs)
                    }
                    Err(e) => {
                        println!("Warning: Could not extract UI preferences: {}", e);
                        None
                    }
                }
            } else {
                None
            };
            
            // Store UI preferences for later application (after restore)
            if let Some(prefs) = ui_preferences {
                // We'll apply these after the restore completes
                // Store them in a temporary location for now
                let temp_prefs_path = std::env::temp_dir().join("homemap_ui_prefs.json");
                let prefs_json = serde_json::to_string(&prefs)
                    .map_err(|e| format!("Failed to serialize UI preferences: {}", e))?;
                fs::write(&temp_prefs_path, prefs_json)
                    .map_err(|e| format!("Failed to save temporary UI preferences: {}", e))?;
            }
            
            break;
        }
    }
    
    // Create backup of existing data if requested
    let backup_location = if options.backup_existing && target_dir.exists() {
        let timestamp = chrono::Utc::now().format("%Y%m%d-%H%M%S");
        let backup_name = format!("homemap-backup-before-restore-{}.zip", timestamp);
        let backup_path = target_dir.parent()
            .unwrap_or(&target_dir)
            .join(&backup_name);
        
        create_backup(target_path.clone(), backup_path.to_string_lossy().to_string())?;
        Some(backup_path.to_string_lossy().to_string())
    } else {
        None
    };
    
    // Create target directory if it doesn't exist
    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create target directory: {}", e))?;
    
    // Extract files based on options
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read archive entry: {}", e))?;
        
        let file_path = file.name().to_string();
        let is_dir = file.is_dir();
        
        // Check if we should restore this file type
        let should_restore = match file_path.as_str() {
            p if p == "config.json" => options.restore_config,
            p if p.starts_with("images/") => options.restore_images,
            p if p.starts_with("icons/") => options.restore_icons,
            p if p.starts_with("widgets/") => options.restore_widgets,
            p if p.ends_with("installed-packages.json") || p.ends_with("widget-mappings.json") => true, // Always restore these
            _ => true, // Restore other files by default
        };
        
        if !should_restore {
            continue;
        }
        
        let outpath = target_dir.join(&file_path);
        
        if is_dir {
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create directory {}: {}", file_path, e))?;
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent directory: {}", e))?;
            }
            
            let mut outfile = File::create(&outpath)
                .map_err(|e| format!("Failed to create file {}: {}", file_path, e))?;
            
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to extract file {}: {}", file_path, e))?;
            
            println!("Restored file: {}", file_path);
        }
    }
    
    // Apply UI preferences if they were extracted
    let temp_prefs_path = std::env::temp_dir().join("homemap_ui_prefs.json");
    if temp_prefs_path.exists() {
        match fs::read_to_string(&temp_prefs_path) {
            Ok(prefs_json) => {
                match serde_json::from_str::<UiPreferences>(&prefs_json) {
                    Ok(prefs) => {
                        if let Err(e) = apply_ui_preferences_to_current_config(prefs) {
                            println!("Warning: Could not apply UI preferences: {}", e);
                        } else {
                            println!("Successfully applied UI preferences from backup");
                        }
                    }
                    Err(e) => println!("Warning: Could not parse stored UI preferences: {}", e),
                }
            }
            Err(e) => println!("Warning: Could not read stored UI preferences: {}", e),
        }
        
        // Clean up temporary file
        let _ = fs::remove_file(&temp_prefs_path);
    }
    
    let mut result = "HomeMap data restored successfully!".to_string();
    if let Some(backup_loc) = backup_location {
        result = format!("{}\n\nYour previous data was backed up to: {}", result, backup_loc);
    }
    
    Ok(result)
}

// Extract UI preferences from config.json content
fn extract_ui_preferences_from_config(config_content: &str) -> Result<UiPreferences, String> {
    let config_json: serde_json::Value = serde_json::from_str(config_content)
        .map_err(|e| format!("Failed to parse config.json: {}", e))?;
    
    let mut preferences = UiPreferences {
        widget_background_enabled: None,
        widget_background_color: None,
        widget_background_opacity: None,
    };
    
    // Extract widget background settings if they exist
    if let Some(widget_bg) = config_json.get("widgetBackground").and_then(|v| v.as_object()) {
        preferences.widget_background_enabled = widget_bg.get("enabled").and_then(|v| v.as_bool());
        preferences.widget_background_color = widget_bg.get("color").and_then(|v| v.as_str()).map(|s| s.to_string());
        preferences.widget_background_opacity = widget_bg.get("opacity").and_then(|v| v.as_i64()).map(|i| i as i32);
    }
    
    Ok(preferences)
}

// Apply UI preferences to the current config.json
#[tauri::command]
fn apply_ui_preferences_to_current_config(preferences: UiPreferences) -> Result<(), String> {
    let data_path = get_homemap_data_path()?;
    let config_path = data_path.join("config.json");
    
    if !config_path.exists() {
        return Err("Config file not found".to_string());
    }
    
    // Read current config
    let config_content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;
    
    let mut config_json: serde_json::Value = serde_json::from_str(&config_content)
        .map_err(|e| format!("Failed to parse current config: {}", e))?;
    
    // Apply UI preferences
    if let Some(config_obj) = config_json.as_object_mut() {
        let mut widget_bg = serde_json::Map::new();
        
        if let Some(enabled) = preferences.widget_background_enabled {
            widget_bg.insert("enabled".to_string(), serde_json::Value::Bool(enabled));
        }
        if let Some(color) = preferences.widget_background_color {
            widget_bg.insert("color".to_string(), serde_json::Value::String(color));
        }
        if let Some(opacity) = preferences.widget_background_opacity {
            widget_bg.insert("opacity".to_string(), serde_json::Value::Number(opacity.into()));
        }
        
        if !widget_bg.is_empty() {
            config_obj.insert("widgetBackground".to_string(), serde_json::Value::Object(widget_bg));
        }
    }
    
    // Save updated config
    let updated_content = serde_json::to_string_pretty(&config_json)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    fs::write(&config_path, updated_content)
        .map_err(|e| format!("Failed to write config file: {}", e))?;
    
    println!("Applied UI preferences to current config");
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
struct BackupFileInfo {
    path: String,
    filename: String,
    size: u64,
    modified: String,
}

#[tauri::command]
fn list_backup_files() -> Result<Vec<BackupFileInfo>, String> {
    let mut backup_files = Vec::new();
    
    // Check common directories where backup files might be located
    let search_dirs = vec![
        #[cfg(target_os = "android")]
        PathBuf::from("/storage/emulated/0/Download"), // Android Downloads
        #[cfg(target_os = "android")]
        PathBuf::from("/storage/emulated/0/Documents"), // Android Documents
        
        #[cfg(target_os = "ios")]
        dirs::document_dir().unwrap_or_default().join("Downloads"), // iOS Downloads (if accessible)
        #[cfg(target_os = "ios")]
        dirs::document_dir().unwrap_or_default(), // iOS Documents
        
        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        dirs::download_dir().unwrap_or_default(), // Desktop Downloads
        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        dirs::document_dir().unwrap_or_default(), // Desktop Documents
        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        dirs::desktop_dir().unwrap_or_default(), // Desktop
    ];
    
    for search_dir in search_dirs {
        if !search_dir.exists() {
            continue;
        }
        
        if let Ok(entries) = fs::read_dir(&search_dir) {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if let Some(extension) = path.extension() {
                        if extension == "zip" {
                            if let Some(filename) = path.file_name() {
                                if let Some(filename_str) = filename.to_str() {
                                    // Only include files that look like HomeMap backups
                                    if filename_str.contains("homemap") || filename_str.contains("HomeMap") {
                                        if let Ok(metadata) = fs::metadata(&path) {
                                            let modified = metadata.modified()
                                                .map(|time| {
                                                    let datetime: chrono::DateTime<chrono::Utc> = time.into();
                                                    datetime.format("%Y-%m-%d %H:%M:%S").to_string()
                                                })
                                                .unwrap_or_else(|_| "Unknown".to_string());
                                            
                                            backup_files.push(BackupFileInfo {
                                                path: path.to_string_lossy().to_string(),
                                                filename: filename_str.to_string(),
                                                size: metadata.len(),
                                                modified,
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Sort by modification time (newest first)
    backup_files.sort_by(|a, b| b.modified.cmp(&a.modified));
    
    Ok(backup_files)
}

#[tauri::command]
fn delete_backup_file(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    
    // Safety check: only allow deleting .zip files with "homemap" in the name
    if let Some(extension) = path.extension() {
        if extension != "zip" {
            return Err("Can only delete .zip files".to_string());
        }
    } else {
        return Err("File has no extension".to_string());
    }
    
    if let Some(filename) = path.file_name() {
        if let Some(filename_str) = filename.to_str() {
            let filename_lower = filename_str.to_lowercase();
            if !filename_lower.contains("homemap") {
                return Err("Can only delete HomeMap backup files".to_string());
            }
        }
    }
    
    // Delete the file
    fs::remove_file(&path)
        .map_err(|e| format!("Failed to delete file: {}", e))?;
    
    println!("Deleted backup file: {}", file_path);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init());
    
    // Desktop-only plugins
    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_window_state::Builder::default().build());
    
    builder
        .invoke_handler(tauri::generate_handler![
            http_fetch_insecure,
            get_hc3_config, 
            is_hc3_configured,
            get_homemap_config, 
            get_data_path, 
            read_image_as_base64,
            write_file_base64,
            save_temp_file,
            read_bundled_asset,
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
            is_directory,
            create_backup,
            restore_homemap_data,
            list_backup_files,
            delete_backup_file,
            is_mobile_platform,
            apply_ui_preferences_to_current_config
        ])
        .setup(|app| {
            // Mobile: Initialize data directory with bundled resources
            #[cfg(any(target_os = "ios", target_os = "android"))]
            {
                println!("Mobile platform detected, initializing data directory...");
                
                #[cfg(target_os = "android")]
                let data_dir = PathBuf::from("/data/data/com.gabrielsson.homemap/files/homemapdata");
                
                #[cfg(target_os = "ios")]
                let data_dir = {
                    use std::env;
                    let home = env::var("HOME").unwrap_or_else(|_| String::from("/"));
                    PathBuf::from(home).join("Documents").join("homemapdata")
                };
                
                if !data_dir.exists() {
                    println!("Creating homemapdata directory: {:?}", data_dir);
                    if let Err(e) = fs::create_dir_all(&data_dir) {
                        eprintln!("Failed to create data directory: {}", e);
                    } else {
                        // Try to extract bundled template resources
                        match extract_bundled_template(&app.handle(), &data_dir) {
                            Ok(_) => {
                                println!("Successfully initialized from bundled resources");
                            }
                            Err(e) => {
                                eprintln!("Could not extract bundled resources: {}", e);
                                eprintln!("Falling back to minimal initialization");
                                // Fall back to minimal config creation
                                if let Err(e2) = initialize_default_config(&data_dir) {
                                    eprintln!("Failed to create minimal config: {}", e2);
                                }
                            }
                        }
                    }
                } else {
                    println!("Data directory already exists: {:?}", data_dir);
                }
            }
            
            // Desktop-only: Create menu
            #[cfg(not(any(target_os = "ios", target_os = "android")))]
            {
                // Create menu items
                let toggle_devtools = MenuItemBuilder::with_id("toggle_devtools", "Toggle DevTools")
                    .accelerator("CmdOrCtrl+Shift+I")
                    .build(app)?;
                
                let check_updates = MenuItemBuilder::with_id("check-for-updates", "Check for Updates...")
                    .build(app)?;
                
                let about = MenuItemBuilder::with_id("about", "About HomeMap")
                    .build(app)?;
                
                // Create app menu (first menu on macOS)
                let app_menu = SubmenuBuilder::new(app, "HomeMap")
                    .item(&about)
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
                    } else if event.id().as_ref() == "about" {
                        println!("About event received");
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("show-about", ());
                        }
                    }
                });
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
