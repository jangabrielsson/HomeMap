# HomeMap

HC3 Home Automation Map Visualization

## Overview
HomeMap is a desktop application for visualizing and managing Fibaro Home Center 3 (HC3) home automation systems.

## Features
- 🏠 Visual home automation map
- 🔄 Real-time HC3 connection
- 🛠️ DevTools for development
- 📦 Auto-update support

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

## Documentation

- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Quick start and architecture overview
- **[docs/DEV_GUIDE.md](docs/DEV_GUIDE.md)** - Development patterns and best practices
- **[docs/UPDATER_SETUP.md](docs/UPDATER_SETUP.md)** - Auto-updater configuration
- **[docs/CODESIGNING.md](docs/CODESIGNING.md)** - Code signing for macOS
- **[VERSION.md](VERSION.md)** - Version history

## Architecture
Built on Tauri 2.x with:
- **Backend**: Rust for HC3 API integration
- **Frontend**: HTML/CSS/JavaScript
- **Features**: DevTools, auto-update, HTTP client
- **Based on**: QuickAppManager architecture and learnings

## Project Status
- ✅ Core framework setup
- ✅ HC3 API integration
- ✅ DevTools support
- ✅ macOS code signing
- 🔄 Auto-updater (ready for keys)
- 🔄 Map visualization (in progress)

## License
MIT
