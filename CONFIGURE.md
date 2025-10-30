# HomeMap Configuration Guide

This guide explains how to configure HomeMap for your home automation system.

**Note**: For detailed widget format documentation, see [docs/WIDGET_FORMAT.md](docs/WIDGET_FORMAT.md)

## Table of Contents

- [Quick Start](#quick-start)
- [Configuration File Structure](#configuration-file-structure)
- [Floor Plans](#floor-plans)
- [Devices](#devices)
- [Widget System](#widget-system)
- [Icons](#icons)
- [Examples](#examples)

## Quick Start

1. **Use Settings Panel** (Recommended):
   - Click the cogwheel (⚙️) button in the app
   - Configure HC3 host, credentials, and HomeMap data directory
   - Settings are saved to `.env` file automatically

2. **Or Edit .env Manually**:
   ```bash
   HC3_HOST=192.168.1.100
   HC3_USER=admin
   HC3_PASSWORD=yourpassword
   HC3_PROTOCOL=http
   HC3_HOMEMAP=/path/to/homemapdata
   ```

3. **Add Devices Visually**:
   - Enable Edit Mode (toggle at top of app)
   - Right-click on floor plan to add device
   - Right-click on device to edit or delete
   - Drag devices to reposition

## Configuration File Structure

The main configuration file is `homemapdata/config.json`. It defines:

- Application name and icon
- Floor plans
- Device placements

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

**Recommended: Use the Visual UI**
1. Enable Edit Mode (toggle at top)
2. Right-click empty space → "Add Device"
3. Right-click device → "Edit" or "Delete"
4. Drag devices to reposition

**Manual Editing**:
1. Get device ID from HC3
2. Choose appropriate widget type
3. Position device on floor plan
4. Save and reload app

## Widget System

Widgets define how devices are rendered and what actions they support.

**For complete widget format documentation, see [docs/WIDGET_FORMAT.md](docs/WIDGET_FORMAT.md)**

### Widget File Location

Widget definitions are JSON files in `homemapdata/widgets/`:

**Available Widgets** (v0.1.5+):
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

Icons are displayed on the floor plan to represent devices.

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
- **Location**: `homemapdata/icons/{iconSetName}/{iconName}.{ext}`
- **Naming**: Use descriptive names matching your render conditions

### Example Icon Sets

**Light Icons**:
```
icons/lightIcons/
  ├── off.svg
  ├── on.svg
  └── dim.svg
```

**Motion Sensor Icons**:
```
icons/motionSensor/
  ├── safe.svg
  └── breached.svg
```

**Door Sensor Icons**:
```
icons/doorSensor/
  ├── closed.svg
  └── open.svg
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

1. **Use Visual UI**: Enable Edit Mode to add, edit, and position devices without manual JSON editing

2. **Start with Settings Panel**: Use the cogwheel (⚙️) to configure HC3 connection instead of editing .env

3. **Use Example Widgets**: Copy from `homemapdata.example/widgets/` and modify for your needs

4. **Icon Sets**: Organize icons into sets by device type for better management

5. **Test Incrementally**: Add one device at a time to verify everything works

6. **Check Console**: Use DevTools (Cmd+Shift+I or menu) to debug event processing

7. **Backup Config**: Keep backups before major changes

8. **Multi-Floor Devices**: HomeMap automatically handles format conversion - add/remove floors via Edit dialog

9. **Widget Versioning**: Always set `widgetVersion: "0.1.5"` or higher for new widgets

10. **Property-Specific APIs**: Use `/api/devices/${id}/properties/{property}` for better performance

## Troubleshooting

**Device not showing**:
- Check device ID matches HC3
- Verify widget type exists in `widgets/` folder
- Check `floor_id` matches a floor definition
- Look for version compatibility errors in console

**Icon not appearing**:
- Verify icon set name and icon name match
- Check files exist: `homemapdata/icons/{iconSet}/{iconName}.{ext}`
- Look for loading errors in console
- Ensure widget has `iconSet` property

**Action not working**:
- Check HC3 API endpoint is correct in widget actions
- Verify device supports the action in HC3
- Check console for HTTP errors
- Ensure `body` format matches HC3 expectations

**Events not updating**:
- Check event `match` pattern includes property filter
- Verify `updates` map is correct
- Look for event dispatch logs in console
- Ensure widget version is 0.1.5+

**Widget version errors**:
- Update `widgetVersion` to "0.1.5" or higher
- Convert old valuemaps format to new state/getters/render format
- See `docs/WIDGET_FORMAT.md` for migration guide

**Can't edit devices**:
- Enable Edit Mode (toggle at top of window)
- Right-click device for Edit/Delete
- Right-click empty space to Add Device

## Migration from v0.1.4

If you have widgets in the old format (with valuemaps), see:
- `docs/WIDGET_FORMAT.md` - Complete new format
- `homemapdata.example/` - Working examples of all widget types
- Migration involves converting `valuemaps` → `state`/`getters`/`render`/`actions`/`ui`

## Additional Resources

- **Widget Format**: [docs/WIDGET_FORMAT.md](docs/WIDGET_FORMAT.md) - Complete widget specification
- **Multi-Floor Devices**: [docs/MULTI_FLOOR_DEVICES.md](docs/MULTI_FLOOR_DEVICES.md) - Multi-floor support details
- **Examples**: `homemapdata.example/` - Complete working configuration
- **Changelog**: [CHANGELOG.md](CHANGELOG.md) - Version history and changes

**Position wrong after edit**:
- Verify floor width/height match actual image dimensions
- Reload app after changing floor dimensions

## See Also

- [README.md](README.md) - Installation and quick start
- [homemapdata.example/](homemapdata.example/) - Example configuration
- [docs/DEV_GUIDE.md](docs/DEV_GUIDE.md) - Development guide
