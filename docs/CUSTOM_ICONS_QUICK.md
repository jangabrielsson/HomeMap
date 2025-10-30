# Custom Icons - Quick Reference

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

### 3. Use in Device
**Via UI:** Edit device → "Custom Icon Set" field → enter `myCustomIcons`

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

**Icons not showing?**
1. Check folder name matches exactly (case-sensitive)
2. Check icon file names match widget expectations
3. Open DevTools (Cmd+Shift+I) → Console for errors
4. Restart app to reload icon cache

**Wrong icons?**
1. Verify path: `homemapdata/icons/{yourSetName}/`
2. Check JSON syntax in config.json
3. Clear and re-enter icon set name in Edit dialog

## 🚀 Coming Soon

Future parameter support:
- `iconSize` - Custom icon dimensions
- `iconColor` - Apply color tint
- `customStyles` - Additional CSS styling
- `rotateIcon` - Rotation angle

---

**Happy Customizing! 🎨**
