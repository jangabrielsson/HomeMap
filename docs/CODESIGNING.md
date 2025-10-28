# macOS Code Signing Guide for HC3 Event Logger

This document explains the code signing options for building and distributing the HC3 Event Logger application on macOS.

## Overview

Code signing is important for macOS applications to:
- Reduce security warnings when users open the app
- Enable distribution outside the Mac App Store
- Verify the application hasn't been tampered with
- Allow the app to use certain system features

## Current Configuration

The app is currently configured for **ad-hoc signing** in `src-tauri/tauri.conf.json`:

```json
"macOS": {
  "signingIdentity": "-",
  "minimumSystemVersion": "10.15"
}
```

## Signing Options

### 1. Ad-Hoc Signing (Current - No Cost)

**What it is:**
- Uses the special identity `-` which signs without a developer certificate
- No Apple Developer account required
- Free and works for personal distribution

**Pros:**
- ✅ No cost
- ✅ Better than unsigned
- ✅ Reduces some security warnings
- ✅ Works for GitHub releases and direct distribution

**Cons:**
- ❌ Users still need to right-click and select "Open" on first launch
- ❌ Shows "unidentified developer" warning
- ❌ Cannot be notarized by Apple
- ❌ Gatekeeper will block double-click opening

**User Experience:**
```
"hc3-event-logger.app can't be opened because it is from an unidentified developer"

Solution: Right-click → Open → Click "Open" in dialog
```

### 2. Developer ID Signing (Recommended for Wide Distribution - $99/year)

**What it is:**
- Uses a Developer ID certificate from Apple Developer Program
- Requires Apple Developer account ($99/year)
- Can be notarized by Apple for best user experience

**Pros:**
- ✅ Users can double-click to open (after notarization)
- ✅ No security warnings (after notarization)
- ✅ Professional distribution
- ✅ App Store distribution possible

**Cons:**
- ❌ Costs $99/year for Apple Developer Program
- ❌ Requires additional setup and tools
- ❌ Notarization process adds complexity

**Setup Required:**

1. **Enroll in Apple Developer Program**
   - Go to https://developer.apple.com
   - Pay $99/year enrollment fee
   - Wait for approval (usually 24-48 hours)

2. **Create Developer ID Certificate**
   - Open Xcode
   - Go to Preferences → Accounts
   - Add your Apple ID
   - Manage Certificates → Create "Developer ID Application" certificate

3. **Find Your Signing Identity**
   ```bash
   security find-identity -v -p codesigning
   ```
   
   Look for something like:
   ```
   1) ABC123XYZ "Developer ID Application: Your Name (TEAM_ID)"
   ```

4. **Update tauri.conf.json**
   ```json
   "macOS": {
     "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)",
     "providerShortName": "TEAM_ID",
     "minimumSystemVersion": "10.15"
   }
   ```

5. **Build the App**
   ```bash
   cargo tauri build
   ```

6. **Notarize the App** (Recommended)
   ```bash
   # Store credentials
   xcrun notarytool store-credentials "AC_PASSWORD" \
     --apple-id "your-email@example.com" \
     --team-id "TEAM_ID" \
     --password "app-specific-password"
   
   # Notarize the built app
   xcrun notarytool submit \
     "src-tauri/target/release/bundle/macos/hc3-event-logger.app.tar.gz" \
     --keychain-profile "AC_PASSWORD" \
     --wait
   
   # Staple the notarization ticket
   xcrun stapler staple "src-tauri/target/release/bundle/macos/hc3-event-logger.app"
   ```

   # Staple the notarization ticket
   xcrun stapler staple "src-tauri/target/release/bundle/macos/hc3-event-logger.app"
   ```

### 3. No Signing (Not Recommended)

**What it is:**
- Building without any code signing

**How to disable:**
```json
"macOS": {
  "signingIdentity": null,
  "minimumSystemVersion": "10.15"
}
```

**Not recommended because:**
- ❌ Worst user experience
- ❌ Maximum security warnings
- ❌ Some macOS features won't work
- ❌ Distribution will be difficult

## User Workarounds (For Current Ad-Hoc Signed Builds)

## User Workarounds (For Current Ad-Hoc Signed Builds)

Users can bypass the Gatekeeper warning using one of these methods:

### Method 1: Right-Click Open (Recommended)
1. Right-click (or Control-click) the app
2. Click "Open"
3. Click "Open" in the confirmation dialog

### Method 2: Terminal Command
```bash
xattr -cr /Applications/hc3-event-logger.app
```

### Method 3: System Settings
1. Try to open the app (it will be blocked)
2. Go to System Settings > Privacy & Security
3. Scroll down and click "Open Anyway"
4. Try opening the app again

## Recommendations

### For Personal Use or Small Distribution
✅ **Use ad-hoc signing (current setup)**
- Already configured
- No additional cost
- Acceptable for GitHub releases
- Users can easily bypass the warning with right-click

### For Professional Distribution
✅ **Use Developer ID + Notarization**
- Best user experience
- No warnings or extra steps for users
- Professional appearance
- Required for wide distribution

### For Mac App Store
✅ **Use Mac App Store signing**
- Different certificate type
- Requires additional app review
- See [Tauri Mac App Store Guide](https://tauri.app/distribute/app-store/)

## GitHub Actions Signing

## GitHub Actions Signing

To sign builds in GitHub Actions, you need to:

1. **Add secrets to GitHub repository:**
   - `APPLE_CERTIFICATE` - Base64 encoded .p12 certificate
   - `APPLE_CERTIFICATE_PASSWORD` - Certificate password
   - `APPLE_ID` - Your Apple ID email
   - `APPLE_PASSWORD` - App-specific password
   - `APPLE_TEAM_ID` - Your Team ID

2. **Export Certificate as Base64:**
   ```bash
   # Export certificate from Keychain as .p12
   # Then convert to base64:
   base64 -i certificate.p12 | pbcopy
   ```

3. **Update GitHub Actions workflow:**
   ```yaml
   - name: Import Code-Signing Certificates
     uses: apple-actions/import-codesign-certs@v1
     with:
       p12-file-base64: ${{ secrets.APPLE_CERTIFICATE }}
       p12-password: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
   
   - name: Build and Sign
     run: cargo tauri build
     env:
       APPLE_SIGNING_IDENTITY: "Developer ID Application: Your Name (TEAM_ID)"
   
   - name: Notarize
     run: |
       xcrun notarytool submit \
         "target/release/bundle/macos/*.app.tar.gz" \
         --apple-id "${{ secrets.APPLE_ID }}" \
         --password "${{ secrets.APPLE_PASSWORD }}" \
         --team-id "${{ secrets.APPLE_TEAM_ID }}" \
         --wait
   ```

## Current Status

**Current configuration:** Ad-hoc signing (`-`)

**What this means for users:**
- GitHub releases will be ad-hoc signed
- Users will see security warning on first launch
- Users must right-click and select "Open"
- No additional cost or setup required

**To upgrade to Developer ID:**
1. Enroll in Apple Developer Program
2. Create Developer ID certificate
3. Update `signingIdentity` in `tauri.conf.json`
4. Optionally add notarization step
5. Update GitHub Actions if using automated builds

## Troubleshooting

### "No identity found" error
```bash
# List available identities
security find-identity -v -p codesigning

# If empty, you need to create a certificate in Xcode
```

### Signature verification
```bash
# Check if app is signed
codesign -vvv --deep --strict "path/to/hc3-event-logger.app"

# Check notarization status
spctl -a -vvv "path/to/hc3-event-logger.app"
```

### Remove existing signature
```bash
codesign --remove-signature "path/to/hc3-event-logger.app"
```

## Resources

- [Tauri Code Signing Docs](https://tauri.app/v1/guides/distribution/sign-macos/)
- [Apple Developer Program](https://developer.apple.com/programs/)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Create App-Specific Password](https://support.apple.com/en-us/HT204397)

## Cost-Benefit Analysis

**Cost:** $99/year for Apple Developer Program (for Developer ID signing)

**Benefits:**
- ✓ Professional appearance
- ✓ No user friction
- ✓ Users can double-click to open
- ✓ Required for Mac App Store distribution
- ✓ Access to beta software and tools

**Current Ad-Hoc Signing:**
- ✓ Free
- ✓ Better than no signing
- ✓ Acceptable for community/open-source distribution
- ✓ Users can easily work around warnings

## Questions?

For issues related to code signing, please check:
1. This documentation
2. [Tauri documentation](https://tauri.app)
3. [GitHub Issues](https://github.com/jangabrielsson/EventLogger/issues)

