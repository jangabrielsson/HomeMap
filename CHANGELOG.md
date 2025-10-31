# Changelog

All notable changes to HomeMap will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.18] - 2025-10-31

### Added
- **Floor Management System**:
  - Add/Edit/Delete floors via UI - no manual config.json editing needed
  - Native file picker for selecting floor plan images
  - Image preview with automatic dimension detection
  - Aspect ratio locking with checkbox for maintaining proportions
  - Floor reordering with Move Up/Down buttons
  - Right-click context menu on floor backgrounds
  - [+] tab in Edit Mode to quickly add new floors
  - Images automatically organized in `floors/<floor-id>/` directories
  - Full validation (prevents deleting floors with devices)

- **Device Management Panel**:
  - Unified side panel for managing all devices
  - Immediate Install/Uninstall actions per device (no batch save needed)
  - Edit device properties with pen icon (✏️) button
  - Compact status badge: green "✓" for installed devices
  - Widget and floor selection enabled for uninstalled devices (configure before installing)
  - Visual highlighting for installed devices
  - Seamless integration with existing edit workflow

- **House Configuration in Settings**:
  - House Name field - updates window title and header
  - House Icon field - emoji input for branding (max 2 characters)
  - No more manual config.json editing for basic configuration
  - Changes apply immediately and update UI

- **Auto-Managed homemapdata Folder**:
  - Automatic creation in app-specific storage (`~/Library/Application Support/HomeMap/homemapdata` on macOS)
  - Auto-populated from `homemapdata.example` template on first launch
  - Includes all built-in widgets, icons, and example floor plans
  - Path visible and configurable in Settings dialog
  - Advanced users can browse to use custom folder location
  - Removed dependency on HC3_HOMEMAP environment variable

- **Auto-Sync Built-in Resources**:
  - Automatically syncs `widgets/built-in/` on every app startup
  - Automatically syncs `icons/built-in/` on every app startup
  - Ensures users always have latest widget definitions and icon sets
  - User packages (`widgets/packages/`, `icons/packages/`) remain untouched
  - Development mode detection - skips sync for project's homemapdata folder

### Changed
- **Settings Dialog**: Added House Name and House Icon fields in Configuration section
- **Floor Loading**: Now uses `read_image_as_base64` Tauri command for consistent image handling
- **Initial Setup**: Much simpler for new users - app creates everything needed automatically
- **Update Process**: Built-in widgets and icons update automatically with new app versions

### Fixed
- **Dialog Scrolling**: Added `max-height: 90vh` and `overflow-y: auto` to `.slider-content` for long dialogs
- **Floor Image Preview**: Fixed loading of current floor image in Edit Floor dialog using correct path resolution
- **Aspect Ratio Text**: Fixed checkbox label wrapping with `white-space: nowrap`
- **Settings Save**: Fixed `save_config` command parameters (`filePath` and `content` instead of `configPath` and `config`)

### Technical
- **New Module**: `floorManagementDialog.js` (485 lines) - Complete floor CRUD operations
- **Enhanced**: `deviceManagementView.js` - Refactored to immediate-action model
- **Backend**: Rust functions for template discovery, recursive directory copying, and built-in sync
- **Template Bundling**: `homemapdata.example` included in app resources for distribution

## [0.1.17] - 2025-10-31

### Added
- **Auto-Discover HC3 Devices**: New feature to automatically discover and add HC3 devices
  - "Auto-discover" button in Edit Mode for quick device discovery
  - Fetches all devices from HC3 and suggests widget mappings
  - Shows ALL devices (both mapped and unmapped)
  - Mapped devices checked by default, unmapped devices unchecked
  - **Widget Selection**: Dropdown for each device to select/change widget type
  - **Floor Selection**: Dropdown to choose which floor to place each device
  - Device grouping by floor with smart grid positioning
  - Control buttons: "Select All", "Deselect All", "Select Mapped Only"
  - Visual indicators for unmapped devices with "Unmapped" badge
  - Success message shows devices added per floor
- **Device Mapping System**:
  - JSON-based mapping rules in `src/deviceMappings.json`
  - Automatic widget assignment based on device type, interface, and properties
  - Fallback logic for complex device types (e.g., binarySwitch with/without light interface)
  - 15 device type mappings included out of the box
- **Generic Device Widget**:
  - New `genericdevice` widget for unmapped/unknown devices
  - Static icon display with no interactions
  - Perfect for devices without specific widget support
  - Located at `homemapdata/widgets/built-in/genericdevice.json`
- **New AutoMapManager Module**: Handles device discovery, mapping, and batch addition

### Changed
- **HC3ApiManager**: Added `fetchDevices()` method to retrieve all devices from HC3
- **Device Format**: Auto-discovered devices use correct format (`type`, `floor_id`, `position`)
- **Button Label**: Auto-discover button shortened to "Auto-discover" (no emoji) to save header space

### Fixed
- **Authentication**: Fixed `config.user` vs `config.username` inconsistency in `fetchDevices()`
- **Status Update**: Fixed missing parameter name (`status` vs `state`) in `updateStatus()` method
- **Syntax Error**: Removed duplicate closing brace in HC3ApiManager

## [0.1.16] - 2025-10-30

### Added
- **Icon Set Dropdown**: Custom Icon Set field now uses dropdown instead of text input
  - Auto-discovers all available icon sets from built-in, user, and package folders
  - Organized by location (Built-in, User, Package)
  - Prevents typos and shows what's available
  - Default option: "Use widget default icons"
- **Enhanced Icon Discovery**: Improved icon set scanning across all locations

### Changed
- **list_directory Command**: Now returns both files and directories (directories with trailing `/`)
  - Enables proper discovery of icon set folders
  - Backward compatible with existing file listings

### Fixed
- **Edit Device Dialog**: Fixed duplicate text that caused buttons to appear outside dialog
- **Dialog Closing**: Edit Device dialog now properly closes after saving
- **Error Handling**: Added proper error handling with try-catch in save handlers
- **Missing Import**: Fixed `normalizeDeviceFormat` import in dialogManager

### Improved
- **User Experience**: Much easier to select custom icon sets - no typing, no typos
- **Visual Feedback**: Icon sets grouped by location for clarity
- **Debug Logging**: Added comprehensive logging for icon set discovery

## [0.1.15] - 2025-10-30

### Added
- **Device Parameters System**:
  - New `params` field in device configuration for customization
  - Custom icon set support - override widget icons per device
  - UI fields in Add/Edit Device dialogs for icon set selection
  - Backward compatible - existing configs work without changes
  - Documentation: `docs/CUSTOM_ICONS.md` with complete guide
  - Example icons: `docs/examples/custom-icons/exampleCustomLight/`
  - Implementation docs: `docs/DEVICE_PARAMS_IMPL.md`

### Changed
- **Widget Rendering**:
  - `renderDevice()` checks for `device.params.iconSet` before using widget default
  - Custom icon sets loaded dynamically at render time
  - Allows same widget to have different icons on different devices

### Benefits
- **No Widget Cloning**: Users don't need to duplicate widget files for custom icons
- **Per-Device Customization**: Each device can use unique icon sets
- **Theme Support**: Easy to create and switch between visual themes
- **Non-Destructive**: Original widget definitions remain unchanged

### Future Extensions
- Support for additional parameters: `iconSize`, `iconColor`, `customStyles`, `rotateIcon`
- Architecture ready for any device-level customization

## [0.1.9] - 2025-10-30

### Added
- **View Zoom Controls**:
  - Zoom slider (50% - 200% range)
  - Quick zoom buttons: +/- for increment/decrement
  - "Fit to Window" button for auto-scaling to available space
  - "Reset" button to return to 100%
  - Per-floor zoom memory - each floor remembers its zoom level
  - Zoom settings persist across sessions via localStorage
  - Transform-based scaling for smooth performance

### Changed
- **Zoom Controls UI**:
  - Zoom controls only visible in Edit Mode
  - Integrated into header bar to save screen space
  - Compact design with smaller buttons and slider
  - No dedicated row taking up vertical space
  - Contextual appearance - hidden during normal use

### Improved
- **User Experience**:
  - Users can scale entire floor view to fill window
  - Smaller floor plan images can be zoomed up for larger relative widget sizes
  - Better utilization of available screen space
  - Zoom level restores automatically when switching between floors

## [0.1.8] - 2025-10-30

### Added
- **Authentication Protection System**:
  - Tracks failed authentication attempts (401/403 responses)
  - Automatically locks API calls after 2 consecutive failures
  - Prevents HC3 account lockout (HC3 locks after 4 attempts)
  - Shows clear error dialog when auth fails
  - Stops event polling immediately on auth lock
  - Status indicator shows "Authentication Failed - Check Credentials"
  - Auto-reset when credentials are updated in Settings
- **Widget Package System Documentation**:
  - `CREATE_WIDGET_PACKAGE.md` - Comprehensive guide for creating .hwp packages
  - Step-by-step manual creation instructions for non-technical users
  - Package structure specification
  - Manifest format reference with complete field documentation
  - Testing and distribution guidelines
  - Troubleshooting section with common issues
- **Package Export Script** (`scripts/create-package.sh`):
  - Export installed packages as .hwp files
  - Lists available packages in homemapdata
  - Extracts package metadata from manifest
  - Creates properly named archives: `package-id-version.hwp`
  - Includes widgets, icons, README, and screenshots
  - Shows package contents summary after creation
- **Device Dialog Enhancements**:
  - Shows all installed package widgets in add/edit device dialogs
  - "Available from Packages" section lists unloaded package widgets
  - Consistent display format showing package IDs
  - Saves package reference with device configuration

### Changed
- **Package Manager Integration**:
  - Widget selection now includes all installed packages, not just loaded ones
  - Package widgets display with format: "widget-id (package-id)"
  - Device widget field stores package reference: "package-id/widget-id"

### Fixed
- **Authentication Failure Handling**:
  - `testConnection()` checks auth lock before attempting connection
  - `executeAction()` checks auth lock and handles 401/403 responses
  - `updateDeviceIcon()` silently skips updates when auth locked
  - Event polling checks auth lock at start of each cycle
  - All HC3 API calls detect and handle authentication failures
- **Package Installation**:
  - Switched to non-blocking Tauri dialogs for reinstall confirmation
  - Proper widget reload after package operations

### Security
- Auth failure counter prevents repeated failed login attempts
- Protects users from accidentally triggering HC3 account lockouts
- Safe margin of 2 attempts below HC3's 4-attempt limit

### Documentation
- `docs/AUTH_PROTECTION.md` - Complete authentication protection documentation
- `docs/CREATE_WIDGET_PACKAGE.md` - Widget package creation guide

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
