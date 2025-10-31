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

When you first open HomeMap:
- The app automatically creates a configuration folder
- Built-in widgets and icons are installed automatically
- You'll see a welcome dialog guiding you to set up your HC3 connection

### 2.2 Opening Settings

Click the **⚙️ Settings** button in the top-right corner.

### 2.3 Configure HC3 Connection

In the Settings dialog, go to the **HC3** tab and fill in:

| Field | Description | Example |
|-------|-------------|---------|
| **HC3 Host** | Your HC3's IP address or hostname | `192.168.1.57` |
| **HC3 Username** | Your HC3 username | `admin` |
| **HC3 Password** | Your HC3 password | Your password |
| **Protocol** | HTTP or HTTPS | `http` (most common) |

### 2.4 Optional: Configure House Settings

In the **General** tab, you can set:
- **House Name**: Display name for your home (shows in window title)
- **House Icon**: An emoji icon for branding (max 2 characters)

These are optional but make HomeMap feel more personalized!

### 2.5 Save and Test Connection

1. Click **Save**
2. The app automatically tests your connection
3. You should see "Connected to HC3" (green indicator) at the top right

> **Tip:** If you see "Authentication Failed", double-check your username and password!

**Where are files stored?**
HomeMap automatically creates its configuration folder at:
- **macOS**: `~/Library/Application Support/HomeMap/homemapdata`
- **Windows**: `%APPDATA%\HomeMap\homemapdata`

You don't need to worry about this unless you want to create custom widgets or icons!

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
## 3. Adding Floor Plans

### 3.1 Prepare Your Floor Plan Image

1. Create or obtain a floor plan image (PNG, JPG, or GIF)
2. Name it something descriptive like `ground-floor.png` or `first-floor.jpg`
3. Recommended size: 1500-3000 pixels wide for best quality

### 3.2 Add Floor via Settings

1. Open **Settings** (⚙️)
2. Go to the **Floors** tab
3. Click **Add Floor**
4. Fill in the floor information:

| Field | Description | Example |
|-------|-------------|---------|
| **Floor ID** | Unique identifier (simple name) | `floor1` |
| **Floor Name** | Display name | `Ground Floor` |
| **Floor Image** | Click **Browse...** to select your image | `ground-floor.png` |

5. Click **Save**
6. The floor appears in your floor tabs

**The floor image is automatically copied to your data folder**, so you don't need to worry about file paths!

### 3.3 Verify the Floor

You should now see your new floor as a tab at the top of the window.

Click on the tab to view the floor plan!

### 3.4 Add More Floors

Repeat the process for additional floors:
- **Ground Floor** (id: `floor1`)
- **First Floor** (id: `floor2`)
- **Basement** (id: `basement`)

> **Tip:** Start with one floor to get familiar with HomeMap, then add more floors later!

---

## 4. Adding Devices

There are two ways to add devices to your floor plans:

### 4.1 Using Device Management Panel (Recommended)

This is the **easiest and most visual way** to add devices.

**Step 1: Enter Edit Mode**
1. Click the **Edit** button (✏️) at the top right
2. The floor plan enters edit mode (you'll see editing controls)

**Step 2: Open Device Management**
1. Click the **hamburger menu (☰)** at the top left
2. Select **Device Management**

**Step 3: Install a Device**
1. The panel shows all your HC3 devices organized by room
2. Find the device you want to add
3. Click **Install** next to the device
4. The device appears on your floor plan!

**Step 4: Position the Device**
1. **Drag** the device to the correct location on your floor
2. Devices snap to a grid for easier alignment
3. The device automatically uses the appropriate widget based on its type
4. Click **Exit Edit Mode** when done

> **Tip:** The Device Management panel groups devices by room, making it easy to find what you need!

### 4.2 Common Widget Types

HomeMap automatically selects the right widget based on your HC3 device type:

| Device Type | Widget Type | Controls |
|-------------|-------------|----------|
| Dimmable Light | `lightdim` | On/Off + Brightness slider |
| On/Off Light | `binaryswitch` | On/Off button |
| Door/Window Sensor | `binarysensor` | Open/Closed status |
| Motion Sensor | `motion` | Motion detected indicator |
| Temperature Sensor | `temperature` | Current temperature |
| Multi-level Sensor | `multilevel` | Sensor value display |
| Colored Light | `lightcolor` | On/Off + Color picker |

> **Where to find Device ID:** In the HC3 web interface, go to Devices, and look at the device details. The ID is shown in the URL or device info.

### 4.3 Advanced: Manual Configuration (config.json)

For developers or advanced users who want direct file control:

Open your configuration file at:
- **macOS**: `~/Library/Application Support/HomeMap/homemapdata/config.json`
- **Windows**: `%APPDATA%\HomeMap\homemapdata\config.json`

Add devices manually:

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

> **Note:** Using the Device Management panel is much easier and less error-prone!

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

Your configuration is automatically stored in:
- **macOS**: `~/Library/Application Support/HomeMap/homemapdata/`
- **Windows**: `%APPDATA%\HomeMap\homemapdata\`

**To backup:**
1. Copy the entire `homemapdata` folder to a safe location
2. This includes `config.json` and all your floor plan images
3. Keep backups before making major changes

**To restore:**
1. Copy the backup `homemapdata` folder back to the app support location
2. Restart HomeMap

### When Things Go Wrong

**HomeMap won't start:**
- Check the console/terminal for error messages
- Try resetting to defaults by temporarily moving the `homemapdata` folder
- Reinstall if needed (your data folder is preserved)

**Can't connect to HC3:**
- Verify IP address in Settings → HC3 tab
- Check username and password
- Make sure HC3 is powered on and accessible
- Try accessing HC3 web interface in a browser

**Devices not appearing:**
- Check device ID is correct in HC3
- Make sure device is enabled in HC3
- Try uninstalling and reinstalling the device via Device Management panel
- Check that the device is visible on the current floor

**Floor plans not loading:**
- Make sure you selected a valid image file (PNG, JPG, or GIF)
- Try re-adding the floor via Settings → Floors tab
- Check that the image file isn't corrupted
- Try a different image format if needed

### Getting Help

**Resources:**
- Check the [README](../README.md) for feature overview
- See the [Forum Post](FORUM_POST.html) for community discussion
- Review [Configuration Guide](CONFIGURE.md) for advanced options (developers)
- See [Widget Format](WIDGET_FORMAT.md) for custom widget development

**Common Questions:**
- **Q: Can I use HomeMap on multiple computers?**
  - A: Yes! The configuration folder can be synced via cloud storage, or you can export/import by copying the `homemapdata` folder
  
- **Q: How do I add custom widgets?**
  - A: See the Widget Format documentation - place custom widgets in `homemapdata/widgets/packages/`
  
- **Q: Can I export my configuration?**
  - A: Yes! Copy your entire `homemapdata` folder (found in Application Support) to backup or share
  
- **Q: Do I need to manually edit config files?**
  - A: No! HomeMap is designed to be fully configurable through the UI. Direct file editing is only for advanced customization.

---

## Quick Start Checklist

Ready to get started? Follow this checklist:

- [ ] Launch HomeMap (configuration folder created automatically)
- [ ] Open Settings (⚙️) and go to HC3 tab
- [ ] Enter your HC3 credentials (IP, username, password)
- [ ] Save settings and verify "Connected to HC3" appears (green dot)
- [ ] Go to Settings → Floors tab
- [ ] Click "Add Floor" and select your floor plan image
- [ ] Fill in floor name and ID, click Save
- [ ] Close Settings and verify you see your floor tab
- [ ] Click Edit Mode (✏️)
- [ ] Open hamburger menu (☰) → Device Management
- [ ] Find a device and click "Install"
- [ ] Drag the device to position it on your floor plan
- [ ] Exit Edit Mode
- [ ] Try clicking the device to control it
- [ ] Use zoom controls (in Edit Mode) to adjust the view
- [ ] Add more devices and floors as needed!

---

**Congratulations!** You're now ready to use HomeMap. The app handles all file management automatically - just use the interface to set up your floors and devices!

**Happy Home Mapping! 🏠**
