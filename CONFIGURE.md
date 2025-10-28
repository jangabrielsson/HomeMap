# HomeMap Configuration Guide

This guide explains how to configure HomeMap for your home automation system.

## Table of Contents

- [Configuration File Structure](#configuration-file-structure)
- [Floor Plans](#floor-plans)
- [Devices](#devices)
- [Widget System](#widget-system)
- [Icons](#icons)
- [Actions](#actions)
- [Examples](#examples)

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

### Device Definition

```json
{
    "floor_id": "floor1",
    "id": 3630,
    "name": "Living Room Light",
    "type": "light",
    "position": {
        "x": 155,
        "y": 81
    }
}
```

### Device Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `floor_id` | string | Yes | ID of the floor this device is on |
| `id` | number | Yes | HC3 device ID |
| `name` | string | Yes | Display name (shown in tooltip) |
| `type` | string | Yes | Widget type (must match widget definition file) |
| `position.x` | number | Yes | X coordinate in natural image pixels |
| `position.y` | number | Yes | Y coordinate in natural image pixels |

### Positioning Devices

1. **Natural coordinates**: Use the actual pixel coordinates from your source image
2. **Edit mode**: Enable Edit Mode in the app to drag devices and save positions
3. **Hover tooltip**: Hover over devices to see their ID and name

## Widget System

Widgets define how devices are rendered and what actions they support.

### Widget File Location

Widget definitions are JSON files in `homemapdata/widgets/`:
- `light.json` - Simple on/off lights
- `lightdim.json` - Dimmable lights
- `binarySwitch.json` - Binary switches
- `temperature.json` - Temperature sensors
- `motion.json` - Motion sensors

### Widget Structure

A widget definition contains:

```json
{
    "valuemaps": {...},
    "status": {...},
    "events": {...},
    "actions": {...}
}
```

### Valuemaps

Valuemaps define how device properties are rendered.

#### Icon Valuemap

**Boolean Type** (on/off):
```json
"icon": {
    "property": "value",
    "type": "boolean",
    "true": "icons/LightOn.svg",
    "false": "icons/LightOff.svg"
}
```

**Range Type** (numeric ranges):
```json
"icon": {
    "property": "value",
    "type": "range",
    "ranges": [
        { "min": 0, "max": 0, "path": "icons/LightOff.svg" },
        { "min": 1, "max": 98, "path": "icons/LightHalf.svg" },
        { "min": 99, "max": 100, "path": "icons/LightFull.svg" }
    ]
}
```

**Static Type** (always same icon):
```json
"icon": {
    "type": "static",
    "path": "icons/Temperature.svg"
}
```

#### Display Valuemap

Display text under the icon:

**Integer**:
```json
"display": {
    "property": "value",
    "type": "integer",
    "text": "${value}%"
}
```

**Float**:
```json
"display": {
    "property": "value",
    "type": "float",
    "text": "${value}°C"
}
```

**Epoch Time** (shows "X minutes ago"):
```json
"display": {
    "property": "lastBreached",
    "type": "epoch",
    "text": "${value}"
}
```

### Status API

Defines which HC3 API to call and which properties to fetch:

```json
"status": {
    "api": "/api/devices/${id}",
    "properties": ["properties.value"],
    "valuemap": "lightdim"
}
```

### Events

Events define how the device updates in real-time:

```json
"events": {
    "DevicePropertyUpdatedEvent": {
        "id": "id",
        "match": "$..[?(@.id == ${id} && @.property == 'value')]",
        "valuemap": "lightdim"
    }
}
```

| Property | Description |
|----------|-------------|
| `id` | JSONPath to device ID in event |
| `match` | JSONPath filter to match relevant events |
| `valuemap` | Which valuemap to use for rendering |

## Actions

Actions define what happens when you click on a device.

### Simple Action (Toggle)

For on/off devices:

```json
"actions": {
    "click": {
        "method": "GET",
        "api": "/api/devices/${id}/actions/toggle"
    }
}
```

### Slider Action

For devices with adjustable values (like dimmers):

```json
"actions": {
    "click": {
        "type": "slider",
        "min": 0,
        "max": 99,
        "valueProperty": "properties.value",
        "method": "POST",
        "api": "/api/devices/${id}/action/setValue",
        "body": {
            "args": ["${value}"]
        }
    }
}
```

#### Slider Action Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | string | Yes | Set to "slider" to show slider UI |
| `min` | number | Yes | Minimum slider value |
| `max` | number | Yes | Maximum slider value |
| `valueProperty` | string | No | Path to property for current value (default: "properties.value") |
| `method` | string | Yes | HTTP method (GET, POST, etc.) |
| `api` | string | Yes | API endpoint (use `${id}` for device ID) |
| `body` | object | No | Request body (use `${value}` for slider value) |

### Action Placeholders

- `${id}` - Replaced with device ID
- `${value}` - Replaced with slider value (for slider actions)

## Icons

Icons are displayed on the floor plan to represent devices.

### Icon Guidelines

- **Format**: SVG recommended (also supports PNG, JPG)
- **Size**: 32x32 pixels (will be scaled automatically)
- **Location**: Place in `homemapdata/icons/`
- **Naming**: Use descriptive names (e.g., `LightBulbOn.svg`, `LightBulbOff.svg`)

### Icon Types by Widget

Different widgets use different icon patterns:

**Boolean devices** (2 icons):
- `LightBulbOn.svg`
- `LightBulbOff.svg`

**Range devices** (3+ icons):
- `LightBulbOff.svg` (0)
- `LightBulbHalf.svg` (1-98)
- `LightBulbFull.svg` (99-100)

**Static devices** (1 icon):
- `TemperatureMeter.svg`
- `MotionSensor.svg`

## Examples

### Complete Light Widget

```json
{
    "valuemaps": {
        "light": {
            "icon": {
                "property": "value",
                "type": "boolean",
                "true": "icons/LightBulbFull.svg",
                "false": "icons/LightBulbOff.svg"
            }
        }
    },
    "status": {
        "api": "/api/devices/${id}",
        "properties": ["properties.value"],
        "valuemap": "light"
    },
    "events": {
        "DevicePropertyUpdatedEvent": {
            "id": "id",
            "match": "$..[?(@.id == ${id} && @.property == 'value')]",
            "valuemap": "light"
        }
    },
    "actions": {
        "click": {
            "method": "GET",
            "api": "/api/devices/${id}/actions/toggle"
        }
    }
}
```

### Complete Dimmer Widget

```json
{
    "valuemaps": {
        "lightdim": {
            "icon": {
                "property": "value",
                "type": "range",
                "ranges": [
                    { "min": 0, "max": 0, "path": "icons/LightBulbOff.svg" },
                    { "min": 1, "max": 98, "path": "icons/LightBulbHalf.svg" },
                    { "min": 99, "max": 100, "path": "icons/LightBulbFull.svg" }
                ]
            },
            "display": {
                "property": "value",
                "type": "integer",
                "text": "${value}%"
            }
        }
    },
    "status": {
        "api": "/api/devices/${id}",
        "properties": ["properties.value"],
        "valuemap": "lightdim"
    },
    "events": {
        "DevicePropertyUpdatedEvent": {
            "id": "id",
            "match": "$..[?(@.id == ${id} && @.property == 'value')]",
            "valuemap": "lightdim"
        }
    },
    "actions": {
        "click": {
            "type": "slider",
            "min": 0,
            "max": 99,
            "valueProperty": "properties.value",
            "method": "POST",
            "api": "/api/devices/${id}/action/setValue",
            "body": {
                "args": ["${value}"]
            }
        }
    }
}
```

### Temperature Sensor Widget

```json
{
    "valuemaps": {
        "temperature": {
            "icon": {
                "type": "static",
                "path": "icons/TemperatureMeter.svg"
            },
            "display": {
                "property": "value",
                "type": "float",
                "text": "${value}°C"
            }
        }
    },
    "status": {
        "api": "/api/devices/${id}",
        "properties": ["properties.value"],
        "valuemap": "temperature"
    },
    "events": {
        "DevicePropertyUpdatedEvent": {
            "id": "id",
            "match": "$..[?(@.id == ${id} && @.property == 'value')]",
            "valuemap": "temperature"
        }
    }
}
```

## Tips and Best Practices

1. **Start with Edit Mode**: Use Edit Mode to position devices visually, then fine-tune in config.json if needed

2. **Use Descriptive Names**: Device names appear in tooltips - make them clear and unique

3. **Organize Icons**: Group related icons with consistent naming (e.g., `Light_On.svg`, `Light_Off.svg`)

4. **Test Incrementally**: Add one device at a time to verify widget definitions work correctly

5. **Check Console**: Use DevTools (Cmd+Shift+I) to see event processing and debug issues

6. **Backup Config**: Keep backups of your config.json when making major changes

7. **Reuse Widgets**: Create widget definitions that can be reused across similar devices

8. **SVG Icons**: Use SVG for crisp icons at any size and smaller file sizes

## Troubleshooting

**Device not showing**:
- Check device ID matches HC3
- Verify widget type exists in `widgets/` folder
- Check floor_id matches a floor definition

**Icon not appearing**:
- Verify icon path is correct
- Check icon file exists in `homemapdata/icons/`
- Look for errors in console (DevTools)

**Action not working**:
- Check HC3 API endpoint is correct
- Verify device supports the action
- Check console for HTTP errors

**Position wrong after edit**:
- Verify floor width/height match actual image dimensions
- Reload app after changing floor dimensions

## See Also

- [README.md](README.md) - Installation and quick start
- [homemapdata.example/](homemapdata.example/) - Example configuration
- [docs/DEV_GUIDE.md](docs/DEV_GUIDE.md) - Development guide
