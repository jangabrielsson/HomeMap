# Multi-Floor Device Support

## Overview
Devices can now appear on multiple floors with different positions. This is useful for:
- Having an overview map showing all devices
- Having zoomed detail maps for specific rooms
- Showing the same device in different contexts

## Configuration Format

### Old Format (Single Floor)
```json
{
  "id": 123,
  "name": "Living Room Light",
  "floor_id": "floor1",
  "position": { "x": 500, "y": 300 }
}
```

### New Format (Multi-Floor)
```json
{
  "id": 123,
  "name": "Living Room Light",
  "floors": [
    { "floor_id": "floor1", "position": { "x": 500, "y": 300 } },
    { "floor_id": "floor2", "position": { "x": 200, "y": 150 } }
  ]
}
```

## Backward Compatibility
The implementation supports **both formats seamlessly**:
- Old configs with `floor_id` continue to work without modification
- New configs with `floors` array enable multi-floor support
- Automatic conversion when adding device to additional floor
- Automatic reversion when removing from all but one floor

## User Interface

### Context Menu (Right-Click in Edit Mode)
- Shows checkmark (✓) for all floors the device is currently on
- **Click a floor without checkmark**: Add device to that floor
- **Click a floor with checkmark**: Remove device from that floor (if on multiple floors)
- Device retains its position when removed from a floor

### Behavior
1. When adding to new floor: Copies current position as default
2. When removing: Must keep device on at least one floor
3. Position on each floor is independent
4. Drag-and-drop updates position only on current floor

## API Reference

### Helper Functions (in HomeMap class)

#### `isDeviceOnFloor(device, floorId)`
Check if device appears on a specific floor.
```javascript
const isVisible = homeMap.isDeviceOnFloor(device, 'floor1');
```

#### `getDevicePosition(device, floorId)`
Get device position for a specific floor.
```javascript
const pos = homeMap.getDevicePosition(device, 'floor1');
// Returns: { x: 500, y: 300 } or null
```

#### `getDeviceFloors(device)`
Get array of all floor IDs the device is on.
```javascript
const floors = homeMap.getDeviceFloors(device);
// Returns: ['floor1', 'floor2']
```

#### `updateDevicePosition(device, floorId, position)`
Update device position on a specific floor.
```javascript
homeMap.updateDevicePosition(device, 'floor1', { x: 600, y: 400 });
```

#### `addDeviceToFloor(device, floorId, position)`
Add device to an additional floor. Auto-converts format if needed.
```javascript
homeMap.addDeviceToFloor(device, 'floor2', { x: 200, y: 150 });
```

#### `removeDeviceFromFloor(device, floorId)`
Remove device from a floor. Auto-reverts to simple format if only one floor remains.
```javascript
homeMap.removeDeviceFromFloor(device, 'floor1');
```

## Migration Path

### Existing Configurations
No migration required! Your existing config with `floor_id` will continue to work.

### Enabling Multi-Floor
Simply right-click a device in edit mode and click another floor name to add it there. The system automatically converts the format behind the scenes.

### Reverting to Single Floor
Right-click and remove the device from all but one floor. The system automatically reverts to the simple `floor_id` format.

## Implementation Notes

### Rendering
The `renderDevicesOnFloor()` method now:
1. Filters devices using `isDeviceOnFloor(device, floorId)`
2. Gets position using `getDevicePosition(device, floorId)`
3. Handles null positions gracefully

### Drag-and-Drop
The drag handler now:
1. Calculates new position based on mouse position
2. Updates position using `updateDevicePosition(device, currentFloorId, newPosition)`
3. Only updates position on the current floor being viewed

### Context Menu
Shows checkmarks for all floors device is on, allowing:
- Add to floor (click unchecked floor)
- Remove from floor (click checked floor, if on multiple)
- No action if only on one floor (prevents orphaned devices)

## Example Use Case

**Scenario**: You have a house overview map and a detailed living room map.

1. Place device on overview map (`floor_overview`)
2. Right-click device → click "Living Room Detail"
3. Device now appears on both maps with independent positions
4. Adjust position on detail map as needed
5. Both maps show the device in appropriate locations

## Testing

To test the implementation:
1. Enable edit mode (⚙️ → toggle edit mode)
2. Right-click a device
3. Click another floor name
4. Verify device appears on both floors with checkmarks
5. Drag device on each floor to verify independent positions
6. Right-click and remove from one floor
7. Verify device only shows on remaining floor

## Future Enhancements
- Visual indicator showing how many floors device is on
- Bulk operations to add/remove devices from floors
- Template positions (e.g., "use same layout across floors")
- Copy/paste device across floors
