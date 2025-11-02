# iPad/iOS Development Guide

This guide documents how to build and test HomeMap on iPad/iOS simulator.

## Prerequisites

1. **macOS with Xcode** - Xcode 17.0.1 or later
2. **Rust with iOS targets** - Install via rustup
3. **Tauri CLI** - For building iOS apps
4. **xcodegen** - For generating Xcode projects

## Initial Setup

### 1. Install Rust iOS Targets

```bash
# Add iOS compilation targets
rustup target add aarch64-apple-ios          # Physical iOS devices
rustup target add aarch64-apple-ios-sim      # M1+ Mac simulators  
rustup target add x86_64-apple-ios           # Intel Mac simulators
```

### 2. Install xcodegen

```bash
brew install xcodegen
```

### 3. Check Available Simulators

```bash
# List all available iPad simulators
xcrun simctl list devices available | grep iPad
```

## Project Configuration

### Key Files Modified for iOS Support

1. **src-tauri/Cargo.toml**
   - Removed `devtools` feature from default features (causes localhost dev server issues on iOS)
   - Made `devtools` a platform-specific feature for desktop only
   - Made `rfd` (file picker) desktop-only dependency

2. **src-tauri/tauri.conf.json**
   - Added `devUrl` for desktop development
   - Set `frontendDist` to `../src`

3. **src-tauri/tauri.ios.conf.json** (iOS-specific config)
   ```json
   {
     "build": {
       "devUrl": null,
       "frontendDist": "../src"
     }
   }
   ```

4. **src-tauri/gen/apple/project.yml**
   - Added frontend `src` folder as Xcode resources
   - Added `homemapdata.example` template folder as Xcode resources
   - Custom build script compiles Rust with `--no-default-features --features custom-protocol`

5. **src-tauri/src/lib.rs**
   - Conditional compilation for mobile platforms
   - `select_homemap_folder` has desktop (with rfd) and mobile (error) implementations
   - Menu creation wrapped in `#[cfg(not(any(target_os = "ios")))]`

### Template Files

The `homemapdata.example` folder contains template files that get copied to the app's Application Support directory on first run:
- `config.json` - Default floor configuration
- `images/default-floor.png` - Default floor image
- `images/floor1.png`, `floor2.png` - Example floor plans
- `icons/` - Default device icons
- `widgets/` - Default widget definitions

## Building for iOS Simulator

### Using Tauri CLI (Recommended)

```bash
# Build for M1+ Mac simulator (arm64)
cargo tauri ios build --target aarch64-sim

# Build for Intel Mac simulator (x86_64) 
cargo tauri ios build --target x86_64
```

The build output will be at:
```
/Users/[user]/Library/Developer/Xcode/DerivedData/homemap-*/Build/Products/release-iphonesimulator/HomeMap.app
```

### Using Xcode Directly

1. Open the project:
   ```bash
   open src-tauri/gen/apple/homemap.xcodeproj
   ```

2. Select **iPad Pro 13-inch (M4)** simulator (or any iPad)

3. Set scheme to **Release** (not Debug)

4. Build (⌘B) and Run (⌘R)

**Note:** Building through Xcode requires the custom build scripts in `project.yml` to be properly set up via xcodegen first.

## Installing and Running

### Get Simulator ID

```bash
# Find your iPad simulator ID
xcrun simctl list devices available | grep "iPad Pro 13-inch (M4)"
# Example output: iPad Pro 13-inch (M4) (8A59145B-5E6D-40EE-A51F-DD28EEBFD408) (Booted)
```

### Install App

```bash
# Replace SIMULATOR_ID with your iPad's ID from above
xcrun simctl install SIMULATOR_ID /Users/[user]/Library/Developer/Xcode/DerivedData/homemap-*/Build/Products/release-iphonesimulator/HomeMap.app
```

### Launch App

```bash
# Launch with console output for debugging
xcrun simctl launch --console SIMULATOR_ID com.gabrielsson.homemap
```

### Uninstall App (Clean Install)

```bash
# Uninstall to clear all app data
xcrun simctl uninstall SIMULATOR_ID com.gabrielsson.homemap
```

## Troubleshooting

### "Failed to request tauri://localhost" Error

**Cause:** The app was compiled with the `devtools` feature enabled, which tries to connect to a development server.

**Solution:** Ensure building with `--no-default-features --features custom-protocol` (already configured in `project.yml`)

### Missing Floor Images

**Cause:** The `homemapdata.example` folder was not bundled with the app, or template files were updated after initial setup.

**Solution:** 
1. Verify `homemapdata.example` is listed in `project.yml` as a resource
2. Regenerate Xcode project: `cd src-tauri/gen/apple && xcodegen generate`
3. Rebuild the app

### Clearing App Data

To reset the app and recreate the homemapdata folder:

```bash
# Use the helper script (recommended)
./scripts/ios-clear-data.sh

# Or manually:
# Get the app's data container path (handles changing container IDs)
CONTAINER=$(xcrun simctl get_app_container $SIM_ID com.gabrielsson.homemap data)

# Remove the homemapdata folder
rm -rf "$CONTAINER/Library/Application Support/HomeMap/homemapdata"

# Relaunch the app - it will recreate from template
xcrun simctl launch --console $SIM_ID com.gabrielsson.homemap
```

**Note:** The container ID changes every time you uninstall/reinstall the app. Always use `xcrun simctl get_app_container` to get the current path.

### Homebrew Rust Conflicts

If you have Rust installed via Homebrew, it may conflict with rustup's iOS-capable toolchain.

**Temporary workaround:**
```bash
# Backup Homebrew Rust binaries
sudo mv /opt/homebrew/bin/cargo /opt/homebrew/bin/cargo.backup
sudo mv /opt/homebrew/bin/rustc /opt/homebrew/bin/rustc.backup

# After iOS development, restore:
sudo mv /opt/homebrew/bin/cargo.backup /opt/homebrew/bin/cargo
sudo mv /opt/homebrew/bin/rustc.backup /opt/homebrew/bin/rustc
```

## Development Workflow

### Helper Scripts

The project includes helper scripts in `scripts/` to simplify iOS development:

```bash
# Build the app
./scripts/ios-build.sh

# Install and run (on existing data)
./scripts/ios-run.sh

# Clear app data (forces template recreation)
./scripts/ios-clear-data.sh

# Full rebuild: build + clear data + install + launch
./scripts/ios-rebuild.sh
```

**About Container IDs**: The app's container ID changes every time you uninstall/reinstall. The scripts automatically handle this by using `xcrun simctl get_app_container` to find the current container path.

### Manual Commands

If you prefer to run commands manually:

```bash
cd /path/to/HomeMap

# Build
cargo tauri ios build --target aarch64-sim 2>&1 | grep -E "(Finished|BUILD SUCCEEDED|Error)"

# Get simulator ID (automatically finds it)
SIM_ID=$(xcrun simctl list devices available | grep "iPad Pro 13-inch (M4)" | grep -o '[A-F0-9-]\{36\}' | head -1)

# Find app bundle
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData/homemap-* -name "HomeMap.app" -path "*/release-iphonesimulator/*" | head -1)

# Install and launch
xcrun simctl install $SIM_ID "$APP_PATH"
xcrun simctl launch --console $SIM_ID com.gabrielsson.homemap
```

### Updating Template Files

When updating files in `homemapdata.example/`:

1. Make your changes to `homemapdata.example/config.json`, images, etc.
2. Rebuild the app to bundle the updated files
3. Clear existing user data (see "Clearing App Data" above)
4. Launch the app - it will use the new template

## File Locations

### Source Files
- Frontend: `src/` (HTML, CSS, JS)
- Backend: `src-tauri/src/` (Rust)
- iOS Config: `src-tauri/gen/apple/` (generated by Tauri)
- Template: `homemapdata.example/`

### App Bundle Structure
```
HomeMap.app/
├── HomeMap                          # Binary
├── Info.plist
├── src/                            # Frontend files (bundled)
│   ├── index.html
│   ├── script.js
│   └── styles.css
└── homemapdata.example/            # Template (bundled)
    ├── config.json
    ├── images/
    ├── icons/
    └── widgets/
```

### Runtime Locations
```
[App Container]/
└── Library/
    └── Application Support/
        └── HomeMap/
            ├── settings.json        # App settings
            └── homemapdata/         # User data (copied from template)
                ├── config.json      # Floor configuration
                ├── images/          # Floor images
                ├── icons/           # Custom icons
                └── widgets/         # Custom widgets
```

## Platform Differences

### Desktop vs iOS

| Feature | Desktop | iOS |
|---------|---------|-----|
| File picker | ✅ Native dialog (rfd) | ❌ Not supported |
| DevTools | ✅ Enabled | ❌ Disabled (causes issues) |
| Menu | ✅ Native menu | ❌ Not applicable |
| File access | Direct filesystem | Sandboxed container |
| Hot reload | ✅ Dev server | ❌ Bundled files only |

### Conditional Compilation

The codebase uses Rust's `cfg` attributes to handle platform differences:

```rust
// Desktop-only code
#[cfg(not(any(target_os = "ios", target_os = "android")))]
async fn select_homemap_folder() -> Result<String, String> {
    // Uses rfd file picker
}

// Mobile fallback
#[cfg(any(target_os = "ios", target_os = "android"))]
async fn select_homemap_folder() -> Result<String, String> {
    Err("Not supported on mobile".to_string())
}
```

## Known Issues

1. **"Directory not empty" error at end of build** - This is harmless and can be ignored. The app builds successfully.

2. **Settings button shows file picker (iOS)** - The folder selection UI is disabled on iOS, but the button is still visible. This is expected behavior.

## Next Steps for Production

- [ ] Add actual iOS device build configuration (`aarch64-apple-ios` target)
- [ ] Configure code signing for App Store distribution
- [ ] Test on physical iPad devices
- [ ] Implement mobile-specific folder selection UI (browse within app container)
- [ ] Add proper error handling for mobile-unsupported features
- [ ] Consider TestFlight distribution for beta testing

## References

- [Tauri iOS Guide](https://v2.tauri.app/develop/mobile/)
- [Rust Cross Compilation](https://rust-lang.github.io/rustup/cross-compilation.html)
- [xcodegen Documentation](https://github.com/yonaskolb/XcodeGen)
