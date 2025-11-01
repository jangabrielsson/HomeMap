// Floor rendering and navigation management

export class FloorManager {
    constructor(homeMap) {
        this.homeMap = homeMap;
        this.floorTabsEl = document.getElementById('floorTabs');
        this.floorContainerEl = document.getElementById('floorContainer');
    }

    /**
     * Render all floors and their tabs
     */
    renderFloors() {
        const config = this.homeMap.homemapConfig;
        
        if (!config || !config.floors || config.floors.length === 0) {
            this.floorContainerEl.innerHTML = '<p>No floors configured</p>';
            return;
        }

        // Clear containers
        this.floorTabsEl.innerHTML = '';
        this.floorContainerEl.innerHTML = '';

        // Create tabs and floor views
        config.floors.forEach((floor, index) => {
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
            
            // Add right-click handler for floor context menu
            imageContainer.addEventListener('contextmenu', (e) => {
                if (!this.homeMap.editMode) return; // Only in edit mode
                
                // Check if we clicked on empty space (not on a device)
                if (e.target.closest('.device')) {
                    return; // Device will handle its own context menu
                }
                
                e.preventDefault();
                
                // Show floor context menu (Edit Floor, Delete Floor, Add Floor)
                this.homeMap.contextMenuManager.showFloorContextMenu(e.clientX, e.clientY, floor);
            });

            // Create image
            const img = document.createElement('img');
            img.className = 'floor-image';
            img.alt = floor.name;
            
            // Load image via backend as base64
            const imagePath = `${this.homeMap.dataPath}/${floor.image}`;
            console.log('Loading image from:', imagePath);
            
            this.homeMap.invoke('read_image_as_base64', { imagePath: imagePath })
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

        // Add [+] tab in edit mode
        if (this.homeMap.editMode) {
            const addTab = document.createElement('button');
            addTab.className = 'tab add-floor-tab';
            addTab.textContent = '+';
            addTab.title = 'Add Floor';
            addTab.onclick = () => this.homeMap.floorManagementDialog.showAddFloorDialog();
            this.floorTabsEl.appendChild(addTab);
        }

        // Set current floor
        if (config.floors.length > 0) {
            this.homeMap.currentFloor = config.floors[0].id;
            
            // Restore zoom for first floor
            this.homeMap.restoreZoomForFloor(config.floors[0].id);
        }
    }

    /**
     * Render devices on a specific floor
     */
    renderDevicesOnFloor(floorId, container, img) {
        const config = this.homeMap.homemapConfig;
        
        // Filter devices that are on this floor (supports both formats)
        const devices = config.devices?.filter(d => this.homeMap.isDeviceOnFloor(d, floorId)) || [];
        
        devices.forEach(device => {
            // Get position for this specific floor
            const position = this.homeMap.getDevicePosition(device, floorId);
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
            // Track which floor each device is on
            this.homeMap.deviceIcons.set(device.id, { 
                element: icon, 
                textElement: textEl,
                device: device,
                deviceElement: deviceEl,
                container: container,
                img: img,
                floorId: floorId
            });
            
            // Add drag functionality
            this.setupDeviceDrag(deviceEl, device, container, img);
            
            // Add click action handling
            this.homeMap.setupDeviceClick(deviceEl, device);
            
            // Add context menu (right-click)
            this.homeMap.contextMenuManager.setupDeviceContextMenu(deviceEl, device);
            
            // Load initial icon based on widget definition
            this.homeMap.hc3ApiManager.updateDeviceIcon(device, icon, textEl);
            
            deviceEl.appendChild(icon);
            deviceEl.appendChild(textEl);
            container.appendChild(deviceEl);
        });
        
        // If this is the current floor, sync the map to show only current floor devices
        if (floorId === this.homeMap.currentFloor) {
            this.syncDeviceIconsForCurrentFloor(floorId);
        }
    }

    /**
     * Setup drag and drop for a device
     */
    setupDeviceDrag(deviceEl, device, container, img) {
        let isDragging = false;
        let startX, startY;
        
        deviceEl.addEventListener('mousedown', (e) => {
            if (!this.homeMap.editMode) return;
            
            isDragging = true;
            deviceEl.classList.add('dragging');
            
            // Get current position
            const rect = container.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging || !this.homeMap.editMode) return;
            
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
            
            if (this.homeMap.editMode) {
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
                this.homeMap.updateDevicePosition(device, this.homeMap.currentFloor, newPosition);
                
                console.log(`Device ${device.id} moved to (${newPosition.x}, ${newPosition.y}) on floor ${this.homeMap.currentFloor}`);
                
                // Save config
                await this.homeMap.hc3ApiManager.saveConfig();
            }
        });
    }

    /**
     * Show a specific floor
     */
    showFloor(floorId) {
        // Update tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        const activeTab = Array.from(document.querySelectorAll('.tab')).find(tab => 
            tab.textContent === this.homeMap.homemapConfig.floors.find(f => f.id === floorId)?.name
        );
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // Update floor views
        document.querySelectorAll('.floor-view').forEach(view => {
            view.classList.remove('active');
        });
        const floorView = document.getElementById(`floor-${floorId}`);
        if (floorView) {
            floorView.classList.add('active');
        }

        // Update current floor
        this.homeMap.currentFloor = floorId;
        
        // Update the device icons map to only include devices on this floor
        // This ensures event updates only affect visible devices
        this.syncDeviceIconsForCurrentFloor(floorId);
        
        // Restore zoom level for this floor
        this.homeMap.restoreZoomForFloor(floorId);
    }

    /**
     * Sync the deviceIcons map to only include devices on the current floor
     * Events will then only update visible devices
     */
    syncDeviceIconsForCurrentFloor(floorId) {
        // Create a temporary map with only devices on the current floor
        const visibleDevices = new Map();
        
        for (const [deviceId, deviceInfo] of this.homeMap.deviceIcons) {
            if (deviceInfo.floorId === floorId) {
                visibleDevices.set(deviceId, deviceInfo);
            }
        }
        
        // Replace the map with only visible devices
        this.homeMap.deviceIcons.clear();
        for (const [deviceId, deviceInfo] of visibleDevices) {
            this.homeMap.deviceIcons.set(deviceId, deviceInfo);
        }
        
        console.log(`Synced deviceIcons for floor ${floorId}: ${this.homeMap.deviceIcons.size} devices visible`);
    }
}
