# Widget Format Specification v0.1.5

## Overview
Widgets define how devices are rendered and how they interact with the HC3 system. This document describes the widget format starting from version 0.1.5.

## Version Compatibility

### widgetVersion (required)
Specifies the widget format version. Must match or exceed the app's `MIN_WIDGET_VERSION`.

```json
{
  "widgetVersion": "0.1.5"
}
```

The app checks compatibility using semantic versioning:
- Major version must match
- Minor version must be >= minimum
- Patch version must be >= minimum (if minor matches)

## Icon Sets

### iconSet (optional)
Specifies the icon set directory to use for this widget.

```json
{
  "iconSet": "dimLight"
}
```

Icon sets are directories under `homemapdata/icons/` containing image files:
- Supported formats: `.svg`, `.png`, `.jpg`, `.jpeg`
- Icon names are derived from filenames (without extension)
- Multiple extensions supported in same set

Example structure:
```
homemapdata/
  icons/
    dimLight/
      on.svg
      off.svg
      half.svg
    binarySwitch/
      on.png
      off.png
```

In widget definitions, reference icons by name only (no extension):
```json
{
  "icon": "on"
}
```

The system automatically finds the correct file and extension.

## Widget Structure

### 1. state (optional)
Defines the default state properties for the widget.

```json
{
  "state": {
    "value": 0,
    "isOn": false,
    "battery": 100
  }
}
```

### 2. getters (required)
Defines how to fetch state properties from HC3 API.

```json
{
  "getters": {
    "value": {
      "api": "/api/devices/${id}",
      "path": "properties.value"
    }
  }
}
```

**Supported getter types:**
- `api`: Fetch from HC3 API endpoint
- `from`: Derive from another state property (future)
- `transform`: Apply transformation (future)

### 3. events (required)
Maps HC3 events to state updates.

```json
{
  "events": {
    "DevicePropertyUpdatedEvent": {
      "match": "$..[?(@.id == ${id} && @.property == 'value')]",
      "updates": {
        "value": "event.newValue"
      }
    }
  }
}
```

**Properties:**
- `match`: JSONPath expression to filter events
- `updates`: Map of state properties to update
  - Keys are state property names
  - Values are JSONPath expressions to extract from event

### 4. render (required)
Defines how to render the device icon and text.

```json
{
  "render": {
    "icon": {
      "type": "conditional",
      "property": "value",
      "conditions": [
        { "when": "value == 0", "icon": "off" },
        { "when": "value < 99", "icon": "half" },
        { "when": "value >= 99", "icon": "on" }
      ]
    },
    "subtext": {
      "template": "${value}%",
      "visible": "value > 0"
    }
  }
}
```

**Icon types:**
- `static`: Always show the same icon
  ```json
  { "type": "static", "icon": "temperature" }
  ```
  
- `conditional`: Choose icon based on state
  ```json
  {
    "type": "conditional",
    "property": "value",
    "conditions": [
      { "when": "value == 0", "icon": "off" },
      { "when": "value > 0", "icon": "on" }
    ]
  }
  ```

**Subtext:**
- `template`: String template with ${property} placeholders
- `visible`: Expression to determine visibility (optional)

### 5. actions (optional)
Defines API calls to control the device.

```json
{
  "actions": {
    "setValue": {
      "method": "POST",
      "api": "/api/devices/${id}/action/setValue",
      "body": { "args": ["${value}"] }
    }
  }
}
```

**Properties:**
- `method`: HTTP method (GET, POST, PUT, etc.)
- `api`: API endpoint (can use ${id} placeholder)
- `body`: Request body (can use ${value} or other placeholders)

### 6. ui (optional)
Defines interactive UI controls for the device. **Widgets without UI do nothing when clicked.**

```json
{
  "ui": {
    "type": "slider",
    "min": 0,
    "max": 99,
    "property": "value",
    "action": "setValue"
  }
}
```

**UI types:**

- `slider`: Value slider
  - `min`: Minimum value
  - `max`: Maximum value
  - `property`: State property to bind
  - `action`: Action to call on change
  
  ```json
  {
    "ui": {
      "type": "slider",
      "min": 0,
      "max": 99,
      "property": "value",
      "action": "setValue"
    }
  }
  ```

- `buttons`: Action buttons (displays dialog with buttons)
  - `buttons`: Array of button definitions
    - `label`: Button text
    - `action`: Action to call on click
  
  ```json
  {
    "ui": {
      "type": "buttons",
      "buttons": [
        { "label": "On", "action": "turnOn" },
        { "label": "Off", "action": "turnOff" }
      ]
    }
  }
  ```
  
  ```json
  {
    "ui": {
      "type": "buttons",
      "buttons": [
        { "label": "Toggle", "action": "toggle" }
      ]
    }
  }
  ```

- `toggle`: On/off toggle (future)
- No UI: Widget is read-only, clicking does nothing

## Complete Example

```json
{
  "widgetVersion": "0.1.5",
  "iconSet": "dimLight",
  
  "state": {
    "value": 0
  },
  
  "getters": {
    "value": {
      "api": "/api/devices/${id}",
      "path": "properties.value"
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
        { "when": "value == 0", "icon": "off" },
        { "when": "value < 99", "icon": "half" },
        { "when": "value >= 99", "icon": "on" }
      ]
    },
    "subtext": {
      "template": "${value}%",
      "visible": "value > 0"
    }
  },
  
  "actions": {
    "setValue": {
      "method": "POST",
      "api": "/api/devices/${id}/action/setValue",
      "body": { "args": ["${value}"] }
    }
  },
  
  "ui": {
    "type": "slider",
    "min": 0,
    "max": 99,
    "property": "value",
    "action": "setValue"
  }
}
```

## Migration from Old Format

### Old Format
```json
{
  "valuemaps": {
    "lightdim": {
      "icon": {
        "property": "value",
        "type": "range",
        "ranges": [
          { "min": 0, "max": 0, "path": "icons/off.svg" }
        ]
      }
    }
  },
  "status": {
    "api": "/api/devices/${id}",
    "properties": ["properties.value"]
  }
}
```

### New Format
```json
{
  "widgetVersion": "0.1.5",
  "iconSet": "dimLight",
  "state": { "value": 0 },
  "getters": {
    "value": {
      "api": "/api/devices/${id}",
      "path": "properties.value"
    }
  },
  "render": {
    "icon": {
      "type": "conditional",
      "property": "value",
      "conditions": [
        { "when": "value == 0", "icon": "off" }
      ]
    }
  }
}
```

## Widget Examples

### Read-Only Sensor (No UI)
Temperature sensor - displays value, no interaction:
```json
{
  "widgetVersion": "0.1.5",
  "iconSet": "Temperature",
  
  "state": { "value": 0 },
  
  "getters": {
    "value": {
      "api": "/api/devices/${id}",
      "path": "properties.value"
    }
  },
  
  "events": {
    "DevicePropertyUpdatedEvent": {
      "match": "$..[?(@.id == ${id} && @.property == 'value')]",
      "updates": { "value": "event.newValue" }
    }
  },
  
  "render": {
    "icon": { "type": "static", "icon": "icon" },
    "subtext": { "template": "${value}°" }
  }
}
```

### Toggle Button Widget
Binary switch with single toggle button:
```json
{
  "widgetVersion": "0.1.5",
  "iconSet": "binarySwitch",
  
  "state": { "value": false },
  
  "getters": {
    "value": {
      "api": "/api/devices/${id}",
      "path": "properties.value"
    }
  },
  
  "events": {
    "DevicePropertyUpdatedEvent": {
      "match": "$..[?(@.id == ${id} && @.property == 'value')]",
      "updates": { "value": "event.newValue" }
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
    "toggle": {
      "method": "GET",
      "api": "/api/callAction?deviceID=${id}&name=toggle"
    }
  },
  
  "ui": {
    "type": "buttons",
    "buttons": [
      { "label": "Toggle", "action": "toggle" }
    ]
  }
}
```

### Multiple Button Widget
Door lock with Lock/Unlock buttons:
```json
{
  "widgetVersion": "0.1.5",
  "iconSet": "doorLock",
  
  "state": { "secured": 0 },
  
  "getters": {
    "secured": {
      "api": "/api/devices/${id}",
      "path": "properties.secured"
    }
  },
  
  "events": {
    "DevicePropertyUpdatedEvent": {
      "match": "$..[?(@.id == ${id} && @.property == 'secured')]",
      "updates": { "secured": "event.newValue" }
    }
  },
  
  "render": {
    "icon": {
      "type": "conditional",
      "property": "secured",
      "conditions": [
        { "when": "secured == 0", "icon": "open" },
        { "when": "secured > 0", "icon": "closed" }
      ]
    }
  },
  
  "actions": {
    "secure": {
      "method": "POST",
      "api": "/api/devices/${id}/action/secure",
      "body": { "args": [] }
    },
    "unsecure": {
      "method": "POST",
      "api": "/api/devices/${id}/action/unsecure",
      "body": { "args": [] }
    }
  },
  
  "ui": {
    "type": "buttons",
    "buttons": [
      { "label": "Lock", "action": "secure" },
      { "label": "Unlock", "action": "unsecure" }
    ]
  }
}
```

### Slider Widget
Dimmable light with slider control:
```json
{
  "widgetVersion": "0.1.5",
  "iconSet": "dimLight",
  
  "state": { "value": 0 },
  
  "getters": {
    "value": {
      "api": "/api/devices/${id}",
      "path": "properties.value"
    }
  },
  
  "events": {
    "DevicePropertyUpdatedEvent": {
      "match": "$..[?(@.id == ${id} && @.property == 'value')]",
      "updates": { "value": "event.newValue" }
    }
  },
  
  "render": {
    "icon": {
      "type": "conditional",
      "property": "value",
      "conditions": [
        { "when": "value == 0", "icon": "off" },
        { "when": "value < 99", "icon": "half" },
        { "when": "value >= 99", "icon": "on" }
      ]
    },
    "subtext": {
      "template": "${value}%",
      "visible": "value > 0"
    }
  },
  
  "actions": {
    "setValue": {
      "method": "POST",
      "api": "/api/devices/${id}/action/setValue",
      "body": { "args": ["${value}"] }
    }
  },
  
  "ui": {
    "type": "slider",
    "min": 0,
    "max": 99,
    "property": "value",
    "action": "setValue"
  }
}
```
```

## Future Enhancements (Phase 2)

### Compositional Rendering
```json
{
  "render": {
    "layers": [
      { "type": "icon", "icon": "bulb" },
      { "type": "badge", "position": "top-right", "icon": "warning", "visible": "battery < 20" },
      { "type": "svg", "inline": "<circle cx='50%' cy='50%' r='5' fill='red' />", "visible": "!connected" }
    ]
  }
}
```

### Computed State
```json
{
  "getters": {
    "isOn": {
      "from": "value",
      "transform": "value > 0"
    },
    "brightness": {
      "from": "value",
      "transform": "Math.round(value)"
    }
  }
}
```
