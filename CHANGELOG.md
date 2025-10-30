# Changelog

All notable changes to HomeMap will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.5] - 2025-10-30

### Added
- **Settings Panel**: Cogwheel button for configuration management
  - HC3 credentials management (host, username, password)
  - HomeMap data directory configuration
  - Save credentials to .env file
  - Visual settings UI (no more manual .env editing!)
- **Widget System v0.1.5**: Complete refactoring of widget architecture
  - Version compatibility checking with semantic versioning
  - Icon sets with auto-detection of file extensions (.svg, .png, .jpg, .jpeg)
  - New widget structure: `state`, `getters`, `events`, `render`, `actions`, `ui`
  - Composable UI system with rows and multiple element types (buttons, sliders, labels)
  - Conditional icon rendering based on device state
  - Template-based text rendering with property interpolation
  - Event-driven state management with property filtering
- **Device Management UI**: Complete visual device management (no more manual JSON editing!)
  - Add Device dialog (right-click empty floor space in edit mode)
  - Edit Device dialog (change name, type, floor assignments)
  - Delete Device dialog with confirmation
  - Multi-floor device support with visual floor selection
- **Widget Interaction System**:
  - Button UI type - execute actions immediately on click
  - Slider UI type - execute actions on release (mouseup/touchend), dialog stays open
  - Multi-row composable UI - mix buttons, sliders, and labels in flexible layouts
  - No Apply/Cancel needed - all actions are immediate
- **8 Complete Widget Definitions**:
  - `lightdim` - On/Off buttons + dim slider (0-99%)
  - `light` - On/Off buttons
  - `binarySwitch` - Toggle button
  - `doorLock` - Lock/Unlock buttons
  - `temperature` - Read-only with temperature display
  - `doorSensor` - Read-only with conditional icons
  - `motion` - Read-only with conditional icons
  - `windowSensor` - Read-only with conditional icons

### Changed
- **API Optimization**: Widgets now use property-specific endpoints (`/api/devices/{id}/properties/{property}`) instead of fetching entire device objects
- **Event Filtering**: Events now filtered by property name to prevent icon updates from affecting value properties
- **Context Menu**: Simplified to Edit/Delete only (floor management moved to Edit dialog)
- **Action Execution**: Fixed body handling for actions without value parameters

### Fixed
- HC3 value object unwrapping (handles nested `{value: X, path: "...", source: "HC"}` responses)
- Event property filtering to prevent cross-property contamination
- Condition evaluation with proper property substitution
- Action body always sent when defined, even without value parameter

### Technical Details
- Widget version checking prevents incompatible widgets from loading
- Icon sets loaded once and cached in Map
- State management separated from HC3 API responses
- Composable UI allows flexible dialog layouts
- Multi-floor device format: `{id, name, type, floors: [{floor_id, position}]}`

### Documentation
- Complete widget format specification in `docs/WIDGET_FORMAT.md`
- Examples for all widget types
- Migration guide from v0.1.4 to v0.1.5

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

[0.1.5]: https://github.com/jangabrielsson/HomeMap/releases/tag/v0.1.5
[0.1.0]: https://github.com/jangabrielsson/HomeMap/releases/tag/v0.1.0
