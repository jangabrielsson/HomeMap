# HomeMap Remote Widget Examples

This directory contains example implementations of QuickApps and test clients that integrate with HomeMap's WebSocket remote widget system.

## Files

### 1. `remote-widget-quickapp.lua`
Complete HC3 QuickApp example with:
- Auto-reconnect on disconnect
- Multiple widget types (button, alarm, mode switch)
- State management
- Click event handling
- Heartbeat keepalive

**Setup:**
1. Create new QuickApp in HC3
2. Copy/paste the code
3. Update `HOMEMAP_IP` constant
4. Save and start QuickApp
5. Add widgets in HomeMap Edit Mode

### 2. `test-websocket-client.js`
Node.js test client for protocol testing:
- Simulates a QuickApp
- Interactive commands
- Connection management
- Example widget interactions

**Requirements:**
```bash
npm install ws
```

**Usage:**
```bash
# Default (192.168.1.100:8765)
node test-websocket-client.js

# Custom IP and port
node test-websocket-client.js 192.168.1.50 8765
```

**Interactive Commands:**
- `toggle` - Toggle test button
- `light` - Randomize light brightness
- `status` - Show connection status
- `help` - Show commands
- `quit` - Exit

## Quick Start Guide

### Option 1: Using HC3 QuickApp (Production)

1. **Install QuickApp:**
   ```
   - Open HC3 web interface
   - Go to Devices → Add Device → Other Device → QuickApp
   - Name it "HomeMap Widgets"
   - Paste code from remote-widget-quickapp.lua
   - Change HOMEMAP_IP to your HomeMap device IP
   - Save
   ```

2. **Start QuickApp:**
   ```
   - Click "Advanced" tab
   - Click "Save" button
   - QuickApp will start automatically
   - Check logs for "Connected to HomeMap" message
   ```

3. **Add Widgets in HomeMap:**
   ```
   - Open HomeMap
   - Click Edit Mode button
   - Look for "Example Remote Widgets" in palette
   - Drag widgets onto floor plan
   - Exit Edit Mode
   - Click widgets to test!
   ```

### Option 2: Using Node.js Test Client (Testing)

1. **Install dependencies:**
   ```bash
   npm install ws
   ```

2. **Run client:**
   ```bash
   node test-websocket-client.js 192.168.1.100 8765
   ```

3. **Add widgets in HomeMap:**
   ```
   - Open HomeMap
   - Enter Edit Mode
   - Look for "WebSocket Test Client" in palette
   - Add "Test Button" and "Test Light"
   - Exit Edit Mode
   ```

4. **Test interaction:**
   ```
   - Click widgets in HomeMap
   - Watch console output
   - Type "toggle" or "light" in terminal for manual updates
   ```

## Example Use Cases

### Scene Controller
```lua
-- Toggle scene on/off
function QuickApp:handleSceneToggle(widget)
    widget.state = not widget.state
    
    if widget.state then
        fibaro.scene.execute(123)  -- Your scene ID
    else
        fibaro.scene.stop(123)
    end
    
    self:updateWidget(widget.id, {
        iconSet = widget.state and "scene-on" or "scene-off",
        label = widget.state and "Active" or "Inactive",
        color = widget.state and "#4CAF50" or "#9E9E9E"
    })
end
```

### Thermostat Display
```lua
-- Update temperature display every minute
function QuickApp:updateTemperature()
    local temp = api.get("/devices/" .. self.tempSensorId).properties.value
    
    self:updateWidget("thermostat", {
        label = string.format("%.1f°F", temp),
        color = temp > 75 and "#F44336" or "#2196F3"
    })
end
```

### Alarm Panel
```lua
-- Cycle through alarm states
function QuickApp:handleAlarmControl(widget)
    local states = {"disarmed", "armed_home", "armed_away"}
    local nextState = states[((findIndex(states, widget.state) or 0) % #states) + 1]
    
    widget.state = nextState
    
    -- Set alarm
    api.put("/alarms/v1/partitions/1", {
        mode = nextState
    })
    
    self:updateWidget(widget.id, {
        iconSet = nextState == "disarmed" and "alarm-off" or "alarm-on",
        label = nextState:gsub("_", " "):upper(),
        color = nextState == "disarmed" and "#4CAF50" or "#F44336"
    })
end
```

### Multi-Button Controller
```lua
-- Register 4 scene buttons
self.widgets = {
    { id = "scene-1", name = "Morning", iconSet = "sunrise", label = "Morning" },
    { id = "scene-2", name = "Day", iconSet = "sun", label = "Day" },
    { id = "scene-3", name = "Evening", iconSet = "sunset", label = "Evening" },
    { id = "scene-4", name = "Night", iconSet = "moon", label = "Night" }
}

function QuickApp:handleSceneButton(widget)
    local sceneIds = { 101, 102, 103, 104 }
    local index = tonumber(widget.id:match("%d+"))
    
    fibaro.scene.execute(sceneIds[index])
    
    -- Flash button
    self:updateWidget(widget.id, { color = "#FFD700" })
    setTimeout(function()
        self:updateWidget(widget.id, { color = "#FFFFFF" })
    end, 500)
end
```

## Troubleshooting

### "Connection refused"
- Ensure HomeMap WebSocket server is running (check settings)
- Verify IP address and port
- Check firewall rules allow port 8765

### "Widgets not appearing in palette"
- Check QuickApp logs for "Connected to HomeMap"
- Verify registration message was sent
- Refresh HomeMap (Cmd+R / Ctrl+R)

### "Clicks not working"
- Exit Edit Mode (widgets only work in view mode)
- Check QuickApp is still connected
- Look for error messages in QuickApp logs

### "Icons not loading"
- Use built-in icon names: dimLight, binarySwitch, etc.
- Check icon exists in HomeMap (Settings → Packages)
- Try "binarySwitch" as a safe default

## Advanced Topics

### Custom Icon Sets
1. Create icon set in HomeMap Package Manager
2. Export as .hwp package
3. Use icon set name in widget definition

### State Persistence
Widget state is NOT persisted in HomeMap - QuickApp owns state:
```lua
-- Save state to HC3 variable
function QuickApp:saveState()
    self:setVariable("widget_states", json.encode(self.widgetStates))
end

-- Restore on init
function QuickApp:onInit()
    local saved = self:getVariable("widget_states")
    if saved then
        self.widgetStates = json.decode(saved)
    end
end
```

### Error Handling
```lua
function QuickApp:sendMessage(data)
    if not self.isConnected then
        self:warning("Not connected, queueing message")
        table.insert(self.messageQueue, data)
        return false
    end
    
    local ok, err = pcall(function()
        self.ws:sendMessage(json.encode(data))
    end)
    
    if not ok then
        self:error("Send failed:", err)
        self.isConnected = false
    end
    
    return ok
end
```

## Protocol Reference

See `/docs/WEBSOCKET_PROTOCOL.md` for complete protocol documentation.

## Support

For questions or issues:
- GitHub Issues: https://github.com/jangabrielsson/HomeMap/issues
- Fibaro Forum: [Link to thread]

## License

These examples are provided as-is under the same license as HomeMap.
