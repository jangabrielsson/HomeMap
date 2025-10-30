# Creating Widget Packages (.hwp)

This guide explains how to create widget packages for HomeMap. Widget packages use the `.hwp` extension (HomeMap Widget Package) and are ZIP archives containing widgets, icons, and metadata.

## Table of Contents
- [Package Structure](#package-structure)
- [Method 1: Using the Script (Recommended)](#method-1-using-the-script-recommended)
- [Method 2: Manual Creation](#method-2-manual-creation)
- [Manifest Format](#manifest-format)
- [Testing Your Package](#testing-your-package)
- [Distribution](#distribution)

## Package Structure

A widget package is a ZIP file with the following structure:

```
package-id-version.hwp (ZIP archive)
├── manifest.json          # Package metadata (required)
├── widgets/              # Widget definitions (required)
│   ├── widget1.json
│   ├── widget2.json
│   └── ...
├── icons/                # Icon sets (optional)
│   ├── iconset1.json
│   └── ...
├── README.md             # Package documentation (optional)
└── screenshots/          # Preview images (optional)
    ├── screenshot1.png
    └── ...
```

## Method 1: Using the Script (Recommended)

### Prerequisites
- macOS or Linux
- Bash shell
- An installed widget package in HomeMap

### Steps

1. **Locate the script:**
   ```bash
   cd /path/to/HomeMap
   chmod +x scripts/create-package.sh
   ```

2. **List available packages:**
   ```bash
   ./scripts/create-package.sh
   ```
   
   This shows all installed packages in your HomeMap data directory.

3. **Create a package:**
   ```bash
   ./scripts/create-package.sh <package-id> <output-directory>
   ```
   
   **Example:**
   ```bash
   ./scripts/create-package.sh com.example.gauge ~/Desktop
   ```
   
   This creates `com-example-gauge-1.0.0.hwp` on your Desktop.

4. **Verify the output:**
   The script will show:
   - Package name and version
   - Number of widgets copied
   - Number of icon sets copied
   - Final file size
   - Package contents listing

### Script Output Example
```
Creating package for: com.jangabrielsson.gauge
Package: Gauge Widget v1.0.0
Copying widgets...
  1 widget(s) copied
Copying icon sets...
  0 icon set(s) copied
Package created successfully!
File: ./com-jangabrielsson-gauge-1.0.0.hwp
Size: 1.4K
Package contents:
  icons/
  manifest.json
  widgets/
  widgets/gauge.json
✅ Done!
```

## Method 2: Manual Creation

This method works on any platform with a text editor and ZIP program.

### Step 1: Create the Folder Structure

Create a new folder for your package (use any name):

```
my-widget-package/
├── manifest.json
├── widgets/
├── icons/
```

### Step 2: Create the Manifest

Create `manifest.json` with your package information:

```json
{
  "id": "com.yourname.widgetname",
  "name": "Your Widget Name",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "Description of your widget package",
  "homepage": "https://example.com/widget",
  "license": "MIT",
  "requires": {
    "homemap": ">=1.0.0"
  },
  "provides": {
    "widgets": [
      {
        "id": "widget-id",
        "name": "Widget Display Name",
        "description": "What this widget does",
        "deviceTypes": ["com.fibaro.binarySensor", "com.fibaro.multilevelSensor"]
      }
    ],
    "icons": [
      {
        "id": "iconset-id",
        "name": "Icon Set Name",
        "count": 10
      }
    ]
  }
}
```

**Important manifest fields:**
- `id`: Reverse domain notation (e.g., `com.yourname.widget`)
- `version`: Semantic versioning (e.g., `1.0.0`)
- `provides.widgets`: Array of widgets included
- `provides.icons`: Array of icon sets included

### Step 3: Add Widget Definitions

Place your widget JSON files in the `widgets/` folder:

**Example: `widgets/gauge.json`**
```json
{
  "id": "gauge",
  "name": "Gauge Widget",
  "deviceTypes": ["com.fibaro.multilevelSensor"],
  "template": {
    "html": "...",
    "css": "...",
    "script": "..."
  },
  "config": {
    "minValue": 0,
    "maxValue": 100,
    "unit": ""
  }
}
```

### Step 4: Add Icons (Optional)

If your widgets use custom icons, place icon definition files in the `icons/` folder:

**Example: `icons/gauge-icons.json`**
```json
{
  "id": "gauge-icons",
  "name": "Gauge Icon Set",
  "icons": {
    "gauge-0": "data:image/svg+xml;base64,...",
    "gauge-1": "data:image/svg+xml;base64,...",
    "gauge-2": "data:image/svg+xml;base64,..."
  }
}
```

### Step 5: Add Documentation (Optional)

Create a `README.md` file describing your widget:

```markdown
# Your Widget Name

## Description
Brief description of what your widget does.

## Features
- Feature 1
- Feature 2

## Configuration
Explain any configuration options.

## Screenshots
Include screenshots if available.

## License
MIT License
```

### Step 6: Add Screenshots (Optional)

Create a `screenshots/` folder and add PNG/JPG images showing your widget in action.

### Step 7: Create the ZIP Archive

**On macOS/Linux:**
```bash
cd my-widget-package
zip -r ../com-yourname-widget-1.0.0.hwp *
```

**On Windows:**
1. Select all files and folders inside `my-widget-package`
2. Right-click → Send to → Compressed (zipped) folder
3. Rename the ZIP file to `com-yourname-widget-1.0.0.hwp`

**Important:**
- The archive must contain the files directly (not nested in a folder)
- Use the naming pattern: `package-id-version.hwp`
- Replace dots in package ID with hyphens for the filename

### Step 8: Verify the Archive

Extract your `.hwp` file to verify:
- `manifest.json` is at the root
- `widgets/` folder contains your widget files
- No extra nested folders

**Correct structure when extracted:**
```
manifest.json
widgets/
  gauge.json
icons/
  gauge-icons.json
README.md
```

**Incorrect structure (don't do this):**
```
my-widget-package/
  manifest.json
  widgets/
    gauge.json
```

## Manifest Format

### Complete Manifest Example

```json
{
  "id": "com.example.sensors",
  "name": "Enhanced Sensor Widgets",
  "version": "1.2.3",
  "author": "John Doe",
  "description": "A collection of beautiful sensor visualization widgets",
  "homepage": "https://github.com/johndoe/homemap-sensors",
  "repository": "https://github.com/johndoe/homemap-sensors",
  "license": "MIT",
  "keywords": ["sensors", "gauges", "visualization"],
  "requires": {
    "homemap": ">=1.0.0"
  },
  "provides": {
    "widgets": [
      {
        "id": "temperature-gauge",
        "name": "Temperature Gauge",
        "description": "Circular gauge for temperature sensors",
        "deviceTypes": [
          "com.fibaro.temperatureSensor",
          "com.fibaro.multilevelSensor"
        ]
      },
      {
        "id": "humidity-bar",
        "name": "Humidity Bar",
        "description": "Horizontal bar for humidity display",
        "deviceTypes": [
          "com.fibaro.humiditySensor",
          "com.fibaro.multilevelSensor"
        ]
      }
    ],
    "icons": [
      {
        "id": "sensor-icons",
        "name": "Sensor Icon Set",
        "count": 25
      }
    ]
  }
}
```

### Field Reference

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `id` | Yes | String | Unique package identifier (reverse domain notation) |
| `name` | Yes | String | Human-readable package name |
| `version` | Yes | String | Semantic version (major.minor.patch) |
| `author` | Yes | String | Package author name |
| `description` | No | String | Short package description |
| `homepage` | No | String | Package website URL |
| `repository` | No | String | Source code repository URL |
| `license` | No | String | License identifier (MIT, GPL-3.0, etc.) |
| `keywords` | No | Array | Search keywords |
| `requires.homemap` | No | String | Minimum HomeMap version |
| `provides.widgets` | Yes | Array | List of included widgets |
| `provides.icons` | No | Array | List of included icon sets |

### Widget Definition Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Widget identifier (used in filenames) |
| `name` | Yes | Display name |
| `description` | No | Widget description |
| `deviceTypes` | Yes | Array of compatible HC3 device types |

### Icon Set Definition Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Icon set identifier |
| `name` | Yes | Display name |
| `count` | No | Number of icons in the set |

## Testing Your Package

### 1. Install in HomeMap

1. Open HomeMap
2. Go to Settings → Widget Packages
3. Click "Install Package"
4. Select your `.hwp` file
5. Verify installation success

### 2. Test Widget Usage

1. Go to Edit Mode
2. Add a new device or edit existing one
3. Check if your widget appears in the widget list
4. Assign your widget to a device
5. Verify the widget displays correctly

### 3. Check Console for Errors

1. Open DevTools (View → Toggle Developer Tools)
2. Check Console tab for any errors
3. Verify widget loads without warnings

### 4. Test Reinstallation

1. Try installing the package again
2. Verify update/reinstall prompt appears
3. Confirm version detection works

## Distribution

### File Naming Convention

Use this pattern for consistency:
```
<package-id-with-hyphens>-<version>.hwp
```

Examples:
- `com-example-gauge-1.0.0.hwp`
- `com-johndoe-sensors-2.1.5.hwp`
- `org-community-themes-3.0.0-beta.hwp`

### Sharing Options

1. **GitHub Releases**: Upload `.hwp` files as release assets
2. **Personal Website**: Host on your own server
3. **Forum Posts**: Share via HC3 community forums
4. **Direct Transfer**: Email or messaging apps

### Best Practices

1. **Version Your Releases**: Increment version for each release
2. **Include README**: Document features and configuration
3. **Add Screenshots**: Help users preview widgets
4. **Test Thoroughly**: Install on clean HomeMap instance
5. **Document Requirements**: Note any HC3 version requirements
6. **Provide Examples**: Include sample device configurations
7. **License Clearly**: Specify usage terms

### Publishing Checklist

- [ ] Manifest contains all required fields
- [ ] Version follows semantic versioning
- [ ] All widget files are included
- [ ] Icons are properly referenced
- [ ] README documents features
- [ ] Screenshots are included
- [ ] Package installs without errors
- [ ] Widgets display correctly
- [ ] File is named correctly
- [ ] License is specified

## Troubleshooting

### Common Issues

**Issue**: "Invalid manifest" error
- **Solution**: Validate manifest.json using a JSON validator
- Check for missing required fields
- Ensure valid JSON syntax (no trailing commas)

**Issue**: Widgets don't appear in device dialog
- **Solution**: Check `deviceTypes` in widget definition
- Verify widget files are in `widgets/` folder
- Ensure widget IDs match between manifest and files

**Issue**: Icons not loading
- **Solution**: Verify icon files are in `icons/` folder
- Check icon set IDs match between manifest and files
- Ensure icon data is valid (base64 encoded)

**Issue**: Package won't install
- **Solution**: Check ZIP structure (files at root, not nested)
- Verify file extension is `.hwp`
- Ensure manifest.json is valid JSON

**Issue**: Version conflict on reinstall
- **Solution**: Increment version number in manifest
- Use semantic versioning properly
- Test update detection

## Examples

### Minimal Package

A simple package with one widget and no icons:

```
minimal-widget-1.0.0.hwp
├── manifest.json
└── widgets/
    └── simple.json
```

**manifest.json:**
```json
{
  "id": "com.example.minimal",
  "name": "Minimal Widget",
  "version": "1.0.0",
  "author": "Example",
  "provides": {
    "widgets": [
      {
        "id": "simple",
        "name": "Simple Widget",
        "deviceTypes": ["com.fibaro.binarySensor"]
      }
    ]
  }
}
```

### Complete Package

A full-featured package with multiple widgets, icons, and documentation:

```
sensor-suite-2.1.0.hwp
├── manifest.json
├── README.md
├── widgets/
│   ├── gauge.json
│   ├── bar.json
│   └── graph.json
├── icons/
│   └── sensor-icons.json
└── screenshots/
    ├── gauge.png
    ├── bar.png
    └── graph.png
```

## Additional Resources

- **Widget Format**: See existing widgets in `widgets/built-in/`
- **Icon Format**: Check `icons/built-in/` for examples
- **Device Types**: HC3 API documentation for device type list
- **Semantic Versioning**: https://semver.org/

## Support

If you encounter issues creating packages:
1. Check HomeMap DevTools console for errors
2. Validate your JSON files
3. Review examples in the built-in widgets folder
4. Post questions on HC3 community forums

---

**Happy widget creating!** 🎨
