# Custom Icons for Widgets

## Overview

HomeMap allows you to use custom icons with any widget by specifying device-level parameters. This means you can use the built-in widgets (like `light`, `doorSensor`, etc.) but provide your own custom icon sets without needing to create or clone widget definitions.

**New in v0.1.16**: Custom Icon Set selection now uses a dropdown menu that automatically discovers all available icon sets!

## How It Works

Device parameters are stored in the `config.json` file and override widget defaults at render time. This allows you to:

- Use built-in widgets with your own icon designs
- Have different icon styles for different devices of the same type
- Easily switch between icon sets without editing widget files
- See all available icon sets in an organized dropdown

## Setting Up Custom Icons

### 1. Prepare Your Icon Set

Create a folder in your `homemapdata/icons/` directory structure:

**Recommended structure (v0.1.16+):**
```
homemapdata/
  icons/
    built-in/          <- Built-in icon sets (managed by app)
      dimLight/
      doorSensor/
    myCustomLights/    <- Your custom icon sets (top-level)
      on.svg
      off.svg
    packages/          <- Package-specific icons (auto-managed)
      com.example.pkg/
        customIcons/
```

Your custom icon sets should go in the top-level `icons/` folder (e.g., `homemapdata/icons/myCustomLights/`).

Your icon set should contain the same icon names that the widget expects. For example, the `light` widget expects:
- `off.svg` - for when the light is off
- `on.svg` - for when the light is on

### 2. Add Device with Custom Icons (UI Method - Recommended)

When adding or editing a device:

1. Click "Add Device" or right-click device and select "Edit"
2. Fill in Device ID, Name, and Type as normal
3. In the **Custom Icon Set** dropdown:
   - Select from discovered icon sets organized by location (Built-in, User, Package)
   - Or choose "Use widget default icons" to use the widget's default
4. Click "Add Device" or "Save"

**Benefits of dropdown (v0.1.16+):**
- ✅ No typing - select from available options
- ✅ No typos - only valid icon sets shown
- ✅ Visual organization by location
- ✅ See all available icon sets at once

The device will now use your custom icons instead of the widget's default icons.

### 3. Manual Configuration (config.json)

You can also manually edit `config.json`:

```json
{
  "devices": [
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
  ]
}
```

The `params.iconSet` field tells HomeMap to use icons from `homemapdata/icons/myCustomLights/` instead of the widget's default icon set.

## Icon Set Locations

HomeMap looks for icon sets in this order:

1. **Built-in icons**: `homemapdata/icons/built-in/{iconSetName}/`
   - Pre-installed icon sets managed by the app
   - Examples: `dimLight`, `doorSensor`, `motion`
   
2. **User icons**: `homemapdata/icons/{iconSetName}/`
   - Your custom icon sets (top-level folders)
   - Examples: `myCustomLights`, `vintageTheme`, `modernDoors`
   
3. **Package icons**: `homemapdata/icons/packages/{packageId}/{iconSetName}/`
   - Icon sets bundled with widget packages
   - Automatically discovered when packages are installed

**Creating Custom Icons**: Place your icon sets in the top-level `icons/` folder (option #2).

**Dropdown Organization (v0.1.16+)**: Icon sets are automatically grouped by location in the dropdown menu.

## Example Use Cases

### Different Light Styles

You might want modern icons for smart lights and classic icons for traditional lights:

```json
{
  "devices": [
    {
      "id": 101,
      "name": "Smart LED Strip",
      "type": "light",
      "params": { "iconSet": "modernLights" }
    },
    {
      "id": 102,
      "name": "Chandelier",
      "type": "light",
      "params": { "iconSet": "classicLights" }
    }
  ]
}
```

### Custom Door Icons

Replace the built-in door sensor icons with your own design:

```json
{
  "id": 200,
  "name": "Front Door",
  "type": "doorSensor",
  "params": { "iconSet": "myDoorIcons" }
}
```

### Theme Variations

Create multiple icon sets for different visual themes:

```
homemapdata/icons/
  light-theme/       <- Bright, colorful icons
  dark-theme/        <- Minimal, dark icons
  retro-theme/       <- Vintage style icons
```

Then assign different themes to different floors or rooms as needed.

## Icon Requirements

### SVG Format (Recommended)

- Use SVG format for scalability and styling support
- Keep file sizes small (< 50KB per icon)
- Use simple paths for best performance
- Name files to match widget expectations (e.g., `on.svg`, `off.svg`)

### PNG Format

- PNG icons are also supported
- Use transparent backgrounds
- Recommended size: 128x128 pixels
- Higher resolutions will be scaled down

## Finding Widget Icon Names

To know which icon names a widget expects, check the widget definition:

```json
// homemapdata/widgets/built-in/light.json
{
  "render": {
    "icon": {
      "type": "conditional",
      "conditions": [
        { "when": "value == false", "icon": "off" },  <- expects "off.svg"
        { "when": "value == true", "icon": "on" }     <- expects "on.svg"
      ]
    }
  }
}
```

## Advanced: Icon Set in Package

If you're creating a widget package and want to bundle custom icons:

1. Place icons in your package folder: `homemapdata/widgets/packages/{packageId}/icons/{iconSetName}/`
2. Reference them in device params with package context:

```json
{
  "id": 123,
  "name": "Special Device",
  "type": "light",
  "widget": "com.example.widgets/light",
  "params": {
    "iconSet": "specialIcons",
    "iconPackage": "com.example.widgets"
  }
}
```

## Troubleshooting

### Icons Not Showing in Dropdown (v0.1.16+)

1. **Check folder location**: Icon set folders must be in `homemapdata/icons/{yourSetName}/`
2. **Check folder structure**: Icon files (SVGs/PNGs) should be directly in the folder
3. **Restart app**: Close and reopen HomeMap to refresh the icon set discovery
4. **Check console**: Open DevTools (Cmd+Shift+I) and look for discovery logs

### Icons Not Showing on Device

1. **Check dropdown selection**: Verify icon set is selected in device settings
2. **Check icon file names**: Must match what the widget expects (e.g., `on.svg` not `On.svg`)
3. **Check file format**: Use SVG or PNG only
4. **Check console**: Open DevTools (Cmd+Shift+I) and look for error messages
5. **Verify widget expectations**: Check the widget JSON to see what icon names it needs

### Wrong Icons Showing

1. **Edit device**: Right-click device → Edit → verify icon set selection
2. **Clear selection**: Choose "Use widget default icons" to reset
3. **Restart app**: Reload to clear any cached icon sets

### Icons Look Blurry

- Use SVG format instead of PNG for crisp scaling
- If using PNG, provide higher resolution (256x256 or 512x512)

## Best Practices

1. **Consistent Naming**: Use the same naming convention across all your icon sets
2. **Icon Dimensions**: Keep icons square and centered
3. **File Organization**: Create a separate folder for each icon set
4. **Documentation**: Add a README.txt in your icon folder listing available icons
5. **Testing**: Test all device states (on/off, open/closed, etc.) to ensure all icons display correctly

## Future Enhancements

Planned features for custom parameters:

- `params.iconSize`: Override default icon size
- `params.iconColor`: Tint color for icons
- `params.customStyles`: Additional CSS styles
- `params.rotateIcon`: Rotation angle for icons

---

**Need Help?**

- Check existing icon sets in `homemapdata/icons/built-in/` for examples
- Visit the forum for community-created icon packs
- See `docs/DEV_GUIDE.md` for widget development details
