# Widget Package System

## Overview

HomeMap Widget Packages (`.hwp` files) are ZIP archives containing widget definitions, icon sets, and metadata that can be easily shared and installed through the UI or file system.

## Package Format

### File Structure

```
package-name.hwp (ZIP archive)
├── manifest.json         ← Package metadata (required)
├── widget.json           ← Single widget (option 1)
├── widgets/              ← Multiple widgets (option 2)
│   ├── gauge.json
│   └── speedometer.json
├── icons/               ← Icon sets
│   ├── gauge/
│   │   ├── gauge.svg
│   │   └── needle.svg
│   └── speedometer/
│       └── speedometer.svg
├── README.md            ← Documentation (optional)
└── screenshots/         ← Preview images (optional)
    ├── preview.png
    └── screenshot.png
```

### Manifest Schema

```json
{
  "id": "com.jangabrielsson.gauge",
  "name": "Gauge Widgets",
  "version": "1.0.0",
  "author": "Jan Gabrielsson",
  "email": "jan@example.com",
  "description": "Visual gauge widgets with rotating needles for sensor values",
  "homepage": "https://github.com/jangabrielsson/homemap-gauge-widgets",
  "license": "MIT",
  
  "requires": {
    "homeMapVersion": ">=0.1.7"
  },
  
  "provides": {
    "widgets": ["gauge", "speedometer"],
    "iconSets": ["gauge", "speedometer"]
  },
  
  "deviceTypes": [
    "com.fibaro.multilevelSensor",
    "com.fibaro.powerMeter"
  ],
  
  "tags": ["sensor", "visualization", "gauge", "meter"],
  
  "screenshots": [
    "screenshots/preview.png",
    "screenshots/screenshot.png"
  ]
}
```

**Field Descriptions:**
- `id`: Reverse domain notation package identifier (e.g., `com.author.package-name`)
- `name`: Human-readable package name
- `version`: Semantic version (major.minor.patch)
- `author`: Package author name
- `email`: Author contact email (optional)
- `description`: Short package description
- `homepage`: Package repository or documentation URL (optional)
- `license`: License identifier (e.g., MIT, Apache-2.0)
- `requires.homeMapVersion`: Minimum HomeMap version (semver range)
- `provides.widgets`: Array of widget IDs included in package
- `provides.iconSets`: Array of icon set names included
- `deviceTypes`: HC3 device types supported by these widgets
- `tags`: Search/filter tags
- `screenshots`: Preview images for package browser

## Installation Structure

### Package Storage

```
homemapdata/
├── widgets/
│   ├── built-in/                    ← Shipped with HomeMap
│   │   ├── binarySwitch.json
│   │   └── temperature.json
│   └── packages/                    ← Installed packages
│       ├── com.jangabrielsson.gauge/
│       │   ├── manifest.json
│       │   ├── gauge.json
│       │   └── speedometer.json
│       └── io.github.community.lights/
│           ├── manifest.json
│           └── lightcolor.json
├── icons/
│   ├── built-in/                    ← Shipped with HomeMap
│   │   ├── light/
│   │   └── sensor/
│   └── packages/                    ← Package icon sets
│       ├── com.jangabrielsson.gauge/
│       │   └── gauge/
│       │       ├── gauge.svg
│       │       └── needle.svg
│       └── io.github.community.lights/
│           └── colorLight/
└── widget-mappings.json             ← Device type → widget mappings
```

### Widget Mappings

```json
{
  "version": "1.0",
  "mappings": {
    "com.fibaro.binarySwitch": {
      "package": "com.fibaro.built-in",
      "widget": "binarySwitch"
    },
    "com.fibaro.multilevelSensor": {
      "package": "com.jangabrielsson.gauge",
      "widget": "gauge"
    },
    "com.fibaro.colorController": {
      "package": "io.github.community.lights",
      "widget": "lightcolor"
    }
  },
  "defaults": {
    "com.fibaro.binarySwitch": "com.fibaro.built-in/binarySwitch"
  }
}
```

### Installed Packages Registry

```json
{
  "version": "1.0",
  "packages": {
    "com.jangabrielsson.gauge": {
      "version": "1.0.0",
      "installedAt": "2025-10-30T12:00:00Z",
      "installedFrom": "local",
      "manifest": {
        "id": "com.jangabrielsson.gauge",
        "name": "Gauge Widgets",
        "version": "1.0.0",
        "author": "Jan Gabrielsson"
      },
      "files": {
        "widgets": [
          "widgets/packages/com.jangabrielsson.gauge/gauge.json",
          "widgets/packages/com.jangabrielsson.gauge/speedometer.json"
        ],
        "icons": [
          "icons/packages/com.jangabrielsson.gauge/gauge/"
        ]
      }
    }
  }
}
```

## Widget Resolution

### Priority Order

1. **Explicit package reference** (highest priority)
2. **Widget mapping** for device type
3. **Built-in widget** by device type name
4. **First matching package widget**
5. **Generic fallback widget** (lowest priority)

### Resolution Algorithm

```javascript
async resolveWidget(deviceType, explicitWidget = null) {
  // 1. Explicit widget reference (from config.json)
  if (explicitWidget) {
    const [packageId, widgetId] = explicitWidget.split('/');
    return await this.loadPackageWidget(packageId, widgetId);
  }
  
  // 2. Check widget mappings
  const mappings = await this.loadWidgetMappings();
  if (mappings.mappings[deviceType]) {
    const { package: pkg, widget } = mappings.mappings[deviceType];
    return await this.loadPackageWidget(pkg, widget);
  }
  
  // 3. Try built-in widget
  const builtIn = await this.loadBuiltInWidget(deviceType);
  if (builtIn) return builtIn;
  
  // 4. Search installed packages
  const matches = await this.findWidgetsByDeviceType(deviceType);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    // Multiple matches - use most recent or show disambiguation
    return this.selectBestMatch(matches);
  }
  
  // 5. Generic fallback
  return await this.loadGenericWidget(deviceType);
}
```

### Widget Reference Formats

**In config.json:**
```json
{
  "devices": [
    {
      "id": 123,
      "widget": "com.jangabrielsson.gauge/gauge"  // Explicit package reference
    },
    {
      "id": 456
      // No widget specified - uses mapping or auto-resolution
    }
  ]
}
```

**Full widget identifier:**
```
package-id/widget-id
com.jangabrielsson.gauge/gauge
com.fibaro.built-in/binarySwitch
io.github.community.lights/lightcolor
```

## Package Manager API

### JavaScript API (Frontend)

```javascript
class PackageManager {
  // Installation
  async installPackage(hwpPath);
  async uninstallPackage(packageId);
  async updatePackage(packageId);
  
  // Package queries
  async getInstalledPackages();
  async getPackageInfo(packageId);
  async checkForUpdates(packageId);
  
  // Widget resolution
  async resolveWidget(deviceType, explicitWidget);
  async findWidgetsByDeviceType(deviceType);
  
  // Mappings
  async loadWidgetMappings();
  async saveWidgetMapping(deviceType, packageId, widgetId);
  async resetWidgetMappings();
  
  // Package creation/export
  async exportPackage(packageId, outputPath);
  async createPackage(manifest, widgets, icons);
}
```

### Rust Commands (Backend)

```rust
// src-tauri/src/lib.rs

#[tauri::command]
async fn install_widget_package(hwp_path: String) -> Result<PackageInfo, String>;

#[tauri::command]
async fn uninstall_widget_package(package_id: String) -> Result<(), String>;

#[tauri::command]
async fn list_installed_packages() -> Result<Vec<PackageInfo>, String>;

#[tauri::command]
async fn export_widget_package(
    package_id: String, 
    output_path: String
) -> Result<String, String>;

#[tauri::command]
async fn extract_package_preview(hwp_path: String) -> Result<PackageManifest, String>;
```

## Installation Flow

### User Installation

1. **Initiate**: User clicks "Install Package" or opens `.hwp` file
2. **Preview**: Show package info, requirements, conflicts
3. **Confirm**: User reviews and confirms installation
4. **Extract**: Extract ZIP to temporary directory
5. **Validate**: Check manifest, version compatibility, conflicts
6. **Install**: Copy widgets and icons to package directory
7. **Register**: Update installed packages registry
8. **Cleanup**: Remove temporary files
9. **Reload**: Refresh widget cache and UI

### Conflict Detection

```javascript
async checkConflicts(manifest) {
  const conflicts = [];
  
  // Check widget ID conflicts
  for (const widgetId of manifest.provides.widgets) {
    const existing = await this.findInstalledWidget(widgetId);
    if (existing && existing.package !== manifest.id) {
      conflicts.push({
        type: 'widget',
        id: widgetId,
        existing: existing.package,
        new: manifest.id
      });
    }
  }
  
  // Check icon set conflicts
  for (const iconSet of manifest.provides.iconSets) {
    const existing = await this.findInstalledIconSet(iconSet);
    if (existing && existing.package !== manifest.id) {
      conflicts.push({
        type: 'iconSet',
        id: iconSet,
        existing: existing.package,
        new: manifest.id
      });
    }
  }
  
  return conflicts;
}
```

### Conflict Resolution UI

```
⚠️ Installation Conflicts

Package: com.community.gauges v2.0.0

Conflicts with installed packages:

1. Widget "gauge"
   Installed: com.jangabrielsson.gauge v1.0.0
   New:       com.community.gauges v2.0.0
   
   Resolution:
   ◉ Install both (namespaced)
      Both widgets will be available
   ○ Replace existing
      ⚠️ May break existing floor plans
   ○ Skip this widget
      Install package without "gauge"

2. Icon set "gauge"
   Installed: com.jangabrielsson.gauge v1.0.0
   New:       com.community.gauges v2.0.0
   
   Resolution:
   ◉ Install both (namespaced)
   ○ Replace existing
   ○ Skip this icon set

[Continue Installation] [Cancel]
```

## Package Creation

### Manual Creation

1. Create package directory structure
2. Add widget definitions
3. Add icon sets
4. Create manifest.json
5. Add README and screenshots
6. ZIP all files with `.hwp` extension

### Export Tool

```
Settings → Widgets → [Package Name] → Export

Package Export
├─ Package ID: com.jangabrielsson.gauge
├─ Include:
│  ☑ Widget: gauge
│  ☑ Widget: speedometer
│  ☑ Icon Set: gauge
│  ☑ Icon Set: speedometer
│  ☑ README.md
│  ☐ Screenshots
├─ Version: [1.0.0]
└─ Output: [~/Desktop/gauge-widgets.hwp]

[Export Package]
```

### Command Line Tool

```bash
#!/bin/bash
# scripts/create-package.sh

PACKAGE_ID=$1
OUTPUT_DIR=${2:-.}

cd homemapdata

# Create temp directory
TEMP_DIR=$(mktemp -d)

# Load manifest
MANIFEST="widgets/packages/${PACKAGE_ID}/manifest.json"
if [ ! -f "$MANIFEST" ]; then
  echo "Error: Package not found: $PACKAGE_ID"
  exit 1
fi

# Copy manifest
cp "$MANIFEST" "$TEMP_DIR/"

# Copy widgets
mkdir -p "$TEMP_DIR/widgets"
cp widgets/packages/${PACKAGE_ID}/*.json "$TEMP_DIR/widgets/" 2>/dev/null || true

# Copy icons
if [ -d "icons/packages/${PACKAGE_ID}" ]; then
  mkdir -p "$TEMP_DIR/icons"
  cp -r icons/packages/${PACKAGE_ID}/* "$TEMP_DIR/icons/"
fi

# Create ZIP
PACKAGE_NAME=$(echo $PACKAGE_ID | sed 's/\./-/g')
OUTPUT_FILE="${OUTPUT_DIR}/${PACKAGE_NAME}.hwp"

cd "$TEMP_DIR"
zip -r "$OUTPUT_FILE" .

# Cleanup
rm -rf "$TEMP_DIR"

echo "Package created: $OUTPUT_FILE"
```

## UI Components

### Package Manager Screen

```
Settings → Packages

Installed Packages (3)

┌───────────────────────────────────────────────────┐
│ 📦 Gauge Widgets                         v1.0.0   │
│    by Jan Gabrielsson                             │
│    com.jangabrielsson.gauge                       │
│                                                    │
│    Widgets: gauge, speedometer                    │
│    Icon Sets: gauge, speedometer                  │
│                                                    │
│    Installed: Oct 30, 2025                        │
│    [View Details] [Uninstall] [Export]            │
└───────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────┐
│ 📦 RGB Light Widgets                     v2.1.0   │
│    by Community Contributors                      │
│    io.github.community.lights                     │
│                                                    │
│    Widgets: lightcolor, rgbstrip                  │
│    Icon Sets: colorLight                          │
│                                                    │
│    🔄 Update available: v2.2.0                    │
│    [Update] [View Details] [Uninstall]            │
└───────────────────────────────────────────────────┘

[+ Install Package] [Browse Repository]
```

### Widget Mapping Screen

```
Settings → Widget Mappings

Device type mappings determine which widget is used
for each HC3 device type.

┌───────────────────────────────────────────────────┐
│ com.fibaro.binarySwitch                           │
│ [com.fibaro.built-in/binarySwitch ▼]             │
│                                                    │
│ Available Widgets:                                 │
│   • com.fibaro.built-in/binarySwitch (default)    │
│                                                    │
│ [Reset to Default]                                │
└───────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────┐
│ com.fibaro.multilevelSensor                       │
│ [com.jangabrielsson.gauge/gauge ▼]               │
│                                                    │
│ Available Widgets:                                 │
│   • com.fibaro.built-in/sensor (default)          │
│   • com.jangabrielsson.gauge/gauge ⭐             │
│   • com.jangabrielsson.gauge/speedometer          │
│   • com.community.gauges/gauge                    │
│                                                    │
│ [Reset to Default]                                │
└───────────────────────────────────────────────────┘

[Save All] [Reset All to Defaults]
```

### Installation Preview

```
Install Widget Package?

📦 Gauge Widgets v1.0.0
by Jan Gabrielsson

Description:
Visual gauge widgets with rotating needles for
sensor values (0-100%).

Package Details:
• ID: com.jangabrielsson.gauge
• License: MIT
• Requires: HomeMap ≥0.1.7

Includes:
• 2 widgets: gauge, speedometer
• 2 icon sets: gauge, speedometer
• Device types: multilevelSensor, powerMeter

[Preview Screenshot]

✓ No conflicts detected
✓ Version compatible

[Install] [Cancel]
```

## Community Repository (Future)

### Repository Format

```json
{
  "version": "1.0",
  "repository": "https://homemap-widgets.github.io",
  "packages": [
    {
      "id": "com.jangabrielsson.gauge",
      "name": "Gauge Widgets",
      "version": "1.0.0",
      "author": "Jan Gabrielsson",
      "description": "Visual gauge widgets",
      "downloads": 1523,
      "rating": 4.8,
      "reviews": 42,
      "download_url": "https://github.com/.../gauge-widgets-1.0.0.hwp",
      "homepage": "https://github.com/jangabrielsson/homemap-gauge-widgets",
      "license": "MIT",
      "tags": ["sensor", "visualization", "gauge"],
      "screenshots": [
        "https://example.com/screenshot1.png"
      ],
      "created_at": "2025-10-01T00:00:00Z",
      "updated_at": "2025-10-30T12:00:00Z"
    }
  ]
}
```

### Repository Browser UI

```
Browse Widget Packages

Search: [________________________] 🔍

Filter: [All ▼] [Sensors ▼] [Lights ▼]
Sort:   [Most Downloads ▼]

┌─────────────────────────────────────────┐
│ 📦 Gauge Widgets                 v1.0.0 │
│    by Jan Gabrielsson            ⭐ 4.8 │
│                                         │
│    Visual gauge widgets with rotating   │
│    needles for sensor values.           │
│                                         │
│    👁️ 1.5K downloads • 42 reviews      │
│    🏷️ sensor, visualization, gauge      │
│                                         │
│    [Install] [Preview] [More Info]      │
└─────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Core Package System (v0.1.8)
- [x] Define `.hwp` format specification
- [ ] Implement ZIP extraction (Rust)
- [ ] Package validation and manifest parsing
- [ ] Basic installation (copy files to packages/)
- [ ] Widget resolution with package namespacing
- [ ] Installed packages registry
- [ ] Manual installation via file picker
- [ ] Basic uninstall functionality

### Phase 2: UI & Management (v0.1.9)
- [ ] Package Manager UI screen
- [ ] Installation preview dialog
- [ ] Conflict detection and resolution
- [ ] Widget mapping UI
- [ ] Package export functionality
- [ ] Package details view
- [ ] Update checking

### Phase 3: Community Features (v0.2.0)
- [ ] Community repository browser
- [ ] Search and filtering
- [ ] One-click installation from URL
- [ ] Rating and review system
- [ ] Package submission workflow
- [ ] Auto-update for packages

## Best Practices

### For Package Authors

1. **Use reverse domain notation** for package IDs
2. **Follow semantic versioning** (major.minor.patch)
3. **Include comprehensive README** with examples
4. **Add screenshots** for visual widgets
5. **Test with minimum HomeMap version** specified
6. **Document device type compatibility**
7. **Use clear, descriptive widget IDs**
8. **Include license information**

### For Users

1. **Review package details** before installation
2. **Check version requirements** match your HomeMap version
3. **Backup configuration** before installing packages
4. **Update packages** regularly for bug fixes
5. **Report issues** to package authors
6. **Share useful packages** with the community

## Security Considerations

1. **Package validation**: Verify manifest schema and structure
2. **Path traversal protection**: Ensure extracted files stay within package directory
3. **Version verification**: Check HomeMap version compatibility
4. **File size limits**: Prevent extremely large packages
5. **Malicious code prevention**: Widgets are JSON data, not executable code
6. **Update signing** (future): Cryptographic signatures for updates

## Migration Guide

### From Current System (v0.1.7) to Packages (v0.1.8+)

**Automatic Migration:**
```javascript
async migrateToPackageSystem() {
  // Existing widgets stay in widgets/ (backward compatible)
  // New structure:
  // widgets/built-in/  ← moved here
  // widgets/packages/  ← new installs go here
  
  // Widget resolution handles both locations
  // No user action required
}
```

**Manual Migration (optional):**
Users can export existing custom widgets as packages for sharing.

