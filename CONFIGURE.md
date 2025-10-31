# HomeMap Configuration Guide

This guide explains how to configure HomeMap for your home automation system.

> **For End Users**: HomeMap is designed to work through the UI! This guide is primarily for **developers** who want to customize widgets or understand the file structure.

**Note**: For detailed widget format documentation, see [docs/WIDGET_FORMAT.md](docs/WIDGET_FORMAT.md)

## Table of Contents

- [Quick Start (UI Method)](#quick-start-ui-method)
- [Configuration File Structure](#configuration-file-structure)
- [Floor Plans](#floor-plans)
- [Devices](#devices)
- [Widget System](#widget-system)
- [Icons](#icons)
- [Examples](#examples)
- [Advanced: Manual Configuration](#advanced-manual-configuration)

## Quick Start (UI Method)

**Recommended for all users:**

1. **Launch HomeMap**:
   - Configuration folder is created automatically
   - Built-in widgets and icons are installed automatically

2. **Configure HC3 Connection**:
   - Click Settings (⚙️) → HC3 tab
   - Enter your HC3 host, username, and password
   - Click Save

3. **Add Floor Plans**:
   - Settings (⚙️) → Floors tab
   - Click "Add Floor"
   - Select your floor plan image
   - Enter floor name and ID
   - Click Save

4. **Add Devices**:
   - Click Edit Mode (✏️)
   - Click hamburger menu (☰) → Device Management
   - Find your device and click "Install"
   - Drag to position on floor plan
   - Exit Edit Mode

**Files are stored automatically at:**
- **macOS**: `~/Library/Application Support/HomeMap/homemapdata/`
- **Windows**: `%APPDATA%\HomeMap\homemapdata/`

> **Note**: The `.env` file is optional and only needed for advanced configuration.

## Configuration File Structure

> **Note**: For most users, you don't need to edit this file directly! Use the Settings UI instead. This section is for developers who want to understand the file format or create custom configurations.

The main configuration file is `homemapdata/config.json`. It defines:

- Application name and icon
- Floor plans
- Device placements

**Location:**
- **macOS**: `~/Library/Application Support/HomeMap/homemapdata/config.json`
- **Windows**: `%APPDATA%\HomeMap\homemapdata\config.json`

### Basic Structure

```json
{
    "name": "My Home Map",
    "icon": "icons/house.png",
    "floors": [...],
    "devices": [...]
}
```

### Top-Level Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | No | Application title (default: "HomeMap") |
| `icon` | string | No | Path to app icon relative to homemapdata folder |
| `floors` | array | Yes | Array of floor definitions |
| `devices` | array | Yes | Array of device placements |

## Floor Plans

> **Recommended**: Use Settings → Floors tab to add floors. This section explains the underlying file format for developers.

Each floor requires:
- Unique ID
- Display name
- Floor plan image
- Natural image dimensions

### Floor Definition

```json
{
    "id": "floor1",
    "name": "First Floor",
    "image": "images/floor1.jpg",
    "width": 1920,
    "height": 1080
}
```

### Floor Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for the floor |
| `name` | string | Yes | Display name shown in tabs |
| `image` | string | Yes | Path to floor plan image (relative to homemapdata) |
| `width` | number | Yes | Natural width of the image in pixels |
| `height` | number | Yes | Natural height of the image in pixels |

### Image Guidelines

- **Formats**: JPG, PNG, SVG, WebP, GIF
- **Recommended size**: 1920x1080 or higher
- **Location**: Place images in `homemapdata/images/`
- **Aspect ratio**: Will scale to fit window while maintaining aspect ratio

## Devices

> **Recommended**: Use Edit Mode → Device Management panel to add devices. This section explains the underlying file format for developers.

Devices are placed on floors using natural image coordinates.

HomeMap supports two device formats:

### Single Floor Format

For devices on only one floor:

```json
{
    "id": 3630,
    "name": "Living Room Light",
    "type": "lightdim",
    "floor_id": "floor1",
    "position": {
        "x": 155,
        "y": 81
    }
}
```

### Multi-Floor Format

For devices that appear on multiple floors (e.g., thermostats, security panels):

```json
{
    "id": 3630,
    "name": "Thermostat",
    "type": "temperature",
    "floors": [
        {
            "floor_id": "floor1",
            "position": { "x": 155, "y": 81 }
        },
        {
            "floor_id": "floor2",
            "position": { "x": 200, "y": 90 }
        }
    ]
}
```

**Note**: HomeMap automatically normalizes formats - if you remove a device from all but one floor, it converts to single-floor format.

### Device Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | number | Yes | HC3 device ID |
| `name` | string | Yes | Display name (shown in tooltip) |
| `type` | string | Yes | Widget type (must match widget definition file) |
| `floor_id` | string | Conditional* | ID of the floor (single-floor format) |
| `position` | object | Conditional* | Position {x, y} (single-floor format) |
| `floors` | array | Conditional* | Array of floor placements (multi-floor format) |

\* Use either `floor_id`+`position` OR `floors`, not both.

### Managing Devices

**Recommended: Use the Device Management Panel**
1. Click Edit Mode (✏️)
2. Click hamburger menu (☰) → "Device Management"
3. Find your device and click "Install"
4. Drag device to position it on the floor plan
5. Exit Edit Mode to save

**For Developers: Manual Editing**:
1. Get device ID from HC3
2. Choose appropriate widget type
3. Add device to `config.json` with position coordinates
4. Reload app to see changes

## Widget System

> **For End Users**: HomeMap comes with all the widgets you need built-in! This section is for **developers** who want to create custom widgets.

Widgets define how devices are rendered and what actions they support.

**For complete widget format documentation, see [docs/WIDGET_FORMAT.md](docs/WIDGET_FORMAT.md)**

### Widget File Location

Widget definitions are JSON files in `homemapdata/widgets/`:

**Built-in Widgets** (auto-installed):
- Located in `widgets/built-in/` (automatically synced on startup)
- Don't edit these - they'll be overwritten!

**Custom Widgets** (for developers):
- Place in `widgets/packages/` for your own custom widgets
- Won't be overwritten by auto-sync

**Available Widget Types**:
- `lightdim.json` - Dimmable lights with on/off/dim
- `light.json` - Simple on/off lights
- `binarySwitch.json` - Toggle switches
- `doorLock.json` - Lock/unlock controls
- `temperature.json` - Temperature sensors
- `motion.json` - Motion sensors
- `doorSensor.json` - Door sensors
- `windowSensor.json` - Window sensors

### Widget Version

All widgets must specify a version (minimum: 0.1.5):

```json
{
    "widgetVersion": "0.1.5",
    ...
}
```

### Widget Structure (v0.1.5+)

Modern widgets use this structure:

```json
{
    "widgetVersion": "0.1.5",
    "iconSet": "lightIcons",
    "state": {...},
    "getters": {...},
    "events": {...},
    "render": {...},
    "actions": {...},
    "ui": {...}
}
```

### Quick Example: Light Widget

```json
{
    "widgetVersion": "0.1.5",
    "iconSet": "lightIcons",
    
    "state": {
        "value": false
    },
    
    "getters": {
        "value": {
            "api": "/api/devices/${id}/properties/value",
            "path": "value"
        }
    },
    
    "events": {
        "DevicePropertyUpdatedEvent": {
            "match": "$..[?(@.id == ${id} && @.property == 'value')]",
            "updates": {
                "value": "event.newValue"
            }
        }
    },
    
    "render": {
        "icon": {
            "type": "conditional",
            "property": "value",
            "conditions": [
                { "when": "value == false", "icon": "off" },
                { "when": "value == true", "icon": "on" }
            ]
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
        "rows": [
            {
                "elements": [
                    {
                        "type": "button",
                        "label": "On",
                        "action": "turnOn"
                    },
                    {
                        "type": "button",
                        "label": "Off",
                        "action": "turnOff"
                    }
                ]
            }
        ]
    }
}
```

### Key Sections

- **state**: Default state values
- **getters**: API calls to fetch device state
- **events**: Real-time update handling
- **render**: Icon and text rendering rules
- **actions**: Available actions (API calls)
- **ui**: User interface when device is clicked

For detailed explanations of each section, see [docs/WIDGET_FORMAT.md](docs/WIDGET_FORMAT.md).

## Icons

> **For End Users**: HomeMap comes with all necessary icons built-in! This section is for **developers** creating custom widgets.

Icons are displayed on the floor plan to represent devices.

### Icon File Location

**Built-in Icons** (auto-installed):
- Located in `icons/built-in/` (automatically synced on startup)
- Don't edit these - they'll be overwritten!

**Custom Icons** (for developers):
- Place in `icons/packages/` for your own custom icons
- Won't be overwritten by auto-sync

### Icon Sets (v0.1.5+)

Icons are now organized into **icon sets** - named collections that support multiple formats:

```json
{
    "iconSet": "lightIcons",
    "render": {
        "icon": {
            "type": "conditional",
            "property": "value",
            "conditions": [
                { "when": "value == false", "icon": "off" },
                { "when": "value == true", "icon": "on" }
            ]
        }
    }
}
```

Icon files should be in `homemapdata/icons/{iconSetName}/`:
- `lightIcons/off.svg`
- `lightIcons/on.svg`

**Supported formats**: SVG, PNG, JPG, JPEG (auto-detected)

### Icon Guidelines

- **Format**: SVG recommended (crisp at any size, smaller files)
- **Size**: 32x32 pixels default (scales automatically)
- **Location**: 
  - Built-in: `homemapdata/icons/built-in/{iconSetName}/{iconName}.{ext}`
  - Custom: `homemapdata/icons/packages/{iconSetName}/{iconName}.{ext}`
- **Naming**: Use descriptive names matching your render conditions

### Example Icon Sets

**Light Icons** (built-in):
```
icons/built-in/lightIcons/
  ├── off.svg
  ├── on.svg
  └── dim.svg
```

**Custom Icons** (for developers):
```
icons/packages/myCustomIcons/
  ├── state1.svg
  └── state2.svg
```

## Examples

### Complete Example Configurations

See `homemapdata.example/` for complete working examples with:
- All 8 widget types
- Icon sets
- Floor plan setup
- Device configurations

### Quick Widget Examples

**Simple Light** (On/Off only):
```json
{
    "widgetVersion": "0.1.5",
    "iconSet": "lightIcons",
    "state": { "value": false },
    "getters": {
        "value": {
            "api": "/api/devices/${id}/properties/value",
            "path": "value"
        }
    },
    "render": {
        "icon": {
            "type": "conditional",
            "property": "value",
            "conditions": [
                { "when": "value == false", "icon": "off" },
                { "when": "value == true", "icon": "on" }
            ]
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
        "rows": [
            {
                "elements": [
                    { "type": "button", "label": "On", "action": "turnOn" },
                    { "type": "button", "label": "Off", "action": "turnOff" }
                ]
            }
        ]
    }
}
```

**Dimmable Light** (On/Off + Slider):
```json
{
    "widgetVersion": "0.1.5",
    "iconSet": "lightDimIcons",
    "state": { "value": 0 },
    "getters": {
        "value": {
            "api": "/api/devices/${id}/properties/value",
            "path": "value"
        }
    },
    "render": {
        "icon": {
            "type": "conditional",
            "property": "value",
            "conditions": [
                { "when": "value == 0", "icon": "off" },
                { "when": "value > 0 && value < 99", "icon": "dim" },
                { "when": "value >= 99", "icon": "on" }
            ]
        },
        "text": {
            "template": "${value}%"
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
        },
        "setValue": {
            "method": "POST",
            "api": "/api/devices/${id}/action/setValue",
            "body": { "args": ["${value}"] }
        }
    },
    "ui": {
        "rows": [
            {
                "elements": [
                    { "type": "button", "label": "On", "action": "turnOn" },
                    { "type": "button", "label": "Off", "action": "turnOff" }
                ]
            },
            {
                "elements": [
                    {
                        "type": "slider",
                        "property": "value",
                        "min": 0,
                        "max": 99,
                        "action": "setValue"
                    }
                ]
            }
        ]
    }
}
```

**Temperature Sensor** (Read-only):
```json
{
    "widgetVersion": "0.1.5",
    "iconSet": "temperature",
    "state": { "value": 20.0 },
    "getters": {
        "value": {
            "api": "/api/devices/${id}/properties/value",
            "path": "value"
        }
    },
    "render": {
        "icon": {
            "type": "static",
            "icon": "thermometer"
        },
        "text": {
            "template": "${value}°C"
        }
    }
}
```

For more examples, see:
- `homemapdata.example/widgets/` - All 8 widget types
- `docs/WIDGET_FORMAT.md` - Complete format documentation

## Tips and Best Practices

1. **Use the UI**: Settings, Floor Management, and Device Management handle everything for most users

2. **Built-in vs Custom**:
   - `built-in/` folders: Auto-synced, don't edit
   - `packages/` folders: Your custom widgets/icons, safe to edit

3. **For Developers Creating Custom Widgets**:
   - Copy from `built-in/` to `packages/` as a starting point
   - Test incrementally with one device at a time
   - Check console (DevTools) to debug event processing
   - Always set `widgetVersion: "0.1.5"` or higher

4. **Backup Config**: 
   - Copy entire `homemapdata` folder before major changes
   - Located in Application Support folder (see Quick Start section)

5. **Widget Versioning**: Always set `widgetVersion: "0.1.5"` or higher for new widgets

6. **Property-Specific APIs**: Use `/api/devices/${id}/properties/{property}` for better performance

## Troubleshooting

**Device not showing**:
- Use Device Management panel to reinstall the device
- Check device ID matches HC3
- Verify device is enabled in HC3
- Check that device is on the current floor

**Icon not appearing**:
- Built-in icons should work automatically
- For custom icons: verify files exist in `icons/packages/{iconSet}/`
- Check icon set name and icon name match in widget
- Look for loading errors in console (DevTools)

**Action not working**:
- Test the device in HC3 web interface first
- Check console for HTTP errors (DevTools)
- For custom widgets: verify API endpoint is correct

**Events not updating**:
- Check HC3 connection status (green indicator at top right)
- Refresh the page to reconnect
- Look for event dispatch logs in console

**Can't edit devices**:
- Make sure Edit Mode (✏️) is enabled
- Use Device Management panel (☰ menu)
- Drag devices to reposition them

**Configuration folder not found**:
- Should be created automatically on first launch
- Check Application Support folder (see Quick Start section)
- Try restarting the app

## Advanced: Manual Configuration

> **For Developers Only**: This section covers manual file editing for advanced users who need direct control.

### Manual .env Configuration

While the Settings UI is recommended, you can manually edit the `.env` file:

**Location**: Same directory as the app executable (development) or user preferences (production)

```bash
HC3_HOST=192.168.1.100
HC3_USER=admin
HC3_PASSWORD=yourpassword
HC3_PROTOCOL=http
```

**Note**: The `HC3_HOMEMAP` path is no longer needed - HomeMap uses Application Support folder automatically.

### Manual Device Addition

If you need to manually edit `config.json`:

1. Find your config file:
   - **macOS**: `~/Library/Application Support/HomeMap/homemapdata/config.json`
   - **Windows**: `%APPDATA%\HomeMap\homemapdata\config.json`

2. Add device entry:
   ```json
   {
     "id": 385,
     "name": "Living Room Light",
     "type": "lightdim",
     "floor_id": "floor1",
     "position": { "x": 450, "y": 300 }
   }
   ```

3. Save and restart HomeMap

**Finding Coordinates**: Add a device via UI first, then check config.json to see the coordinates.

### Custom Widget Development

For creating custom widgets:

1. Study built-in widgets in `homemapdata/widgets/built-in/`
2. Create your widget in `homemapdata/widgets/packages/`
3. Follow format in [docs/WIDGET_FORMAT.md](docs/WIDGET_FORMAT.md)
4. Test with a single device before deploying

### Custom Icon Development

For creating custom icons:

1. Create icon set folder in `homemapdata/icons/packages/myIconSet/`
2. Add SVG files (32x32px recommended)
3. Reference in widget: `"iconSet": "myIconSet"`
4. Use descriptive icon names matching render conditions

## Additional Resources

- **User Tutorial**: [docs/TUTORIAL.md](docs/TUTORIAL.md) - Step-by-step guide for end users
- **Widget Format**: [docs/WIDGET_FORMAT.md](docs/WIDGET_FORMAT.md) - Complete widget specification for developers
- **Examples**: `homemapdata.example/` - Example widgets and icons
- **Changelog**: [CHANGELOG.md](CHANGELOG.md) - Version history and changes
- **Forum Post**: [docs/FORUM_POST.html](docs/FORUM_POST.html) - Community discussion

## See Also

- [README.md](README.md) - Installation and quick start for end users
- [docs/TUTORIAL.md](docs/TUTORIAL.md) - Complete user tutorial
- [docs/DEV_GUIDE.md](docs/DEV_GUIDE.md) - Development guide for contributors
- [homemapdata.example/](homemapdata.example/) - Example configuration files
