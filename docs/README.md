# Documentation Index

This directory contains comprehensive documentation for the HC3 QuickApp Manager project, based on learnings from the HC3 Event Logger project.

## Available Documentation

### [UPDATER_SETUP.md](UPDATER_SETUP.md)
Complete guide for setting up Tauri auto-updater with cryptographic signing.

**Contents:**
- Dependencies and configuration
- Minisign key generation
- GitHub Actions setup
- DevTools integration
- ACL permissions
- Troubleshooting guide
- Critical success factors

**Use this when:** Setting up auto-update functionality, configuring releases, or debugging update issues.

### [DEV_GUIDE.md](DEV_GUIDE.md)
Development workflow and build instructions.

**Contents:**
- Prerequisites and setup
- Development commands
- Building for production
- Testing procedures

**Use this when:** Setting up development environment or building releases.

### [CODESIGNING.md](CODESIGNING.md)
macOS code signing and notarization guide.

**Contents:**
- Ad-hoc signing (current approach)
- Apple Developer signing
- Notarization process
- Security bypass methods
- Troubleshooting

**Use this when:** Dealing with macOS security warnings or planning official distribution.

## Quick Start

1. **First Time Setup:**
   - Read UPDATER_SETUP.md sections 1-4
   - Generate signing keys (UPDATER_SETUP.md Part 2)
   - Configure GitHub secrets

2. **Development:**
   - Follow DEV_GUIDE.md for build commands
   - Use `cargo tauri dev` for testing

3. **Release Process:**
   - Update version in tauri.conf.json and Cargo.toml
   - Tag and push: `git tag v0.x.x && git push --tags`
   - GitHub Actions will build and release automatically

## Key Configuration Files

- `src-tauri/tauri.conf.json` - Tauri configuration, updater settings
- `src-tauri/Cargo.toml` - Rust dependencies
- `src-tauri/capabilities/default.json` - ACL permissions
- `.github/workflows/release.yml` - CI/CD pipeline

## Important Notes

⚠️ **Critical for Updates:**
- `createUpdaterArtifacts: true` must be in tauri.conf.json
- Dialog and process plugins required for native update UX
- ACL permissions must include: `dialog:default`, `process:default`, `updater:default`

🔑 **Signing Keys:**
- Store private key: `~/.tauri/quickappmanager-nopass.key`
- Public key goes in tauri.conf.json
- Never commit private key to git

📝 **Version Management:**
- Use semantic versioning (e.g., 0.1.0)
- Update version in both tauri.conf.json AND Cargo.toml
- Create git tag matching the version
