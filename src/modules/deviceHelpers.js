// Helper functions for multi-floor device support

/**
 * Check if a device is on a specific floor
 * Supports both old (floor_id) and new (floors array) formats
 */
export function isDeviceOnFloor(device, floorId) {
    if (device.floors) {
        // New multi-floor format
        return device.floors.some(f => f.floor_id === floorId);
    } else {
        // Old single-floor format
        return device.floor_id === floorId;
    }
}

/**
 * Get device position for a specific floor
 * Returns null if device is not on that floor
 */
export function getDevicePosition(device, floorId) {
    if (device.floors) {
        // New multi-floor format
        const floorEntry = device.floors.find(f => f.floor_id === floorId);
        return floorEntry?.position || null;
    } else {
        // Old single-floor format
        return device.floor_id === floorId ? device.position : null;
    }
}

/**
 * Get all floor IDs that a device is on
 */
export function getDeviceFloors(device) {
    if (device.floors) {
        // New multi-floor format
        return device.floors.map(f => f.floor_id);
    } else {
        // Old single-floor format
        return device.floor_id ? [device.floor_id] : [];
    }
}

/**
 * Update device position on a specific floor
 * Creates floors array if needed
 */
export function updateDevicePosition(device, floorId, position) {
    if (device.floors) {
        // New multi-floor format
        const floorEntry = device.floors.find(f => f.floor_id === floorId);
        if (floorEntry) {
            floorEntry.position = position;
        }
    } else {
        // Old single-floor format
        if (device.floor_id === floorId) {
            device.position = position;
        }
    }
}

/**
 * Add device to a floor (for multi-floor support)
 */
export function addDeviceToFloor(device, floorId, position = { x: 500, y: 300 }) {
    if (device.floors) {
        // Already multi-floor format
        if (!device.floors.find(f => f.floor_id === floorId)) {
            device.floors.push({ floor_id: floorId, position });
        }
    } else {
        // Convert from single-floor to multi-floor format
        const currentFloorId = device.floor_id;
        const currentPosition = device.position;
        
        device.floors = [];
        if (currentFloorId) {
            device.floors.push({ floor_id: currentFloorId, position: currentPosition });
        }
        device.floors.push({ floor_id: floorId, position });
        
        // Remove old format fields
        delete device.floor_id;
        delete device.position;
    }
}

/**
 * Remove device from a floor
 */
export function removeDeviceFromFloor(device, floorId) {
    if (device.floors) {
        device.floors = device.floors.filter(f => f.floor_id !== floorId);
        
        // If only one floor left, convert back to single-floor format
        if (device.floors.length === 1) {
            const singleFloor = device.floors[0];
            device.floor_id = singleFloor.floor_id;
            device.position = singleFloor.position;
            delete device.floors;
        }
        // If no floors left, remove floor data entirely
        else if (device.floors.length === 0) {
            delete device.floors;
        }
    }
}

/**
 * Normalize device format after editing
 * Converts multi-floor format to single-floor format if only one floor exists
 */
export function normalizeDeviceFormat(device) {
    if (device.floors && device.floors.length === 1) {
        const singleFloor = device.floors[0];
        device.floor_id = singleFloor.floor_id;
        device.position = singleFloor.position;
        delete device.floors;
    }
}
