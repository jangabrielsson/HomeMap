# HomeMap

🏠 Visual Floor Plan Interface for Fibaro Home Center 3

[![Release](https://img.shields.io/github/v/release/jangabrielsson/HomeMap)](https://github.com/jangabrielsson/HomeMap/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

<a href="https://www.buymeacoffee.com/rywnwpdvvni" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>

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

HomeMap is designed to work out of the box! On first launch:

1. **Automatic Setup**
   - The app automatically creates a configuration folder: `~/Library/Application Support/HomeMap/homemapdata` (macOS)
   - All required files and built-in widgets are installed automatically

2. **Configure HC3 Connection**
   - Click the Settings button (⚙️) in the top-right corner
   - Enter your HC3 credentials:
     - IP Address or Hostname
     - Username
     - Password
     - Protocol (http or https)
   - Optionally: Set your house name and icon (emoji)

3. **Set Up Your Floor Plans**
   - Click the Settings button (⚙️) → Floors tab
   - Add floors by selecting floor plan images
   - The app automatically detects dimensions and maintains aspect ratios
   - Arrange floors with Move Up/Down buttons

4. **Add Your Devices**
   - Turn on Edit Mode (toggle in top bar)
   - Open the Device Management panel (☰ button)
   - Select devices from your HC3 system
   - Choose widget type and floor for each device
   - Click Install to add devices to your floor plan
   - Drag devices to position them on your floor plan

That's it! No manual file editing required. The app handles all configuration through its UI.

### Advanced: Custom .env Configuration (Optional)

For development or if you prefer environment variables, create a `.env` file in your home directory:

- **macOS**: `~/.env`
- **Windows**: `C:\Users\YourUsername\.env`

```bash
HC3_HOST=192.168.1.57
HC3_USER=admin
HC3_PASSWORD=your-password
HC3_PROTOCOL=http
```

**Note:** Settings configured in the app UI take priority over `.env` file values.

## Updates

HomeMap includes automatic update support:

- **Check for Updates**: Menu → HomeMap → Check for Updates
- **Automatic Notifications**: App notifies you when new versions are available
- **One-Click Install**: Download and install updates with a single click
- **Secure Updates**: All updates are cryptographically signed

Updates are downloaded from the [GitHub Releases](https://github.com/jangabrielsson/HomeMap/releases) page and verified before installation.

## Widget System

HomeMap uses a flexible JSON-based widget system. Built-in widgets are provided for common device types (lights, sensors, switches, etc.), and they're automatically synced on startup.

### For End Users

All built-in widgets work out of the box! Simply:
1. Select a device in the Device Management panel
2. Choose the appropriate widget type (e.g., "light" for lights)
3. Install the device on your floor plan

The app handles everything automatically.

### For Developers: Custom Widgets and Icons

If you want to create custom widgets or icons, you can work directly with the `homemapdata` folder:

**Location:** `~/Library/Application Support/HomeMap/homemapdata` (macOS)

**Structure:**
```
homemapdata/
├── widgets/
│   ├── built-in/        # Auto-synced from app (don't edit)
│   └── packages/        # Your custom widgets go here
├── icons/
│   ├── built-in/        # Auto-synced from app (don't edit)
│   └── packages/        # Your custom icons go here
├── images/              # Floor plan images
└── config.json          # Main configuration
```

**Important:** The `built-in/` folders are automatically synced from the app on startup. Any changes will be overwritten. Place custom content in the `packages/` folders.

### Custom Icons

You can use custom icons with any widget by specifying device-level parameters:

You can use custom icons with any widget by specifying device-level parameters. This allows you to:

- Use built-in widgets with your own icon designs
- Have different icon styles for different devices of the same type
- Easily switch between icon sets without editing widget files

**Example:**

```json
{
  "id": 123,
  "name": "Living Room Light",
  "type": "light",
  "params": {
    "iconSet": "myCustomLights"
  }
}
```

Place your custom icons in `homemapdata/icons/packages/myCustomLights/` and the device will use them instead of the widget's default icons. See **[docs/CUSTOM_ICONS.md](docs/CUSTOM_ICONS.md)** for complete guide.

### Widget Definition Example

For developers creating custom widgets, each widget is a JSON file that defines:

```json
{
  "id": "binarySwitch",
  "name": "Binary Switch",
  "type": "com.fibaro.binarySwitch",
  
  "state": {
    "value": false
  },
  
  "events": {
    "value": {
      "match": "$[?(@.property=='value')]",
      "update": "newValue"
    }
  },
  
  "render": {
    "icon": {
      "set": "light",
      "template": "value ? 'on' : 'off'"
    },
    "badge": {
      "template": "value ? 'ON' : 'OFF'"
    }
  },
  
  "actions": {
    "turnOn": {
      "method": "POST",
      "api": "/api/devices/${id}/action/turnOn"
    },
    "turnOff": {
      "method": "POST",
      "api": "/api/devices/${id}/action/turnOff"
    }
  },
  
  "ui": {
    "type": "toggle",
    "property": "value",
    "onAction": "turnOn",
    "offAction": "turnOff"
  }
}
```

**Widget Components:**
- **State**: Device properties to track
- **Events**: JSONPath patterns for HC3 event matching
- **Render**: Icon sets, badges, and dynamic styling
- **Actions**: HC3 API calls for device control
- **UI**: Interactive dialogs for device control

**Advanced Features (v0.1.7+):**
- Expression evaluation in templates (`${value * 1.8 - 90}`)
- SVG manipulation for dynamic graphics
- Conditional updates with OR logic
- Composable UI with buttons, sliders, and color pickers
- Dynamic styling for colored effects

See [docs/WIDGET_FORMAT.md](docs/WIDGET_FORMAT.md) for complete specification and examples.

## Configuration Files (Advanced)

While the UI handles most configuration, advanced users can directly edit configuration files in the `homemapdata` folder:

- **config.json** - Main configuration (floors, devices, house settings)
- **widget-mappings.json** - HC3 type to widget mappings
- **installed-packages.json** - Installed widget/icon packages

**Note:** It's recommended to use the UI whenever possible. Direct file editing is primarily for development and advanced customization.

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

**For Users:**
- **[CONFIGURE.md](CONFIGURE.md)** - Complete configuration guide (widgets, icons, actions, floor plans)
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and changes

**For Developers:**
- **[docs/CUSTOM_ICONS.md](docs/CUSTOM_ICONS.md)** - Creating custom icons for widgets
- **[docs/WIDGET_FORMAT.md](docs/WIDGET_FORMAT.md)** - Widget JSON format specification and examples
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
