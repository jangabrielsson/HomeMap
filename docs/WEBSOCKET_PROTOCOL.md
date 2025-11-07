# HomeMap WebSocket Protocol Documentation

## Overview

HomeMap includes a WebSocket server that allows HC3 QuickApps (or other clients) to create interactive remote widgets that appear on your floor plans. This enables custom automation controls beyond standard device types.

## Architecture

```
QuickApp (HC3) <--WebSocket--> HomeMap <--UI--> User
     |                            |
     +-- Register Widgets --------+
     +-- Update Widget State <----+
     +<- Receive User Events -----+
```

## WebSocket Server Configuration

Default settings (can be configured in HomeMap's config.json):

```json
{
  "websocket": {
    "enabled": true,
    "autoStart": true,
    "port": 8765,
    "bindAddress": "0.0.0.0"
  }
}
```

- **port**: WebSocket server port (default: 8765)
- **bindAddress**: Network interface ("0.0.0.0" for all, or specific LAN IP)
- **autoStart**: Whether to start server on app launch
- **enabled**: Master enable/disable for WebSocket features

## Message Protocol

All messages are JSON objects sent as WebSocket text frames.

### Message Types

#### 1. **register-widgets** (QuickApp → HomeMap)

Register one or more widgets when connecting.

```json
{
  "type": "register-widgets",
  "qaId": "qa-123",
  "qaName": "My Automation QuickApp",
  "widgets": [
    {
      "id": "scene-toggle",
      "name": "Living Room Scene",
      "iconSet": "livingroom-off",
      "label": "Living Room",
      "metadata": {
        "description": "Toggle living room scene",
        "version": "1.0.0"
      }
    },
    {
      "id": "alarm-status",
      "name": "Alarm Status",
      "iconSet": "alarm-off",
      "label": "Alarm"
    }
  ]
}
```

**Fields:**
- `qaId`: Unique identifier for this QuickApp (e.g., "qa-{deviceId}") - **Must remain stable across reconnections**
- `qaName`: Display name shown in HomeMap
- `widgets[]`: Array of widget definitions
  - `id`: Unique widget ID within this QuickApp - **Must be stable across reconnections**
  - `name`: Widget name for palette
  - `iconSet`: Initial icon set name (from HomeMap's icon library)
  - `label`: Text label displayed under icon
  - `metadata`: Optional custom data

**Important - Widget UIDs:**
Widget IDs (`id` field) must be **stable and unique** within the QuickApp. When a QuickApp reconnects:
- Widgets with the same `id` are preserved on floor plans
- Widgets with IDs no longer present are automatically removed
- New widget IDs are added to the palette

This allows QuickApps to update their widget offerings without leaving orphaned widgets on floor plans.

**Example UID Strategy:**
```javascript
// ✅ Good - stable IDs
widgets: [
  { id: "scene-living-room", name: "Living Room" },
  { id: "scene-bedroom", name: "Bedroom" }
]

// ❌ Bad - changing IDs
widgets: [
  { id: "widget-" + Date.now(), name: "Living Room" }  // Changes every reconnect!
]
```
  - `metadata`: Optional custom data

**Response:** HomeMap emits `ws-register-widgets` event internally

---

#### 2. **widget-update** (QuickApp → HomeMap)

Update the visual state of a widget.

```json
{
  "type": "widget-update",
  "widgetId": "scene-toggle",
  "changes": {
    "iconSet": "livingroom-on",
    "label": "Living Room (ON)",
    "color": "#FFD700",
    "backgroundColor": "#000000",
    "state": {
      "active": true,
      "brightness": 80
    }
  }
}
```

**Fields:**
- `widgetId`: ID of the widget to update
- `changes`: Object with properties to change
  - `iconSet`: New icon set name
  - `label`: New text label
  - `color`: Text color (CSS color)
  - `backgroundColor`: Background color
  - `state`: Custom state object (stored but not displayed)

**Response:** HomeMap updates all instances of this widget on floor plans

---

#### 3. **widget-event** (HomeMap → QuickApp)

User interaction with a remote widget.

```json
{
  "type": "widget-event",
  "widgetId": "scene-toggle",
  "event": "click",
  "data": {
    "floor": "floor-1",
    "x": 250,
    "y": 180,
    "timestamp": 1699300800000,
    "parameters": {
      "profileName": "Away",
      "sceneId": "123"
    }
  }
}
```

**Fields:**
- `widgetId`: ID of the widget that was clicked
- `event`: Event type (currently only "click")
- `data`: Event context
  - `floor`: Floor ID where widget is placed
  - `x`, `y`: Widget position on floor
  - `timestamp`: Event time (milliseconds since epoch)
  - `parameters`: User-defined parameters for this widget instance (optional)

**Response:** QuickApp handles the event and may send widget-update

**Parameters:**
Each widget instance can have custom parameters configured by the user. These allow the same widget type to perform different actions. For example:
- A "Scene" widget with `profileName: "Away"` vs `profileName: "Home"`
- A "Control" widget with `sceneId: "123"` to trigger different scenes
- Generic key-value pairs for any custom behavior

To set parameters in HomeMap: Right-click a widget in Edit Mode and choose "Edit Parameters".

---

#### 4. **request-widgets** (HomeMap → QuickApp)

Request that the client re-send its widget registrations. This is sent when HomeMap reloads and needs to rebuild the widget palette for already-connected clients.

```json
{
  "type": "request-widgets",
  "message": "Please send your widget definitions"
}
```

**Expected Response:** Client should respond with a `register-widgets` message containing all its widget definitions.

**Use Case:** When HomeMap app reloads but WebSocket clients remain connected, the widget palette becomes empty. HomeMap sends this message to request re-registration without requiring clients to reconnect.

---

#### 5. **unregister-widgets** (QuickApp → HomeMap)

Explicitly unregister widgets before disconnecting.

```json
{
  "type": "unregister-widgets",
  "qaId": "qa-123"
}
```

**Fields:**
- `qaId`: QuickApp ID to unregister

**Response:** HomeMap marks widgets as disconnected

---

#### 6. **heartbeat** (QuickApp → HomeMap)

Optional keepalive message.

```json
{
  "type": "heartbeat"
}
```

**Response:** None (prevents connection timeout)

---

## Connection Lifecycle

### 1. Connect

```lua
-- Lua (HC3 QuickApp)
local ws = net.WebSocketClient()
ws:connect("ws://192.168.1.100:8765", {
  onConnected = function()
    print("Connected to HomeMap")
    sendRegistration()
  end
})
```

```javascript
// JavaScript
const ws = new WebSocket('ws://192.168.1.100:8765');
ws.onopen = () => {
  console.log('Connected to HomeMap');
  sendRegistration();
};
```

### 2. Register Widgets

Immediately after connecting, send `register-widgets` message.

**On Reconnection:**
When a QuickApp reconnects and re-registers, HomeMap performs smart cleanup:
- Compares new widget IDs with previously placed widgets
- Removes widget instances whose IDs no longer exist (widget was removed from QA)
- Keeps widget instances whose IDs still exist (widget still supported)
- Restores visual state and makes kept widgets interactive again

This ensures your floor plans stay synchronized with QuickApp changes.

### 3. Handle Events

Listen for `widget-event` messages and respond with `widget-update`.

### 4. Update State

Send `widget-update` whenever widget state changes (from automation, device events, etc.).

### 5. Disconnect

Widgets are automatically marked as disconnected. Optionally send `unregister-widgets` first.

---

## Widget Persistence

HomeMap automatically saves widget placements to `config.json`:

```json
{
  "remoteWidgets": [
    {
      "qaId": "qa-123",
      "widgetId": "scene-toggle",
      "floor": "floor-1",
      "x": 250,
      "y": 180,
      "parameters": {
        "profileName": "Away"
      }
    }
  ]
}
```

When a QuickApp reconnects with the same `qaId`, widgets are automatically restored to their saved positions.

**Widget Lifecycle:**
- Widget placed: Saved to config with `qaId` + `widgetId` + position + parameters
- QA disconnects: Widget marked as "Not connected" visually but stays on floor
- QA reconnects with same widget ID: Widget restored to active state
- QA reconnects without widget ID: Widget removed from floor (no longer supported)

---

## Icon Sets

Remote widgets use HomeMap's icon library:

**Built-in icons:** `dimLight`, `binarySwitch`, `temperature`, `motion`, etc.

**Custom icons:** Upload via Package Manager (.hwp files)

**Icon paths:**
- Built-in: Just use name (e.g., `"iconSet": "dimLight"`)
- Packages: Use name from package (e.g., `"iconSet": "my-custom-icon"`)

Icons can have multiple states:
- `icon` - Default/on state
- `iconOff` - Off state
- `iconOpen` - Open state
- etc.

HomeMap automatically selects the appropriate icon file.

---

## Security Considerations

### Network Security
- **Local network only**: Bind to LAN IP, not internet-facing
- **No authentication required**: Assumes trusted local network
- **Optional token**: Future feature for shared secret authentication

### Firewall Rules
- Allow incoming TCP on configured port (default 8765)
- Restrict to local subnet only

### Mobile Considerations
- iOS/Android apps can connect if on same network
- Ensure HomeMap device IP is accessible from mobile

---

## Error Handling

### Connection Failures

**Client side:**
```lua
onDisconnected = function()
  -- Retry after delay
  fibaro.setTimeout(5000, function()
    reconnect()
  end)
end
```

### Widget Not Found

If HomeMap can't find a widget (wrong ID), no error is sent. Check console logs.

### Disconnection

When a QuickApp disconnects:
1. Widgets remain on floor plans
2. Visual state frozen at last update
3. Clicks show "Widget disconnected" error
4. On reconnect, widgets are re-activated

---

## Testing

### Using WebSocket Test Tool

```bash
# Install wscat
npm install -g wscat

# Connect to HomeMap
wscat -c ws://192.168.1.100:8765

# Send test message
> {"type":"register-widgets","qaId":"test-1","qaName":"Test QA","widgets":[{"id":"test-widget","name":"Test","iconSet":"dimLight","label":"Test"}]}
```

### Using Browser Console

```javascript
const ws = new WebSocket('ws://192.168.1.100:8765');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'register-widgets',
    qaId: 'browser-test',
    qaName: 'Browser Test',
    widgets: [{
      id: 'test-btn',
      name: 'Test Button',
      iconSet: 'binarySwitch',
      label: 'Click Me'
    }]
  }));
};

ws.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};
```

---

## Troubleshooting

### "Connection refused"
- Check WebSocket server is running (green indicator in HomeMap)
- Verify correct IP address and port
- Check firewall rules

### "Widget not appearing"
- Ensure `register-widgets` was sent successfully
- Check HomeMap is in Edit Mode
- Look for widget in "🔌 Remote Widgets" palette section

### "Widget click not working"
- Exit Edit Mode (clicks only work in view mode)
- Check QuickApp is still connected
- Verify `onMessage` handler is receiving events

### "Icons not loading"
- Ensure icon set name exists in HomeMap
- Check icon set is correctly formatted
- Use built-in icons for testing (e.g., "dimLight")

---

## Advanced Features

### Multi-State Widgets

```json
{
  "type": "widget-update",
  "widgetId": "thermostat",
  "changes": {
    "iconSet": "temperature",
    "label": "72°F",
    "state": {
      "temp": 72,
      "mode": "heat",
      "fan": "auto"
    }
  }
}
```

### Dynamic Label Updates

```lua
-- Update temperature every minute
function QuickApp:updateTemperature(temp)
  ws:sendMessage(json.encode({
    type = "widget-update",
    widgetId = "temp-sensor",
    changes = {
      label = string.format("%.1f°F", temp)
    }
  }))
end
```

### Color Coding

```json
{
  "type": "widget-update",
  "widgetId": "alarm",
  "changes": {
    "iconSet": "alarm-on",
    "color": "#FF0000",
    "label": "ALARM!"
  }
}
```

---

## API Reference

### HomeMap JavaScript API

From within HomeMap frontend:

```javascript
// Start WebSocket server
await homeMap.remoteWidgetManager.startServer(8765, '0.0.0.0');

// Stop server
await homeMap.remoteWidgetManager.stopServer();

// Get connected clients
const clients = await homeMap.remoteWidgetManager.getConnectedClients();

// Get registered widgets
const widgets = homeMap.remoteWidgetManager.getRemoteWidgetInfo();
```

### Tauri Commands

From Rust or via `invoke()`:

```rust
// Start server
ws_start_server(port: u16, bind_address: String) -> Result<(), String>

// Stop server
ws_stop_server() -> Result<(), String>

// Send to specific client
ws_send_to_client(client_id: String, message: Value) -> Result<(), String>

// Broadcast to all clients
ws_broadcast(message: Value) -> Result<(), String>

// Get connected clients
ws_get_connected_clients() -> Result<Vec<String>, String>
```

---

## Examples

See `/docs/examples/` for complete QuickApp implementations:
- Simple button toggle
- Multi-state thermostat control
- Scene controller with 4 buttons
- Alarm system status display

---

## Future Enhancements

Planned features:
- [ ] Token-based authentication
- [ ] Widget configuration dialog (double-click)
- [ ] Context menu for remote widgets
- [ ] Custom widget UI templates (HTML/CSS)
- [ ] Bidirectional device control (HomeMap → HC3)
- [ ] Widget grouping/folders
- [ ] SSL/TLS support (wss://)
- [ ] Rate limiting
- [ ] Connection status API endpoint

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/jangabrielsson/HomeMap/issues
- Fibaro Forum: [Link to forum thread]

---

**Version:** 1.0 (November 2025)  
**Compatible with:** HomeMap v1.0.29+
