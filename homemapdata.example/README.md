# HomeMap Data Directory

This is an example structure for your `homemapdata` directory.

## Setup Instructions

### 1. HC3 Connection Setup

Create a `.env` file in your **home directory** (`~/.env` on macOS/Linux, `%USERPROFILE%\.env` on Windows):

```env
HC3_HOST=192.168.1.57
HC3_USER=admin
HC3_PASSWORD=your-password
HC3_PROTOCOL=http
```

**Important:**
- Replace the values with your HC3 system details
- The `.env` file should be in your home directory, NOT in the homemapdata folder
- Keep this file secure - it contains your HC3 credentials

### 2. Configure HomeMap Data

1. Copy this entire directory and rename it to `homemapdata`
2. Edit `config.json` with your floor plans and devices
3. Add your floor plan images to the `images/` directory
4. Add custom device icons to `icons/` (user icons) or `icons/packages/<package-name>/` (packaged icons)
5. Customize widget definitions in `widgets/` (user widgets) or `widgets/packages/<package-name>/` (packaged widgets)

### 3. Tell HomeMap Where to Find Your Data

**Option A: Place next to the app (recommended)**
- Put the `homemapdata` folder in the same directory as the HomeMap app

**Option B: Use HC3_HOMEMAP environment variable**
- Add `HC3_HOMEMAP=/path/to/your/homemapdata` to your `~/.env` file
- Or set it as a system environment variable
- Example in `~/.env`:
  ```env
  HC3_HOST=192.168.1.57
  HC3_USER=admin
  HC3_PASSWORD=your-password
  HC3_PROTOCOL=http
  HC3_HOMEMAP=/Users/yourname/Documents/homemapdata
  ```

**HomeMap searches for homemapdata in this order:**
1. Path specified in `HC3_HOMEMAP` environment variable
2. Next to the executable
3. In parent directories (development mode)

## Directory Structure

```
homemapdata/
├── config.json           # Main configuration
├── images/              # Floor plan images
│   └── floor1.jpg
├── icons/               # Device icons (SVG recommended)
│   ├── built-in/       # Built-in icon sets (provided by HomeMap)
│   │   ├── binarySwitch/
│   │   ├── dimLight/
│   │   └── ...
│   ├── packages/       # Packaged icon sets (for distribution)
│   │   └── <package-name>/
│   └── <custom>/       # Your custom icon sets
│       ├── on.svg
│       └── off.svg
└── widgets/             # Widget type definitions
    ├── built-in/       # Built-in widgets (provided by HomeMap)
    │   ├── light.json
    │   ├── temperature.json
    │   └── ...
    ├── packages/       # Packaged widgets (for distribution)
    │   └── <package-name>/
    └── <custom>.json   # Your custom widget definitions
```

**Note:** When using "Create Configuration" from the menu, HomeMap automatically creates the `built-in/` and `packages/` subdirectories and organizes existing files appropriately.

## Configuration

See `config.json` for the structure. Key points:

- **name**: The application title (defaults to "HomeMap" if not specified)
- **icon**: Optional path to custom app icon (e.g., "icons/house.png")
  - If not specified, the default house emoji 🏠 is used
  - Icon is displayed in the header bar
  - Path is relative to the homemapdata directory
- **floors**: Define each floor with an image and dimensions
- **devices**: Place devices on floors with x,y coordinates
- Device coordinates are in the natural image dimensions (not screen pixels)

## Widget Types

Widget definitions control how devices are rendered. See existing widgets in `widgets/built-in/` for examples:

- **light.json**: Boolean on/off devices
- **lightdim.json**: Dimmers with range-based icons
- **temperature.json**: Sensors with static icons and value display
- **motion.json**: Motion sensors with lastBreached time display

**Organization:**
- Built-in widgets: `widgets/built-in/*.json` - Provided examples
- Custom widgets: `widgets/*.json` - Your own widget definitions
- Packaged widgets: `widgets/packages/<package-name>/*.json` - For sharing/distribution
