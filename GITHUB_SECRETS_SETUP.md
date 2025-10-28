# GitHub Secrets Setup Instructions

## Required Secrets

To enable auto-updates, you need to add two secrets to your GitHub repository:

### 1. TAURI_SIGNING_PRIVATE_KEY

This is the private key used to sign the updater packages.

**Value:** Get from `AUTOUPDATE_KEYS.md` (base64-encoded private key)

### 2. TAURI_SIGNING_PRIVATE_KEY_PASSWORD

This is the password you entered when generating the signing keys.

**Value:** The password you entered during `cargo tauri signer generate`

## How to Add Secrets

1. Go to your repository: https://github.com/jangabrielsson/HomeMap

2. Click on **Settings** (top menu)

3. In the left sidebar, expand **Secrets and variables** → Click **Actions**

4. Click **New repository secret**

5. Add first secret:
   - **Name:** `TAURI_SIGNING_PRIVATE_KEY`
   - **Value:** Copy the base64 private key from `AUTOUPDATE_KEYS.md`
   - Click **Add secret**

6. Add second secret:
   - Click **New repository secret** again
   - **Name:** `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
   - **Value:** The password you entered when generating keys
   - Click **Add secret**

## Verify Setup

After adding the secrets:

1. Create a test release:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

2. Go to **Actions** tab in your repository

3. You should see a "Release" workflow running

4. Once complete, check the **Releases** page - you should see:
   - DMG files for macOS (Intel and Apple Silicon)
   - Setup.exe for Windows
   - `.sig` signature files for each
   - `latest.json` updater manifest

## Troubleshooting

### "Private key password required" Error

If you see this error in GitHub Actions:
- Make sure `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secret is set correctly
- Verify it matches the password you used when generating the keys

### No Signature Files Generated

If `.sig` files are missing:
- Check that `createUpdaterArtifacts: true` in `src-tauri/tauri.conf.json`
- Verify the public key is correctly set in `tauri.conf.json`

### Actions Workflow Not Running

If the workflow doesn't trigger:
- Make sure the tag starts with `v` (e.g., `v0.1.0`)
- Check that `.github/workflows/release.yml` is committed and pushed

## Security Notes

⚠️ **Never commit these secrets to git!**
- The private key file (`~/.tauri/homemap.key`) should stay on your local machine
- The `AUTOUPDATE_KEYS.md` file is gitignored
- Only add secrets through the GitHub web interface
- Treat the private key and password like passwords - keep them secure!

## Next Steps

Once secrets are configured:

1. ✅ GitHub Actions workflow is ready
2. ✅ Signing keys are configured
3. ✅ Auto-updater is enabled in the app
4. 🎉 Ready to create your first release!

Create your first release:
```bash
git tag v0.1.0
git push origin v0.1.0
```

Then watch the magic happen in the Actions tab! 🚀
