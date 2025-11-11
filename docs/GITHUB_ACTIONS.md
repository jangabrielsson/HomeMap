# GitHub Actions CI/CD Setup

This project now includes automated building and releases for multiple platforms, including Android.

## Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Triggers:** Push to main, Pull Requests  
**Purpose:** Test builds on all platforms before merging

**Jobs:**
- **Desktop Test:** Windows + macOS compilation testing
- **Android Test:** Android build compilation testing

### 2. Release Workflow (`.github/workflows/release.yml`)

**Triggers:** Git tags starting with `v*` (e.g., `v0.1.31`)  
**Purpose:** Create releases with binaries for all platforms

**Jobs:**
- **Desktop Release:** macOS (Intel + ARM), Windows
- **Android Release:** Universal APK (all architectures)

## Creating a Release

1. **Bump version using the version script:**
   ```bash
   ./scripts/version.sh
   ```

2. **Commit and tag:**
   ```bash
   git add .
   git commit -m "Release v0.1.31"
   git tag v0.1.31
   git push origin main --tags
   ```

3. **GitHub Actions will automatically:**
   - Build for all platforms
   - Create a GitHub release
   - Upload binaries (DMG, EXE, APK)
   - Generate release notes

## Release Assets

Each release includes:
- `HomeMap_*_aarch64.dmg` - macOS Apple Silicon (M1/M2/M3)
- `HomeMap_*_x64.dmg` - macOS Intel  
- `HomeMap_*_x64-setup.exe` - Windows installer
- `app-universal-release.apk` - Android APK (all architectures)

**Supported Platforms:**
- ✅ **macOS** (Intel + Apple Silicon)
- ✅ **Windows** (x64)  
- ✅ **Android** (ARM64, ARMv7, x86, x86_64)
- ❌ **Linux Desktop** (not included in releases)

## Android Build Details

The Android build:
- Uses Android NDK 29.0.14206865
- Targets: ARM64, ARMv7, x86, x86_64
- Generates universal APK for maximum compatibility
- Includes automatic signing with debug keystore
- Requires asset manifest generation

## Environment Requirements

**Android CI needs:**
- Java 17 (Temurin distribution)
- Android SDK with build-tools 34.0.0
- Android NDK 29.0.14206865
- Rust with Android targets
- Node.js LTS

**Secrets:** (for future signing)
- `TAURI_SIGNING_PRIVATE_KEY` - For desktop app signing
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` - For desktop app signing

## Performance Optimizations

### Caching Strategy
To speed up builds, especially the heavy Android setup, we cache:

- **Android SDK/NDK**: ~1GB+ of tools, saves 5-10 minutes per build
- **Rust Dependencies**: Cargo registry and compiled targets
- **Tauri CLI**: Avoid reinstalling the CLI every time
- **Node Modules**: NPM dependency cache (handled by setup-node)

### Cache Keys
- **Desktop**: `cargo-{os}-desktop-{lockfile-hash}`
- **Android**: `cargo-{os}-android-{lockfile-hash}`
- **Android SDK**: `android-sdk-{os}-ndk-29.0.14206865-build-tools-34.0.0`
- **Tauri CLI**: `tauri-cli-{os}-v2`

First builds will be slower as caches populate, but subsequent builds should be significantly faster.

## Troubleshooting

**If Android build fails:**
1. Check NDK/SDK versions match local development
2. Verify asset manifest generation succeeded
3. Check Rust target installation
4. Review Android build logs for specific errors

**If release upload fails:**
1. Verify file paths match expected locations
2. Check repository permissions
3. Ensure tag format is correct (`v*`)