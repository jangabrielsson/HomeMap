// Floor rendering and navigation management

export class FloorManager {
    constructor(homeMap) {
        this.homeMap = homeMap;
        this.floorTabsEl = document.getElementById('floorTabs');
        this.floorContainerEl = document.getElementById('floorContainer');
        
        // Add single global resize handler to reposition all widgets
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.repositionAllDevices();
            }, 100);
        });
    }
    
    /**
     * Reposition all devices on all floors
     */
    repositionAllDevices() {
        const config = this.homeMap.homemapConfig;
        if (!config || !config.floors) return;
        
        config.floors.forEach(floor => {
            const floorView = document.getElementById(`floor-${floor.id}`);
            if (!floorView) return;
            
            const container = floorView.querySelector('.floor-image-container');
            const img = container?.querySelector('.floor-image');
            if (container && img && img.complete) {
                this.repositionDevices(floor.id, container, img);
            }
        });
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
            
            // Setup context menu for floor (both right-click and long-press)
            this.homeMap.contextMenuManager.setupFloorContextMenu(imageContainer, floor);

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
                        // Debug: Check computed styles
                        const computedStyle = window.getComputedStyle(img);
                        console.log(`Image CSS Debug - objectFit: ${computedStyle.objectFit}, width: ${computedStyle.width}, height: ${computedStyle.height}`);
                        console.log(`Image natural: ${img.naturalWidth}x${img.naturalHeight}, rendered: ${img.width}x${img.height}, aspect: ${(img.width/img.height).toFixed(2)}, natural aspect: ${(img.naturalWidth/img.naturalHeight).toFixed(2)}`);
                        
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
            
            // Show the first floor explicitly
            this.showFloor(config.floors[0].id);
            
            // Restore zoom for first floor
            this.homeMap.restoreZoomForFloor(config.floors[0].id);
        }
    }

    /**
     * Reposition devices on floor when window resizes
     */
    repositionDevices(floorId, container, img) {
        const config = this.homeMap.homemapConfig;
        const floor = config.floors.find(f => f.id === floorId);
        if (!floor) return;

        const imgRect = img.getBoundingClientRect();
        
        // Get current zoom level
        const zoomLevel = this.homeMap.zoomLevel || 100;
        const scale = zoomLevel / 100;
        
        // Calculate the actual rendered image size (accounting for object-fit: contain)
        const containerAspect = imgRect.width / imgRect.height;
        const imageAspect = img.naturalWidth / img.naturalHeight;
        
        let renderedWidth, renderedHeight, imageOffsetX, imageOffsetY;
        
        if (containerAspect > imageAspect) {
            // Container is wider than image - image is constrained by height
            renderedHeight = imgRect.height;
            renderedWidth = renderedHeight * imageAspect;
            imageOffsetX = (imgRect.width - renderedWidth) / 2;
            imageOffsetY = 0;
        } else {
            // Container is taller than image - image is constrained by width
            renderedWidth = imgRect.width;
            renderedHeight = renderedWidth / imageAspect;
            imageOffsetX = 0;
            imageOffsetY = (imgRect.height - renderedHeight) / 2;
        }

        // Filter devices that are on this floor (same logic as renderDevicesOnFloor)
        const devices = config.devices?.filter(d => this.homeMap.isDeviceOnFloor(d, floorId)) || [];

        devices.forEach(device => {
            const position = this.homeMap.getDevicePosition(device, floorId);
            if (!position) return;

            const deviceEl = document.getElementById(`device-${device.id}`);
            if (!deviceEl) return;

            // Calculate position as percentage of natural image dimensions
            const xPercent = position.x / img.naturalWidth;
            const yPercent = position.y / img.naturalHeight;

            // Calculate pixel position within the actual rendered image
            const xInImage = xPercent * renderedWidth;
            const yInImage = yPercent * renderedHeight;
            
            // Widget position relative to container, accounting for scale
            const xPixel = (imageOffsetX + xInImage) / scale;
            const yPixel = (imageOffsetY + yInImage) / scale;
            
            // Set position
            deviceEl.style.left = `${xPixel}px`;
            deviceEl.style.top = `${yPixel}px`;
            deviceEl.style.transform = 'translate(-50%, -50%)';
            deviceEl.style.webkitTransform = 'translate(-50%, -50%)'; // iOS Safari compatibility
        });
    }

    /**
     * Render devices on a specific floor
     */
    renderDevicesOnFloor(floorId, container, img) {
        const config = this.homeMap.homemapConfig;
        
        // Filter devices that are on this floor (supports both formats)
        const devices = config.devices?.filter(d => this.homeMap.isDeviceOnFloor(d, floorId)) || [];
        
        console.log(`renderDevicesOnFloor: floorId=${floorId}, total devices in config=${config.devices?.length || 0}, devices on this floor=${devices.length}`);
        
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
            
            // Get the actual rendered image bounds
            const imgRect = img.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            
            // Get current zoom level
            const zoomLevel = this.homeMap.zoomLevel || 100;
            const scale = zoomLevel / 100;
            
            // Calculate the actual rendered image size (accounting for object-fit: contain)
            const containerAspect = imgRect.width / imgRect.height;
            const imageAspect = img.naturalWidth / img.naturalHeight;
            
            let renderedWidth, renderedHeight, imageOffsetX, imageOffsetY;
            
            if (containerAspect > imageAspect) {
                // Container is wider than image - image is constrained by height
                renderedHeight = imgRect.height;
                renderedWidth = renderedHeight * imageAspect;
                imageOffsetX = (imgRect.width - renderedWidth) / 2;
                imageOffsetY = 0;
            } else {
                // Container is taller than image - image is constrained by width
                renderedWidth = imgRect.width;
                renderedHeight = renderedWidth / imageAspect;
                imageOffsetX = 0;
                imageOffsetY = (imgRect.height - renderedHeight) / 2;
            }
            
            console.log(`[RENDER] Device ${device.id}: zoom=${zoomLevel}%, scale=${scale}`);
            console.log(`  Container: ${imgRect.width.toFixed(1)}x${imgRect.height.toFixed(1)}, aspect=${containerAspect.toFixed(2)}`);
            console.log(`  Natural: ${img.naturalWidth}x${img.naturalHeight}, aspect=${imageAspect.toFixed(2)}`);
            console.log(`  Rendered image: ${renderedWidth.toFixed(1)}x${renderedHeight.toFixed(1)}`);
            console.log(`  Image offset: (${imageOffsetX.toFixed(1)}, ${imageOffsetY.toFixed(1)})`);
            console.log(`  Constraint: ${containerAspect > imageAspect ? 'by height (wider container)' : 'by width (taller container)'}`);
            
            // Calculate position as percentage of natural image dimensions
            const xPercent = position.x / img.naturalWidth;
            const yPercent = position.y / img.naturalHeight;
            
            // Calculate pixel position within the actual rendered image
            const xInImage = xPercent * renderedWidth;
            const yInImage = yPercent * renderedHeight;
            
            console.log(`  Natural pos=(${position.x}, ${position.y}), percent=(${(xPercent*100).toFixed(2)}%, ${(yPercent*100).toFixed(2)}%)`);
            console.log(`  In rendered image=(${xInImage.toFixed(1)}, ${yInImage.toFixed(1)})`);
            console.log(`  Image offset: (${imageOffsetX.toFixed(1)}, ${imageOffsetY.toFixed(1)})`);
            
            // Widget position relative to container
            // Since widgets are children of container (not img), we need to add imageOffset
            // to account for where the rendered image is within the container
            const xPixel = (imageOffsetX + xInImage) / scale;
            const yPixel = (imageOffsetY + yInImage) / scale;
            
            console.log(`  Final position=(${xPixel.toFixed(1)}, ${yPixel.toFixed(1)})`);
            
            deviceEl.style.left = `${xPixel}px`;
            deviceEl.style.top = `${yPixel}px`;
            deviceEl.style.transform = 'translate(-50%, -50%)';
            deviceEl.style.webkitTransform = 'translate(-50%, -50%)'; // iOS Safari compatibility
            
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
            
            // Apply widget background styling if enabled
            const widgetBg = this.homeMap.homemapConfig?.widgetBackground;
            if (widgetBg?.enabled) {
                const bgCircle = document.createElement('div');
                bgCircle.className = 'device-background';
                const opacity = (widgetBg.opacity || 50) / 100;
                
                // Convert hex color to RGB and apply opacity
                const hex = widgetBg.color.replace('#', '');
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);
                
                bgCircle.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
                deviceEl.insertBefore(bgCircle, deviceEl.firstChild);
            }
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
        let offsetX = 0, offsetY = 0;
        let isFirstMove = false;
        
        deviceEl.addEventListener('mousedown', (e) => {
            if (!this.homeMap.editMode) return;
            
            isDragging = true;
            isFirstMove = true;
            deviceEl.classList.add('dragging');
            
            // Get current rendered position
            const rect = deviceEl.getBoundingClientRect();
            
            // Widget center in viewport coordinates
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            // Calculate offset from cursor to widget center
            offsetX = e.clientX - centerX;
            offsetY = e.clientY - centerY;
            
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging || !this.homeMap.editMode) return;
            
            // Get current zoom level
            const zoomLevel = this.homeMap.zoomLevel || 100;
            const scale = zoomLevel / 100;
            
            const imgRect = img.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            
            // On first move, recalculate offset based on current rendered position
            // This handles cases where the layout changed (console opened/closed) since entering edit mode
            if (isFirstMove) {
                isFirstMove = false;
                const rect = deviceEl.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                
                // Recalculate offset from current cursor to current rendered center
                offsetX = e.clientX - centerX;
                offsetY = e.clientY - centerY;
            }
            
            // Calculate widget center position in viewport coordinates
            let centerX = e.clientX - offsetX;
            let centerY = e.clientY - offsetY;
            
            // Clamp to image bounds (in viewport coordinates, which are scaled)
            centerX = Math.max(imgRect.left, Math.min(centerX, imgRect.left + imgRect.width));
            centerY = Math.max(imgRect.top, Math.min(centerY, imgRect.top + imgRect.height));
            
            // Convert from viewport coordinates to container-relative coordinates
            // Then divide by scale to get the unscaled position
            let x = (centerX - containerRect.left) / scale;
            let y = (centerY - containerRect.top) / scale;
            
            // Apply grid snapping if shift key is held
            if (e.shiftKey) {
                x = Math.round(x / 5) * 5;
                y = Math.round(y / 5) * 5;
            }
            
            // Update position - the widget's center will be at this position due to transform
            deviceEl.style.left = `${x}px`;
            deviceEl.style.top = `${y}px`;
        });
        
        document.addEventListener('mouseup', async (e) => {
            if (!isDragging) return;
            
            isDragging = false;
            deviceEl.classList.remove('dragging');
            
            if (this.homeMap.editMode) {
                // Get current zoom level
                const zoomLevel = this.homeMap.zoomLevel || 100;
                const scale = zoomLevel / 100;
                
                // Calculate the actual rendered image size (same as in renderDevicesOnFloor)
                const imgRect = img.getBoundingClientRect();
                const containerAspect = imgRect.width / imgRect.height;
                const imageAspect = img.naturalWidth / img.naturalHeight;
                
                let renderedWidth, renderedHeight, imageOffsetX, imageOffsetY;
                
                if (containerAspect > imageAspect) {
                    // Container is wider - image constrained by height
                    renderedHeight = imgRect.height;
                    renderedWidth = renderedHeight * imageAspect;
                    imageOffsetX = (imgRect.width - renderedWidth) / 2;
                    imageOffsetY = 0;
                } else {
                    // Container is taller - image constrained by width
                    renderedWidth = imgRect.width;
                    renderedHeight = renderedWidth / imageAspect;
                    imageOffsetX = 0;
                    imageOffsetY = (imgRect.height - renderedHeight) / 2;
                }
                
                // Cursor position relative to img element (in scaled coordinates)
                let x = e.clientX - imgRect.left;
                let y = e.clientY - imgRect.top;
                
                // Subtract the image offset to get position within the actual rendered image
                x = x - imageOffsetX;
                y = y - imageOffsetY;
                
                // Clamp to rendered image bounds (scaled)
                x = Math.max(0, Math.min(x, renderedWidth));
                y = Math.max(0, Math.min(y, renderedHeight));
                
                // Convert from rendered image pixels to natural image pixels
                const naturalX = (x / renderedWidth) * img.naturalWidth;
                const naturalY = (y / renderedHeight) * img.naturalHeight;
                
                // Update device position on current floor
                const newPosition = { x: Math.round(naturalX), y: Math.round(naturalY) };
                this.homeMap.updateDevicePosition(device, this.homeMap.currentFloor, newPosition);
                
                console.log(`Device ${device.id} SAVED: cursor=(${e.clientX}, ${e.clientY}), renderedImage=${renderedWidth.toFixed(1)}x${renderedHeight.toFixed(1)}, imageOffset=(${imageOffsetX.toFixed(1)}, ${imageOffsetY.toFixed(1)}), inImage=(${x.toFixed(1)}, ${y.toFixed(1)}), natural=(${newPosition.x}, ${newPosition.y})`);
                
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
