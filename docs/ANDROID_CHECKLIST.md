# 📱 Android Setup Checklist

Quick checklist for setting up Android development for HomeMap.

## ✅ Installation Checklist

### Step 1: Install Android Studio
- [ ] Download Android Studio from https://developer.android.com/studio
- [ ] Install Android Studio to `/Applications`
- [ ] Run Android Studio setup wizard
- [ ] Install SDK (automatic during setup)
- [ ] Install NDK via Tools → SDK Manager → SDK Tools → NDK (Side by side)
- [ ] Create Android Virtual Device (AVD) via Tools → Device Manager

### Step 2: Configure Environment
- [ ] Run `./scripts/setup-android-env.sh`
- [ ] Add environment variables to `~/.zshrc` (or use `--auto` flag)
- [ ] Run `source ~/.zshrc`
- [ ] Verify: `echo $ANDROID_HOME` shows path
- [ ] Verify: `echo $ANDROID_NDK_HOME` shows path
- [ ] Verify: `echo $JAVA_HOME` shows path
- [ ] Verify: `java -version` works
- [ ] Verify: `adb version` works

### Step 3: Install Rust Targets
- [ ] Run: `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`
- [ ] Verify: `rustup target list --installed | grep android` shows all 4 targets

### Step 4: Initialize Android Project
- [ ] Run `./scripts/init-android.sh`
- [ ] Verify: `src-tauri/gen/android` directory exists
- [ ] Verify: No error messages during init

### Step 5: First Build
- [ ] Run `./scripts/android-start-emulator.sh`
- [ ] Wait for emulator to fully boot (~60 seconds)
- [ ] Run `./scripts/android-build.sh`
- [ ] Build completes without errors
- [ ] Run `./scripts/android-run.sh`
- [ ] App launches on emulator

## 🎯 Quick Start (After Setup)

Once everything is installed, your workflow is:

```bash
# Start emulator (once per session)
./scripts/android-start-emulator.sh

# Build and run (every time you make changes)
./scripts/android-rebuild.sh
```

## 📊 Verification Commands

Run these to verify your setup:

```bash
# Check environment variables
echo "ANDROID_HOME: $ANDROID_HOME"
echo "ANDROID_NDK_HOME: $ANDROID_NDK_HOME"
echo "JAVA_HOME: $JAVA_HOME"

# Check tools
java -version
adb version

# Check Rust targets
rustup target list --installed | grep android

# Check emulators
emulator -list-avds

# Check Android project
ls src-tauri/gen/android
```

All should produce valid output without errors.

## 🐛 Common Issues

| Issue | Quick Fix |
|-------|-----------|
| "ANDROID_HOME not set" | Run `./scripts/setup-android-env.sh --auto && source ~/.zshrc` |
| "NDK not found" | Install via Android Studio: Tools → SDK Manager → SDK Tools |
| "No emulators" | Create AVD in Android Studio: Tools → Device Manager |
| "Build fails" | Run `./scripts/android-clear-data.sh` then rebuild |
| "Rust target missing" | Run `rustup target add aarch64-linux-android` (add others too) |

## 📚 Full Documentation

- **Complete Guide**: `docs/ANDROID_INSTALL.md`
- **Detailed Setup**: `docs/ANDROID_SETUP.md`

## ⏱️ Expected Time

- **First-time setup**: 30-45 minutes (includes downloads)
- **First build**: 5-10 minutes
- **Subsequent builds**: 30-60 seconds
