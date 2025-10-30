# HomeMap Tutorial

Welcome to HomeMap! This tutorial will help you get started with visualizing your HC3 home automation on interactive floor plans.

## Table of Contents
1. [Introduction](#1-introduction)
2. [Initial Setup](#2-initial-setup)
3. [Adding Floor Plans](#3-adding-floor-plans)
4. [Adding Devices](#4-adding-devices)
5. [Editing Devices](#5-editing-devices)
6. [Zooming Floor Plans](#6-zooming-floor-plans)
7. [Tips & Tricks](#7-tips--tricks)

---

## 1. Introduction

### What is HomeMap?

HomeMap is a visual interface for your Fibaro HC3 home automation system. Instead of lists and menus, you see your devices on actual floor plans of your home.

### What You'll Learn

- Connect HomeMap to your HC3
- Add floor plan images
- Place devices on your floor plans
- Control devices by clicking them
- Move devices around and edit them

### What You'll Need

- A Fibaro HC3 system
- Your HC3 IP address and login credentials
- Floor plan images (PNG, JPG, or SVG files)
- 10 minutes to get started

---

## 2. Initial Setup

### 2.1 First Launch

When you first open HomeMap, you'll see a connection status at the top right. If it says "Configuration Error", you need to set up your HC3 connection.

### 2.2 Opening Settings

Click the **⚙️ Settings** button in the top left corner.

### 2.3 Configure HC3 Connection

In the Settings panel, fill in:

| Field | Description | Example |
|-------|-------------|---------|
| **HC3 Host** | Your HC3's IP address | `192.168.1.57` |
| **HC3 Username** | Your HC3 username | `admin` |
| **HC3 Password** | Your HC3 password | Your password |
| **Protocol** | HTTP or HTTPS | `http` (most common) |

### 2.4 Set Data Path

The **HomeMap Data Path** is where your configuration and floor plans are stored.

**Default location:**
```
/Users/YourName/Desktop/Fibaro/HomeMap/homemapdata
```

**Option 1: Use "Create Configuration" (Easiest)**

If the folder doesn't exist yet, HomeMap can create it for you:

1. Go to menu bar → **File** → **Create Configuration**
2. Choose where you want the folder
3. HomeMap creates the folder and a basic `config.json` file
4. The path is automatically set in Settings

**Option 2: Choose Existing Folder**

If you already have a data folder:

1. Click **Browse...** to choose the folder
2. Or type the path manually
3. Make sure the folder contains (or will contain) `config.json`

**Option 3: Use Default Location**

Leave the default path as-is if you want to use:
```
/Users/YourName/Desktop/Fibaro/HomeMap/homemapdata
```
Just make sure the folder exists before restarting.

### 2.5 Save and Restart

1. Click **Save**
2. Restart HomeMap when prompted
3. You should now see "Connected to HC3" (green dot) at the top right

> **Tip:** If you see "Authentication Failed", double-check your username and password!

---

## 3. Adding Floor Plans

### 3.1 Prepare Your Floor Plan Images

**What works best:**
- PNG, JPG, or SVG format
- Size: 1000-2000 pixels wide recommended
- Clear, simple floor plans work better than complex ones
- Name them something simple: `floor1.png`, `floor2.png`, etc.

**Where to put them:**
Place your floor plan images in your data folder:
```
/path/to/homemapdata/floor1.png
/path/to/homemapdata/floor2.png
```

### 3.2 Edit config.json

Open the configuration file:
```
/path/to/homemapdata/config.json
```

Add your floors to the `floors` array:

```json
{
  "floors": [
    {
      "id": "floor1",
      "name": "Ground Floor",
      "image": "floor1.png"
    },
    {
      "id": "floor2",
      "name": "First Floor",
      "image": "floor2.png"
    }
  ],
  "devices": []
}
```

**Field explanations:**
- `id`: Unique identifier (use simple names like "floor1", "floor2")
- `name`: Display name shown in tabs
- `image`: Filename of your floor plan image

### 3.3 Reload HomeMap

After editing `config.json`:
1. Save the file
2. Restart HomeMap
3. You should see tabs for each floor at the top

> **Tip:** Start with one floor to get familiar with HomeMap, then add more floors later!

---

## 4. Adding Devices

There are two ways to add devices: manually editing config.json, or using the visual editor (much easier!).

### 4.1 Using the Visual Editor (Recommended)

**Step 1: Enable Edit Mode**

At the top right, check the **Edit Mode** checkbox.

**Step 2: Right-Click on Floor Plan**

Right-click where you want to place a device on your floor plan, then select **Add Device**.

**Step 3: Fill in Device Information**

A dialog will appear asking for:

| Field | What to Enter |
|-------|---------------|
| **Device ID** | The ID from your HC3 (e.g., `385`) |
| **Name** | A friendly name (e.g., "Living Room Light") |
| **Type** | The widget type (e.g., `lightdim`, `binarysensor`) |
| **Floors** | Check which floors this device appears on |

**Step 4: Click "Add Device"**

The device will appear on your floor plan! A small icon represents the device at the position where you right-clicked.

### 4.2 Common Widget Types

| Device Type | Widget Type |
|-------------|-------------|
| Dimmable Light | `lightdim` |
| On/Off Light | `binaryswitch` |
| Door/Window Sensor | `binarysensor` |
| Motion Sensor | `motion` |
| Temperature Sensor | `temperature` |
| Multi-level Sensor | `multilevel` |
| Colored Light | `lightcolor` |

> **Where to find Device ID:** In the HC3 web interface, go to Devices, and look at the device details. The ID is shown in the URL or device info.

### 4.3 Manual Method (config.json)

If you prefer editing the config file directly:

```json
{
  "floors": [...],
  "devices": [
    {
      "id": 385,
      "name": "Living Room Light",
      "type": "lightdim",
      "floor_id": "floor1",
      "position": {
        "x": 450,
        "y": 300
      }
    }
  ]
}
```

**Finding coordinates:**
- Enable Edit Mode
- Add a device visually to see where it lands
- Check config.json to see the coordinates
- Use those coordinates for other devices

---

## 5. Editing Devices

### 5.1 Moving Devices

**Step 1: Enable Edit Mode**

Check the **Edit Mode** checkbox at the top right.

**Step 2: Drag to Move**

Click and drag any device to move it to a new position. The position saves automatically!

### 5.2 Editing Device Properties

**Step 1: Enable Edit Mode**

Make sure Edit Mode is enabled.

**Step 2: Right-Click Device**

Right-click on any device and select **Edit**.

**Step 3: Change Settings**

You can modify:
- Device name
- Widget type
- Which floors the device appears on

**Step 4: Save Changes**

Click **Save** to apply your changes.

### 5.3 Moving Devices Between Floors

A device can appear on multiple floors!

**To add a device to another floor:**
1. Right-click the device → **Edit**
2. Check additional floors in the "Floors" section
3. Click **Save**
4. Switch to the other floor tab
5. The device appears there (you can drag it to the right position)

**To remove from a floor:**
1. Right-click the device → **Edit**
2. Uncheck the floor you want to remove it from
3. Click **Save**

### 5.4 Deleting Devices

**Step 1: Enable Edit Mode**

**Step 2: Right-Click Device**

Right-click on the device you want to remove.

**Step 3: Choose "Delete"**

Select **Delete** from the menu.

**Step 4: Confirm**

Click **Delete** in the confirmation dialog.

The device will be removed from all floors.

---

## 6. Zooming Floor Plans

Sometimes your floor plan is too small or too large. Use zoom to adjust!

### 6.1 Enable Zoom Controls

Zoom controls only appear in **Edit Mode**.

1. Check the **Edit Mode** checkbox
2. Zoom controls appear in the top bar (between Settings and Edit Mode)

### 6.2 Zoom Options

| Control | What It Does |
|---------|--------------|
| **−** button | Zoom out by 10% |
| **+** button | Zoom in by 10% |
| **Slider** | Drag to set exact zoom (50% - 200%) |
| **Fit** button | Auto-scale to fill the window |
| **Reset** button | Return to 100% zoom |

### 6.3 Using Zoom

**To make everything bigger:**
- Click the **+** button a few times, or
- Drag the slider to the right, or
- Try **Fit** to automatically fill your window

**To make everything smaller:**
- Click the **−** button, or
- Drag the slider to the left, or
- Click **Reset** to go back to 100%

### 6.4 Per-Floor Zoom

Each floor remembers its own zoom level!

- Set zoom to 150% on Floor 1
- Switch to Floor 2, set zoom to 100%
- Switch back to Floor 1 → still at 150%

Zoom settings are saved even when you close HomeMap.

### 6.5 Why Use Zoom?

**Use Cases:**
- **Small floor plans:** Zoom in to make devices appear larger
- **Large displays:** Zoom out to see everything at once
- **Presentations:** Use "Fit" to fill the screen
- **Different floor sizes:** Each floor can have its own zoom level

---

## 7. Tips & Tricks

### Getting Device IDs Quickly

**Method 1: HC3 Web Interface**
1. Open your HC3 web interface
2. Go to Devices
3. Click on a device
4. Look at the URL: `http://192.168.1.57/devices/385` → ID is `385`

**Method 2: HC3 Mobile App**
1. Long-press a device
2. Select "Advanced"
3. Device ID is shown at the top

### Organizing Your Floor Plans

**Best practices:**
- Start with one floor until you're comfortable
- Use consistent naming: "floor1", "floor2", etc.
- Keep floor plan images simple and clear
- Optimize image size (1000-2000px wide is plenty)
- Use PNG or JPG format

### Dealing with Many Devices

**Strategies:**
- Don't add every device - focus on the ones you use most
- Group similar devices (e.g., all lights on one floor)
- Use descriptive names: "Kitchen Light" not just "Light 1"
- Color-code using different widget types if needed

### Controlling Devices

**To control a device:**
1. Make sure Edit Mode is **OFF**
2. Click on any device icon
3. A control dialog appears
4. Use sliders, buttons, or toggles to control the device

**Quick actions:**
- Lights: Click to see dimmer slider
- Switches: Click to toggle on/off
- Sensors: Click to see current value

### Keyboard Shortcuts

- **Edit Mode Toggle:** Just click the Edit Mode checkbox (no keyboard shortcut yet)
- **Settings:** Click the ⚙️ button

### Backup Your Configuration

Your configuration is in one file:
```
/path/to/homemapdata/config.json
```

**To backup:**
1. Copy `config.json` to a safe location
2. Also copy your floor plan images
3. Keep backups before making major changes

**To restore:**
1. Copy the backup `config.json` back
2. Restart HomeMap

### When Things Go Wrong

**HomeMap won't start:**
- Check that config.json is valid JSON (use a JSON validator online)
- Make sure floor plan images exist in the data folder
- Check the console for error messages

**Can't connect to HC3:**
- Verify IP address is correct
- Check username and password
- Make sure HC3 is powered on and accessible
- Try accessing HC3 web interface in a browser

**Devices not appearing:**
- Check device ID is correct
- Verify widget type matches device type
- Make sure device is enabled in HC3
- Check that position is within floor plan bounds

**Floor plans not loading:**
- Verify image files exist in data folder
- Check file names match config.json exactly
- Try PNG format if other formats don't work
- Make sure file paths have no spaces or special characters

### Getting Help

**Resources:**
- Check the [Configuration Guide](CONFIGURE.md) for detailed options
- See [Widget Format](WIDGET_FORMAT.md) for custom widgets
- Review example config files in the examples folder

**Common Questions:**
- **Q: Can I use HomeMap on multiple computers?**
  - A: Yes! Just point each HomeMap to the same data folder (use a shared drive or cloud storage)
  
- **Q: How do I add custom widgets?**
  - A: See the Widget Format documentation (advanced topic)
  
- **Q: Can I export my configuration?**
  - A: Just copy your `config.json` file and floor plan images

---

## Quick Start Checklist

Ready to get started? Follow this checklist:

- [ ] Open Settings and enter HC3 credentials
- [ ] Set your data path and create the folder
- [ ] Save settings and restart HomeMap
- [ ] Verify "Connected to HC3" appears (green dot)
- [ ] Copy a floor plan image to your data folder
- [ ] Edit `config.json` to add your first floor
- [ ] Restart HomeMap to see the floor tab
- [ ] Enable Edit Mode
- [ ] Right-click on floor plan → Add Device
- [ ] Enter device ID, name, and type
- [ ] Click Add Device
- [ ] Try clicking the device (with Edit Mode OFF) to control it
- [ ] Try dragging the device to move it (with Edit Mode ON)
- [ ] Use zoom controls to adjust the view
- [ ] Add more devices and enjoy!

---

**Congratulations!** You're now ready to use HomeMap. Start simple, experiment, and gradually add more devices and floors as you get comfortable with the interface.

**Happy Home Mapping! 🏠**
