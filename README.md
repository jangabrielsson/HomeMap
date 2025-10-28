# HomeMap

🏠 Visual Floor Plan Interface for Fibaro Home Center 3

## Overview
HomeMap is a desktop application for visualizing and controlling your Fibaro Home Center 3 (HC3) home automation system using interactive floor plans.

## Features
- 📍 **Interactive Floor Plans** - Display devices on custom floor plan images with drag-and-drop positioning
- 🔄 **Real-time Updates** - Live device status using HC3 event polling
- 🎨 **Flexible Widget System** - JSON-based device definitions with valuemaps for icons and displays
- ✏️ **Edit Mode** - Reposition devices visually and auto-save configuration
- 🏷️ **Multiple Device Types** - Lights, dimmers, temperature sensors, motion sensors, and more
- ⚡ **Fast Event Handling** - Dispatch table architecture for O(1) event processing
- 🔧 **DevTools** - Built-in developer tools (Cmd+Shift+I)
- � **Auto-Updates** - Automatic update checking and installation
- 🎯 **Multi-Floor Support** - Tab-based navigation between floors

## Quick Start

### Prerequisites
- Rust (for Tauri)
- Fibaro HC3 system

### Configuration

#### 1. HC3 Credentials
Create a `.env` file in your home directory (`~/.env`) with:
```env
HC3_HOST=your-hc3-ip
HC3_USER=your-username
HC3_PASSWORD=your-password
HC3_PROTOCOL=http
```

#### 2. HomeMap Data
Copy the example data directory:
```bash
cp -r homemapdata.example homemapdata
```

Then customize:
- Add your floor plan images to `homemapdata/images/`
- Edit `homemapdata/config.json` with your devices
- Add device icons to `homemapdata/icons/`
- Customize widget definitions in `homemapdata/widgets/`

See `homemapdata.example/README.md` for detailed instructions.

### Development
```bash
cargo tauri dev
```

### Build
```bash
cargo tauri build
```

## Installation

### Download
Download the latest release for your platform from the [Releases](https://github.com/jangabrielsson/HomeMap/releases) page:

- **macOS**
  - Apple Silicon (M1/M2/M3): `HomeMap_*_aarch64.dmg`
  - Intel: `HomeMap_*_x64.dmg`
- **Windows**: `HomeMap_*_x64-setup.exe`

### Auto-Updates
The app automatically checks for updates. You can manually check via:
- Menu → HomeMap → Check for Updates...

## Widget System

HomeMap uses a flexible JSON-based widget system. Each device type is defined by:

- **Valuemaps**: Icon and display rendering definitions
- **Status API**: Properties to fetch from HC3
- **Events**: Event types to listen for

Example widget definition (`homemapdata/widgets/light.json`):
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
      "match": "...",
      "valuemap": "light"
    }
  }
}
```

## Documentation

- **[CHANGELOG.md](CHANGELOG.md)** - Version history and changes
- **[homemapdata.example/README.md](homemapdata.example/README.md)** - Configuration guide
- **[docs/DEV_GUIDE.md](docs/DEV_GUIDE.md)** - Development patterns and best practices
- **[docs/UPDATER_SETUP.md](docs/UPDATER_SETUP.md)** - Auto-updater configuration
- **[docs/CODESIGNING.md](docs/CODESIGNING.md)** - Code signing for macOS

## Architecture
Built on Tauri 2.x with:
- **Backend**: Rust for HC3 API integration and file operations
- **Frontend**: Vanilla JavaScript with Tauri APIs
- **Event System**: Long-polling with dispatch table (30s timeout, 1s throttle)
- **Configuration**: JSON-based with auto-save on edits
- **Based on**: QuickAppManager architecture and learnings

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

See [LICENSE](LICENSE) file for details.

## Project Status
- ✅ Floor plan visualization
- ✅ Real-time device monitoring
- ✅ Event-driven updates
- ✅ Edit mode with drag-and-drop
- ✅ Widget system
- ✅ Auto-updater configured
- ✅ HC3 API integration
- 🔄 Map visualization (in progress)

## License
MIT
