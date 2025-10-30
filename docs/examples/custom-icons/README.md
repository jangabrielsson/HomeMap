# Custom Icon Examples

This folder contains example custom icon sets that demonstrate the device parameters feature.

## What's Included

### exampleCustomLight/

A custom light bulb icon set with detailed styling:

- **off.svg** - Dark gray light bulb (off state)
- **on.svg** - Bright yellow light bulb with glow effect and light rays (on state)

**Features:**
- Drop shadows for depth
- Radial gradients for glow effect
- Light rays animation
- Detailed filament and socket
- Professional appearance

## How to Use

1. **Copy to your homemapdata folder:**
   ```bash
   cp -r exampleCustomLight ~/Documents/homemapdata/icons/
   ```

2. **Add device with custom icons:**
   - Via UI: Add device → set "Custom Icon Set" to `exampleCustomLight`
   - Via config.json:
     ```json
     {
       "id": 123,
       "name": "Living Room Light",
       "type": "light",
       "params": {
         "iconSet": "exampleCustomLight"
       }
     }
     ```

3. **Test it:**
   - Turn the light on/off and watch the icon change
   - Notice the smooth glow effect and light rays

## Create Your Own

Use these as templates:

1. Copy the folder: `cp -r exampleCustomLight myCustomLight`
2. Edit the SVG files in your favorite editor
3. Modify colors, shapes, effects
4. Save and use `"iconSet": "myCustomLight"` in your device config

## Icon Design Tips

- **Keep it simple**: Complex SVGs can impact performance
- **Use viewBox**: Always use `viewBox="0 0 100 100"` for consistent scaling
- **Optimize**: Remove unnecessary elements and attributes
- **Test states**: Ensure all states (on/off, open/closed) are visually distinct
- **Consider size**: Icons are typically displayed at 64x64 or 48x48 pixels

## SVG Tools

- **Inkscape** (free): Great for creating and editing SVG files
- **Figma** (free): Modern design tool with SVG export
- **Adobe Illustrator**: Professional vector graphics editor
- **SVGOMG** (online): Optimize and clean up SVG files

## Resources

- [SVG Tutorial](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial)
- [Inkscape Download](https://inkscape.org/)
- [SVGOMG Optimizer](https://jakearchibald.github.io/svgomg/)
- [Material Design Icons](https://material.io/icons/) - Inspiration

## Share Your Icons

Created a great icon set? Share it with the community!

1. Create a GitHub repository
2. Include README with usage instructions
3. Post in the HomeMap forum/discussions
4. Help others customize their setups

## License

These example icons are provided under MIT License - feel free to use, modify, and share!
