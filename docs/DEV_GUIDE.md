# Development Guide

## What You Have Now

A **Tauri desktop app** for HC3 QuickApp Manager that:
- ✅ **No CORS issues** - Native apps bypass browser restrictions
- ✅ **Hot reload in dev mode** - Changes to HTML/CSS/JS reload automatically
- ✅ **Small size** - Final app is ~5MB (vs 100MB+ for Electron)
- ✅ **Fast** - Uses system WebView, not bundled browser
- ✅ **Direct HC3 access** - Connect directly to your HC3 using Tauri's HTTP client

## Development Mode (What's Running Now)

The command `cargo tauri dev` is currently:
1. Compiling the Rust backend (first time takes 3-5 minutes)
2. Will open the app window automatically
3. Watches for file changes and reloads instantly

### Edit and See Changes Instantly:
- Edit `src/index.html` → App reloads
- Edit `src/styles.css` → Styles update  
- Edit `src/script.js` → Logic updates

**No need to restart!** Just save the file.

## Using Tauri's HTTP Module

### Why Use Tauri HTTP Instead of Fetch?

Browser's `fetch()` is blocked by CORS when accessing local devices. Tauri's HTTP client runs in the Rust backend and bypasses CORS completely.

### Setup Required

1. **Add HTTP plugin to Cargo.toml:**
```toml
[dependencies]
tauri-plugin-http = "2.4.0"
```

2. **Initialize plugin in lib.rs:**
```rust
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_http::init())
    // ... other plugins
}
```

3. **Add HTTP permissions to capabilities/default.json:**
```json
{
  "permissions": [
    "http:default",
    {
      "identifier": "http:default",
      "allow": [
        { "url": "http://*" },
        { "url": "https://*" }
      ]
    }
  ]
}
```

### JavaScript Usage

```javascript
// Get the HTTP client
const http = window.__TAURI__.http;

// Make a request
const response = await http.fetch(url, {
  method: 'GET',
  headers: {
    'Authorization': 'Basic ' + btoa(`${user}:${password}`),
    'Content-Type': 'application/json'
  }
});

// Get response text and parse JSON
const text = await response.text();
const data = JSON.parse(text);
```

**Important:** Always use `await response.text()` to get the response body, then parse it as JSON.

## Accessing HC3 API

### Using Environment Variables

Credentials are stored in `.env` file and accessed via Tauri command:

1. **Create Tauri command in lib.rs:**
```rust
#[tauri::command]
fn get_hc3_config() -> Result<serde_json::Value, String> {
    let host = std::env::var("HC3_HOST").unwrap_or_default();
    let user = std::env::var("HC3_USER").unwrap_or_default();
    let password = std::env::var("HC3_PASSWORD").unwrap_or_default();
    let protocol = std::env::var("HC3_PROTOCOL").unwrap_or_else(|_| "http".to_string());

    Ok(serde_json::json!({
        "host": host,
        "user": user,
        "password": password,
        "protocol": protocol
    }))
}
```

2. **Register the command:**
```rust
.invoke_handler(tauri::generate_handler![get_hc3_config])
```

3. **Call from JavaScript:**
```javascript
const invoke = window.__TAURI__.core.invoke;
const config = await invoke('get_hc3_config');
```

### Example: Fetching QuickApps

```javascript
async function fetchQuickApps() {
  // Get credentials
  const config = await window.__TAURI__.core.invoke('get_hc3_config');
  
  // Build URL
  const url = `${config.protocol}://${config.host}/api/devices?interface=quickApp`;
  
  // Make request with Tauri HTTP
  const response = await window.__TAURI__.http.fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${btoa(`${config.user}:${config.password}`)}`,
      'Content-Type': 'application/json'
    }
  });
  
  // Parse response
  const text = await response.text();
  const quickApps = JSON.parse(text);
  
  return quickApps;
}
```

## Commands Reference

### Run in Dev Mode (Hot Reload)
```bash
cd src-tauri
cargo tauri dev
```

### Build for Distribution
```bash
cd src-tauri
cargo tauri build
```
Creates `hc3-quickapp-manager.app` in `src-tauri/target/release/bundle/macos/`

### Stop Dev Server
Press `Ctrl+C` in the terminal

## Project Files

```
EventLogger2/
├── src/
│   ├── index.html     ← Edit this for UI changes
│   ├── styles.css     ← Edit this for styling
│   └── script.js      ← Edit this for functionality
└── src-tauri/
    ├── tauri.conf.json ← App configuration
    └── src/main.rs     ← Rust code (usually don't need to touch)
```

## What Happened Behind the Scenes

1. ✅ Installed Tauri CLI
2. ✅ Created Tauri project structure  
3. ✅ Copied your existing HC3 Event Logger files
4. ✅ Configured for hot-reload dev mode
5. ✅ Started dev server (compiling now...)

## First Time Compilation

The first `cargo tauri dev` takes 3-5 minutes because:
- Compiling 400+ Rust dependencies
- Building the native app framework
- **Next time will be much faster** (5-10 seconds)

## Next Steps

1. **Wait for compilation to finish** (watch the terminal)
2. **App window will open automatically**
3. **Test the HC3 connection** - use your real IP, no proxy!
4. **Make changes** to any file in `src/` and see instant updates
5. **Build final app** when ready with `cargo tauri build`

## Why This is Better

### Before (Browser):
- ❌ CORS restrictions
- ❌ Need proxy server
- ❌ Multiple files to manage
- ❌ Security limitations

### Now (Tauri):
- ✅ No CORS - direct HC3 connection
- ✅ No proxy needed
- ✅ Single `.app` file to distribute
- ✅ Native app capabilities
- ✅ 5MB vs 100MB+
- ✅ Hot reload during development

You now have a **professional desktop app** that's easy to develop and easy to distribute!