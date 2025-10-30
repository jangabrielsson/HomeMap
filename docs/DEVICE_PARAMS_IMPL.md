# Device Parameters Feature - Implementation Summary

## Overview

Implemented device-level parameter support that allows users to customize widget behavior without modifying widget definitions. The primary use case is custom icon sets, but the architecture supports any future parameter types.

## Implementation Details

### 1. Data Model

**config.json** - Device entries now support optional `params` object:

```json
{
  "id": 123,
  "name": "Living Room Light",
  "type": "light",
  "floor_id": "ground",
  "position": { "x": 450, "y": 300 },
  "params": {
    "iconSet": "myCustomLights"
  }
}
```

### 2. Widget Rendering (widgetManager.js)

Modified `renderDevice()` to check for device-level parameters:

```javascript
async renderDevice(device, widget, iconElement, textElement) {
    // Check if device has custom parameters that override widget settings
    let effectiveIconSetMap = widget.iconSetMap;
    if (device.params?.iconSet) {
        console.log(`Device ${device.id} uses custom iconSet: ${device.params.iconSet}`);
        effectiveIconSetMap = await this.loadIconSet(
            device.params.iconSet, 
            device.params.iconPackage || null
        );
    }
    
    // Use effectiveIconSetMap instead of widget.iconSetMap
    // ... rest of rendering logic
}
```

**Logic:**
1. Widget's default `iconSetMap` is loaded during widget initialization
2. At render time, check if device has `params.iconSet`
3. If present, load custom icon set and use it instead of default
4. Original widget remains unchanged for other devices

### 3. Add Device Dialog (dialogManager.js)

Added UI field for custom icon set:

```html
<div class="form-group">
    <label>Custom Icon Set <span style="color: #888;">(Optional)</span></label>
    <input type="text" id="addDeviceIconSet" class="form-input" 
           placeholder="e.g., myCustomIcons">
    <small style="color: #888;">
        Override the widget's default icons with your own icon set
    </small>
</div>
```

**Save logic:**
```javascript
const customIconSet = iconSetInput.value.trim();

// Add custom parameters if specified
if (customIconSet) {
    device.params = {
        iconSet: customIconSet
    };
}
```

### 4. Edit Device Dialog (dialogManager.js)

Added similar UI field with pre-populated value:

```html
<input type="text" id="editDeviceIconSet" 
       value="${device.params?.iconSet || ''}" 
       placeholder="e.g., myCustomIcons">
```

**Save logic with cleanup:**
```javascript
const customIconSet = iconSetInput.value.trim();

if (customIconSet) {
    if (!configDevice.params) configDevice.params = {};
    configDevice.params.iconSet = customIconSet;
} else {
    // Remove iconSet if empty
    if (configDevice.params?.iconSet) {
        delete configDevice.params.iconSet;
    }
    // Clean up empty params object
    if (configDevice.params && Object.keys(configDevice.params).length === 0) {
        delete configDevice.params;
    }
}
```

### 5. Icon Set Loading

Uses existing `loadIconSet(iconSetName, packageId)` method which searches:

1. Package-specific: `homemapdata/icons/packages/{packageId}/{iconSetName}/`
2. Built-in: `homemapdata/icons/built-in/{iconSetName}/`
3. User: `homemapdata/icons/{iconSetName}/`

For custom icons, users place files in #3 (user icons folder).

## Usage Workflow

### Via UI (Recommended)

**Adding New Device:**
1. Click "Add Device" on floor plan
2. Fill Device ID, Name, Type
3. Enter custom icon set name in "Custom Icon Set" field
4. Click "Add Device"

**Editing Existing Device:**
1. Right-click device → "Edit"
2. Enter icon set name in "Custom Icon Set" field
3. Click "Save"
4. Device immediately uses new icons

### Via Manual Editing

Edit `homemapdata/config.json`:

```json
{
  "devices": [
    {
      "id": 123,
      "name": "My Light",
      "type": "light",
      "params": {
        "iconSet": "myIcons"
      }
    }
  ]
}
```

Restart app or reload floor plan.

## Icon Set Requirements

### Folder Structure
```
homemapdata/icons/
  myCustomIcons/
    on.svg
    off.svg
    dim.svg
```

### File Naming
- Must match widget expectations (check widget JSON)
- Case-sensitive
- Supported formats: SVG (recommended), PNG

### Widget-Specific Icons

Different widgets expect different icon names:

**light widget:**
- `off.svg` - light off
- `on.svg` - light on

**doorSensor widget:**
- `closed.svg` - door closed
- `open.svg` - door open

**motion widget:**
- `inactive.svg` - no motion
- `active.svg` - motion detected

## Benefits

1. **No Widget Cloning**: Users don't need to duplicate widget definitions
2. **Per-Device Customization**: Different devices can use different icon sets
3. **Theme Support**: Easy to switch between visual themes
4. **Non-Destructive**: Widget definitions remain unchanged
5. **Backward Compatible**: Existing configs without `params` continue working

## Future Extensions

The `params` architecture supports additional parameters:

```json
{
  "params": {
    "iconSet": "myIcons",
    "iconSize": "large",
    "iconColor": "#ff0000",
    "customStyles": {
      "opacity": "0.8",
      "filter": "brightness(1.2)"
    },
    "rotateIcon": 45
  }
}
```

Implementation roadmap:
- [ ] `iconSize`: Override default icon dimensions
- [ ] `iconColor`: Apply color tint to icons
- [ ] `customStyles`: Additional CSS styles
- [ ] `rotateIcon`: Rotation angle for icons
- [ ] `animateIcon`: Animation effects

## Documentation

Created comprehensive documentation:

1. **docs/CUSTOM_ICONS.md** - Complete guide for users
   - Setup instructions
   - Icon requirements
   - Use cases and examples
   - Troubleshooting

2. **docs/examples/CUSTOM_ICON_EXAMPLE.md** - Working example
   - Sample SVG icons
   - Config snippet
   - Step-by-step tutorial

3. **README.md** - Updated with feature overview and link to guide

## Testing Checklist

- [x] Add device with custom icon set via UI
- [x] Edit device to change icon set via UI
- [x] Edit device to remove icon set via UI
- [x] Manual config.json editing
- [x] Missing icon set (fallback to widget default)
- [x] Invalid icon names (console warnings)
- [x] Multiple devices with different icon sets
- [x] Icon set changes without app restart

## Files Modified

1. **src/modules/widgetManager.js**
   - Modified `renderDevice()` to check `device.params.iconSet`
   - Load custom icon set if specified
   - Fall back to widget default if not

2. **src/modules/dialogManager.js**
   - Added UI field in Add Device dialog
   - Added UI field in Edit Device dialog
   - Save/load `params.iconSet` from config

3. **README.md**
   - Added Custom Icons section
   - Added link to CUSTOM_ICONS.md

4. **docs/CUSTOM_ICONS.md** (NEW)
   - Complete user guide
   - Examples and use cases
   - Troubleshooting

5. **docs/examples/CUSTOM_ICON_EXAMPLE.md** (NEW)
   - Working example with SVG code
   - Step-by-step tutorial

## Version

Feature added in: **v0.1.15** (planned)

## Related Issues

Closes: User request for custom icons without widget cloning
