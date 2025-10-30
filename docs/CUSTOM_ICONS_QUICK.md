# Custom Icons - Quick Reference

**✨ New in v0.1.16**: Icon set selection now uses a dropdown with auto-discovery!

## 🎨 What It Does

Use your own icon designs with any built-in widget - no need to copy or edit widget files!

## 🚀 Quick Start (3 Steps)

### 1. Create Icon Folder
```bash
homemapdata/icons/myCustomIcons/
```

### 2. Add Icons
Place SVG or PNG files matching widget expectations:
- Light widget: `on.svg`, `off.svg`
- Door sensor: `open.svg`, `closed.svg`
- Motion: `active.svg`, `inactive.svg`

### 3. Select in Device
**Via UI (v0.1.16+):**
1. Add or Edit device
2. Use **Custom Icon Set** dropdown
3. Select your icon set from the list (organized by location)
4. Save

**No typing needed!** Dropdown shows all available icon sets automatically.

**Via config.json:**
```json
{
  "id": 123,
  "name": "My Light",
  "type": "light",
  "params": {
    "iconSet": "myCustomIcons"
  }
}
```

## 📂 Icon Set Organization (v0.1.16+)

Dropdown automatically discovers and groups icon sets:

```
Built-in          <- homemapdata/icons/built-in/
├── dimLight
├── doorSensor
└── motion

User              <- homemapdata/icons/
├── myCustomIcons
├── vintageTheme
└── modernLights

Package: pkg-name <- homemapdata/icons/packages/pkg-name/
└── customIcons
```

## 💡 Common Use Cases

### Different Styles for Same Widget Type
```json
{
  "id": 101, "type": "light", 
  "params": { "iconSet": "modernLights" }
},
{
  "id": 102, "type": "light", 
  "params": { "iconSet": "classicLights" }
}
```

### Custom Brand/Theme
```bash
homemapdata/icons/
  myBrand/      # Your custom designs
  darkTheme/    # Dark mode icons
  lightTheme/   # Light mode icons
```

## 📝 Icon File Checklist

✅ Correct folder: `homemapdata/icons/yourSetName/`  
✅ Correct file names (match widget expectations)  
✅ SVG format (recommended) or PNG  
✅ Case-sensitive naming (`on.svg` not `On.svg`)  
✅ Square dimensions for best results  

## 🔍 Find Widget Icon Names

Check widget definition file:
```json
// homemapdata/widgets/built-in/light.json
"conditions": [
  { "when": "value == false", "icon": "off" },  // needs: off.svg
  { "when": "value == true", "icon": "on" }     // needs: on.svg
]
```

## 🎁 Example Icons Included

Ready-to-use examples in:
```
docs/examples/custom-icons/exampleCustomLight/
├── off.svg   (gray bulb)
└── on.svg    (yellow bulb with glow)
```

Copy to your homemapdata folder:
```bash
cp -r docs/examples/custom-icons/exampleCustomLight ~/Documents/homemapdata/icons/
```

## 📚 Full Documentation

**Complete Guide:** [docs/CUSTOM_ICONS.md](CUSTOM_ICONS.md)  
**Example Tutorial:** [docs/examples/CUSTOM_ICON_EXAMPLE.md](examples/CUSTOM_ICON_EXAMPLE.md)  
**Implementation Details:** [docs/DEVICE_PARAMS_IMPL.md](DEVICE_PARAMS_IMPL.md)

## ❓ Troubleshooting

**Icon set not in dropdown?**
1. Check folder is in `homemapdata/icons/{yourSetName}/`
2. Restart app to refresh discovery
3. Check DevTools (Cmd+Shift+I) → Console for logs

**Icons not showing on device?**
1. Verify icon set selected in Edit Device dialog
2. Check icon file names match widget expectations
3. Check file format (SVG or PNG only)
4. Open DevTools → Console for errors

**Wrong icons?**
1. Edit device → verify Custom Icon Set dropdown selection
2. Select "Use widget default icons" to reset
3. Restart app to clear cache

## 🎯 Benefits (v0.1.16+)

✅ **No typing** - select from dropdown  
✅ **No typos** - only valid sets shown  
✅ **Visual discovery** - see all available options  
✅ **Organized** - grouped by location  
✅ **Fast setup** - no manual path entry  

## 🚀 Coming Soon

Future parameter support:
- `iconSize` - Custom icon dimensions
- `iconColor` - Apply color tint
- `customStyles` - Additional CSS styling
- `rotateIcon` - Rotation angle

---

**Happy Customizing! 🎨**
