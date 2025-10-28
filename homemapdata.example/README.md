# HomeMap Data Directory

This is an example structure for your `homemapdata` directory.

## Setup Instructions

1. Copy this entire directory and rename it to `homemapdata`
2. Edit `config.json` with your floor plans and devices
3. Add your floor plan images to the `images/` directory
4. Add device icons to the `icons/` directory
5. Customize widget definitions in the `widgets/` directory

## Directory Structure

```
homemapdata/
├── config.json           # Main configuration
├── images/              # Floor plan images
│   └── floor1.jpg
├── icons/               # Device icons (SVG recommended)
│   ├── LightBulbFull.svg
│   └── LightBulbOff.svg
└── widgets/             # Widget type definitions
    ├── light.json
    ├── temperature.json
    └── motion.json
```

## Configuration

See `config.json` for the structure. Key points:

- **floors**: Define each floor with an image and dimensions
- **devices**: Place devices on floors with x,y coordinates
- Device coordinates are in the natural image dimensions (not screen pixels)

## Widget Types

Widget definitions control how devices are rendered. See existing widgets for examples:

- **light.json**: Boolean on/off devices
- **lightdim.json**: Dimmers with range-based icons
- **temperature.json**: Sensors with static icons and value display
- **motion.json**: Motion sensors with lastBreached time display
