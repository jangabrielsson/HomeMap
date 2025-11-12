# Android APK Signing Setup

## Overview
Android requires all APK files to be digitally signed before they can be installed on devices. This document explains how to set up APK signing for HomeMap releases.

## Prerequisites
- Java JDK installed (comes with Android Studio or standalone)
- Access to GitHub repository settings

## Step 1: Generate a Keystore (One-Time Setup)

The keystore is a file that stores your signing credentials. You only need to create this once.

```bash
keytool -genkey -v -keystore homemap-release.keystore \
  -alias homemap \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

This command will prompt you for:
1. **Keystore password**: Choose a strong password (e.g., 20+ characters)
2. **Key password**: Can be the same as keystore password for simplicity
3. **Personal information**:
   - Name (CN): Your name or company name
   - Organizational unit (OU): Optional, can press Enter
   - Organization (O): Optional, can press Enter  
   - City (L): Your city
   - State (ST): Your state/province
   - Country code (C): Two-letter country code (e.g., US, SE)

### Important Notes:
- **Keep this keystore file secure!** Store it in a password manager or secure backup
- **Never commit the keystore to git**
- **Keep the passwords secure** - you'll need them for every release
- If you lose the keystore, you cannot update your app on the Play Store

## Step 2: Encode Keystore for GitHub

To use the keystore in GitHub Actions, encode it as base64:

```bash
base64 -i homemap-release.keystore | tr -d '\n' | pbcopy
```

This copies the encoded keystore to your clipboard.

## Step 3: Add GitHub Secrets

1. Go to: https://github.com/YOUR_USERNAME/HomeMap/settings/secrets/actions
2. Click "New repository secret" and add each of these:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `ANDROID_KEYSTORE_BASE64` | (paste from clipboard) | Base64-encoded keystore file |
| `ANDROID_KEYSTORE_PASSWORD` | Your keystore password | Password you entered for the keystore |
| `ANDROID_KEY_ALIAS` | `homemap` | Key alias from keytool command |
| `ANDROID_KEY_PASSWORD` | Your key password | Password you entered for the key |

## Step 4: Verify Setup

Once the secrets are added:

1. Create a new release tag (e.g., `v0.1.36`)
2. Push the tag: `git push origin v0.1.36`
3. GitHub Actions will build and sign the APK
4. Check the release page for `app-arm64-release.apk` (signed)

## How It Works

### Workflow Process
1. GitHub Actions decodes the keystore from `ANDROID_KEYSTORE_BASE64`
2. Saves it to `src-tauri/gen/android/app/homemap-release.keystore`
3. Creates `keystore.properties` with signing credentials
4. Gradle reads `keystore.properties` during build
5. Gradle signs the APK with the keystore
6. Signed APK is uploaded to the release

### Build Configuration
The signing configuration is in `src-tauri/gen/android/app/build.gradle.kts`:

```kotlin
val keystoreProperties = Properties().apply {
    val propFile = file("../keystore.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

signingConfigs {
    create("release") {
        if (keystoreProperties.isNotEmpty()) {
            storeFile = file(keystoreProperties.getProperty("storeFile"))
            storePassword = keystoreProperties.getProperty("storePassword")
            keyAlias = keystoreProperties.getProperty("keyAlias")
            keyPassword = keystoreProperties.getProperty("keyPassword")
        }
    }
}

buildTypes {
    getByName("release") {
        signingConfig = signingConfigs.getByName("release")
        // ... other settings
    }
}
```

## Local Builds

To build and sign locally:

1. Create `src-tauri/gen/android/keystore.properties`:
```properties
storeFile=app/homemap-release.keystore
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=homemap
keyPassword=YOUR_KEY_PASSWORD
```

2. Copy your keystore:
```bash
cp homemap-release.keystore src-tauri/gen/android/app/
```

3. Build:
```bash
cargo tauri android build --target aarch64
```

4. Find signed APK at:
```
src-tauri/gen/android/app/build/outputs/apk/arm64/release/app-arm64-release.apk
```

## Troubleshooting

### "Keystore was tampered with, or password was incorrect"
- Verify the `ANDROID_KEYSTORE_PASSWORD` secret is correct
- Ensure base64 encoding didn't add line breaks (`tr -d '\n'`)

### "Could not read key alias from store"
- Verify the `ANDROID_KEY_ALIAS` matches what you used in keytool
- Check `ANDROID_KEY_PASSWORD` is correct

### APK still unsigned
- Check GitHub Actions logs for signing errors
- Verify all four secrets are set correctly
- Ensure `keystore.properties` file is created in workflow

### Lost keystore
If you lose the keystore:
- **Play Store**: You cannot update the existing app, must create new app
- **Direct installs**: Users must uninstall old version before installing new one
- **Solution**: Always keep secure backups!

## Security Best Practices

1. **Never commit keystore files**: Already in `.gitignore`
2. **Use strong passwords**: Minimum 20 characters
3. **Backup securely**: Store keystore and passwords in password manager
4. **Rotate if compromised**: Create new keystore, publish as new app
5. **Limit access**: Only repository admins should have keystore access

## References

- [Android App Signing Guide](https://developer.android.com/studio/publish/app-signing)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Tauri Android Build](https://v2.tauri.app/develop/build/)
