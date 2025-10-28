# Tauri Auto-Update & DevTools Setup Guide

## Overview

Complete guide for setting up auto-update functionality and developer tools in Tauri 2.x applications. This guide includes all the critical configuration steps, ACL permissions, and GitHub Actions setup needed for a production-ready auto-updater.

**Based on learnings from HC3 Event Logger project.**

## Key Learnings

**Critical Success Factors:**
1. ✅ `createUpdaterArtifacts: true` in bundle config (most important!)
2. ✅ Dialog and Process plugins for native UX
3. ✅ Proper ACL permissions in capabilities
4. ✅ Password-free signing key for CI/CD
5. ✅ Try-catch error handling for graceful fallbacks

## Part 1: Auto-Update Setup

### Step 1: Add Required Dependencies

In `src-tauri/Cargo.toml`, add these plugins:

```toml
[dependencies]
tauri = { version = "2", features = ["devtools"] }  # Add devtools feature
tauri-plugin-updater = "2"
tauri-plugin-dialog = "2"   # For native update dialogs
tauri-plugin-process = "2"  # For app restart after update
tauri-plugin-http = "2"     # Usually already included

[features]
default = ["devtools"]
devtools = ["tauri/devtools"]
```

### Step 2: Initialize Plugins in Rust

In `src-tauri/src/lib.rs`:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Your setup code
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Step 3: Generate Signing Keys (PASSWORD-FREE!)

**Critical: Use a password-free key for GitHub Actions!**

```bash
# Generate password-free keypair
cargo tauri signer generate --write-keys ~/.tauri/eventlogger-nopass.key

# Copy the entire output, including the comment line
# Example output:
# untrusted comment: minisign public key: 2F6DB1077207AB57
# RWRXqwdyB7FtL4hu8werFuxMXtVslYfvJAIAYe6zHUU9NG6D5kbU+fGo
```

**Important:**
- ✅ Use `--write-keys` (not `-w`) to avoid password prompt
- ✅ Save private key securely
- ❌ Never commit private key to git
- ✅ Add `~/.tauri/` to `.gitignore`

**⚠️ CRITICAL: Base64 Encoding for GitHub Actions**

For GitHub Actions, the keys MUST be base64-encoded as single-line strings:

```bash
# Get base64-encoded private key (for GitHub Secret)
cat ~/.tauri/eventlogger-nopass.key | tr -d '\n' | tr -d '%'
# Result: dW50cnVzdGVkIGNvbW1lbnQ6...  (long single line, ~272 chars)

# Get base64-encoded public key (for tauri.conf.json)
cat ~/.tauri/eventlogger-nopass.key.pub | tr -d '\n' | tr -d '%'
# Result: dW50cnVzdGVkIGNvbW1lbnQ6...  (long single line, ~156 chars)
```

**Why this matters:**
- ❌ Using decoded format with `\n` newlines will cause "Invalid symbol 32, offset 9" errors
- ✅ Base64-encoded single-line strings work correctly
- ✅ No spaces, no newlines, no line breaks in the encoded string

### Step 4: Configure Updater in tauri.conf.json

**This is the most critical configuration!**

```json
{
  "productName": "your-app",
  "version": "0.1.0",
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/USERNAME/REPO/releases/latest/download/latest.json"
      ],
      "dialog": true,
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDZEM..."
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "createUpdaterArtifacts": true,  // ⚠️ CRITICAL! Must be true!
    "icon": ["icons/icon.icns", "icons/icon.ico"],
    "macOS": {
      "signingIdentity": "-"  // ⚠️ CRITICAL for macOS! Enables ad-hoc signing
    }
  },
  "app": {
    "windows": [{
      "title": "Your App",
      "devtools": true  // Enable devtools in production
    }],
    "security": {
      "csp": "default-src 'self' ipc: https://ipc.localhost; connect-src 'self' ipc: https://ipc.localhost http://* https://*; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'"
    }
  }
}
```

### Step 5: Add ACL Permissions

In `src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "enables the default permissions",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-create",
    "core:webview:allow-internal-toggle-devtools",
    "dialog:default",      // ⚠️ Required for native dialogs
    "process:default",     // ⚠️ Required for app restart
    "updater:default",
    "updater:allow-check",
    "updater:allow-download",
    "updater:allow-download-and-install",
    "updater:allow-install",
    {
      "identifier": "http:default",
      "allow": [{ "url": "http://*" }]
    }
  ]
}
```

### Step 6: Frontend Updater Code

In your JavaScript/TypeScript file:

```javascript
async function setupUpdater() {
    const { checkUpdate } = window.__TAURI__?.updater || {};
    const hasDialog = window.__TAURI__?.dialog != null;
    const hasRelaunch = window.__TAURI__?.process?.relaunch != null;
    
    if (!checkUpdate) {
        console.log('Updater not available (dev mode or missing plugin)');
        return;
    }
    
    // Listen for menu "Check for Updates" event
    window.__TAURI__.event.listen('check-for-updates', () => {
        checkForUpdates(false);
    });
}

async function checkForUpdates(silent = false) {
    try {
        const { check } = window.__TAURI__.updater;
        const update = await check();
        
        if (update?.available) {
            const version = update.version;
            let body = update.body || 'Bug fixes and improvements';
            
            // Clean up release notes (remove manual installation instructions)
            body = body.replace(/## Installation[\s\S]*$/i, '').trim();
            body = body.replace(/### Manual Installation[\s\S]*$/i, '').trim();
            
            const message = `A new version (${version}) is available!\n\n${body}\n\nThe update will be downloaded and installed automatically.`;
            
            // Try dialog API with fallback for ACL errors
            let shouldUpdate = true;
            if (window.__TAURI__?.dialog) {
                try {
                    const { ask } = window.__TAURI__.dialog;
                    shouldUpdate = await ask(message, {
                        title: 'Update Available',
                        kind: 'info',
                        okLabel: 'Update',
                        cancelLabel: 'Later'
                    });
                } catch (error) {
                    console.log('Dialog failed, auto-installing:', error.message);
                }
            }
            
            if (shouldUpdate) {
                console.log('Downloading and installing update...');
                await update.downloadAndInstall();
                
                // Try to restart
                if (window.__TAURI__?.process?.relaunch) {
                    try {
                        const { ask } = window.__TAURI__.dialog;
                        const shouldRelaunch = await ask(
                            'Update installed successfully. Restart now?',
                            { title: 'Update Complete', kind: 'info', 
                              okLabel: 'Restart Now', cancelLabel: 'Later' }
                        );
                        if (shouldRelaunch) {
                            await window.__TAURI__.process.relaunch();
                        }
                    } catch (error) {
                        console.log('Auto-restarting...', error.message);
                        await window.__TAURI__.process.relaunch();
                    }
                }
            }
        } else if (!silent) {
            if (window.__TAURI__?.dialog) {
                const { message } = window.__TAURI__.dialog;
                await message('You are running the latest version!', 
                             { title: 'No Updates', kind: 'info' });
            }
        }
    } catch (error) {
        console.error('Update check failed:', error);
        if (!silent && window.__TAURI__?.dialog) {
            const { message } = window.__TAURI__.dialog;
            await message(`Failed to check for updates: ${error.message}`, 
                         { title: 'Update Error', kind: 'error' });
        }
    }
}

// Initialize on app start
if (window.__TAURI__) {
    setupUpdater();
}
```

### Step 7: Add Menu Item (in lib.rs)

**⚠️ CRITICAL: Import Emitter trait for emit() method**

```rust
use tauri::{Emitter, Manager};  // ⚠️ Must import Emitter!
use tauri::menu::{Menu, MenuItem, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};

fn create_menu(app: &tauri::AppHandle) -> Result<Menu<tauri::Wry>, tauri::Error> {
    let check_updates = MenuItemBuilder::with_id("check-for-updates", "Check for Updates...")
        .build(app)?;
    
    // Add to app menu (macOS) or Help menu (Windows/Linux)
    let app_menu = SubmenuBuilder::new(app, "Your App Name")
        .item(&PredefinedMenuItem::about(app, None, None)?)
        .item(&check_updates)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;
    
    let menu = Menu::new(app)?;
    menu.append(&app_menu)?;
    
    Ok(menu)
}

// In .setup():
app.set_menu(create_menu(app)?)?;
app.on_menu_event(|app, event| {
    if event.id() == "check-for-updates" {
        if let Some(window) = app.get_webview_window("main") {
            window.emit("check-for-updates", ()).unwrap();  // emit() requires Emitter trait
        }
    }
});
    }
});
```

## Part 2: DevTools Setup

### Step 1: Enable DevTools Feature

Already done in Cargo.toml above:

```toml
[dependencies]
tauri = { version = "2", features = ["devtools"] }

[features]
default = ["devtools"]
devtools = ["tauri/devtools"]
```

### Step 2: Add Toggle DevTools Menu

In `lib.rs`:

```rust
#[tauri::command]
#[cfg(any(debug_assertions, feature = "devtools"))]
fn toggle_devtools(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_devtools_open() {
            window.close_devtools();
        } else {
            window.open_devtools();
        }
    }
}

// Add to menu:
let toggle_dev = MenuItem::with_id(
    app,
    "toggle-devtools",
    "Toggle Developer Tools",
    true,
    Some("CmdOrCtrl+Shift+I"),
)?;

// Register command:
.invoke_handler(tauri::generate_handler![toggle_devtools])
```

### Step 3: Frontend DevTools Toggle

```javascript
window.__TAURI__.event.listen('toggle-devtools', async () => {
    try {
        await window.__TAURI__.core.invoke('plugin:webview|internal_toggle_devtools');
    } catch (error) {
        console.error('Failed to toggle devtools:', error);
    }
});
```

## Part 3: GitHub Actions Workflow

**Critical configurations for auto-update:**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    permissions:
      contents: write  # Required for creating releases
    strategy:
      matrix:
        include:
          - platform: 'macos-latest'
            target: 'aarch64-apple-darwin'
          - platform: 'macos-latest'
            target: 'x86_64-apple-darwin'
          - platform: 'windows-latest'
            target: 'x86_64-pc-windows-msvc'
    
    runs-on: ${{ matrix.platform }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: lts/*
      
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}
      
      - name: Install frontend dependencies
        run: npm install  # ⚠️ REQUIRED even if no frontend deps!
      
      - name: Build Tauri App
        uses: tauri-apps/tauri-action@v0  # Use v0 for Tauri 2.x
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ""  # Empty for password-free key
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'Release ${{ github.ref_name }}'
          releaseBody: 'See the assets below to download the app for your platform.'
          releaseDraft: true  # Create draft for review before publishing
          prerelease: false
          args: ${{ matrix.args }}
```

**Critical Environment Variables:**
- `GITHUB_TOKEN`: Auto-provided by GitHub Actions
- `TAURI_SIGNING_PRIVATE_KEY`: Your **base64-encoded** private key (add to repo secrets)
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: Set to `""` for password-free keys

**Important Notes:**
- ✅ Use `tauri-action@v0` (supports Tauri 2.x)
- ✅ `npm install` is REQUIRED even if you have no frontend dependencies (tauri-action needs it)
- ✅ Add `args: ${{ matrix.args }}` to pass target-specific arguments
- ✅ `createUpdaterArtifacts: true` in tauri.conf.json triggers automatic `.sig` file generation
- ✅ `latest.json` is automatically generated by tauri-action
- ⚠️ Private key in GitHub secret must be base64-encoded single-line (see Step 3)

### Step 8: Add GitHub Secret

1. Go to your repo: Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `TAURI_SIGNING_PRIVATE_KEY`
4. Value: Paste the entire contents of `~/.tauri/eventlogger-nopass.key`
5. Click "Add secret"

## Part 4: Testing & Troubleshooting

### Testing the Complete Flow

1. **Create initial release:**
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

2. **Wait for GitHub Actions** to build and create release

3. **Download and install** the built app

4. **Create new release:**
   - Update version in `Cargo.toml` and `tauri.conf.json` to `0.1.1`
   - Commit and push
   - Create new tag: `git tag v0.1.1 && git push origin v0.1.1`

5. **Test update** in installed app:
   - Click "Check for Updates..."
   - Should show native dialog with update
   - Click "Update"
   - Should download, install, and prompt to restart

### Common Issues & Solutions

#### ❌ No `.sig` files or `latest.json` generated

**Problem:** GitHub Actions builds successfully but no signature files created

**Solution:** 
```json
// In tauri.conf.json
"bundle": {
  "createUpdaterArtifacts": true  // ⚠️ This MUST be true!
}
```

#### ❌ Dialog shows "Command plugin:dialog|ask not allowed by ACL"

**Problem:** Dialog plugin not permitted

**Solution:** Add to `capabilities/default.json`:
```json
{
  "permissions": [
    "dialog:default",   // Add this
    "process:default"   // And this
  ]
}
```

#### ❌ GitHub Actions fails: "Private key password required"

**Problem:** Signing key has password protection

**Solution:** Generate password-free key:
```bash
cargo tauri signer generate --write-keys ~/.tauri/yourapp-nopass.key
```

#### ❌ Update detected but nothing happens

**Problem:** JavaScript errors preventing update execution

**Solution:** Wrap dialog calls in try-catch:
```javascript
try {
    const { ask } = window.__TAURI__.dialog;
    shouldUpdate = await ask(message, options);
} catch (error) {
    console.log('Dialog failed, auto-installing:', error);
    shouldUpdate = true;  // Fallback to auto-install
}
```

#### ❌ "Public key verification failed"

**Problem:** Public key in config doesn't match private key used for signing

**Solution:**
1. Verify public key in `tauri.conf.json` matches key generated with private key
2. Include the full key with the `untrusted comment:` line
3. Regenerate keypair if needed and update both config and GitHub secret

#### ❌ Updater not working in development

**Expected behavior!** Updater only works in production builds:
```bash
# Development (updater disabled):
cargo tauri dev

# Production (updater enabled):
cargo tauri build
```

#### ❌ Multi-arch builds create duplicate artifact names

**Problem:** Apple Silicon and Intel builds overwrite each other

**Solution:** Add target-specific args:
```yaml
args: --target ${{ matrix.target }}
```

#### ❌ DevTools menu item doesn't work

**Problem:** DevTools feature not enabled or command not registered

**Solution:**
1. Check `Cargo.toml` has `tauri = { features = ["devtools"] }`
2. Check `tauri.conf.json` has `"devtools": true` in windows config
3. Verify command is registered: `.invoke_handler(tauri::generate_handler![toggle_devtools])`

### Version Number Best Practices

✅ **Do:**
- Use semantic versioning: `MAJOR.MINOR.PATCH`
- Keep versions in sync: `Cargo.toml`, `tauri.conf.json`, and `package.json`
- Always increment version for new releases
- Use tags matching version: `v0.1.2`

❌ **Don't:**
- Skip versions
- Reuse version numbers
- Use different versions across config files

### Security Checklist

- [ ] Private key stored securely (not in git)
- [ ] Private key added to GitHub Secrets only
- [ ] Public key embedded in `tauri.conf.json`
- [ ] `.tauri/` directory in `.gitignore`
- [ ] HTTPS used for all update endpoints
- [ ] CSP configured to allow necessary IPC calls

## Part 5: Optional Enhancements

### Auto-Check for Updates on Startup

Add to your updater initialization:

```javascript
async function setupUpdater() {
    // ... existing setup code ...
    
    // Silent check 3 seconds after launch
    setTimeout(() => checkForUpdates(true), 3000);
}
```

### Custom Update UI

Instead of native dialogs, you can create custom UI:

```javascript
// Create custom modal/notification
function showCustomUpdateNotification(version, notes) {
    // Your custom UI code here
}

// Use in checkForUpdates instead of dialog.ask()
```

### Update Progress Indicator

```javascript
const { onUpdaterEvent } = window.__TAURI__.updater;

await onUpdaterEvent(({ error, status }) => {
    if (status === 'PENDING') {
        console.log('Checking for updates...');
    } else if (status === 'DOWNLOADING') {
        console.log('Downloading update...');
    } else if (status === 'DONE') {
        console.log('Update downloaded!');
    } else if (status === 'ERROR') {
        console.error('Update error:', error);
    }
});
```

### Staged Rollouts

You can implement staged rollouts by controlling which users see updates:

```javascript
async function checkForUpdates(silent = false) {
    // Only check for updates for certain users/conditions
    if (!shouldCheckForUpdates()) return;
    
    // ... rest of update code
}
```

## Resources

### Documentation
- [Tauri 2.x Updater Plugin](https://v2.tauri.app/plugin/updater/)
- [Tauri Signing Guide](https://v2.tauri.app/security/signing/)
- [Tauri GitHub Action](https://github.com/tauri-apps/tauri-action)
- [Tauri ACL Documentation](https://v2.tauri.app/security/capabilities/)

### Example Repositories
- [HC3 Event Logger](https://github.com/jangabrielsson/EventLogger) - Complete working example
- [Tauri Action Examples](https://github.com/tauri-apps/tauri-action/tree/dev/examples)

### Tools
- [Minisign](https://jedisct1.github.io/minisign/) - Signing tool used by Tauri
- [GitHub Actions Debugging](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/enabling-debug-logging)

## Summary Checklist

Before deploying auto-update:

- [ ] All plugins added to `Cargo.toml` with devtools feature
- [ ] All plugins initialized in `lib.rs`
- [ ] Password-free signing key generated
- [ ] **Keys base64-encoded as single-line strings** (tr -d '\n')
- [ ] Public key in `tauri.conf.json` (base64 format)
- [ ] `createUpdaterArtifacts: true` in config
- [ ] **`signingIdentity: "-"` in bundle.macOS config**
- [ ] ACL permissions for dialog and process
- [ ] **Emitter trait imported** (use tauri::{Emitter, Manager})
- [ ] DevTools enabled and menu item added
- [ ] Frontend updater code implemented
- [ ] Try-catch blocks for graceful error handling
- [ ] GitHub Actions workflow configured
- [ ] **npm install step** in GitHub Actions
- [ ] Private key added to GitHub Secrets (base64 format)
- [ ] CSP allows IPC calls

## Troubleshooting

### Common Build Errors

**Error: `failed to decode pubkey: Invalid symbol 32, offset 9`**
- **Cause**: Public or private key has spaces/newlines
- **Fix**: Use base64-encoded single-line format (see Step 3)
```bash
cat ~/.tauri/your.key | tr -d '\n' | tr -d '%'
```

**Error: `no method named 'emit' found`**
- **Cause**: Missing Emitter trait import
- **Fix**: Add to imports: `use tauri::{Emitter, Manager};`

**Error: `sh: tauri: command not found` in GitHub Actions**
- **Cause**: Missing npm install step
- **Fix**: Add `npm install` step before tauri-action (even if no deps)

**Error: App won't open on macOS (damaged/unidentified developer)**
- **Cause**: Missing ad-hoc code signing
- **Fix**: Add `"signingIdentity": "-"` to `bundle.macOS` in tauri.conf.json

**Error: `no method named 'is_devtools_open' found`**
- **Cause**: Missing devtools feature
- **Fix**: Add `features = ["devtools"]` to tauri dependency in Cargo.toml

**Error: Update check fails silently**
- **Cause**: Missing ACL permissions for updater/dialog/process
- **Fix**: Check `capabilities/default.json` includes all required permissions

### Testing Updates

1. **Build and install v0.1.0** locally
2. **Create and push v0.1.1 tag** to trigger GitHub Actions
3. **Wait for release** to be published
4. **Launch v0.1.0 app** and wait 3 seconds (auto-check)
5. **Or use menu** "Check for Updates..." (manual check)
6. **Update dialog** should appear with release notes
7. **After download** app should prompt to restart
8. **Verify new version** after restart

### Debug Commands

```bash
# Check key format
file ~/.tauri/your.key
cat ~/.tauri/your.key  # Should show base64-like content

# Test local build
cargo tauri build --debug

# Check GitHub Actions logs
# Go to: https://github.com/USERNAME/REPO/actions

# Verify release assets
# Should see: app.dmg, app.dmg.sig, latest.json
```
- [ ] Tested with actual releases

---

*Last updated: October 2025 - Based on Tauri 2.9.1*
