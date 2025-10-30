// Constants
const APP_VERSION = "0.1.4";
const MIN_WIDGET_VERSION = "0.1.5"; // Minimum compatible widget version

class HomeMap {
    constructor() {
        this.config = null;
        this.homemapConfig = null;
        this.dataPath = null;
        this.currentFloor = null;
        this.statusEl = document.getElementById('connectionStatus');
        this.statusDot = document.querySelector('.status-dot');
        this.floorTabsEl = document.getElementById('floorTabs');
        this.floorContainerEl = document.getElementById('floorContainer');
        this.invoke = window.__TAURI__.core.invoke;
        this.http = window.__TAURI__.http;
        this.convertFileSrc = window.__TAURI__.core.convertFileSrc;
        this.lastEventId = 0;
        this.isPolling = false;
        this.deviceIcons = new Map(); // Store device icon elements for quick updates
        this.eventDispatch = {}; // Event dispatch table
        this.iconSets = new Map(); // Cache for loaded icon sets
        this.editMode = false;
        this.draggedDevice = null;
        this.dragOffset = { x: 0, y: 0 };
        this.setupEditMode();
        this.setupSettings();
        this.setupCleanup();
        this.init();
    }

    // Helper functions for multi-floor device support
    
    /**
     * Check if a device is on a specific floor
     * Supports both old (floor_id) and new (floors array) formats
     */
    isDeviceOnFloor(device, floorId) {
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
    getDevicePosition(device, floorId) {
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
    getDeviceFloors(device) {
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
    updateDevicePosition(device, floorId, position) {
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
    addDeviceToFloor(device, floorId, position = { x: 500, y: 300 }) {
        if (device.floors) {
            // Already multi-floor format
            if (!device.floors.some(f => f.floor_id === floorId)) {
                device.floors.push({ floor_id: floorId, position });
            }
        } else if (device.floor_id) {
            // Convert from single-floor to multi-floor
            const existingFloorId = device.floor_id;
            const existingPosition = device.position;
            
            device.floors = [
                { floor_id: existingFloorId, position: existingPosition },
                { floor_id: floorId, position }
            ];
            
            // Remove old format properties
            delete device.floor_id;
            delete device.position;
        }
    }

    /**
     * Remove device from a floor
     */
    removeDeviceFromFloor(device, floorId) {
        if (device.floors) {
            device.floors = device.floors.filter(f => f.floor_id !== floorId);
            
            // If only one floor left, optionally convert back to simple format
            if (device.floors.length === 1) {
                const lastFloor = device.floors[0];
                device.floor_id = lastFloor.floor_id;
                device.position = lastFloor.position;
                delete device.floors;
            } else if (device.floors.length === 0) {
                // Remove device entirely if no floors left
                return false; // Indicate device should be removed
            }
        } else if (device.floor_id === floorId) {
            // Can't remove from single floor - would delete device
            return false;
        }
        return true;
    }

    setupCleanup() {
        // Stop polling when page unloads
        window.addEventListener('beforeunload', () => {
            this.stopEventPolling();
        });
    }

    setupEditMode() {
        const editToggle = document.getElementById('editMode');
        if (editToggle) {
            editToggle.addEventListener('change', (e) => {
                this.editMode = e.target.checked;
                this.toggleEditMode();
            });
        }
    }

    setupSettings() {
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsPanel = document.getElementById('settingsPanel');
        const closeSettings = document.getElementById('closeSettings');
        const cancelSettings = document.getElementById('cancelSettings');
        const saveSettings = document.getElementById('saveSettings');
        const browseHomemapPath = document.getElementById('browseHomemapPath');

        // Open settings
        settingsBtn.addEventListener('click', async () => {
            await this.openSettings();
        });

        // Close settings
        closeSettings.addEventListener('click', () => {
            this.closeSettings();
        });

        cancelSettings.addEventListener('click', () => {
            this.closeSettings();
        });

        // Save settings
        saveSettings.addEventListener('click', async () => {
            await this.saveSettings();
        });

        // Browse for homemapdata folder
        browseHomemapPath.addEventListener('click', async () => {
            await this.browseHomemapPath();
        });
    }

    async openSettings() {
        try {
            // Get current settings from backend
            const settings = await this.invoke('get_app_settings');
            
            // Populate form
            document.getElementById('hc3Host').value = settings.hc3_host || '';
            document.getElementById('hc3User').value = settings.hc3_user || '';
            document.getElementById('hc3Password').value = settings.hc3_password || '';
            document.getElementById('hc3Protocol').value = settings.hc3_protocol || 'http';
            document.getElementById('homemapPath').value = settings.homemap_path || '';
            
            // Show panel
            document.getElementById('settingsPanel').classList.add('open');
        } catch (error) {
            console.error('Failed to load settings:', error);
            alert('Failed to load settings: ' + error);
        }
    }

    closeSettings() {
        document.getElementById('settingsPanel').classList.remove('open');
    }

    async saveSettings() {
        try {
            const settings = {
                hc3_host: document.getElementById('hc3Host').value,
                hc3_user: document.getElementById('hc3User').value,
                hc3_password: document.getElementById('hc3Password').value,
                hc3_protocol: document.getElementById('hc3Protocol').value,
                homemap_path: document.getElementById('homemapPath').value
            };

            await this.invoke('save_app_settings', { settings });
            
            this.closeSettings();
            alert('Settings saved! Please restart the app for changes to take effect.');
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Failed to save settings: ' + error);
        }
    }

    async browseHomemapPath() {
        try {
            const path = await this.invoke('select_homemap_folder');
            if (path) {
                document.getElementById('homemapPath').value = path;
            }
        } catch (error) {
            console.error('Failed to browse folder:', error);
            alert('Failed to browse folder: ' + error);
        }
    }

    toggleEditMode() {
        // Update all device elements
        document.querySelectorAll('.device').forEach(deviceEl => {
            if (this.editMode) {
                deviceEl.classList.add('edit-mode');
            } else {
                deviceEl.classList.remove('edit-mode');
            }
        });
        
        console.log(`Edit mode: ${this.editMode ? 'ON' : 'OFF'}`);
    }

    async init() {
        try {
            console.log('Getting HC3 config...');
            this.config = await this.invoke('get_hc3_config');
            console.log('Config received:', this.config);
            
            await this.testConnection();
            console.log('HomeMap initialized with HC3:', this.config.host);
            
            // Load HomeMap configuration
            await this.loadHomeMapConfig();
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.updateStatus('error', `Configuration Error: ${error.message}`);
        }
    }

    async loadHomeMapConfig() {
        try {
            console.log('Loading HomeMap config...');
            this.dataPath = await this.invoke('get_data_path');
            console.log('Data path:', this.dataPath);
            
            this.homemapConfig = await this.invoke('get_homemap_config');
            console.log('HomeMap config:', this.homemapConfig);
            
            // Update window title and header
            await this.updateAppTitle();
            
            // Load widget definitions
            await this.loadWidgets();
            
            this.renderFloors();
            
            // Start event polling
            this.startEventPolling();
        } catch (error) {
            console.error('Failed to load HomeMap config:', error);
            this.floorContainerEl.innerHTML = `<p style="color: #f44336;">Error: ${error}</p>`;
        }
    }

    async updateAppTitle() {
        const appName = this.homemapConfig.name || 'HomeMap';
        const iconPath = this.homemapConfig.icon;
        
        // Update window title
        document.title = appName;
        
        // Update header
        const header = document.querySelector('header h1');
        if (header) {
            if (iconPath) {
                // Load custom icon from homemapdata
                try {
                    const base64Icon = await this.invoke('read_image_as_base64', { 
                        imagePath: iconPath 
                    });
                    header.innerHTML = `<img src="data:image/png;base64,${base64Icon}" alt="${appName}" style="width: 32px; height: 32px; vertical-align: middle; margin-right: 8px;"> ${appName}`;
                } catch (error) {
                    console.warn('Failed to load custom icon, using default:', error);
                    header.textContent = `🏠 ${appName}`;
                }
            } else {
                // Use default house emoji
                header.textContent = `🏠 ${appName}`;
            }
        }
    }

    /**
     * Check if a widget version is compatible with the app
     */
    isWidgetCompatible(widgetVersion) {
        if (!widgetVersion) {
            console.warn('Widget has no version specified, assuming incompatible');
            return false;
        }
        
        const parseVersion = (v) => v.split('.').map(Number);
        const [appMajor, appMinor, appPatch] = parseVersion(MIN_WIDGET_VERSION);
        const [widgetMajor, widgetMinor, widgetPatch] = parseVersion(widgetVersion);
        
        // Major version must match
        if (widgetMajor !== appMajor) return false;
        
        // Minor version must be >= minimum
        if (widgetMinor < appMinor) return false;
        if (widgetMinor > appMinor) return true;
        
        // Patch version must be >= minimum
        return widgetPatch >= appPatch;
    }

    /**
     * Load icon set and detect file extensions
     */
    async loadIconSet(iconSetName) {
        // Check cache first
        if (this.iconSets.has(iconSetName)) {
            return this.iconSets.get(iconSetName);
        }
        
        try {
            // List files in the icon set directory
            const iconSetPath = `${this.dataPath}/icons/${iconSetName}`;
            const files = await this.invoke('list_directory', { path: iconSetPath });
            
            // Build a map of icon names to full paths
            const iconMap = {};
            const supportedExtensions = ['.svg', '.png', '.jpg', '.jpeg'];
            
            for (const file of files) {
                const ext = file.substring(file.lastIndexOf('.')).toLowerCase();
                if (supportedExtensions.includes(ext)) {
                    const iconName = file.substring(0, file.lastIndexOf('.'));
                    iconMap[iconName] = `icons/${iconSetName}/${file}`;
                }
            }
            
            console.log(`Loaded icon set "${iconSetName}":`, Object.keys(iconMap));
            
            // Cache it
            this.iconSets.set(iconSetName, iconMap);
            return iconMap;
        } catch (error) {
            console.error(`Failed to load icon set "${iconSetName}":`, error);
            return {};
        }
    }

    async loadWidgets() {
        this.widgets = {};
        
        // Get unique widget types from devices
        const widgetTypes = [...new Set(this.homemapConfig.devices?.map(d => d.type) || [])];
        
        for (const type of widgetTypes) {
            try {
                const jsonContent = await this.invoke('read_widget_json', { widgetType: type });
                const widget = JSON.parse(jsonContent);
                
                // Check widget version compatibility
                if (!this.isWidgetCompatible(widget.widgetVersion)) {
                    console.error(`Widget "${type}" version ${widget.widgetVersion} is not compatible with app version ${APP_VERSION} (requires >= ${MIN_WIDGET_VERSION})`);
                    continue;
                }
                
                // Load icon set if specified
                if (widget.iconSet) {
                    widget.iconSetMap = await this.loadIconSet(widget.iconSet);
                }
                
                this.widgets[type] = widget;
                console.log(`Loaded widget definition for ${type} (version ${widget.widgetVersion})`);
            } catch (error) {
                console.error(`Failed to load widget ${type}:`, error);
            }
        }
        
        // Build event dispatch table
        this.buildEventDispatchTable();
    }

    buildEventDispatchTable() {
        this.eventDispatch = {};
        
        // Iterate through all devices and their widgets
        for (const device of this.homemapConfig.devices || []) {
            const widget = this.widgets[device.type];
            if (!widget || !widget.events) {
                continue;
            }
            
            // For each event type in the widget definition
            for (const [eventType, eventDef] of Object.entries(widget.events)) {
                // Initialize event type in dispatch table if not exists
                if (!this.eventDispatch[eventType]) {
                    this.eventDispatch[eventType] = {
                        idPath: eventDef.id, // JSONPath to extract device id from event
                        idMap: new Map() // Map of device id -> {device, widget, eventDef}
                    };
                }
                
                // Add device to the idMap for this event type
                this.eventDispatch[eventType].idMap.set(device.id, {
                    device: device,
                    widget: widget,
                    eventDef: eventDef
                });
            }
        }
        
        console.log('Event dispatch table built:', 
            Object.keys(this.eventDispatch).map(k => `${k}: ${this.eventDispatch[k].idMap.size} devices`));
    }

    renderFloors() {
        if (!this.homemapConfig || !this.homemapConfig.floors || this.homemapConfig.floors.length === 0) {
            this.floorContainerEl.innerHTML = '<p>No floors configured</p>';
            return;
        }

        // Clear containers
        this.floorTabsEl.innerHTML = '';
        this.floorContainerEl.innerHTML = '';

        // Create tabs and floor views
        this.homemapConfig.floors.forEach((floor, index) => {
            // Create tab
            const tab = document.createElement('button');
            tab.className = 'tab';
            if (index === 0) tab.classList.add('active');
            tab.textContent = floor.name;
            tab.onclick = () => this.showFloor(floor.id);
            this.floorTabsEl.appendChild(tab);

            // Create floor view
            const floorView = document.createElement('div');
            floorView.className = 'floor-view';
            floorView.id = `floor-${floor.id}`;
            if (index === 0) floorView.classList.add('active');

            // Create image container
            const imageContainer = document.createElement('div');
            imageContainer.className = 'floor-image-container';
            imageContainer.style.position = 'relative';
            imageContainer.style.display = 'inline-block';
            
            // Add right-click handler for "Add Device"
            imageContainer.addEventListener('contextmenu', (e) => {
                if (!this.editMode) return; // Only in edit mode
                
                // Check if we clicked on empty space (not on a device)
                if (e.target.closest('.device')) {
                    return; // Device will handle its own context menu
                }
                
                e.preventDefault();
                
                // Calculate position relative to the image
                const rect = imageContainer.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                this.showAddDeviceMenu(e.clientX, e.clientY, floor.id, { x, y });
            });

            // Create image
            const img = document.createElement('img');
            img.className = 'floor-image';
            img.alt = floor.name;
            
            // Load image via backend as base64
            const imagePath = `${this.dataPath}/${floor.image}`;
            console.log('Loading image from:', imagePath);
            
            this.invoke('read_image_as_base64', { imagePath: imagePath })
                .then(base64Data => {
                    console.log('Successfully loaded image:', floor.name);
                    img.src = base64Data;
                    
                    // Once image loads, render devices on it
                    img.onload = () => {
                        this.renderDevicesOnFloor(floor.id, imageContainer, img);
                    };
                })
                .catch(error => {
                    console.error('Failed to load image:', error);
                    floorView.innerHTML = `<p style="color: #f44336;">Failed to load image: ${floor.image}<br>Error: ${error}</p>`;
                });

            imageContainer.appendChild(img);
            floorView.appendChild(imageContainer);
            this.floorContainerEl.appendChild(floorView);
        });

        // Set current floor
        if (this.homemapConfig.floors.length > 0) {
            this.currentFloor = this.homemapConfig.floors[0].id;
        }
    }

    renderDevicesOnFloor(floorId, container, img) {
        // Filter devices that are on this floor (supports both formats)
        const devices = this.homemapConfig.devices?.filter(d => this.isDeviceOnFloor(d, floorId)) || [];
        
        devices.forEach(device => {
            // Get position for this specific floor
            const position = this.getDevicePosition(device, floorId);
            if (!position) {
                console.warn(`Device ${device.id} has no position for floor ${floorId}`);
                return;
            }
            
            const deviceEl = document.createElement('div');
            deviceEl.className = 'device';
            deviceEl.id = `device-${device.id}`;
            deviceEl.style.position = 'absolute';
            deviceEl.setAttribute('data-tooltip', `${device.name} (ID: ${device.id})`);
            
            // Calculate position as percentage of image dimensions
            const xPercent = (position.x / img.naturalWidth) * 100;
            const yPercent = (position.y / img.naturalHeight) * 100;
            deviceEl.style.left = `${xPercent}%`;
            deviceEl.style.top = `${yPercent}%`;
            deviceEl.style.transform = 'translate(-50%, -50%)';
            
            // Create icon placeholder
            const icon = document.createElement('img');
            icon.className = 'device-icon';
            icon.style.width = '32px';
            icon.style.height = '32px';
            icon.alt = device.name;
            
            // Create text element for value display
            const textEl = document.createElement('div');
            textEl.className = 'device-text';
            textEl.style.display = 'none'; // Hidden by default
            
            // Store icon and text elements for event-driven updates
            this.deviceIcons.set(device.id, { 
                element: icon, 
                textElement: textEl,
                device: device,
                deviceElement: deviceEl,
                container: container,
                img: img
            });
            
            // Add drag functionality
            this.setupDeviceDrag(deviceEl, device, container, img);
            
            // Add click action handling
            this.setupDeviceClick(deviceEl, device);
            
            // Add context menu (right-click)
            this.setupDeviceContextMenu(deviceEl, device);
            
            // Load initial icon based on widget definition
            this.updateDeviceIcon(device, icon, textEl);
            
            deviceEl.appendChild(icon);
            deviceEl.appendChild(textEl);
            container.appendChild(deviceEl);
        });
    }

    setupDeviceDrag(deviceEl, device, container, img) {
        let isDragging = false;
        let startX, startY;
        
        deviceEl.addEventListener('mousedown', (e) => {
            if (!this.editMode) return;
            
            isDragging = true;
            deviceEl.classList.add('dragging');
            
            // Get current position
            const rect = container.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging || !this.editMode) return;
            
            const rect = container.getBoundingClientRect();
            const imgRect = img.getBoundingClientRect();
            
            // Calculate position relative to image
            const x = e.clientX - imgRect.left;
            const y = e.clientY - imgRect.top;
            
            // Convert to percentage
            const xPercent = (x / imgRect.width) * 100;
            const yPercent = (y / imgRect.height) * 100;
            
            // Update position
            deviceEl.style.left = `${xPercent}%`;
            deviceEl.style.top = `${yPercent}%`;
        });
        
        document.addEventListener('mouseup', async (e) => {
            if (!isDragging) return;
            
            isDragging = false;
            deviceEl.classList.remove('dragging');
            
            if (this.editMode) {
                // Calculate new position in image coordinates
                const rect = container.getBoundingClientRect();
                const imgRect = img.getBoundingClientRect();
                
                const x = e.clientX - imgRect.left;
                const y = e.clientY - imgRect.top;
                
                // Convert from display size to natural image size
                const naturalX = (x / imgRect.width) * img.naturalWidth;
                const naturalY = (y / imgRect.height) * img.naturalHeight;
                
                // Update device position on current floor
                const newPosition = { x: Math.round(naturalX), y: Math.round(naturalY) };
                this.updateDevicePosition(device, this.currentFloorId, newPosition);
                
                console.log(`Device ${device.id} moved to (${newPosition.x}, ${newPosition.y}) on floor ${this.currentFloorId}`);
                
                // Save config
                await this.saveConfig();
            }
        });
    }

    setupDeviceContextMenu(deviceEl, device) {
        deviceEl.addEventListener('contextmenu', (e) => {
            console.log('Context menu triggered, editMode:', this.editMode);
            if (!this.editMode) {
                console.log('Not in edit mode, ignoring right-click');
                return; // Only show context menu in edit mode
            }
            
            e.preventDefault();
            console.log('Showing context menu at', e.clientX, e.clientY);
            this.showContextMenu(e.clientX, e.clientY, device);
        });
    }

    showContextMenu(x, y, device) {
        const contextMenu = document.getElementById('contextMenu');
        
        // Store device reference for Edit/Delete actions
        this.contextMenuDevice = device;
        
        // Setup Edit and Delete handlers
        const editBtn = document.getElementById('contextMenuEdit');
        const deleteBtn = document.getElementById('contextMenuDelete');
        
        // Remove old listeners by cloning
        const newEditBtn = editBtn.cloneNode(true);
        const newDeleteBtn = deleteBtn.cloneNode(true);
        editBtn.replaceWith(newEditBtn);
        deleteBtn.replaceWith(newDeleteBtn);
        
        newEditBtn.addEventListener('click', () => {
            this.hideContextMenu();
            this.showEditDeviceDialog(device);
        });
        
        newDeleteBtn.addEventListener('click', () => {
            this.hideContextMenu();
            this.showDeleteDeviceDialog(device);
        });
        
        // Position the menu
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        contextMenu.style.display = 'block';
        
        // Hide menu when clicking elsewhere
        const hideOnClick = (e) => {
            if (!contextMenu.contains(e.target)) {
                this.hideContextMenu();
                document.removeEventListener('click', hideOnClick);
            }
        };
        
        // Delay to avoid immediate close
        setTimeout(() => {
            document.addEventListener('click', hideOnClick);
        }, 10);
    }

    hideContextMenu() {
        const contextMenu = document.getElementById('contextMenu');
        contextMenu.style.display = 'none';
        
        const addDeviceMenu = document.getElementById('addDeviceMenu');
        if (addDeviceMenu) {
            addDeviceMenu.style.display = 'none';
        }
    }

    showAddDeviceMenu(x, y, floorId, position) {
        const menu = document.getElementById('addDeviceMenu');
        
        // Store context for the add dialog
        this.addDeviceContext = { floorId, position };
        
        const addBtn = document.getElementById('addDeviceMenuItem');
        
        // Remove old listener
        const newAddBtn = addBtn.cloneNode(true);
        addBtn.replaceWith(newAddBtn);
        
        newAddBtn.addEventListener('click', () => {
            this.hideContextMenu();
            this.showAddDeviceDialog(floorId, position);
        });
        
        // Position the menu
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.display = 'block';
        
        // Hide menu when clicking elsewhere
        const hideOnClick = (e) => {
            if (!menu.contains(e.target)) {
                this.hideContextMenu();
                document.removeEventListener('click', hideOnClick);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', hideOnClick);
        }, 10);
    }

    showAddDeviceDialog(floorId, position) {
        const modal = document.createElement('div');
        modal.className = 'slider-modal';
        
        // Build floor checkboxes
        const floorsHtml = this.homemapConfig.floors.map(floor => {
            const isChecked = floor.id === floorId; // Default to the floor we clicked on
            return `
                <div class="floor-checkbox">
                    <input type="checkbox" id="add-floor-${floor.id}" value="${floor.id}" ${isChecked ? 'checked' : ''}>
                    <label for="add-floor-${floor.id}">${floor.name}</label>
                </div>
            `;
        }).join('');
        
        // Build widget type options
        const widgetOptions = Object.keys(this.widgets).map(type => {
            return `<option value="${type}">${type}</option>`;
        }).join('');
        
        modal.innerHTML = `
            <div class="slider-content edit-dialog">
                <h3>Add Device</h3>
                <div class="edit-form">
                    <div class="form-group">
                        <label>Device ID</label>
                        <input type="number" id="addDeviceId" class="form-input" placeholder="Enter HC3 device ID">
                    </div>
                    <div class="form-group">
                        <label>Name</label>
                        <input type="text" id="addDeviceName" class="form-input" placeholder="Enter device name">
                    </div>
                    <div class="form-group">
                        <label>Type</label>
                        <select id="addDeviceType" class="form-input">
                            <option value="">Select widget type</option>
                            ${widgetOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Floors</label>
                        <div class="floors-list">
                            ${floorsHtml}
                        </div>
                    </div>
                </div>
                <div class="slider-buttons">
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-apply">Add Device</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const idInput = modal.querySelector('#addDeviceId');
        const nameInput = modal.querySelector('#addDeviceName');
        const typeSelect = modal.querySelector('#addDeviceType');
        
        // Add button
        modal.querySelector('.btn-apply').addEventListener('click', async () => {
            const deviceId = parseInt(idInput.value);
            const deviceName = nameInput.value.trim();
            const deviceType = typeSelect.value;
            const selectedFloors = Array.from(modal.querySelectorAll('.floor-checkbox input:checked'))
                .map(cb => parseInt(cb.value));
            
            if (!deviceId || isNaN(deviceId)) {
                alert('Please enter a valid device ID');
                return;
            }
            
            if (!deviceName) {
                alert('Device name cannot be empty');
                return;
            }
            
            if (!deviceType) {
                alert('Please select a widget type');
                return;
            }
            
            if (selectedFloors.length === 0) {
                alert('Device must be on at least one floor');
                return;
            }
            
            // Check if device ID already exists
            if (this.homemapConfig.devices.find(d => d.id === deviceId)) {
                alert(`Device with ID ${deviceId} already exists`);
                return;
            }
            
            // Create new device with multi-floor format
            const newDevice = {
                id: deviceId,
                name: deviceName,
                type: deviceType,
                floors: selectedFloors.map(fId => ({
                    floor_id: fId,
                    position: fId === floorId ? position : { x: 500, y: 300 } // Use click position for current floor
                }))
            };
            
            // Add to config
            this.homemapConfig.devices.push(newDevice);
            
            await this.saveConfig();
            await this.loadDevices(); // Reload to fetch from HC3
            this.renderFloors();
            
            document.body.removeChild(modal);
        });
        
        // Cancel button
        modal.querySelector('.btn-cancel').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    showEditDeviceDialog(device) {
        const modal = document.createElement('div');
        modal.className = 'slider-modal';
        
        // Get current device floors
        const deviceFloors = this.getDeviceFloors(device);
        
        // Build floor checkboxes
        const floorsHtml = this.homemapConfig.floors.map(floor => {
            const isChecked = deviceFloors.includes(floor.id);
            return `
                <div class="floor-checkbox">
                    <input type="checkbox" id="floor-${floor.id}" value="${floor.id}" ${isChecked ? 'checked' : ''}>
                    <label for="floor-${floor.id}">${floor.name}</label>
                </div>
            `;
        }).join('');
        
        // Build widget type options
        const widgetOptions = Object.keys(this.widgets).map(type => {
            const selected = type === device.type ? 'selected' : '';
            return `<option value="${type}" ${selected}>${type}</option>`;
        }).join('');
        
        modal.innerHTML = `
            <div class="slider-content edit-dialog">
                <h3>Edit Device</h3>
                <div class="edit-form">
                    <div class="form-group">
                        <label>Name</label>
                        <input type="text" id="editDeviceName" value="${device.name}" class="form-input">
                    </div>
                    <div class="form-group">
                        <label>Type</label>
                        <select id="editDeviceType" class="form-input">
                            ${widgetOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Floors</label>
                        <div class="floors-list">
                            ${floorsHtml}
                        </div>
                    </div>
                </div>
                <div class="slider-buttons">
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-apply">Save</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const nameInput = modal.querySelector('#editDeviceName');
        const typeSelect = modal.querySelector('#editDeviceType');
        
        // Save button
        modal.querySelector('.btn-apply').addEventListener('click', async () => {
            const newName = nameInput.value.trim();
            const newType = typeSelect.value;
            const selectedFloors = Array.from(modal.querySelectorAll('.floor-checkbox input:checked'))
                .map(cb => parseInt(cb.value));
            
            if (!newName) {
                alert('Device name cannot be empty');
                return;
            }
            
            if (selectedFloors.length === 0) {
                alert('Device must be on at least one floor');
                return;
            }
            
            // Update device properties
            const configDevice = this.homemapConfig.devices.find(d => d.id === device.id);
            if (configDevice) {
                const typeChanged = configDevice.type !== newType;
                
                configDevice.name = newName;
                configDevice.type = newType;
                device.name = newName;
                device.type = newType;
                
                // Update floor assignments
                const currentFloors = this.getDeviceFloors(device);
                
                // Remove from floors no longer selected
                for (const floorId of currentFloors) {
                    if (!selectedFloors.includes(floorId)) {
                        this.removeDeviceFromFloor(device, floorId);
                    }
                }
                
                // Add to newly selected floors
                for (const floorId of selectedFloors) {
                    if (!currentFloors.includes(floorId)) {
                        const position = this.getDevicePosition(device, this.currentFloorId) || { x: 500, y: 300 };
                        this.addDeviceToFloor(device, floorId, position);
                    }
                }
                
                await this.saveConfig();
                
                // If type changed, reload to update widget
                if (typeChanged) {
                    console.log('Device type changed, reloading...');
                    await this.loadDevices();
                    this.renderFloors();
                } else {
                    this.renderFloors();
                }
            }
            
            document.body.removeChild(modal);
        });
        
        // Cancel button
        modal.querySelector('.btn-cancel').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    showDeleteDeviceDialog(device) {
        const modal = document.createElement('div');
        modal.className = 'slider-modal';
        
        const deviceFloors = this.getDeviceFloors(device);
        const floorsText = this.homemapConfig.floors
            .filter(f => deviceFloors.includes(f.id))
            .map(f => f.name)
            .join(', ');
        
        modal.innerHTML = `
            <div class="slider-content">
                <h3>Delete Device</h3>
                <p style="color: #e0e0e0; margin: 20px 0;">
                    Are you sure you want to delete <strong>${device.name}</strong>?
                </p>
                <p style="color: #888; font-size: 14px; margin-bottom: 20px;">
                    This will remove the device from floors: ${floorsText}
                </p>
                <div class="slider-buttons">
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-delete" style="background: #e74c3c;">Delete</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Delete button
        modal.querySelector('.btn-delete').addEventListener('click', async () => {
            // Remove device from all floors
            for (const floorId of deviceFloors) {
                this.removeDeviceFromFloor(device, floorId);
            }
            
            // Remove from devices array
            const index = this.homemapConfig.devices.findIndex(d => d.id === device.id);
            if (index !== -1) {
                this.homemapConfig.devices.splice(index, 1);
            }
            
            await this.saveConfig();
            this.renderFloors();
            
            document.body.removeChild(modal);
        });
        
        // Cancel button
        modal.querySelector('.btn-cancel').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    async moveDeviceToFloor(device, targetFloor) {
        try {
            // Find the device in the config's devices array
            const configDevice = this.homemapConfig.devices.find(d => d.id === device.id);
            
            if (!configDevice) {
                console.error('Device not found in config:', device.id);
                return;
            }
            
            const oldFloorId = configDevice.floor_id;
            
            // Update the device's floor_id
            configDevice.floor_id = targetFloor.id;
            
            // Reset position to center of new floor
            configDevice.position = { x: 500, y: 300 };
            
            console.log(`Moved device ${device.id} from ${oldFloorId} to ${targetFloor.id}`);
            
            // Save config
            await this.saveConfig();
            
            // Re-render all floors to update the UI
            this.renderFloors();
            
            // Show the target floor to see the moved device
            this.showFloor(targetFloor.id);
            
        } catch (error) {
            console.error('Failed to move device:', error);
            alert('Failed to move device: ' + error.message);
        }
    }

    setupDeviceClick(deviceEl, device) {
        deviceEl.addEventListener('click', async (e) => {
            // Don't trigger action in edit mode (for dragging)
            if (this.editMode) return;
            
            // Get widget definition
            const widget = this.widgets[device.type];
            if (!widget || !widget.ui) {
                return; // No UI defined for this widget - clicking does nothing
            }
            
            const ui = widget.ui;
            
            // Handle new composable rows format
            if (ui.rows) {
                this.showComposableDialog(device, widget, ui);
                return;
            }
            
            // Legacy: Handle slider type UI
            if (ui.type === 'slider') {
                this.showSlider(device, widget, ui);
                return;
            }
            
            // Legacy: Handle buttons type UI
            if (ui.type === 'buttons') {
                this.showButtonsDialog(device, widget, ui);
                return;
            }
        });
    }

    async showComposableDialog(device, widget, ui) {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'slider-modal';
        
        // Build HTML for each row
        let rowsHtml = '';
        for (const row of ui.rows) {
            let elementsHtml = '';
            
            for (const element of row.elements) {
                switch (element.type) {
                    case 'button':
                        elementsHtml += `<button class="primary-button" data-action="${element.action}">${element.label}</button>`;
                        break;
                    
                    case 'label':
                        elementsHtml += `<label class="ui-label">${element.text}</label>`;
                        break;
                    
                    case 'slider':
                        const currentValue = device.state?.[element.property] || element.min || 0;
                        elementsHtml += `
                            <div class="slider-container-inline" data-property="${element.property}" data-action="${element.action}" data-min="${element.min}" data-max="${element.max}">
                                <input type="range" min="${element.min}" max="${element.max}" value="${currentValue}" class="inline-slider">
                                <span class="slider-value-inline">${currentValue}</span>
                            </div>
                        `;
                        break;
                }
            }
            
            rowsHtml += `<div class="ui-row">${elementsHtml}</div>`;
        }
        
        modal.innerHTML = `
            <div class="slider-content">
                <h3>${device.name}</h3>
                ${rowsHtml}
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Setup slider listeners - execute action on release
        modal.querySelectorAll('.slider-container-inline').forEach(container => {
            const slider = container.querySelector('.inline-slider');
            const valueDisplay = container.querySelector('.slider-value-inline');
            const actionName = container.dataset.action;
            const action = widget.actions[actionName];
            
            // Update display as slider moves
            slider.addEventListener('input', () => {
                const value = parseInt(slider.value);
                valueDisplay.textContent = value;
            });
            
            // Execute action when slider is released
            const executeSliderAction = async () => {
                const value = parseInt(slider.value);
                
                if (!action) {
                    console.error(`Action ${actionName} not found in widget`);
                    return;
                }
                
                try {
                    console.log(`Executing slider action ${actionName} with value ${value}`);
                    await this.executeAction(device, action, value);
                    
                    // Refresh device state after a short delay
                    setTimeout(async () => {
                        await this.updateDeviceIcon(device);
                    }, 500);
                } catch (error) {
                    console.error(`Failed to execute slider action ${actionName}:`, error);
                    alert(`Failed: ${error.message}`);
                }
            };
            
            slider.addEventListener('mouseup', executeSliderAction);
            slider.addEventListener('touchend', executeSliderAction);
        });
        
        // Setup button listeners - execute immediately and close dialog
        modal.querySelectorAll('.primary-button[data-action]').forEach(button => {
            button.addEventListener('click', async () => {
                const actionName = button.dataset.action;
                const action = widget.actions[actionName];
                
                if (!action) {
                    console.error(`Action ${actionName} not found in widget`);
                    return;
                }
                
                try {
                    await this.executeAction(device, action);
                    document.body.removeChild(modal);
                    
                    // Refresh device state after a short delay
                    setTimeout(async () => {
                        await this.updateDeviceIcon(device);
                    }, 500);
                } catch (error) {
                    console.error(`Failed to execute action ${actionName}:`, error);
                    alert(`Failed: ${error.message}`);
                }
            });
        });
        
        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    async showButtonsDialog(device, widget, ui) {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'slider-modal'; // Reuse slider modal styling
        
        const buttonsHtml = ui.buttons.map(btn => 
            `<button class="primary-button" data-action="${btn.action}">${btn.label}</button>`
        ).join('');
        
        modal.innerHTML = `
            <div class="slider-content">
                <h3>${device.name}</h3>
                <div style="display: flex; flex-direction: column; gap: 10px; margin: 20px 0;">
                    ${buttonsHtml}
                </div>
                <button class="secondary-button" id="cancelButton">Cancel</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add button click handlers
        ui.buttons.forEach(btn => {
            const buttonEl = modal.querySelector(`[data-action="${btn.action}"]`);
            buttonEl.addEventListener('click', async () => {
                try {
                    const action = widget.actions[btn.action];
                    if (action) {
                        await this.executeAction(device, action);
                        document.body.removeChild(modal);
                        
                        // Refresh device icon after action
                        const deviceInfo = this.deviceIcons.get(device.id);
                        if (deviceInfo) {
                            setTimeout(() => {
                                this.updateDeviceIcon(device, deviceInfo.element, deviceInfo.textElement);
                            }, 500);
                        }
                    }
                } catch (error) {
                    console.error(`Failed to execute action ${btn.action}:`, error);
                    alert(`Failed: ${error.message}`);
                }
            });
        });
        
        // Cancel button
        modal.querySelector('#cancelButton').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    async showSlider(device, widget, ui) {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'slider-modal';
        
        // Get current device value from state
        let currentValue = device.state?.[ui.property] || ui.min || 0;
        
        modal.innerHTML = `
            <div class="slider-content">
                <h3>${device.name}</h3>
                <div class="slider-value">${currentValue}%</div>
                <div class="slider-container">
                    <input type="range" min="${ui.min}" max="${ui.max}" value="${currentValue}" id="dimmerSlider">
                </div>
                <div class="slider-buttons">
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-set">Set</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const slider = modal.querySelector('#dimmerSlider');
        const valueDisplay = modal.querySelector('.slider-value');
        const cancelBtn = modal.querySelector('.btn-cancel');
        const setBtn = modal.querySelector('.btn-set');
        
        // Update value display as slider moves
        slider.addEventListener('input', (e) => {
            valueDisplay.textContent = `${e.target.value}%`;
        });
        
        // Cancel button
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Set button
        setBtn.addEventListener('click', async () => {
            const value = parseInt(slider.value);
            try {
                const action = widget.actions[ui.action];
                if (action) {
                    await this.executeAction(device, action, value);
                    document.body.removeChild(modal);
                    
                    // Refresh device icon after action
                    const deviceInfo = this.deviceIcons.get(device.id);
                    if (deviceInfo) {
                        setTimeout(() => {
                            this.updateDeviceIcon(device, deviceInfo.element, deviceInfo.textElement);
                        }, 500);
                    }
                }
            } catch (error) {
                console.error(`Failed to set value for device ${device.id}:`, error);
                alert(`Failed to set value: ${error.message}`);
            }
        });
        
        // Click outside to cancel
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    async executeAction(device, action, value = null) {
        // Build API URL by replacing ${id} with device.id
        const apiUrl = action.api.replace('${id}', device.id);
        const fullUrl = `${this.config.protocol}://${this.config.host}${apiUrl}`;
        
        console.log(`Executing action: ${action.method} ${fullUrl}`);
        
        // Prepare request body if action has a body defined
        let requestBody = null;
        if (action.body) {
            // Deep clone the body and replace ${value} with actual value if provided
            const bodyStr = JSON.stringify(action.body);
            if (value !== null) {
                // Replace "${value}" with actual number (no quotes)
                const replacedStr = bodyStr.replace(/"?\$\{value\}"?/g, value);
                requestBody = JSON.parse(replacedStr);
            } else {
                requestBody = JSON.parse(bodyStr);
            }
            console.log('Request body object:', requestBody);
        }
        
        // Make the API call using Tauri HTTP plugin
        const fetchOptions = {
            method: action.method || 'GET',
            headers: {
                'Authorization': 'Basic ' + btoa(`${this.config.user}:${this.config.password}`),
                'X-Fibaro-Version': '2',
                'Accept-Language': 'en'
            }
        };
        
        if (requestBody) {
            const bodyJson = JSON.stringify(requestBody);
            console.log('Sending body:', bodyJson);
            fetchOptions.headers['Content-Type'] = 'application/json';
            fetchOptions.body = bodyJson;
        }
        
        const response = await this.http.fetch(fullUrl, fetchOptions);
        
        console.log(`Action response - Status: ${response.status}, OK: ${response.ok}`);
        console.log('Response headers:', response.headers);
        console.log('Response data:', response.data);
        
        if (!response.ok) {
            // Try to get error details
            let errorDetail = response.statusText || 'Bad Request';
            
            // Try to read response text if available
            try {
                const responseText = await response.text();
                console.error('Response text:', responseText);
                if (responseText) {
                    errorDetail += ` - ${responseText}`;
                }
            } catch (e) {
                console.warn('Could not read response text');
            }
            
            if (response.data) {
                errorDetail += ` - Data: ${JSON.stringify(response.data)}`;
            }
            
            console.error('Full error response:', response);
            throw new Error(`HTTP ${response.status}: ${errorDetail}`);
        }
        
        console.log(`Action executed successfully for device ${device.id}`);
    }

    async saveConfig() {
        try {
            const configJson = JSON.stringify(this.homemapConfig, null, 4);
            await this.invoke('save_config', { configJson });
            console.log('Config saved successfully');
        } catch (error) {
            console.error('Failed to save config:', error);
            alert(`Failed to save config: ${error}`);
        }
    }

    async updateDeviceIcon(device, iconElement, textElement) {
        const widget = this.widgets[device.type];
        if (!widget) {
            console.warn(`No widget definition for device ${device.id} (type: ${device.type})`);
            return;
        }
        
        // Initialize device state if not exists
        if (!device.state) {
            device.state = { ...widget.state };
        }
        
        // Fetch current device status from HC3 using getters
        if (widget.getters) {
            try {
                for (const [stateProp, getter] of Object.entries(widget.getters)) {
                    if (getter.api) {
                        const api = getter.api.replace('${id}', device.id);
                        const url = `${this.config.protocol}://${this.config.host}${api}`;
                        
                        const response = await this.http.fetch(url, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Basic ${btoa(`${this.config.user}:${this.config.password}`)}`
                            }
                        });

                        if (response.ok) {
                            const text = await response.text();
                            const data = JSON.parse(text);
                            
                            // Debug: Log the raw data to see structure
                            console.log(`Raw API data for device ${device.id}, getter path '${getter.path}':`, JSON.stringify(data).substring(0, 500));
                            
                            // Extract value using path
                            let value = this.getPropertyValue(data, getter.path);
                            console.log(`Extracted value before unwrapping for ${stateProp}:`, value, `(type: ${typeof value})`);
                            
                            // HC3 sometimes returns objects like {value: X, path: "...", source: "HC"}
                            // If we got an object with a 'value' property, unwrap it
                            if (value && typeof value === 'object' && !Array.isArray(value)) {
                                console.log(`Object structure:`, Object.keys(value), value);
                                if ('value' in value) {
                                    console.log(`Unwrapping HC3 value object for ${stateProp} - has 'value' key`);
                                    value = value.value;
                                } else {
                                    console.log(`Object does NOT have 'value' key, keys are:`, Object.keys(value));
                                }
                            }
                            
                            device.state[stateProp] = value;
                            console.log(`Set device ${device.id} state.${stateProp} =`, value, `(type: ${typeof value})`);
                        } else {
                            console.error(`Failed to fetch status for device ${device.id}: HTTP ${response.status}`);
                        }
                    }
                }
                
                // Render with updated state
                await this.renderDevice(device, widget, iconElement, textElement);
            } catch (error) {
                console.error(`Error fetching status for device ${device.id}:`, error);
            }
        }
    }

    async renderDevice(device, widget, iconElement, textElement) {
        if (!widget.render) {
            console.warn(`No render definition for device ${device.id}`);
            return;
        }
        
        const state = device.state || {};
        
        // Render icon
        if (widget.render.icon) {
            const iconName = this.getIconFromRenderDef(state, widget.render.icon);
            if (iconName && widget.iconSetMap) {
                const iconPath = widget.iconSetMap[iconName];
                if (iconPath) {
                    await this.loadDeviceIcon(iconElement, iconPath);
                } else {
                    console.warn(`Icon "${iconName}" not found in icon set for device ${device.id}`);
                }
            }
        }
        
        // Render subtext
        if (widget.render.subtext && textElement) {
            const shouldShow = widget.render.subtext.visible 
                ? this.evaluateCondition(state, widget.render.subtext.visible)
                : true;
            
            if (shouldShow) {
                const text = this.interpolateTemplate(widget.render.subtext.template, state);
                textElement.textContent = text;
                textElement.style.display = 'block';
            } else {
                textElement.style.display = 'none';
            }
        }
    }

    getIconFromRenderDef(state, iconDef) {
        switch (iconDef.type) {
            case 'static':
                return iconDef.icon;
            
            case 'conditional':
                const propValue = state[iconDef.property];
                console.log(`Evaluating conditional icon, property "${iconDef.property}", value:`, propValue, 'state:', state);
                
                for (const condition of iconDef.conditions) {
                    // Create evaluation context with the specific property value
                    const evalContext = { [iconDef.property]: propValue };
                    if (this.evaluateCondition(evalContext, condition.when)) {
                        return condition.icon;
                    }
                }
                return null;
            
            default:
                console.warn(`Unknown icon type: ${iconDef.type}`);
                return null;
        }
    }

    evaluateCondition(state, conditionStr) {
        let expr = conditionStr; // Declare at function scope for error handler
        try {
            // Simple evaluation - replace state properties in condition
            
            console.log(`Evaluating condition "${conditionStr}" with state:`, JSON.stringify(state));
            console.log(`State has keys:`, Object.keys(state));
            
            // Check if state is empty
            if (Object.keys(state).length === 0) {
                console.error(`State object is empty! Cannot evaluate condition.`);
                return false;
            }
            
            for (const [key, value] of Object.entries(state)) {
                const regex = new RegExp(`\\b${key}\\b`, 'g');
                
                console.log(`  Processing key "${key}" (${typeof value}), value:`, value);
                
                // Handle different value types
                if (value === undefined) {
                    console.warn(`Value for "${key}" is undefined, replacing with undefined`);
                    expr = expr.replace(regex, 'undefined');
                } else if (value === null) {
                    expr = expr.replace(regex, 'null');
                } else if (typeof value === 'boolean') {
                    expr = expr.replace(regex, String(value));
                } else if (typeof value === 'number') {
                    expr = expr.replace(regex, String(value));
                } else if (typeof value === 'string') {
                    expr = expr.replace(regex, `"${value}"`);
                } else {
                    // For objects/arrays, try JSON.stringify or skip
                    console.warn(`Skipping complex value for "${key}":`, typeof value, value);
                    continue;
                }
                
                console.log(`  After replacing "${key}": "${expr}"`);
            }
            
            console.log(`Final expression: "${expr}"`);
            
            if (expr === conditionStr) {
                console.error(`No replacements were made! Expression unchanged: "${expr}"`);
                return false;
            }
            
            // eslint-disable-next-line no-eval
            const result = eval(expr);
            console.log(`Evaluation result: ${result}`);
            return result;
        } catch (error) {
            console.error(`Error evaluating condition "${conditionStr}":`, error);
            console.error(`  Final expression was: "${expr}"`);
            return false;
        }
    }

    interpolateTemplate(template, state) {
        let result = template;
        for (const [key, value] of Object.entries(state)) {
            result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
        }
        return result;
    }

    getPropertyValue(obj, path) {
        // Simple property path resolver (e.g., "properties.value")
        return path.split('.').reduce((current, prop) => current?.[prop], obj);
    }

    async loadDeviceIcon(iconElement, iconPath) {
        const fullPath = `${this.dataPath}/${iconPath}`;
        console.log(`Loading icon from: ${fullPath}`);
        try {
            const base64Icon = await this.invoke('read_image_as_base64', { imagePath: fullPath });
            iconElement.src = base64Icon;
            console.log(`Icon loaded successfully for ${iconPath}`);
        } catch (error) {
            console.error(`Failed to load icon ${iconPath}:`, error);
            console.error(`Full path attempted: ${fullPath}`);
        }
    }

    showFloor(floorId) {
        // Update tabs
        this.floorTabsEl.querySelectorAll('.tab').forEach((tab, index) => {
            if (this.homemapConfig.floors[index].id === floorId) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Update floor views
        this.floorContainerEl.querySelectorAll('.floor-view').forEach(view => {
            if (view.id === `floor-${floorId}`) {
                view.classList.add('active');
            } else {
                view.classList.remove('active');
            }
        });

        this.currentFloor = floorId;
    }

    async testConnection() {
        try {
            const url = `${this.config.protocol}://${this.config.host}/api/settings/info`;
            console.log('Testing connection to:', url);
            
            const response = await this.http.fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${btoa(`${this.config.user}:${this.config.password}`)}`
                }
            });

            console.log('Response:', response);

            if (response.ok) {
                const text = await response.text();
                const data = JSON.parse(text);
                console.log('HC3 data:', data);
                this.updateStatus('connected', `Connected to HC3 v${data.softVersion || 'unknown'}`);
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Connection test failed:', error);
            this.updateStatus('error', `Connection Failed: ${error.message}`);
        }
    }

    updateStatus(state, message) {
        this.statusEl.textContent = message;
        this.statusDot.className = 'status-dot';
        if (state === 'connected') {
            this.statusDot.classList.add('connected');
        } else if (state === 'error') {
            this.statusDot.classList.add('error');
        }
    }

    startEventPolling() {
        if (this.isPolling) {
            console.log('Event polling already running');
            return;
        }
        this.isPolling = true;
        console.log('Starting event polling...');
        this.pollEvents();
    }

    stopEventPolling() {
        this.isPolling = false;
        console.log('Stopped event polling');
    }

    async pollEvents() {
        // Continue polling while isPolling is true
        while (this.isPolling) {
            try {
                const url = `${this.config.protocol}://${this.config.host}/api/refreshStates?last=${this.lastEventId}&timeout=30`;
                
                const response = await this.http.fetch(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Basic ${btoa(`${this.config.user}:${this.config.password}`)}`
                    },
                    timeout: 35000  // 35 seconds - slightly longer than server timeout
                });

                if (!response.ok) {
                    console.error('Event polling failed:', response.status);
                    // Wait before retrying on error
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    continue;
                }

                const text = await response.text();
                const data = JSON.parse(text);
                
                if (data.last) {
                    this.lastEventId = data.last;
                }

                if (data.events && Array.isArray(data.events)) {
                    await this.processEvents(data.events);
                    
                    // If we received events, wait 1 second before polling again
                    // to avoid hammering the HC3
                    if (data.events.length > 0) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            } catch (error) {
                // Check if we should still be polling
                if (!this.isPolling) {
                    console.log('Polling stopped, exiting poll loop');
                    break;
                }
                
                // Handle specific error types
                const errorMsg = error.message || error.toString();
                
                // If it's a resource ID error, it's likely due to page reload - just log and continue
                if (errorMsg.includes('resource id') || errorMsg.includes('invalid')) {
                    console.warn('HTTP resource error (likely due to reload), continuing...', errorMsg);
                } else {
                    console.error('Event polling error:', errorMsg);
                }
                
                // Wait before retrying on timeout or error
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    async processEvents(events) {
        console.log(`Processing ${events.length} events`);
        
        for (const event of events) {
            console.log(`Event type: ${event.type}`, event);
            await this.dispatchEvent(event);
        }
    }

    async dispatchEvent(event) {
        // Check if we have a dispatch entry for this event type
        const dispatch = this.eventDispatch[event.type];
        if (!dispatch) {
            // No widgets interested in this event type
            return;
        }
        
        // Extract device id from event (usually event.data.id)
        const deviceId = event.data?.id;
        if (!deviceId) {
            console.warn(`Could not extract device id from event`);
            return;
        }
        
        // Look up device in the idMap
        const dispatchInfo = dispatch.idMap.get(deviceId);
        if (!dispatchInfo) {
            // This event is for a device we're not tracking
            return;
        }
        
        const { device, widget, eventDef } = dispatchInfo;
        
        console.log(`Dispatching ${event.type} for device ${deviceId}`);
        console.log(`Event data:`, JSON.stringify(event.data).substring(0, 500));
        
        // Check if event matches the property we care about
        // For DevicePropertyUpdatedEvent, only process if the changed property is in our state
        if (event.type === 'DevicePropertyUpdatedEvent') {
            const eventProperty = event.data?.property;
            console.log(`Event is for property: ${eventProperty}, device state properties:`, Object.keys(device.state || {}));
            
            // Only process if we track this property in our state
            if (eventProperty && device.state && !(eventProperty in device.state)) {
                console.log(`Ignoring event for property ${eventProperty}, not tracked in device state`);
                return;
            }
        }
        
        // Update state from event
        if (eventDef.updates) {
            if (!device.state) {
                device.state = { ...widget.state };
            }
            
            for (const [stateProp, eventPath] of Object.entries(eventDef.updates)) {
                console.log(`Processing event update: ${stateProp} <- ${eventPath}`);
                // eventPath like "event.newValue" - extract value from event
                let value = eventPath.startsWith('event.') 
                    ? event.data[eventPath.substring(6)]  // Skip "event." prefix
                    : this.getPropertyValue(event, eventPath);
                
                console.log(`Extracted value from event for ${stateProp}:`, value, `(type: ${typeof value})`);
                
                // HC3 sometimes returns objects like {value: X, path: "...", source: "HC"}
                // If we got an object with a 'value' property, unwrap it
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    console.log(`Object has keys:`, Object.keys(value));
                    if ('value' in value) {
                        console.log(`Unwrapping HC3 value object from event for ${stateProp}`);
                        value = value.value;
                    }
                }
                
                device.state[stateProp] = value;
                console.log(`Updated device ${deviceId} state.${stateProp} =`, value, `(type: ${typeof value})`);
            }
        }
        
        // Get the icon and text elements
        const deviceInfo = this.deviceIcons.get(deviceId);
        if (!deviceInfo) {
            // Device icon not rendered (maybe on different floor)
            return;
        }
        
        const iconElement = deviceInfo.element;
        const textElement = deviceInfo.textElement;
        
        // Re-render with updated state
        await this.renderDevice(device, widget, iconElement, textElement);
    }

}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded fired');
    console.log('window.__TAURI__:', window.__TAURI__);
    console.log('Keys:', window.__TAURI__ ? Object.keys(window.__TAURI__) : 'undefined');
    
    if (window.__TAURI__) {
        console.log('Creating HomeMap instance...');
        window.homeMap = new HomeMap();
    } else {
        console.error('Tauri APIs not available!');
        document.getElementById('connectionStatus').textContent = 'Tauri APIs not loaded';
    }
});
