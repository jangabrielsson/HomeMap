# Testing Widget Lifecycle and UID Management

This document demonstrates how HomeMap handles QuickApp updates and widget cleanup.

## Feature Overview

When a QuickApp reconnects with a different set of widgets, HomeMap intelligently manages the widget instances on your floor plans:

- **Widgets with matching UIDs**: Preserved and restored
- **Widgets with removed UIDs**: Automatically deleted from floor plans
- **New widget UIDs**: Added to the widget palette

This ensures your floor plans stay synchronized with QuickApp changes without manual cleanup.

## Test Scenario

### Initial Setup

1. **Start HomeMap** and start the WebSocket server
2. **Start test client** with 2 widgets:
   ```bash
   node test-websocket-client.js 127.0.0.1 8765
   ```
3. **Place widgets** on floor plan:
   - Drag "Test Button" to floor
   - Drag "Test Light" to floor
4. **Exit Edit Mode** and test clicking widgets

### Test 1: Normal Reconnection (Same Widgets)

1. **Stop the test client** (Ctrl+C)
   - Observe: Widgets turn gray, show "Not connected"
2. **Restart the test client**
   - Observe: Widgets restore, become interactive again
   - Result: ✅ Both widgets preserved

### Test 2: QuickApp Update (Remove Widget)

1. **Edit test-websocket-client.js**
   ```javascript
   // Remove test-light from widgets array
   const widgets = [
       {
           id: 'test-button',
           name: 'Test Button',
           iconSet: 'binarySwitch',
           label: 'Click Me'
       }
       // test-light removed!
   ];
   ```

2. **Save and restart client**
   - Observe: "Test Button" widget restored
   - Observe: "Test Light" widget **automatically removed** from floor
   - Notification: "Removed 1 obsolete widget(s)"
   - Result: ✅ Cleanup successful

### Test 3: QuickApp Update (Add Widget)

1. **Edit test-websocket-client.js**
   ```javascript
   const widgets = [
       {
           id: 'test-button',
           name: 'Test Button',
           iconSet: 'binarySwitch',
           label: 'Click Me'
       },
       {
           id: 'test-door',  // NEW WIDGET
           name: 'Door Sensor',
           iconSet: 'door-close',
           label: 'Door'
       }
   ];
   ```

2. **Save and restart client**
   - Observe: "Test Button" widget still on floor
   - Observe: "Door Sensor" appears in widget palette
   - Result: ✅ New widget available, existing preserved

### Test 4: Widget ID Change (Breaks Stability)

⚠️ **Don't do this in production!** This demonstrates what happens with unstable IDs.

1. **Edit test-websocket-client.js**
   ```javascript
   const widgets = [
       {
           id: 'test-button-v2',  // ❌ Changed ID!
           name: 'Test Button',
           iconSet: 'binarySwitch',
           label: 'Click Me'
       }
   ];
   ```

2. **Save and restart client**
   - Observe: Old "test-button" widget removed (ID no longer exists)
   - Observe: New "test-button-v2" widget in palette
   - Result: ⚠️ Lost floor placement due to ID change

## Best Practices

### ✅ DO

- Use **descriptive, stable IDs**: `scene-living-room`, `alarm-control`, `profile-away`
- Keep IDs **consistent across updates**
- Base IDs on **functionality**, not dynamic data
- Document your widget IDs

### ❌ DON'T

- Use timestamps: `widget-${Date.now()}`
- Use random IDs: `widget-${Math.random()}`
- Change IDs in updates (breaks persistence)
- Use sequential numbers that might change: `button-1`, `button-2`

## Console Output Examples

### Successful Reconnection
```
🔄 Reconnect detected - cleaned up removed widgets
   Current widget IDs: [ 'test-button', 'test-door' ]
   ❌ Widget "test-light" no longer exists - marking for removal
   🗑️  Removed widget element: Test Light
✅ Cleanup complete - removed 1 widget instance(s)
```

### No Cleanup Needed
```
🔄 Reconnect detected - cleaned up removed widgets
   Current widget IDs: [ 'test-button', 'test-light' ]
✅ No cleanup needed - all widgets still valid
```

## Real-World Example: Profile Buttons

### Version 1 (Initial)
```javascript
widgets: [
    { id: 'profile-home', name: 'Home Profile', ... },
    { id: 'profile-away', name: 'Away Profile', ... },
    { id: 'profile-night', name: 'Night Profile', ... }
]
```

### Version 2 (Updated)
```javascript
widgets: [
    { id: 'profile-home', name: 'Home Profile', ... },     // Kept
    { id: 'profile-away', name: 'Away Profile', ... },     // Kept
    { id: 'profile-vacation', name: 'Vacation', ... }      // New!
    // profile-night removed - will be cleaned up automatically
]
```

Result: Home and Away buttons stay on floor, Night button removed, Vacation added to palette.

## Summary

The UID-based widget lifecycle ensures:
- **Stability**: Widgets with consistent IDs persist across updates
- **Cleanup**: Removed widgets don't clutter floor plans
- **Flexibility**: QuickApps can evolve without breaking existing layouts
- **Safety**: Users don't need to manually track and remove obsolete widgets
