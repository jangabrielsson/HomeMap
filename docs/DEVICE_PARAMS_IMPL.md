# Device Parameters Feature - Implementation Summary

## Overview

Implemented device-level parameter support that allows users to customize widget behavior without modifying widget definitions. The primary use case is custom icon sets, but the architecture supports any future parameter types.

**Version History:**
- **v0.1.15**: Initial implementation with text input field
- **v0.1.16**: Enhanced with dropdown selection and auto-discovery

## Implementation Details (v0.1.16)

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

**v0.1.16**: Changed from text input to dropdown with auto-discovery:

```javascript
// Discover available icon sets
const iconSets = await this.discoverIconSets();
let iconSetOptions = '<option value="">Use widget default icons</option>';
if (iconSets.length > 0) {
    const grouped = {};
    iconSets.forEach(set => {
        if (!grouped[set.location]) grouped[set.location] = [];
        grouped[set.location].push(set);
    });
    
    for (const [location, sets] of Object.entries(grouped)) {
        iconSetOptions += `<optgroup label="${location}">`;
        sets.forEach(set => {
            iconSetOptions += `<option value="${set.name}">${set.name}</option>`;
        });
        iconSetOptions += '</optgroup>';
    }
}
```

**UI field:**
```html
<div class="form-group">
    <label>Custom Icon Set <span style="color: #888;">(Optional)</span></label>
    <select id="addDeviceIconSet" class="form-input">
        ${iconSetOptions}
    </select>
    <small style="color: #888;">
        Override the widget's default icons with your own icon set
    </small>
</div>
```

**Save logic:**
```javascript
const customIconSet = iconSetSelect.value; // Get from dropdown

if (customIconSet) {
    device.params = {
        iconSet: customIconSet
    };
}
```

### 3a. Icon Set Discovery (dialogManager.js)

**v0.1.16**: New method to discover available icon sets:

```javascript
async discoverIconSets() {
    const iconSets = [];
    const dataPath = this.app.dataPath;
    
    // Check built-in icons (icons/built-in/)
    const builtInDirs = await this.app.invoke('list_directory', { 
        path: `${dataPath}/icons/built-in` 
    });
    builtInDirs.forEach(dir => {
        if (dir.endsWith('/')) {
            iconSets.push({ 
                name: dir.slice(0, -1), 
                location: 'built-in' 
            });
        }
    });
    
    // Check user icons (icons/)
    const iconDirs = await this.app.invoke('list_directory', { 
        path: `${dataPath}/icons` 
    });
    iconDirs.forEach(dir => {
        if (dir.endsWith('/') && dir !== 'built-in/' && dir !== 'packages/') {
            iconSets.push({ 
                name: dir.slice(0, -1), 
                location: 'user' 
            });
        }
    });
    
    // Check package icons (icons/packages/{pkg}/)
    // ... similar pattern for packages
    
    return iconSets;
}
```

### 4. Edit Device Dialog (dialogManager.js)

**v0.1.16**: Same dropdown approach with pre-selected current value:

```html
<select id="editDeviceIconSet" class="form-input">
    ${iconSetOptions} <!-- Pre-selects current device.params.iconSet -->
</select>
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

1. Built-in: `homemapdata/icons/built-in/{iconSetName}/`
2. User: `homemapdata/icons/{iconSetName}/`
3. Package: `homemapdata/icons/packages/{packageId}/{iconSetName}/`

For custom icons, users place files in #2 (user icons folder).

### 6. Backend Support (lib.rs)

**v0.1.16**: Modified `list_directory` command to return directories:

```rust
#[tauri::command]
fn list_directory(path: String) -> Result<Vec<String>, String> {
    // ... path validation ...
    
    let entries = fs::read_dir(&path_buf)?;
    let mut items = Vec::new();
    
    for entry in entries {
        let entry = entry?;
        let file_name = entry.file_name();
        if let Some(name) = file_name.to_str() {
            let path = entry.path();
            if path.is_dir() {
                // Add trailing slash for directories
                items.push(format!("{}/", name));
            } else if path.is_file() {
                // Regular file
                items.push(name.to_string());
            }
        }
    }
    
    Ok(items)
}
```

**Key change**: Now returns both files and directories (directories with trailing `/`), enabling icon set discovery.

## Usage Workflow

### Via UI (Recommended - v0.1.16)

**Adding New Device:**
1. Click "Add Device" on floor plan
2. Fill Device ID, Name, Type
3. **Select** custom icon set from dropdown (auto-discovered)
   - Organized by location: Built-in, User, Package
   - Default option: "Use widget default icons"
4. Click "Add Device"

**Editing Existing Device:**
1. Right-click device → "Edit"
2. **Select** icon set from dropdown (current selection pre-selected)
3. Click "Save"
4. Device immediately uses new icons

**Benefits:**
- ✅ No typing - select from available options
- ✅ No typos - only valid icon sets shown
- ✅ Visual organization by location
- ✅ See all available icon sets at once

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

**v0.1.15:**
1. **src/modules/widgetManager.js** - Device params rendering
2. **src/modules/dialogManager.js** - Text input UI fields  
3. **README.md** - Feature overview
4. **docs/CUSTOM_ICONS.md** - User guide
5. **docs/examples/CUSTOM_ICON_EXAMPLE.md** - Tutorial

**v0.1.16:**
1. **src/modules/dialogManager.js** - Dropdown UI + discovery
   - Added `discoverIconSets()` method
   - Changed text input to select dropdown
   - Added grouped optgroup organization
2. **src-tauri/src/lib.rs** - Backend directory listing
   - Modified `list_directory` to return directories with `/`
   - Enables icon set folder discovery
3. **docs/CUSTOM_ICONS.md** - Updated with dropdown usage
4. **docs/CUSTOM_ICONS_QUICK.md** - Updated quick reference
5. **docs/DEVICE_PARAMS_IMPL.md** - Updated implementation notes

## Version

- **v0.1.15**: Initial implementation with text input
- **v0.1.16**: Enhanced with dropdown and auto-discovery

## Related Issues

Closes: User request for custom icons without widget cloning
