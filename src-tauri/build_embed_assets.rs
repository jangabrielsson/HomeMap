// Script to generate embedded assets code for Android
use std::fs;
use std::path::PathBuf;

fn main() {
    println!("cargo:rerun-if-changed=../homemapdata.example");
    
    let manifest_path = PathBuf::from("../homemapdata.example/asset-manifest.json");
    let manifest_content = fs::read_to_string(&manifest_path)
        .expect("Failed to read asset manifest");
    
    let manifest: serde_json::Value = serde_json::from_str(&manifest_content)
        .expect("Failed to parse manifest");
    
    let files = manifest["files"].as_array()
        .expect("Manifest must have files array");
    
    let out_dir = std::env::var("OUT_DIR").unwrap();
    let dest_path = PathBuf::from(&out_dir).join("embedded_assets.rs");
    
    let mut code = String::from("// Auto-generated embedded assets\n");
    code.push_str("use std::collections::HashMap;\n\n");
    code.push_str("pub fn get_embedded_asset(path: &str) -> Option<&'static [u8]> {\n");
    code.push_str("    match path {\n");
    
    for file in files {
        let file_path = file.as_str().unwrap();
        let full_path = format!("../homemapdata.example/{}", file_path);
        code.push_str(&format!("        \"{}\" => Some(include_bytes!(\"{}\")),\n", 
                              file_path, full_path));
    }
    
    code.push_str("        _ => None,\n");
    code.push_str("    }\n");
    code.push_str("}\n");
    
    fs::write(&dest_path, code).expect("Failed to write embedded_assets.rs");
    println!("Generated embedded assets for {} files", files.len());
}
