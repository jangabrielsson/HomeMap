# Changelog

All notable changes to HomeMap will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.7] - 2025-10-30

### Added
- **Color Light Widget** (`lightcolor.json`):
  - Multi-property state tracking (brightness + RGB color components)
  - Dynamic colored glow effect using CSS drop-shadow with actual RGB values
  - Color picker UI element with hex input and RGB display
  - `setColor` action to change light colors
  - Handles both `colorComponents` (object) and `color` (string) events from HC3
  - Automatic color string parsing ("R,G,B,WW,CW" format)
- **Gauge Widget** (`gauge.json`):
  - Visual gauge with rotating needle indicator (0-100 range)
  - Inline SVG manipulation to rotate needle independently from background
  - Colored arc segments (green/yellow/red) for visual feedback
  - Expression-based rotation: `${value * 1.8 - 90}`
- **Color Select UI Element**:
  - New `colorSelect` element type for widget dialogs
  - HTML5 color picker with live RGB value display
  - Hex ↔ RGB conversion utilities
  - Styled with custom CSS for consistent appearance
- **Expression Evaluation in Templates**:
  - Support for mathematical expressions: `${value * 1.8}`, `${value / 10 + 5}`
  - Support for conditional expressions: `${value > 50 ? 100 : 0}`
  - Property references automatically replaced with state values
  - Works in style templates, text templates, and action parameters

### Changed
- **Enhanced Event System**:
  - OR conditions in conditional updates: `(prop1 == event.property || prop2 == event.property) ? event.newValue`
  - Smarter event filtering checks both state properties and update expressions
  - Automatic color string parsing when updating colorComponents
- **Widget Manager Improvements**:
  - Nested property interpolation: `${colorComponents.red}`
  - Dynamic style rendering on icon elements
  - Inline SVG loading and manipulation for advanced styling
  - SVG-specific style application to internal elements via selector
- **Dialog Manager**:
  - Added `rgbToHex()` and `hexToRgb()` helper methods
  - Color picker event handlers with automatic RGB extraction
- **HC3 API Manager**:
  - Object-based action parameters (e.g., `{red: 255, green: 0, blue: 0}`)
  - Template variable replacement for object properties
  - Color string parsing for colorComponents properties

### Technical Details
- New Rust command: `read_file_as_text` for SVG source loading
- SVG manipulation using DOMParser and XMLSerializer
- Expression evaluation with property substitution in interpolateTemplate
- Enhanced widget render system with `svg` section for internal element styling
- Color component normalization (string → object conversion)

## [0.1.6] - 2025-10-30

### Changed
- **Major Code Refactoring**: Improved codebase organization and maintainability
  - Extracted 8 specialized manager modules from monolithic script.js
  - Reduced main script from 1,951 lines to 449 lines (77% reduction)
  - Clear separation of concerns with manager pattern architecture
- **Module Architecture**:
  - `utils.js` (47 lines) - Constants and utility functions
  - `deviceHelpers.js` (122 lines) - Multi-floor device support with auto-normalization
  - `eventManager.js` (187 lines) - HC3 event polling and dispatch
  - `widgetManager.js` (245 lines) - Widget loading and rendering
  - `dialogManager.js` (590 lines) - All UI dialogs (Add/Edit/Delete + widget UIs)
  - `floorManager.js` (269 lines) - Floor rendering, navigation, and drag-and-drop
  - `contextMenuManager.js` (125 lines) - Context menu handling
  - `hc3ApiManager.js` (213 lines) - HC3 API communication and device state management
- **Device Format Normalization**: Automatic conversion between single-floor and multi-floor formats
  - Devices on single floor use compact format: `{id, name, type, floor_id, position}`
  - Devices on multiple floors use array format: `{id, name, type, floors: [{floor_id, position}]}`
  - Auto-converts to simpler format when device removed from all but one floor

### Fixed
- Updated example configuration (`homemapdata.example`) to use new widget format
- Widget version compatibility checking now properly validates minimum version (0.1.5)
- Device format consistency across add/edit/delete operations

### Technical Details
- Total codebase: 2,247 lines across 9 files (vs. original 1,951 lines in single file)
- Manager pattern: Each manager receives HomeMap instance for context access
- ES6 modules with named exports/imports
- Improved code navigability and testability
- Each module has a single, well-defined responsibility

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

[0.1.6]: https://github.com/jangabrielsson/HomeMap/releases/tag/v0.1.6
[0.1.5]: https://github.com/jangabrielsson/HomeMap/releases/tag/v0.1.5
[0.1.0]: https://github.com/jangabrielsson/HomeMap/releases/tag/v0.1.0
