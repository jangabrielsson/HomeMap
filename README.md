# HomeMap

🏠 Visual Floor Plan Interface for Fibaro Home Center 3

[![Release](https://img.shields.io/github/v/release/jangabrielsson/HomeMap)](https://github.com/jangabrielsson/HomeMap/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Overview

HomeMap is a desktop application for visualizing and controlling your Fibaro Home Center 3 (HC3) home automation system using interactive floor plans.

## Features

- 📍 **Interactive Floor Plans** - Display devices on custom floor plan images
- 🔄 **Real-time Updates** - Live device status using HC3 event polling
- 🎨 **Flexible Widget System** - JSON-based device definitions with valuemaps
- ✏️ **Edit Mode** - Drag-and-drop device repositioning with auto-save
- 🏷️ **Multiple Device Types** - Lights, dimmers, temperature sensors, motion sensors
- ⚡ **Fast Event Handling** - Dispatch table architecture for O(1) event processing
- 🔧 **DevTools** - Built-in developer tools (Cmd+Shift+I)
- 🔄 **Auto-Updates** - Automatic update checking and installation
- 🎯 **Multi-Floor Support** - Tab-based navigation between floors
- 📁 **Easy Setup** - Built-in configuration wizard

## Installation

### Download

Download the latest release for your platform from the [Releases](https://github.com/jangabrielsson/HomeMap/releases) page:

- **macOS**
  - Apple Silicon (M1/M2/M3): `HomeMap_*_aarch64.dmg`
  - Intel: `HomeMap_*_x64.dmg`
- **Windows**: `HomeMap_*_x64-setup.exe`

### First Run

**macOS:**
1. Open the DMG and drag HomeMap to Applications
2. Right-click the app and select "Open" (first time only)
3. If blocked, go to System Preferences → Security & Privacy → "Open Anyway"

**Windows:**
1. Run the installer
2. If Windows Defender blocks it, click "More info" → "Run anyway"
3. App is safe but not signed with a Microsoft certificate

### Quick Setup

1. **Create configuration folder**
   - Menu → HomeMap → Create Configuration...
   - Select a location (e.g., Documents or Desktop)
   - A `homemapdata` folder will be created with templates

3. **Set up HC3 credentials**

   Create a `.env` file in your home directory:
   - **macOS**: `~/.env`
   - **Windows**: `C:\Users\YourUsername\.env`

   ```bash
   HC3_HOST=192.168.1.57
   HC3_USER=admin
   HC3_PASSWORD=your-password
   HC3_PROTOCOL=http
   HC3_HOMEMAP=/path/to/homemapdata
   ```

   **Note:** If your password contains special characters like `$`, `"`, `'`, or spaces, do NOT quote it - just write it as-is.

4. **Customize your setup**
   - Add floor plan images to `homemapdata/images/`
   - Edit `homemapdata/config.json` with your devices
   - Add device icons to `homemapdata/icons/`

See [CONFIGURE.md](CONFIGURE.md) for complete configuration guide.

## Updates

HomeMap includes automatic update support:

- **Check for Updates**: Menu → HomeMap → Check for Updates
- **Automatic Notifications**: App notifies you when new versions are available
- **One-Click Install**: Download and install updates with a single click
- **Secure Updates**: All updates are cryptographically signed

Updates are downloaded from the [GitHub Releases](https://github.com/jangabrielsson/HomeMap/releases) page and verified before installation.

## Widget System

HomeMap uses a flexible JSON-based widget system. Each device type is defined by:

- **Valuemaps**: Icon and display rendering definitions
- **Status API**: Properties to fetch from HC3
- **Events**: Event types to listen for

Example widget definition:

```json
{
  "valuemaps": {
    "light": {
      "icon": {
        "property": "value",
        "type": "boolean",
        "true": "icons/light-on.svg",
        "false": "icons/light-off.svg"
      }
    }
  },
  "status": {
    "api": "/api/devices/${id}",
    "properties": ["properties.value"],
    "valuemap": "light"
  },
  "events": {
    "DevicePropertyUpdatedEvent": {
      "id": "id",
      "valuemap": "light"
    }
  }
}
```

See included widget examples in `homemapdata/widgets/` for more patterns.

## Development

### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) (for tauri-action)
- Fibaro HC3 system

### Setup

```bash
# Clone the repository
git clone https://github.com/jangabrielsson/HomeMap.git
cd HomeMap

# Run in development mode
cargo tauri dev

# Build for production
cargo tauri build
```

## Documentation

Comprehensive guides are available in the [`docs/`](docs/) directory:

- **[CONFIGURE.md](CONFIGURE.md)** - Complete configuration guide (widgets, icons, actions, floor plans)
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and changes
- **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** - Development setup guide
- **[docs/DEV_GUIDE.md](docs/DEV_GUIDE.md)** - Development patterns and best practices
- **[docs/UPDATER_SETUP.md](docs/UPDATER_SETUP.md)** - Auto-updater configuration
- **[docs/CODESIGNING.md](docs/CODESIGNING.md)** - Code signing for macOS
- **[docs/RELEASE_READY.md](docs/RELEASE_READY.md)** - Release process guide

## Architecture

Built on Tauri 2.x with:

- **Backend**: Rust for HC3 API integration and file operations
- **Frontend**: Vanilla JavaScript with Tauri APIs
- **Event System**: Long-polling with dispatch table (30s timeout, 1s throttle)
- **Configuration**: JSON-based with auto-save on edits
- **Based on**: QuickAppManager architecture and learnings

## Contributing

Contributions are welcome! Please feel free to:

- Report bugs or request features via [Issues](https://github.com/jangabrielsson/HomeMap/issues)
- Submit pull requests
- Share your widget definitions
- Improve documentation

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Related Projects

- [EventLogger](https://github.com/jangabrielsson/EventLogger) - HC3 event monitoring tool
- [plua](https://github.com/jangabrielsson/plua) - Lua programming environment for HC3
