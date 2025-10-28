# Changelog

All notable changes to HomeMap will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-10-28

### Added
- Initial release of HomeMap
- Floor plan visualization with tab-based navigation
- Real-time HC3 device monitoring and control
- Event-driven device updates using long-polling
- Widget system with valuemaps for flexible device rendering
- Support for multiple device types:
  - Lights (on/off)
  - Dimmable lights (with percentage display)
  - Temperature sensors
  - Motion sensors (with last breach time)
- Edit mode for drag-and-drop device repositioning
- Auto-save configuration on device moves
- DevTools toggle (Cmd+Shift+I)
- Auto-update functionality with native dialogs
- Custom house icon branding
- HC3 API integration via .env configuration
- Base64 image loading with SVG support

### Technical Features
- Built with Tauri 2.x framework
- Rust backend with HC3 API integration
- Event dispatch table for O(1) event handling
- Natural image coordinate system for device positioning
- Multi-property support for widgets (icon + display)
- Time formatting (timeAgo) for timestamps
- Configurable widget definitions (JSON-based)

[0.1.0]: https://github.com/jangabrielsson/HomeMap/releases/tag/v0.1.0
