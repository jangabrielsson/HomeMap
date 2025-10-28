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
        this.editMode = false;
        this.draggedDevice = null;
        this.dragOffset = { x: 0, y: 0 };
        this.setupEditMode();
        this.init();
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

    async loadWidgets() {
        this.widgets = {};
        
        // Get unique widget types from devices
        const widgetTypes = [...new Set(this.homemapConfig.devices?.map(d => d.type) || [])];
        
        for (const type of widgetTypes) {
            try {
                const jsonContent = await this.invoke('read_widget_json', { widgetType: type });
                this.widgets[type] = JSON.parse(jsonContent);
                console.log(`Loaded widget definition for ${type}`);
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
        const devices = this.homemapConfig.devices?.filter(d => d.floor_id === floorId) || [];
        
        devices.forEach(device => {
            const deviceEl = document.createElement('div');
            deviceEl.className = 'device';
            deviceEl.id = `device-${device.id}`;
            deviceEl.style.position = 'absolute';
            
            // Calculate position as percentage of image dimensions
            const xPercent = (device.position.x / img.naturalWidth) * 100;
            const yPercent = (device.position.y / img.naturalHeight) * 100;
            deviceEl.style.left = `${xPercent}%`;
            deviceEl.style.top = `${yPercent}%`;
            deviceEl.style.transform = 'translate(-50%, -50%)';
            
            // Create icon placeholder
            const icon = document.createElement('img');
            icon.className = 'device-icon';
            icon.style.width = '32px';
            icon.style.height = '32px';
            icon.alt = device.name;
            icon.title = device.name;
            
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
                
                // Update device position
                device.position.x = Math.round(naturalX);
                device.position.y = Math.round(naturalY);
                
                console.log(`Device ${device.id} moved to (${device.position.x}, ${device.position.y})`);
                
                // Save config
                await this.saveConfig();
            }
        });
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
        
        // Fetch current device status from HC3
        if (widget.status) {
            try {
                const api = widget.status.api.replace('${id}', device.id);
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
                    
                    await this.renderDevice(device, data, widget, iconElement, textElement);
                } else {
                    console.error(`Failed to fetch status for device ${device.id}: HTTP ${response.status}`);
                }
            } catch (error) {
                console.error(`Error fetching status for device ${device.id}:`, error);
            }
        }
    }

    async renderDevice(device, data, widget, iconElement, textElement) {
        // Get the valuemap
        const valuemapName = widget.status.valuemap;
        const valuemap = widget.valuemaps[valuemapName];
        
        if (!valuemap) {
            console.warn(`No valuemap ${valuemapName} found for device ${device.id}`);
            return;
        }
        
        // Extract all property values
        const properties = {};
        if (Array.isArray(widget.status.properties)) {
            // New format: array of property paths
            for (const propPath of widget.status.properties) {
                const propName = propPath.split('.').pop(); // Get last part as name
                properties[propName] = this.getPropertyValue(data, propPath);
            }
        } else {
            // Old format (backward compat): single property
            const value = this.getPropertyValue(data, widget.status.property);
            properties.value = value;
        }
        
        console.log(`Device ${device.id} properties:`, properties);
        
        // Render icon
        if (valuemap.icon) {
            const iconPath = this.getIconFromValuemapDefinition(properties, valuemap.icon);
            if (iconPath) {
                await this.loadDeviceIcon(iconElement, iconPath);
            }
        }
        
        // Render display text
        if (valuemap.display && textElement) {
            const displayText = this.getDisplayText(properties, valuemap.display);
            if (displayText) {
                textElement.textContent = displayText;
                textElement.style.display = 'block';
            }
        }
    }

    getIconFromValuemapDefinition(properties, iconDef) {
        const propValue = properties[iconDef.property];
        
        switch (iconDef.type) {
            case 'boolean':
                return propValue ? iconDef.true : iconDef.false;
            
            case 'static':
                return iconDef.path;
            
            case 'range':
                const numValue = Number(propValue);
                for (const range of iconDef.ranges) {
                    if (numValue >= range.min && numValue <= range.max) {
                        return range.path;
                    }
                }
                return null;
            
            default:
                console.warn(`Unknown icon type: ${iconDef.type}`);
                return null;
        }
    }

    getDisplayText(properties, displayDef) {
        const propValue = properties[displayDef.property];
        let text = displayDef.text;
        
        switch (displayDef.type) {
            case 'epoch':
                if (displayDef.format === 'timeAgo') {
                    const timeAgo = this.formatTimeAgo(propValue);
                    text = text.replace('${timeAgo}', timeAgo);
                }
                break;
            
            case 'float':
            case 'integer':
            case 'string':
            default:
                text = text.replace('${value}', propValue);
                break;
        }
        
        return text;
    }

    formatTimeAgo(epochSeconds) {
        const now = Date.now();
        const then = epochSeconds * 1000; // Convert to milliseconds
        const diffMs = now - then;
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffSeconds < 60) return `${diffSeconds}s ago`;
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
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
                console.error('Event polling error:', error);
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
        
        // Extract device id from event using the idPath
        const deviceId = this.getPropertyValue(event.data, dispatch.idPath);
        if (!deviceId) {
            console.warn(`Could not extract device id from event using path: ${dispatch.idPath}`);
            return;
        }
        
        // Look up device in the idMap
        const dispatchInfo = dispatch.idMap.get(deviceId);
        if (!dispatchInfo) {
            // This event is for a device we're not tracking
            return;
        }
        
        const { device, widget, eventDef } = dispatchInfo;
        const property = event.data?.property;
        const newValue = event.data?.newValue;
        
        console.log(`Dispatching ${event.type} for device ${deviceId}, property: ${property}, value:`, newValue);
        
        // Get the icon and text elements
        const deviceInfo = this.deviceIcons.get(deviceId);
        if (!deviceInfo) {
            // Device icon not rendered (maybe on different floor)
            return;
        }
        
        const iconElement = deviceInfo.element;
        const textElement = deviceInfo.textElement;
        
        console.log(`Event triggered re-render for device ${deviceId}`);
        
        // Re-fetch device data and re-render
        // This is simpler than trying to patch individual properties from events
        try {
            const api = widget.status.api.replace('${id}', deviceId);
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
                await this.renderDevice(device, data, widget, iconElement, textElement);
            }
        } catch (error) {
            console.error(`Error re-rendering device ${deviceId}:`, error);
        }
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
