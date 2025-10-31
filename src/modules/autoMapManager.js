// autoMapManager.js - Auto-discover and map HC3 devices to HomeMap widgets
export class AutoMapManager {
    constructor(app) {
        this.app = app;
        this.mappingRules = [];
    }

    /**
     * Load and parse device mapping rules from deviceMappings.json
     */
    async loadMappingRules() {
        try {
            // Load the JSON file
            const response = await fetch('./deviceMappings.json');
            if (!response.ok) {
                throw new Error(`Failed to load deviceMappings.json: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.mappingRules = data.mappings || [];
            
            console.log('Loaded mapping rules:', this.mappingRules);
            return true;
        } catch (error) {
            console.error('Failed to load mapping rules:', error);
            return false;
        }
    }

    /**
     * Check if a device matches a mapping rule's conditions
     */
    matchesRule(device, rule) {
        // Check type
        if (device.type !== rule.type) {
            return false;
        }
        
        // Check interface condition if specified
        if (rule.interface) {
            const hasInterface = device.interfaces && device.interfaces.includes(rule.interface);
            if (!hasInterface) {
                return false;
            }
        }
        
        // Check property condition if specified (e.g., property="isLight", propertyValue=true)
        if (rule.property) {
            const devicePropValue = device.properties?.[rule.property];
            const expectedValue = rule.propertyValue;
            
            if (devicePropValue !== expectedValue) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Find the appropriate widget for an HC3 device
     */
    findWidgetForDevice(device) {
        // Try to match rules in order (more specific first)
        for (const rule of this.mappingRules) {
            if (this.matchesRule(device, rule)) {
                // Check if widget exists
                if (this.app.widgetManager.widgets[rule.widget]) {
                    return rule.widget;
                }
            }
        }
        
        return null; // No matching widget found
    }

    /**
     * Check if device is already added to config
     */
    isDeviceInConfig(deviceId) {
        return this.app.homemapConfig?.devices?.some(d => d.id === deviceId) || false;
    }

    /**
     * Calculate grid position for device index
     */
    calculateGridPosition(index, floorWidth, floorHeight) {
        const GRID_SPACING_X = 100;
        const GRID_SPACING_Y = 100;
        const START_X = 50;
        const START_Y = 50;
        const MARGIN_RIGHT = 50; // Space from right edge
        
        // Calculate how many devices fit per row based on floor width
        const availableWidth = floorWidth - START_X - MARGIN_RIGHT;
        const devicesPerRow = Math.max(1, Math.floor(availableWidth / GRID_SPACING_X));
        
        const row = Math.floor(index / devicesPerRow);
        const col = index % devicesPerRow;
        
        return {
            x: START_X + (col * GRID_SPACING_X),
            y: START_Y + (row * GRID_SPACING_Y)
        };
    }

    /**
     * Show device selection dialog with discovered devices
     */
    async showDeviceSelectionDialog(discoveredDevices, firstFloor) {
        // Get list of available widgets
        const availableWidgets = Object.keys(this.app.widgetManager.widgets).sort();
        
        // Get list of floors
        const floors = this.app.homemapConfig.floors;
        
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.className = 'slider-modal';
            
            // Count devices
            const totalCount = discoveredDevices.length;
            const mappedCount = discoveredDevices.filter(d => d.isMapped).length;
            const unmappedCount = totalCount - mappedCount;
            
            dialog.innerHTML = `
                <div class="slider-content device-discovery-dialog">
                    <h2>Auto-discover HC3 Devices</h2>
                    <p class="dialog-info">
                        Found ${totalCount} device${totalCount !== 1 ? 's' : ''} (${mappedCount} mapped, ${unmappedCount} unmapped)<br>
                        Select devices and choose floor placement
                    </p>
                    
                    <div class="device-selection-controls">
                        <button id="selectAllBtn" class="secondary-button">Select All</button>
                        <button id="deselectAllBtn" class="secondary-button">Deselect All</button>
                        <button id="selectMappedBtn" class="secondary-button">Select Mapped Only</button>
                    </div>
                    
                    <div class="device-list">
                        ${discoveredDevices.map((item, index) => `
                            <div class="device-item">
                                <input type="checkbox" class="device-checkbox" data-index="${index}" ${item.isMapped ? 'checked' : ''}>
                                <div class="device-info-full">
                                    <div class="device-name-row">
                                        <strong>${this.escapeHtml(item.device.name)}</strong>
                                        ${!item.isMapped ? '<span class="unmapped-badge">Unmapped</span>' : ''}
                                    </div>
                                    <div class="device-meta">ID: ${item.device.id} | Type: ${item.device.type}</div>
                                    <div class="device-selectors">
                                        <div class="device-widget-selector">
                                            <label>Widget:</label>
                                            <select class="widget-select" data-index="${index}">
                                                ${availableWidgets.map(w => 
                                                    `<option value="${w}" ${w === item.widget ? 'selected' : ''}>${w}</option>`
                                                ).join('')}
                                            </select>
                                        </div>
                                        <div class="device-floor-selector">
                                            <label>Floor:</label>
                                            <select class="floor-select" data-index="${index}">
                                                ${floors.map(f => 
                                                    `<option value="${f.id}" ${f.id === firstFloor.id ? 'selected' : ''}>${this.escapeHtml(f.name)}</option>`
                                                ).join('')}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="dialog-buttons">
                        <button id="cancelDiscoveryBtn" class="secondary-button">Cancel</button>
                        <button id="addDevicesBtn" class="primary-button">Add Selected Devices</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(dialog);
            
            // Setup event handlers
            const selectAllBtn = dialog.querySelector('#selectAllBtn');
            const deselectAllBtn = dialog.querySelector('#deselectAllBtn');
            const selectMappedBtn = dialog.querySelector('#selectMappedBtn');
            const cancelBtn = dialog.querySelector('#cancelDiscoveryBtn');
            const addBtn = dialog.querySelector('#addDevicesBtn');
            const checkboxes = dialog.querySelectorAll('.device-checkbox');
            
            selectAllBtn.addEventListener('click', () => {
                checkboxes.forEach(cb => cb.checked = true);
            });
            
            deselectAllBtn.addEventListener('click', () => {
                checkboxes.forEach(cb => cb.checked = false);
            });
            
            selectMappedBtn.addEventListener('click', () => {
                checkboxes.forEach(cb => {
                    const index = parseInt(cb.dataset.index);
                    cb.checked = discoveredDevices[index].isMapped;
                });
            });
            
            cancelBtn.addEventListener('click', () => {
                dialog.remove();
                resolve(null);
            });
            
            addBtn.addEventListener('click', () => {
                const widgetSelects = dialog.querySelectorAll('.widget-select');
                const floorSelects = dialog.querySelectorAll('.floor-select');
                const selectedDevices = [];
                
                checkboxes.forEach(cb => {
                    if (cb.checked) {
                        const index = parseInt(cb.dataset.index);
                        const widgetSelect = widgetSelects[index];
                        const floorSelect = floorSelects[index];
                        const selectedWidget = widgetSelect.value;
                        const selectedFloor = floorSelect.value;
                        
                        selectedDevices.push({
                            device: discoveredDevices[index].device,
                            widget: selectedWidget,
                            floorId: selectedFloor
                        });
                    }
                });
                
                dialog.remove();
                resolve(selectedDevices);
            });
            
            // Close on overlay click
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    dialog.remove();
                    resolve(null);
                }
            });
        });
    }

    /**
     * Main auto-discovery function
     */
    async autoDiscoverDevices() {
        try {
            // Check if we have floors
            if (!this.app.homemapConfig?.floors || this.app.homemapConfig.floors.length === 0) {
                alert('Please create at least one floor plan before auto-discovering devices.');
                return;
            }
            
            const firstFloor = this.app.homemapConfig.floors[0];
            
            // Load mapping rules
            console.log('Loading mapping rules...');
            const rulesLoaded = await this.loadMappingRules();
            if (!rulesLoaded) {
                alert('Failed to load device mapping rules. Please check the console for errors.');
                return;
            }
            
            // Fetch all devices from HC3
            console.log('Fetching devices from HC3...');
            const hc3Devices = await this.app.hc3ApiManager.fetchDevices();
            console.log(`Fetched ${hc3Devices.length} devices from HC3`);
            
            // Discover devices - include ALL devices, both mapped and unmapped
            const discoveredDevices = [];
            
            for (const device of hc3Devices) {
                // Skip if already in config
                if (this.isDeviceInConfig(device.id)) {
                    continue;
                }
                
                // Try to find matching widget
                const widget = this.findWidgetForDevice(device);
                
                // Add device regardless of whether it has a mapping
                discoveredDevices.push({
                    device: device,
                    widget: widget || 'genericdevice', // Default to genericdevice if no mapping
                    isMapped: widget !== null // Track if it was auto-mapped
                });
            }
            
            console.log(`Discovered ${discoveredDevices.length} new devices (including unmapped)`);
            
            // Count mapped vs unmapped
            const mappedCount = discoveredDevices.filter(d => d.isMapped).length;
            const unmappedCount = discoveredDevices.length - mappedCount;
            console.log(`Mapped: ${mappedCount}, Unmapped: ${unmappedCount}`);
            
            if (discoveredDevices.length === 0) {
                alert('No new devices found that can be automatically mapped.\n\nAll your HC3 devices are either already added or don\'t have a matching widget type.');
                return;
            }
            
            // Show selection dialog
            const selectedDevices = await this.showDeviceSelectionDialog(discoveredDevices, firstFloor);
            
            if (!selectedDevices || selectedDevices.length === 0) {
                console.log('No devices selected or dialog cancelled');
                return;
            }
            
            // Group devices by floor for proper grid positioning
            const devicesByFloor = {};
            selectedDevices.forEach(item => {
                if (!devicesByFloor[item.floorId]) {
                    devicesByFloor[item.floorId] = [];
                }
                devicesByFloor[item.floorId].push(item);
            });
            
            // Add selected devices to config, grouped by floor
            console.log(`Adding ${selectedDevices.length} devices to ${Object.keys(devicesByFloor).length} floor(s)`);
            
            for (const [floorId, floorDevices] of Object.entries(devicesByFloor)) {
                const floor = this.app.homemapConfig.floors.find(f => f.id === floorId);
                
                for (let i = 0; i < floorDevices.length; i++) {
                    const item = floorDevices[i];
                    const pos = this.calculateGridPosition(i, floor.width, floor.height);
                    
                    const newDevice = {
                        id: item.device.id,
                        name: item.device.name,
                        type: item.widget,
                        floor_id: floorId,
                        position: {
                            x: pos.x,
                            y: pos.y
                        },
                        state: {}
                    };
                    
                    this.app.homemapConfig.devices.push(newDevice);
                }
            }
            
            // Save config
            await this.app.saveConfig();
            
            // Refresh display
            await this.app.floorManager.renderFloors();
            
            // Show success message
            const floorNames = Object.keys(devicesByFloor).map(fid => {
                const floor = this.app.homemapConfig.floors.find(f => f.id === fid);
                return `${floor.name} (${devicesByFloor[fid].length})`;
            }).join(', ');
            alert(`Successfully added ${selectedDevices.length} device${selectedDevices.length !== 1 ? 's' : ''} to: ${floorNames}`);
            
        } catch (error) {
            console.error('Auto-discovery failed:', error);
            alert(`Failed to auto-discover devices:\n\n${error.message || error}`);
        }
    }

    /**
     * Escape HTML for safe display
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
