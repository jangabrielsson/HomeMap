# Auto-Update Setup Complete! ✅

## What Was Configured

### 1. Dependencies Added
- ✅ `tauri-plugin-updater` - Core updater functionality
- ✅ `tauri-plugin-dialog` - Native update dialogs
- ✅ `tauri-plugin-process` - App restart after update

### 2. Backend (Rust)
- ✅ Initialized updater, dialog, and process plugins in `lib.rs`
- ✅ Added "Check for Updates..." menu item to HomeMap menu
- ✅ Added menu event handler to emit `check-for-updates` event
- ✅ Added `Emitter` trait import for event emission

### 3. Frontend (JavaScript)
- ✅ Created `src/updater.js` with full update flow:
  - Silent startup check capability
  - Manual "Check for Updates" from menu
  - Native dialogs for update prompts
  - Automatic download and install
  - Graceful restart after update
  - Error handling with fallbacks

### 4. Permissions (ACL)
- ✅ Added all required permissions to `capabilities/default.json`:
  - `dialog:default` - For native dialogs
  - `process:default` - For app restart
  - `updater:*` - For update checking and installation

### 5. Configuration
- ✅ Updated `tauri.conf.json`:
  - `createUpdaterArtifacts: true` - Critical for updater!
  - Updater endpoint: GitHub releases
  - Public key configured
  - Dialog enabled

### 6. Signing Keys
- ✅ Generated minisign keypair at `~/.tauri/homemap.key`
- ✅ Public key added to `tauri.conf.json`
- ✅ Private key documented in `AUTOUPDATE_KEYS.md` (gitignored)
- ⚠️ **Note:** Keys were generated with password - you'll need to store password in GitHub Secrets

## How It Works

1. **User triggers update check:**
   - Menu: HomeMap → Check for Updates...
   - Or: Automatic check on startup (can be enabled)

2. **Update flow:**
   ```
   Check GitHub → Update available? → Show dialog → Download & Install → Restart
   ```

3. **Silent mode:**
   - No dialogs shown if no update available
   - Perfect for startup checks

## Testing Locally

```bash
# Build the app
cargo tauri build --debug

# Run from bundle
open src-tauri/target/debug/bundle/macos/HomeMap.app

# Try "Check for Updates" from menu
# Should show "No updates available" (no releases yet)
```

## Next Steps for Full Auto-Update

### Step 1: Create GitHub Repository
```bash
cd /Users/jangabrielsson/Desktop/Fibaro/HomeMap
git init
git add .
git commit -m "Initial commit with auto-updater"
git remote add origin https://github.com/jangabrielsson/HomeMap.git
git push -u origin main
```

### Step 2: Add GitHub Secrets
1. Go to: https://github.com/jangabrielsson/HomeMap/settings/secrets/actions
2. Add two secrets:
   - `TAURI_SIGNING_PRIVATE_KEY` = (see `AUTOUPDATE_KEYS.md`)
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = (password you entered when generating keys)

### Step 3: Create GitHub Actions Workflow
Create `.github/workflows/release.yml` - see `docs/UPDATER_SETUP.md` lines 400-600 for complete workflow.

### Step 4: Create First Release
```bash
# Bump version in src-tauri/tauri.conf.json
# Then:
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions will:
- Build for macOS (Intel + Apple Silicon), Windows, Linux
- Sign the updater artifacts with your private key
- Create GitHub release with `latest.json`
- Upload DMG, installers, and signed updater packages

### Step 5: Test Update Flow
1. Install v0.1.0 on your machine
2. Bump version to v0.1.1 and create new release
3. Open installed v0.1.0 app
4. Click "Check for Updates"
5. Should prompt to download v0.1.1
6. Accept → Download → Install → Restart
7. App relaunches as v0.1.1! 🎉

## Files Modified

- `src-tauri/Cargo.toml` - Added 3 new plugins
- `src-tauri/src/lib.rs` - Plugins, menu item, event handler
- `src-tauri/capabilities/default.json` - ACL permissions
- `src-tauri/tauri.conf.json` - Updater config with public key
- `src/updater.js` - New file, frontend update logic
- `src/index.html` - Include updater.js
- `.gitignore` - Exclude AUTOUPDATE_KEYS.md

## Important Notes

⚠️ **Password-Protected Keys:** Your signing keys have a password. This is fine for security, but you MUST set `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` in GitHub Secrets.

✅ **Build Verified:** The app builds successfully with all updater plugins.

✅ **Menu Works:** "Check for Updates..." menu item is integrated.

✅ **Updater Artifacts:** The `.tar.gz` updater package is being created (verified in build output).

## Current Status

- ✅ Auto-updater fully configured in code
- ✅ Signing keys generated and documented
- ✅ Menu integration complete
- ✅ Frontend updater code ready
- ⏳ Waiting for GitHub repository creation
- ⏳ Waiting for GitHub Actions workflow
- ⏳ Waiting for first release tag

You're ready to create the GitHub repo and workflow! 🚀
