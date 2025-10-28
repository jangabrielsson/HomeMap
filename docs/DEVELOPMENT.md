# HomeMap Development Guide

## Quick Start

### Prerequisites
- Rust (latest stable)
- Cargo
- macOS (for local development)

### Running the App
```bash
cargo tauri dev
```

### Building for Production
```bash
cargo tauri build
```

## Architecture

### Backend (Rust)
- **File**: `src-tauri/src/lib.rs`
- **Framework**: Tauri 2.x
- **Plugins**: 
  - `tauri-plugin-http` - For HC3 API calls
  - DevTools enabled in debug mode

### Frontend (HTML/CSS/JS)
- **Location**: `src/`
- **Files**: 
  - `index.html` - Main UI
  - `styles.css` - Styling
  - `script.js` - Application logic

### HC3 Integration
Configuration is read from `.env` file in:
1. App directory (for production)
2. Home directory `~/.env` (for development)

Required variables:
```env
HC3_HOST=192.168.1.89
HC3_USER=admin
HC3_PASSWORD=yourpassword
HC3_PROTOCOL=http
```

## Important Documentation

This project includes comprehensive documentation from QuickAppManager:

1. **[DEV_GUIDE.md](docs/DEV_GUIDE.md)** - Development patterns and Tauri HTTP usage
2. **[UPDATER_SETUP.md](docs/UPDATER_SETUP.md)** - Complete auto-updater setup guide
3. **[CODESIGNING.md](docs/CODESIGNING.md)** - macOS code signing requirements
4. **[docs/README.md](docs/README.md)** - Documentation overview

### Key Learnings Applied

✅ **HTTP Requests**: Use Tauri's HTTP plugin, not browser fetch
```javascript
const { fetch } = window.__TAURI__.http;
```

✅ **DevTools**: Auto-opens in debug mode via `lib.rs`

✅ **Code Signing**: Ad-hoc signing configured for macOS (`signingIdentity: "-"`)

✅ **Auto-Updates**: Ready for minisign keys and GitHub Actions workflow

✅ **Multi-Window**: Architecture supports opening multiple windows (see QuickAppManager pattern)

## Version Management

Use the version script to update all version numbers:
```bash
./scripts/version.sh
```

This updates:
- `package.json`
- `Cargo.toml`
- `tauri.conf.json`
- Creates git tag

## Project Structure
```
HomeMap/
├── src/                    # Frontend files
│   ├── index.html
│   ├── styles.css
│   └── script.js
├── src-tauri/             # Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── capabilities/
│   │   └── default.json
│   ├── icons/
│   └── src/
│       ├── lib.rs         # Main application logic
│       └── main.rs        # Entry point
├── docs/                  # Documentation
├── scripts/               # Utility scripts
├── .github/              # CI/CD workflows
└── README.md
```

## Next Steps

1. **Set up auto-updater**:
   - Generate minisign keys (see UPDATER_SETUP.md)
   - Configure GitHub Actions workflow
   - Add updater.js frontend code

2. **Create GitHub repository**:
   - Initialize git
   - Create repo at github.com/jangabrielsson/HomeMap
   - Push initial commit

3. **Build features**:
   - Home map visualization
   - Device management
   - Room layout

## Common Issues

### HTTP requests fail
- ✅ Use `window.__TAURI__.http.fetch()` not browser `fetch()`
- ✅ Check capabilities/default.json includes `http:allow-fetch`

### App won't open on macOS
- ✅ Ensure `signingIdentity: "-"` is set in tauri.conf.json

### DevTools not opening
- ✅ Only opens in debug mode (`cargo tauri dev`)
- ✅ Check lib.rs has `window.open_devtools()` in setup

For more details, see the individual documentation files in `docs/`.
