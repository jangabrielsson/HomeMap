# Multi-HC3 Support - Design Document

## Overview

Feature request to support multiple HC3 controllers in a single HomeMap instance. This would allow users with multiple HC3 boxes (e.g., large houses) to visualize and control devices from all controllers in one unified floor plan.

**Status:** Not implemented - Future feature  
**Priority:** Medium (requested by at least one user)  
**Complexity:** Medium-High  
**Estimated Effort:** ~48 hours (1 week)

---

## Use Case

User has multiple HC3 controllers covering different parts of a large house:
- HC3 #1 (Serial: 12345678) - Main house at 192.168.1.57
- HC3 #2 (Serial: 87654321) - Guest house at 192.168.2.57
- HC3 #3 (Serial: 11223344) - Pool area at 192.168.3.57

All devices should appear on the same floor plans with proper routing to the correct HC3 for state updates and actions.

---

## Current Architecture (Single HC3)

### Configuration
```javascript
{
  protocol: "http",
  host: "192.168.1.57",
  user: "admin",
  password: "secret"
}
```

### Device Format
```json
{
  "id": 4193,
  "name": "Living Room Light",
  "floor_id": "first",
  "position": { "x": 100, "y": 200 },
  "type": "light"
}
```

### API Management
- Single `HC3ApiManager` instance
- Single event polling loop (`EventManager`)
- Device ID is simple integer (4193)
- All API calls go to one host

---

## Proposed Architecture (Multi-HC3)

### 1. Device ID Prefixing

**Format:** `"serial:deviceId"` or `"serial-deviceId"`

```json
{
  "id": "HC3-12345678:4193",
  "name": "Living Room Light",
  "floor_id": "first",
  "position": { "x": 100, "y": 200 },
  "type": "light"
}
```

**Helper Functions:**
```javascript
// Extract HC3 serial number from device ID
extractSerial(deviceId) {
  if (typeof deviceId === 'number') return null; // Legacy format
  const match = deviceId.match(/^([^:]+):(\d+)$/);
  return match ? match[1] : null;
}

// Extract real device ID for HC3 API
extractDeviceId(deviceId) {
  if (typeof deviceId === 'number') return deviceId; // Legacy format
  const match = deviceId.match(/^([^:]+):(\d+)$/);
  return match ? parseInt(match[2]) : null;
}

// Combine serial and device ID
makeDeviceId(serial, deviceId) {
  return `${serial}:${deviceId}`;
}
```

**Migration:** Auto-detect single-HC3 configs and add default serial prefix if needed.

---

### 2. Configuration Changes

**New Settings Structure:**
```javascript
{
  hc3Controllers: {
    "HC3-12345678": {
      serial: "HC3-12345678",
      name: "Main House",           // User-friendly name
      host: "192.168.1.57",
      user: "admin",
      password: "secret1",
      protocol: "http",
      enabled: true                  // Allow disable without removing
    },
    "HC3-87654321": {
      serial: "HC3-87654321",
      name: "Guest House",
      host: "192.168.2.57",
      user: "admin",
      password: "secret2",
      protocol: "http",
      enabled: true
    }
  }
}
```

**Settings UI Changes:**
- Add "Manage HC3 Controllers" section
- List of configured controllers with add/edit/remove buttons
- Each controller shows: name, host, status (connected/disconnected)
- Test connection button per controller
- Default/primary controller selection (for manual device additions)

---

### 3. HC3ApiManager Refactoring

**Current (Single):**
```javascript
class HomeMap {
  constructor() {
    this.hc3ApiManager = new HC3ApiManager(this);
  }
}
```

**New (Multiple):**
```javascript
class HomeMap {
  constructor() {
    this.hc3Managers = new Map();     // serial -> HC3ApiManager
    this.hc3Configs = new Map();      // serial -> config
  }
  
  // Initialize all configured HC3 controllers
  async initializeHC3Controllers(controllersConfig) {
    for (const [serial, config] of Object.entries(controllersConfig)) {
      if (!config.enabled) continue;
      
      const manager = new HC3ApiManager(config);
      this.hc3Managers.set(serial, manager);
      this.hc3Configs.set(serial, config);
      
      // Test connection
      await manager.testConnection();
    }
  }
  
  // Get manager for a specific device
  getManagerForDevice(deviceId) {
    const serial = this.extractSerial(deviceId);
    if (!serial) {
      // Legacy device - use default/first HC3
      return this.hc3Managers.values().next().value;
    }
    return this.hc3Managers.get(serial);
  }
  
  // Execute action on correct HC3
  async executeDeviceAction(device, action, value) {
    const manager = this.getManagerForDevice(device.id);
    if (!manager) {
      throw new Error(`No HC3 controller found for device ${device.id}`);
    }
    
    // Extract real device ID for HC3 API
    const realDeviceId = this.extractDeviceId(device.id);
    const deviceForApi = { ...device, id: realDeviceId };
    
    return await manager.executeAction(deviceForApi, action, value);
  }
}
```

**HC3ApiManager Changes:**
```javascript
class HC3ApiManager {
  constructor(config) {  // Now takes config directly, not homeMap
    this.config = config;
    this.serial = config.serial;
    this.authLocked = false;
    this.authFailureCount = 0;
  }
  
  // All methods use this.config instead of this.homeMap.config
}
```

---

### 4. Event Polling (Multiple Loops)

**Current (Single):**
```javascript
class HomeMap {
  startEventPolling() {
    this.eventManager = new EventManager(this);
    this.eventManager.startEventPolling();
  }
}
```

**New (Multiple):**
```javascript
class HomeMap {
  constructor() {
    this.eventManagers = new Map();  // serial -> EventManager
  }
  
  startEventPolling() {
    // Start event polling for each HC3
    for (const [serial, apiManager] of this.hc3Managers) {
      const eventMgr = new EventManager(apiManager, serial);
      eventMgr.startEventPolling();
      this.eventManagers.set(serial, eventMgr);
    }
  }
  
  stopEventPolling() {
    for (const eventMgr of this.eventManagers.values()) {
      eventMgr.stopEventPolling();
    }
  }
  
  // Build dispatch table across all HC3s
  buildEventDispatchTable() {
    const allDevices = this.homemapConfig.devices;
    
    for (const [serial, eventMgr] of this.eventManagers) {
      // Filter devices for this HC3
      const serialDevices = allDevices.filter(d => 
        this.extractSerial(d.id) === serial
      );
      
      // Build dispatch table with real device IDs
      const devicesForDispatch = serialDevices.map(d => ({
        ...d,
        id: this.extractDeviceId(d.id)
      }));
      
      eventMgr.buildEventDispatch(devicesForDispatch, this.widgetManager.widgets);
    }
  }
}
```

**EventManager Changes:**
```javascript
class EventManager {
  constructor(apiManager, serial) {
    this.apiManager = apiManager;  // Specific HC3ApiManager
    this.serial = serial;           // For logging/debugging
    this.lastEventId = 0;
    this.isPolling = false;
  }
  
  async pollEvents() {
    // Poll this specific HC3's /api/refreshStates
    // Events already have correct device IDs from HC3
    // No need to prefix - dispatch table uses real IDs
  }
}
```

---

### 5. Device State Fetching

**Current:**
```javascript
// FloorManager fetches all devices from single HC3
async renderFloors() {
  const hc3Devices = await fetch('/api/devices');
  // Merge with config...
}
```

**New:**
```javascript
async renderFloors() {
  const allHC3Devices = new Map();
  
  // Fetch from each HC3
  for (const [serial, manager] of this.homeMap.hc3Managers) {
    try {
      const devices = await manager.fetchDevices();
      
      // Prefix device IDs and store
      devices.forEach(device => {
        const prefixedId = this.homeMap.makeDeviceId(serial, device.id);
        allHC3Devices.set(prefixedId, {
          ...device,
          id: prefixedId,
          _originalId: device.id,  // Keep original for API calls
          _hc3Serial: serial
        });
      });
    } catch (error) {
      console.error(`Failed to fetch devices from ${serial}:`, error);
      // Continue with other HC3s
    }
  }
  
  // Merge with config devices as before
  // ...
}
```

---

### 6. Connection Status UI

**Multiple Status Indicators:**

```html
<div class="status-multi">
  <div class="hc3-status" data-serial="HC3-12345678">
    <span class="status-dot connected"></span>
    <span class="status-label">Main House</span>
  </div>
  <div class="hc3-status" data-serial="HC3-87654321">
    <span class="status-dot connected"></span>
    <span class="status-label">Guest House</span>
  </div>
  <div class="hc3-status" data-serial="HC3-11223344">
    <span class="status-dot error"></span>
    <span class="status-label">Pool Area</span>
  </div>
</div>
```

**Or: Combined Status:**
```
Status: 2/3 HC3s Connected
```

Click to expand and show individual statuses.

---

### 7. Add Device Dialog Changes

**Select Target HC3:**
```html
<div class="form-group">
  <label>HC3 Controller</label>
  <select id="addDeviceHC3" class="form-input">
    <option value="HC3-12345678">Main House (192.168.1.57)</option>
    <option value="HC3-87654321">Guest House (192.168.2.57)</option>
    <option value="HC3-11223344">Pool Area (192.168.3.57)</option>
  </select>
</div>
```

When saving device:
```javascript
const serial = hc3Select.value;
const deviceId = deviceIdInput.value;
const fullId = this.app.makeDeviceId(serial, deviceId);

const newDevice = {
  id: fullId,  // "HC3-12345678:4193"
  name: deviceName,
  // ...
};
```

---

## Implementation Checklist

### Phase 1: Foundation (8 hours)
- [ ] Device ID helper functions (extract, make, parse)
- [ ] Config migration utility (single → multi HC3)
- [ ] Update config structure in Rust backend
- [ ] Backward compatibility tests

### Phase 2: Settings UI (8 hours)
- [ ] "Manage HC3 Controllers" section in Settings
- [ ] Add/Edit/Remove HC3 controller dialogs
- [ ] Test connection per controller
- [ ] Visual feedback for connection status

### Phase 3: Core Refactoring (16 hours)
- [ ] Refactor HC3ApiManager to take config directly
- [ ] Create HC3 manager map in HomeMap
- [ ] Routing layer: `getManagerForDevice()`
- [ ] Update all API calls to use routing layer
- [ ] Multiple event polling loops
- [ ] Event dispatch table per HC3

### Phase 4: Device Management (8 hours)
- [ ] Update device fetching to query all HC3s
- [ ] ID prefixing when merging device states
- [ ] Add Device dialog: HC3 selection dropdown
- [ ] Edit Device: show which HC3 it belongs to
- [ ] Update device rendering with prefixed IDs

### Phase 5: Status & UX (4 hours)
- [ ] Multi-HC3 connection status UI
- [ ] Per-HC3 auth failure handling
- [ ] Error messages with HC3 context
- [ ] Logging improvements (include serial in logs)

### Phase 6: Testing (8 hours)
- [ ] Test with 2+ HC3 controllers
- [ ] Test mixed devices from different HC3s
- [ ] Test connection failures (one HC3 down)
- [ ] Test auth failures per HC3
- [ ] Test event polling from multiple sources
- [ ] Test device actions routing
- [ ] Migration testing (single → multi)

---

## Edge Cases & Considerations

### Serial Number Acquisition
**Q:** How do we get the HC3 serial number?

**Options:**
1. User enters it manually in settings
2. Fetch from `/api/settings/info` endpoint (has `serialNumber` field)
3. Auto-generate from hostname/IP (e.g., `HC3-192-168-1-57`)

**Recommendation:** Option 2 - fetch automatically, allow manual override

### Duplicate Device IDs Across HC3s
**Problem:** Device #100 exists on both HC3 #1 and HC3 #2

**Solution:** Device ID prefixing solves this
- HC3 #1 Device 100 → `HC3-12345678:100`
- HC3 #2 Device 100 → `HC3-87654321:100`

### Network Latency
Different HC3s may have different response times. Use Promise.all() with timeouts.

### Authentication
Each HC3 may have different credentials. Store per-controller in config.

### Event ID Overlap
Each HC3 has its own event ID sequence. Keep `lastEventId` per EventManager instance.

---

## Alternative: Multiple HomeMap Instances

**Simpler Approach:**
- User runs multiple HomeMap windows/instances
- Each configured for one HC3
- OS-level window switching

**Pros:**
- Zero development effort
- Already works today
- Natural separation

**Cons:**
- Can't see devices from multiple HC3s on same floor plan
- Need to switch windows frequently
- More memory usage

---

## Future Enhancements

### Cross-HC3 Scenes/Automations
Allow scenes that control devices across multiple HC3s.

### HC3-to-HC3 Communication
If HC3s can communicate, could create virtual devices that sync state.

### Load Balancing
Distribute event polling load across multiple connections.

### High Availability
If one HC3 is down, continue working with others (already partially covered).

---

## Notes

- This is a significant architectural change
- Requires thorough testing with real multi-HC3 setups
- Consider beta testing with requesting user
- Could be positioned as a "Pro" feature
- Document migration path clearly for existing users

---

**Document Version:** 1.0  
**Date:** October 30, 2025  
**Author:** AI Assistant (GitHub Copilot)  
**Status:** Design/Planning - Not Implemented
