# Custom Icon Example

This example shows how to use custom icons with the built-in `light` widget.

## Folder Structure

```
homemapdata/
  icons/
    exampleCustomLight/
      off.svg
      on.svg
```

## Device Configuration

In your `config.json`:

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
        "iconSet": "exampleCustomLight"
      }
    }
  ]
}
```

## Icon Files

### off.svg
A simple light bulb icon (off state):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="30" r="20" fill="#666" stroke="#333" stroke-width="2"/>
  <rect x="45" y="50" width="10" height="30" fill="#666" stroke="#333" stroke-width="2"/>
  <rect x="40" y="80" width="20" height="5" fill="#666" stroke="#333" stroke-width="2"/>
</svg>
```

### on.svg
Same light bulb icon (on state with glow):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <radialGradient id="glow">
      <stop offset="0%" stop-color="#ffeb3b" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#ffeb3b" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="50" cy="30" r="35" fill="url(#glow)"/>
  <circle cx="50" cy="30" r="20" fill="#ffeb3b" stroke="#fdd835" stroke-width="2"/>
  <rect x="45" y="50" width="10" height="30" fill="#ffeb3b" stroke="#fdd835" stroke-width="2"/>
  <rect x="40" y="80" width="20" height="5" fill="#ffeb3b" stroke="#fdd835" stroke-width="2"/>
</svg>
```

## Result

The light widget will now use your custom icons:
- When off: gray bulb icon
- When on: bright yellow bulb with glow effect

## Try It Out

1. Create the folder: `homemapdata/icons/exampleCustomLight/`
2. Save the SVG files above as `off.svg` and `on.svg`
3. Add the device configuration with `params.iconSet`
4. Restart HomeMap or reload the floor plan

Your device will now use the custom icons!

## Customization Tips

- Change colors to match your theme
- Add animations using CSS
- Use PNG files instead of SVG (128x128px recommended)
- Create multiple icon sets for different styles
- Share your icon sets with the community!

See [CUSTOM_ICONS.md](../CUSTOM_ICONS.md) for more details.
