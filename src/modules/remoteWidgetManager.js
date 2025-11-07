// Remote Widget Manager
// Handles QuickApp widget connections, registration, and interactions

export class RemoteWidgetManager {
    constructor(homeMap) {
        this.homeMap = homeMap;
        this.remoteWidgets = new Map(); // clientId -> { qaId, qaName, widgets[] }
        this.widgetInstances = new Map(); // instanceId -> { clientId, widgetDef, floor, x, y }
        this.isInitialized = false;
        this.serverRunning = false;
        this.dropZonesSetup = false; // Track if drop zones are already configured
    }

    /**
     * Helper to get icon path from icon set
     * For remote widgets, only look for 'icon' key
     * If the icon set doesn't have 'icon', return defaultButton as fallback
     */
    getIconPathFromSet(iconSet) {
        if (!iconSet) return 'icons/built-in/defaultButton/icon.png';
        return iconSet.icon || 'icons/built-in/defaultButton/icon.png';
    }

    async initialize() {
        if (this.isInitialized) {
            console.log('RemoteWidgetManager already initialized');
            return;
        }

        console.log('🔌 Initializing RemoteWidgetManager...');

        // Use Tauri event system from window object
        const { listen } = window.__TAURI__.event;

        // Listen for server lifecycle events
        listen('ws-server-started', (event) => {
            console.log('✅ WebSocket server started:', event.payload);
            this.serverRunning = true;
            this.updateServerStatus(true);
        });

        listen('ws-server-stopped', () => {
            console.log('⏹️ WebSocket server stopped');
            this.serverRunning = false;
            this.updateServerStatus(false);
        });

        // Listen for client connections
        listen('ws-client-connected', (event) => {
            console.log('📥 Client connected:', event.payload);
            this.handleClientConnected(event.payload);
        });

        listen('ws-client-disconnected', (event) => {
            console.log('📤 Client disconnected:', event.payload);
            this.handleClientDisconnected(event.payload);
        });

        // Listen for widget registration
        listen('ws-register-widgets', (event) => {
            console.log('📝 Widgets registered:', event.payload);
            this.handleWidgetRegistration(event.payload);
        });

        // Listen for widget updates
        listen('ws-widget-update', (event) => {
            console.log('🔄 Widget update:', event.payload);
            this.handleWidgetUpdate(event.payload);
        });

        // Listen for widget unregistration
        listen('ws-unregister-widgets', (event) => {
            console.log('❌ Widgets unregistered:', event.payload);
            this.handleWidgetUnregistration(event.payload);
        });

        this.isInitialized = true;
        console.log('✅ RemoteWidgetManager initialized');

        // Check if server is already running and sync UI state
        await this.syncServerState();

        // Auto-start server if configured
        await this.autoStartServerIfConfigured();
        
        // Drop zones will be set up after floors are rendered (called from script.js)
    }

    /**
     * Restore all saved remote widgets on app startup
     * Called after floors are rendered
     */
    async restoreAllSavedWidgets() {
        const { homemapConfig } = this.homeMap;
        const savedWidgets = homemapConfig.remoteWidgets || [];
        
        if (savedWidgets.length === 0) {
            console.log('📦 No saved remote widgets to restore');
            return;
        }

        console.log(`📦 Restoring ${savedWidgets.length} saved remote widgets...`);
        
        for (const saved of savedWidgets) {
            try {
                // Create a placeholder widget definition from saved data
                const placeholderWidget = {
                    id: saved.widgetId,
                    qaId: saved.qaId,
                    name: saved.customLabel || 'Remote Widget',
                    label: saved.customLabel || 'Remote Widget',
                    iconSet: saved.customIconSet || 'defaultButton',
                    iconPackage: saved.customIconPackage || null,
                    isRemote: true,
                    isPlaceholder: true // Mark as placeholder until QA reconnects
                };

                // Create the widget instance
                const instanceId = await this.handleWidgetPlaced(
                    placeholderWidget,
                    saved.floor,
                    saved.x,
                    saved.y
                );
                
                // Restore custom settings
                const instance = this.widgetInstances.get(instanceId);
                if (instance) {
                    instance.parameters = saved.parameters || {};
                    if (saved.customLabel) {
                        instance.customLabel = saved.customLabel;
                    }
                    if (saved.customIconSet) {
                        instance.customIconSet = saved.customIconSet;
                        instance.customIconPackage = saved.customIconPackage || null;
                    }
                    
                    console.log(`✅ Restored widget: ${saved.customLabel || saved.widgetId} on floor ${saved.floor}`);
                }
            } catch (error) {
                console.error(`❌ Failed to restore widget ${saved.widgetId}:`, error);
            }
        }
        
        console.log('✅ Remote widgets restoration complete');
    }

    setupFloorDropZones() {
        if (this.dropZonesSetup) {
            console.log('⚠️ Drop zones already set up, skipping...');
            return;
        }
        
        console.log('🎯 Setting up drop zones for all floors...');
        // Set up drop handlers for all floor canvases
        const floorViews = document.querySelectorAll('.floor-view');
        console.log(`📋 Found ${floorViews.length} floor views`);
        
        if (floorViews.length === 0) {
            console.warn('⚠️ No floor views found yet, will retry when needed');
            return;
        }
        
        let setupCount = 0;
        floorViews.forEach((floorView, index) => {
            // Set up on the floor-view itself (which contains the image-container)
            console.log(`✅ Setting up drop zone for floor view ${index}:`, floorView);
            this.setupDropZone(floorView);
            setupCount++;
        });
        
        this.dropZonesSetup = true;
        console.log(`✅ Drop zones setup complete - ${setupCount} zones configured`);
        
        // DEBUG: Also set up on document body to test if drops work at all
        document.body.addEventListener('dragover', (e) => {
            console.log('🧪 BODY dragover event - types:', e.dataTransfer.types, 'dropEffect:', e.dataTransfer.dropEffect);
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
        document.body.addEventListener('drop', (e) => {
            console.log('🧪 BODY drop event fired!');
            const data = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('application/json');
            console.log('🧪 Data:', data);
            e.preventDefault();
        });
    }

    setupDropZone(floorView) {
        console.log('🎯 Setting up drop zone for element:', floorView);
        
        // Allow dragover - ALWAYS for debugging
        floorView.addEventListener('dragover', (e) => {
            console.log('✅ Floor dragover event!');
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        // Handle drop
        floorView.addEventListener('drop', async (e) => {
            console.log('🎯 DROP EVENT FIRED on floorView!', e);
            
            if (!this.homeMap.editMode) {
                console.log('⚠️ Drop blocked - not in edit mode');
                return;
            }
            e.preventDefault();
            e.stopPropagation();

            try {
                // Try to get data from either text/plain or application/json
                let dataString = e.dataTransfer.getData('application/json');
                if (!dataString) {
                    dataString = e.dataTransfer.getData('text/plain');
                }
                
                console.log('📦 Data from drag:', dataString);
                
                if (!dataString) {
                    console.error('❌ No data in drop event');
                    console.log('Available types:', e.dataTransfer.types);
                    return;
                }
                
                const data = JSON.parse(dataString);
                console.log('📦 Parsed data:', data);
                
                if (data.type === 'remote-widget') {
                    // Find the image container within this floor view
                    const imageContainer = floorView.querySelector('.floor-image-container');
                    const img = imageContainer?.querySelector('.floor-image');
                    
                    console.log('🖼️ Image container:', imageContainer);
                    console.log('🖼️ Image:', img);
                    
                    if (!img || !imageContainer) {
                        console.error('❌ No floor image found');
                        return;
                    }

                    // Get position relative to the image container
                    const rect = imageContainer.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / img.width) * 100;
                    const y = ((e.clientY - rect.top) / img.height) * 100;

                    // Get current floor ID
                    const floorId = floorView.id.replace('floor-', '');

                    console.log(`📍 Dropping widget at ${x.toFixed(2)}%, ${y.toFixed(2)}% on floor ${floorId}`);

                    // Create and place the widget
                    await this.handleWidgetPlaced(data.widgetDef, floorId, x, y);
                } else {
                    console.log('⚠️ Not a remote-widget drop:', data.type);
                }
            } catch (error) {
                console.error('❌ Failed to handle drop:', error);
            }
        });
    }

    async syncServerState() {
        try {
            const isRunning = await this.homeMap.invoke('ws_is_server_running');
            console.log(`🔍 Server state check: ${isRunning ? 'RUNNING' : 'STOPPED'}`);
            
            this.serverRunning = isRunning;
            this.updateServerStatus(isRunning);
            
            if (isRunning) {
                // Get connected clients
                const clients = await this.homeMap.invoke('ws_get_connected_clients');
                console.log(`📊 Connected clients: ${clients.length}`);
                this.updateConnectedClientsList(clients);
                
                // Request widget registration from all connected clients
                if (clients.length > 0) {
                    console.log('📤 Requesting widget registration from connected clients...');
                    await this.homeMap.invoke('ws_request_widgets');
                }
            }
        } catch (error) {
            console.error('Failed to check server state:', error);
            this.serverRunning = false;
            this.updateServerStatus(false);
        }
    }

    async autoStartServerIfConfigured() {
        const config = this.homeMap.homemapConfig || this.homeMap.config;
        if (config.websocket?.enabled && config.websocket?.autoStart) {
            console.log('🚀 Auto-starting WebSocket server...');
            await this.startServer(
                config.websocket.port || 8765,
                config.websocket.bindAddress || '0.0.0.0'
            );
        }
    }

    async startServer(port = 8765, bindAddress = '0.0.0.0') {
        try {
            // Check if server is already running
            const isRunning = await this.homeMap.invoke('ws_is_server_running');
            if (isRunning) {
                console.log('⚠️ Server is already running, syncing UI state');
                this.serverRunning = true;
                this.updateServerStatus(true);
                this.showNotification('WebSocket server is already running', 'info');
                return true;
            }
            
            await this.homeMap.invoke('ws_start_server', { port, bindAddress });
            console.log(`✅ WebSocket server started on ${bindAddress}:${port}`);
            this.showNotification(`WebSocket server started on port ${port}`, 'success');
            return true;
        } catch (error) {
            console.error('Failed to start WebSocket server:', error);
            this.showNotification(`Failed to start server: ${error}`, 'error');
            return false;
        }
    }

    async stopServer() {
        try {
            await this.homeMap.invoke('ws_stop_server');
            console.log('⏹️ WebSocket server stopped');
            this.showNotification('WebSocket server stopped', 'info');
            
            // Clean up all remote widgets
            this.remoteWidgets.clear();
            this.markAllWidgetsAsDisconnected();
            
            return true;
        } catch (error) {
            console.error('Failed to stop WebSocket server:', error);
            this.showNotification(`Failed to stop server: ${error}`, 'error');
            return false;
        }
    }

    handleClientConnected(data) {
        const { clientId, address } = data;
        console.log(`Client ${clientId} connected from ${address}`);
        // Wait for widget registration
    }

    handleClientDisconnected(data) {
        const { clientId } = data;
        
        // Find and remove widgets for this client
        if (this.remoteWidgets.has(clientId)) {
            const clientData = this.remoteWidgets.get(clientId);
            console.log(`Removing widgets for disconnected client: ${clientData.qaName}`);
            
            this.showNotification(`Disconnected: ${clientData.qaName}`, 'warning');
            this.remoteWidgets.delete(clientId);
            
            // Mark placed widgets as disconnected
            this.markWidgetsAsDisconnected(clientId);
            
            // Update widget palette
            this.updateWidgetPalette();
        }
    }

    handleWidgetRegistration(data) {
        const { clientId, qaId, qaName, widgets } = data;
        
        if (!widgets || !Array.isArray(widgets)) {
            console.error('Invalid widget registration data:', data);
            return;
        }

        // Check if this is a re-registration (QA reconnecting)
        const isReconnect = this.remoteWidgets.has(clientId) || 
                           Array.from(this.remoteWidgets.values()).some(c => c.qaId === qaId);

        // Build set of current widget UIDs from this QA
        const newWidgetIds = new Set(widgets.map(w => w.id));

        // If reconnecting, clean up widgets that no longer exist
        if (isReconnect) {
            this.cleanupRemovedWidgets(qaId, newWidgetIds);
        }

        // Store widget definitions
        this.remoteWidgets.set(clientId, {
            qaId,
            qaName,
            widgets: widgets.map(w => ({
                ...w,
                isRemote: true,
                clientId,
                qaId,
                qaName
            }))
        });

        console.log(`📝 Registered ${widgets.length} widgets from ${qaName}`);
        if (isReconnect) {
            console.log(`🔄 Reconnect detected - cleaned up removed widgets`);
        }
        this.showNotification(`Connected: ${qaName} (${widgets.length} widgets)`, 'success');

        // Update widget palette in edit mode
        this.updateWidgetPalette();

        // Restore any previously placed widgets for this QA
        this.restorePlacedWidgets(clientId, qaId);
    }

    cleanupRemovedWidgets(qaId, newWidgetIds) {
        console.log(`🧹 Cleaning up removed widgets for QA: ${qaId}`);
        console.log(`   Current widget IDs:`, Array.from(newWidgetIds));
        
        const instancesToRemove = [];
        
        // Find instances whose widget IDs no longer exist in the new registration
        this.widgetInstances.forEach((instance, instanceId) => {
            if (instance.widgetDef.qaId === qaId) {
                const widgetId = instance.widgetDef.id;
                
                if (!newWidgetIds.has(widgetId)) {
                    console.log(`   ❌ Widget "${widgetId}" no longer exists - marking for removal`);
                    instancesToRemove.push({ instanceId, widgetName: instance.widgetDef.name });
                }
            }
        });

        // Remove the obsolete widget instances
        if (instancesToRemove.length > 0) {
            instancesToRemove.forEach(({ instanceId, widgetName }) => {
                // Remove from DOM
                const element = document.querySelector(`[data-widget-instance="${instanceId}"]`);
                if (element) {
                    element.remove();
                    console.log(`   🗑️  Removed widget element: ${widgetName}`);
                }
                
                // Remove from instances map
                this.widgetInstances.delete(instanceId);
            });

            // Save updated config
            this.savePlacedWidgets();
            
            this.showNotification(
                `Removed ${instancesToRemove.length} obsolete widget(s) from ${qaId}`, 
                'warning'
            );
            
            console.log(`✅ Cleanup complete - removed ${instancesToRemove.length} widget instance(s)`);
        } else {
            console.log(`✅ No cleanup needed - all widgets still valid`);
        }
    }

    handleWidgetUpdate(data) {
        const { clientId, widgetId, changes } = data;
        
        if (!changes) {
            console.error('Invalid widget update data:', data);
            return;
        }

        console.log(`🔄 Updating widget ${widgetId}:`, changes);

        // Find all instances of this widget on floors
        this.widgetInstances.forEach((instance, instanceId) => {
            if (instance.clientId === clientId && instance.widgetDef.id === widgetId) {
                this.applyWidgetChanges(instanceId, instance, changes);
            }
        });
    }

    handleWidgetUnregistration(data) {
        const { clientId, qaId } = data;
        
        if (this.remoteWidgets.has(clientId)) {
            const clientData = this.remoteWidgets.get(clientId);
            console.log(`Unregistering widgets for ${clientData.qaName}`);
            
            this.remoteWidgets.delete(clientId);
            this.markWidgetsAsDisconnected(clientId);
            this.updateWidgetPalette();
        }
    }

    applyWidgetChanges(instanceId, instance, changes) {
        const element = document.querySelector(`[data-widget-instance="${instanceId}"]`);
        if (!element) return;

        // Update icon
        if (changes.iconSet) {
            const iconImg = element.querySelector('.widget-icon');
            if (iconImg) {
                this.updateWidgetIcon(iconImg, changes.iconSet);
            }
        }

        // Update label
        if (changes.label !== undefined) {
            const labelDiv = element.querySelector('.widget-label');
            if (labelDiv) {
                labelDiv.textContent = changes.label;
            }
        }

        // Update color/styling
        if (changes.color) {
            element.style.setProperty('--widget-color', changes.color);
        }

        if (changes.backgroundColor) {
            element.style.setProperty('--widget-bg-color', changes.backgroundColor);
        }

        // Store updated state
        if (changes.state) {
            instance.state = changes.state;
        }
    }

    async updateWidgetIcon(iconImg, iconSetName) {
        // Load icon set and update image
        const iconSet = await this.homeMap.widgetManager.loadIconSet(iconSetName);
        if (iconSet) {
            iconImg.src = iconSet.icon || iconSet.iconOff || '';
        }
    }

    updateWidgetPalette() {
        if (!this.homeMap.editMode) return;

        // Get or create remote widgets section in palette
        const palette = document.getElementById('widget-list');
        if (!palette) return;

        // Remove old remote widgets section
        const oldSection = palette.querySelector('.remote-widgets-section');
        if (oldSection) {
            oldSection.remove();
        }

        // Create new section if there are remote widgets
        if (this.remoteWidgets.size > 0) {
            const section = this.createRemoteWidgetsSection();
            palette.appendChild(section);
        }
    }

    createRemoteWidgetsSection() {
        const section = document.createElement('div');
        section.className = 'remote-widgets-section';
        section.innerHTML = '<h3>🔌 Remote Widgets (QuickApps)</h3>';

        this.remoteWidgets.forEach((clientData, clientId) => {
            const qaGroup = document.createElement('div');
            qaGroup.className = 'remote-widget-group';
            qaGroup.innerHTML = `
                <div class="qa-header">
                    <strong>${clientData.qaName}</strong>
                    <span class="widget-count">${clientData.widgets.length} widgets</span>
                </div>
            `;

            const widgetList = document.createElement('div');
            widgetList.className = 'remote-widget-list';

            clientData.widgets.forEach(widget => {
                const widgetItem = this.createWidgetPaletteItem(widget);
                widgetList.appendChild(widgetItem);
            });

            qaGroup.appendChild(widgetList);
            section.appendChild(qaGroup);
        });

        return section;
    }

    createWidgetPaletteItem(widgetDef) {
        const item = document.createElement('div');
        item.className = 'widget-palette-item remote';
        item.dataset.widgetId = widgetDef.id;
        item.dataset.clientId = widgetDef.clientId;

        item.innerHTML = `
            <div class="widget-icon-preview">📱</div>
            <div class="widget-name">${widgetDef.name}</div>
        `;

        // Use mouse events instead of HTML5 drag/drop for better Tauri compatibility
        let isDragging = false;
        let dragGhost = null;
        let offsetX = 0;
        let offsetY = 0;

        item.style.cursor = 'grab';

        item.addEventListener('mousedown', (e) => {
            if (!this.homeMap.editMode) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const startX = e.clientX;
            const startY = e.clientY;
            
            isDragging = true;
            item.style.cursor = 'grabbing';
            
            console.log('🖱️ Mouse down - starting custom drag');
            
            // Create a preview that looks like the actual widget that will be placed
            dragGhost = document.createElement('div');
            dragGhost.className = 'device remote-widget';
            dragGhost.style.position = 'fixed';
            dragGhost.style.pointerEvents = 'none';
            dragGhost.style.opacity = '0.7';
            dragGhost.style.zIndex = '10000';
            dragGhost.style.cursor = 'grabbing';
            
            // Load the icon for preview
            this.homeMap.widgetManager.loadIconSet(widgetDef.iconSet).then(async iconSet => {
                const iconPath = this.getIconPathFromSet(iconSet);
                
                const iconElement = document.createElement('img');
                iconElement.className = 'device-icon';
                iconElement.style.width = '32px';
                iconElement.style.height = '32px';
                iconElement.alt = widgetDef.name;
                
                const textElement = document.createElement('div');
                textElement.className = 'device-text';
                textElement.textContent = widgetDef.label || widgetDef.name;
                
                dragGhost.appendChild(iconElement);
                dragGhost.appendChild(textElement);
                
                if (iconPath) {
                    await this.homeMap.widgetManager.loadDeviceIcon(iconElement, iconPath);
                }
            }).catch(() => {
                dragGhost.innerHTML = `
                    <div style="width: 32px; height: 32px; font-size: 24px;">📱</div>
                    <div class="device-text">${widgetDef.label || widgetDef.name}</div>
                `;
            });
            
            // Center the ghost on cursor
            dragGhost.style.left = e.clientX + 'px';
            dragGhost.style.top = e.clientY + 'px';
            dragGhost.style.transform = 'translate(-50%, -50%)';
            
            document.body.appendChild(dragGhost);
            
            // Keep track that we're 50% offset (centered)
            offsetX = 0; // We'll center it, so no offset needed
            offsetY = 0;
            
            item.style.opacity = '0.3';
        });

        const handleMouseMove = (e) => {
            if (!isDragging || !dragGhost) return;
            
            // Keep ghost centered on cursor
            dragGhost.style.left = e.clientX + 'px';
            dragGhost.style.top = e.clientY + 'px';
        };

        const handleMouseUp = async (e) => {
            if (!isDragging) return;
            
            console.log('🖱️ Mouse up at', e.clientX, e.clientY);
            isDragging = false;
            item.style.opacity = '1';
            item.style.cursor = 'grab';
            
            // Remove ghost
            if (dragGhost && dragGhost.parentNode) {
                document.body.removeChild(dragGhost);
                dragGhost = null;
            }
            
            // Remove event listeners to prevent duplicates
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            
            // Check if dropped on a floor
            const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
            console.log('🎯 Drop target:', dropTarget?.className);
            
            if (dropTarget) {
                const floorView = dropTarget.closest('.floor-view');
                const imageContainer = dropTarget.closest('.floor-image-container');
                
                if (floorView && imageContainer) {
                    const img = imageContainer.querySelector('.floor-image');
                    
                    if (img) {
                        // Calculate position relative to the image itself
                        const imgRect = img.getBoundingClientRect();
                        
                        console.log('📐 Mouse pos:', e.clientX, e.clientY);
                        console.log('📐 Image bounds:', imgRect.left, imgRect.top, imgRect.width, imgRect.height);
                        console.log('📐 Relative pos:', e.clientX - imgRect.left, e.clientY - imgRect.top);
                        
                        const x = ((e.clientX - imgRect.left) / imgRect.width) * 100;
                        const y = ((e.clientY - imgRect.top) / imgRect.height) * 100;
                        const floorId = floorView.id.replace('floor-', '');
                        
                        console.log(`📍 Calculated position: ${x.toFixed(2)}%, ${y.toFixed(2)}% on floor ${floorId}`);
                        
                        // Place the widget
                        await this.handleWidgetPlaced(widgetDef, floorId, x, y);
                    } else {
                        console.warn('⚠️ No floor image found');
                    }
                } else {
                    console.log('⚠️ Not dropped on a floor');
                }
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return item;
    }

    async handleWidgetPlaced(widgetDef, floor, x, y) {
        const instanceId = `remote-${widgetDef.clientId}-${widgetDef.id}-${Date.now()}`;
        
        console.log(`🎯 handleWidgetPlaced called: ${widgetDef.name} on ${floor} at ${x.toFixed(1)}%, ${y.toFixed(1)}%`);

        // Create widget element
        const element = await this.createWidgetElement(widgetDef, instanceId, x, y);
        
        // Add to floor - find the image container for this floor
        const floorView = document.getElementById(`floor-${floor}`);
        if (floorView) {
            const imageContainer = floorView.querySelector('.floor-image-container');
            if (imageContainer) {
                imageContainer.appendChild(element);
                console.log(`✅ Widget placed on floor ${floor} at ${x.toFixed(2)}%, ${y.toFixed(2)}%`);
                
                // Immediately reposition to pixel coordinates
                const img = imageContainer.querySelector('.floor-image');
                if (img && img.complete) {
                    this.repositionRemoteWidgets(floor, imageContainer, img);
                }
            } else {
                console.error('Could not find image container for floor:', floor);
            }
        } else {
            console.error('Could not find floor view:', floor);
        }

        // Store instance
        this.widgetInstances.set(instanceId, {
            clientId: widgetDef.clientId,
            widgetDef,
            floor,
            x,
            y,
            state: {},
            parameters: {}, // User-defined parameters for this instance
            customLabel: null, // User-defined label override
            customIconSet: null, // Icon set name (without package prefix)
            customIconPackage: null // Package ID for the icon set
        });

        // Save to config
        this.savePlacedWidgets();

        return instanceId;
    }

    async createWidgetElement(widgetDef, instanceId, x, y) {
        const element = document.createElement('div');
        element.className = 'device remote-widget';
        element.dataset.widgetInstance = instanceId;
        
        // Position as percentage of the floor image
        element.style.position = 'absolute';
        element.style.left = `${x}%`;
        element.style.top = `${y}%`;
        element.style.transform = 'translate(-50%, -50%)'; // Center on position

        // Get instance to check for custom overrides
        const instance = this.widgetInstances.get(instanceId);
        
        // Use custom iconSet if set, otherwise widget's iconSet, otherwise default to 'defaultButton'
        const iconSetName = instance?.customIconSet || widgetDef.iconSet || 'defaultButton';
        const iconPackage = instance?.customIconPackage || (instance?.customIconSet || widgetDef.iconSet ? null : 'com.fibaro.built-in');
        const iconSet = await this.homeMap.widgetManager.loadIconSet(iconSetName, iconPackage);
        const iconPath = this.getIconPathFromSet(iconSet);

        // Use custom label if set, otherwise widget's label
        const label = instance?.customLabel || widgetDef.label || widgetDef.name;

        // Create element structure
        const iconElement = document.createElement('img');
        iconElement.className = 'device-icon';
        iconElement.alt = widgetDef.name;
        
        const textElement = document.createElement('div');
        textElement.className = 'device-text';
        textElement.textContent = label;

        element.appendChild(iconElement);
        element.appendChild(textElement);

        // Load icon through backend (converts to base64)
        if (iconPath) {
            await this.homeMap.widgetManager.loadDeviceIcon(iconElement, iconPath);
        }

        // Handle clicks
        element.addEventListener('click', async (e) => {
            if (!this.homeMap.editMode) {
                await this.handleWidgetClick(instanceId, e);
            }
        });

        // Handle right-click for context menu (in edit mode)
        element.addEventListener('contextmenu', async (e) => {
            if (this.homeMap.editMode) {
                e.preventDefault();
                e.stopPropagation();
                await this.showWidgetContextMenu(instanceId, e);
            }
        });

        // Setup drag functionality for edit mode
        this.setupRemoteWidgetDrag(element, instanceId);

        return element;
    }

    setupRemoteWidgetDrag(element, instanceId) {
        let isDragging = false;
        let offsetX = 0, offsetY = 0;
        let isFirstMove = false;
        let justPlaced = true; // Prevent immediate drag after placement
        
        // Allow dragging after a short delay
        setTimeout(() => { justPlaced = false; }, 100);
        
        // Cache DOM references for performance - will be set on mousedown
        let cachedFloorView = null;
        let cachedImg = null;
        let cachedImgRect = null;
        
        element.addEventListener('mousedown', (e) => {
            if (!this.homeMap.editMode) return;
            if (justPlaced) {
                console.log('⏸️ Ignoring mousedown - widget just placed');
                return; // Ignore mousedown if just placed
            }
            
            console.log('🖱️ Repositioning drag started for', instanceId);
            isDragging = true;
            isFirstMove = true;
            element.classList.add('dragging');
            
            // Cache references once at the start of drag
            const instance = this.widgetInstances.get(instanceId);
            if (instance) {
                cachedFloorView = document.getElementById(`floor-${instance.floor}`);
                if (cachedFloorView) {
                    const container = cachedFloorView.querySelector('.floor-image-container');
                    cachedImg = container?.querySelector('.floor-image');
                    if (cachedImg) {
                        cachedImgRect = cachedImg.getBoundingClientRect();
                    }
                }
            }
            
            // Get current rendered position
            const rect = element.getBoundingClientRect();
            
            // Widget center in viewport coordinates
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            // Calculate offset from cursor to widget center
            offsetX = e.clientX - centerX;
            offsetY = e.clientY - centerY;
            
            e.preventDefault();
            e.stopPropagation(); // Prevent palette drag from triggering
        });
        
        const handleMouseMove = (e) => {
            if (!isDragging || !this.homeMap.editMode) return;
            
            // Use cached references - no DOM queries on every move!
            if (!cachedImg || !cachedImgRect) return;
            
            // On first move, recalculate offset
            if (isFirstMove) {
                isFirstMove = false;
                const rect = element.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                offsetX = e.clientX - centerX;
                offsetY = e.clientY - centerY;
            }
            
            // Get current zoom level
            const zoomLevel = this.homeMap.zoomLevel || 100;
            const scale = zoomLevel / 100;
            
            const containerRect = cachedFloorView.querySelector('.floor-image-container').getBoundingClientRect();
            
            // Calculate widget center position in viewport coordinates
            let centerX = e.clientX - offsetX;
            let centerY = e.clientY - offsetY;
            
            // Clamp to image bounds (in viewport coordinates)
            centerX = Math.max(cachedImgRect.left, Math.min(centerX, cachedImgRect.left + cachedImgRect.width));
            centerY = Math.max(cachedImgRect.top, Math.min(centerY, cachedImgRect.top + cachedImgRect.height));
            
            // Convert to container-relative coordinates and adjust for scale
            let x = (centerX - containerRect.left) / scale;
            let y = (centerY - containerRect.top) / scale;
            
            // Update position in pixels
            element.style.left = `${x}px`;
            element.style.top = `${y}px`;
        };
        
        const handleMouseUp = async (e) => {
            if (!isDragging) return;
            
            isDragging = false;
            element.classList.remove('dragging');
            
            if (this.homeMap.editMode) {
                const instance = this.widgetInstances.get(instanceId);
                if (!instance || !cachedImg || !cachedImgRect) return;
                
                // Calculate final position as percentage
                let centerX = e.clientX - offsetX;
                let centerY = e.clientY - offsetY;
                
                // Clamp to image bounds
                centerX = Math.max(cachedImgRect.left, Math.min(centerX, cachedImgRect.left + cachedImgRect.width));
                centerY = Math.max(cachedImgRect.top, Math.min(centerY, cachedImgRect.top + cachedImgRect.height));
                
                const xPercent = ((centerX - cachedImgRect.left) / cachedImgRect.width) * 100;
                const yPercent = ((centerY - cachedImgRect.top) / cachedImgRect.height) * 100;
                
                // Update instance position
                instance.x = xPercent;
                instance.y = yPercent;
                
                // Clear cached references
                cachedFloorView = null;
                cachedImg = null;
                cachedImgRect = null;
                
                // Save config
                this.savePlacedWidgets();
                
                console.log(`Remote widget ${instanceId} moved to ${xPercent.toFixed(2)}%, ${yPercent.toFixed(2)}%`);
            }
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }

    async handleWidgetClick(instanceId, event) {
        const instance = this.widgetInstances.get(instanceId);
        if (!instance) return;

        // Check if widget is disconnected
        const element = document.querySelector(`[data-widget-instance="${instanceId}"]`);
        if (element && element.classList.contains('disconnected')) {
            this.showNotification(`Widget "${instance.widgetDef.name}" is not connected`, 'error');
            return;
        }

        console.log(`Widget clicked: ${instance.widgetDef.name}`);

        // Send event to QuickApp
        try {
            await this.homeMap.invoke('ws_send_to_client', {
                clientId: instance.clientId,
                message: {
                    type: 'widget-event',
                    widgetId: instance.widgetDef.id,
                    event: 'click',
                    data: {
                        floor: instance.floor,
                        x: instance.x,
                        y: instance.y,
                        timestamp: Date.now(),
                        parameters: instance.parameters || {} // Include instance parameters
                    }
                }
            });
        } catch (error) {
            console.error('Failed to send widget event:', error);
            this.showNotification(`Widget "${instance.widgetDef.name}" disconnected`, 'error');
        }
    }

    markWidgetsAsDisconnected(clientId) {
        this.widgetInstances.forEach((instance, instanceId) => {
            if (instance.clientId === clientId) {
                const element = document.querySelector(`[data-widget-instance="${instanceId}"]`);
                if (element) {
                    element.classList.add('disconnected');
                    element.style.opacity = '0.5';
                    element.style.pointerEvents = 'none';
                    
                    // Update label to show disconnected status
                    const textElement = element.querySelector('.device-text');
                    if (textElement) {
                        textElement.textContent = 'Not connected';
                        textElement.style.color = '#ff6b6b';
                    }
                }
            }
        });
    }

    markAllWidgetsAsDisconnected() {
        this.widgetInstances.forEach((instance, instanceId) => {
            const element = document.querySelector(`[data-widget-instance="${instanceId}"]`);
            if (element) {
                element.classList.add('disconnected');
                element.style.opacity = '0.5';
                element.style.pointerEvents = 'none';
                
                // Update label to show disconnected status
                const textElement = element.querySelector('.device-text');
                if (textElement) {
                    textElement.textContent = 'Not connected';
                    textElement.style.color = '#ff6b6b';
                }
            }
        });
    }

    restorePlacedWidgets(clientId, qaId) {
        // Load saved widget placements from config
        const { homemapConfig } = this.homeMap;
        const savedWidgets = homemapConfig.remoteWidgets || [];

        console.log(`🔄 Restoring widgets for QA: ${qaId}`);
        console.log(`   Found ${savedWidgets.filter(w => w.qaId === qaId).length} saved widgets for this QA`);

        // First, restore visual state of existing widgets for this QA
        this.restoreWidgetVisuals(clientId, qaId);

        // Then create any saved widgets that aren't already placed
        savedWidgets
            .filter(w => w.qaId === qaId)
            .forEach(async (saved) => {
                // Check if this widget instance already exists
                // We identify duplicates by matching qaId, widgetId, floor, and approximate position
                let alreadyExists = false;
                this.widgetInstances.forEach((instance) => {
                    if (instance.widgetDef.qaId === qaId && 
                        instance.widgetDef.id === saved.widgetId &&
                        instance.floor === saved.floor &&
                        Math.abs(instance.x - saved.x) < 0.1 &&
                        Math.abs(instance.y - saved.y) < 0.1) {
                        alreadyExists = true;
                        console.log(`   ⏭️  Widget ${saved.widgetId} already exists at position (${saved.x.toFixed(1)}, ${saved.y.toFixed(1)}) - skipping`);
                    }
                });

                if (alreadyExists) {
                    return; // Skip creating this widget
                }

                const clientData = this.remoteWidgets.get(clientId);
                if (!clientData) return;

                const widgetDef = clientData.widgets.find(w => w.id === saved.widgetId);
                if (widgetDef) {
                    console.log(`   ✨ Creating widget ${saved.widgetId} at position (${saved.x.toFixed(1)}, ${saved.y.toFixed(1)})`);
                    const instanceId = await this.handleWidgetPlaced(
                        widgetDef,
                        saved.floor,
                        saved.x,
                        saved.y
                    );
                    
                    // Restore custom settings if they exist
                    const instance = this.widgetInstances.get(instanceId);
                    if (instance) {
                        if (saved.parameters && Object.keys(saved.parameters).length > 0) {
                            instance.parameters = saved.parameters;
                            console.log(`🔧 Restored parameters for ${widgetDef.name}:`, saved.parameters);
                        }
                        if (saved.customLabel) {
                            instance.customLabel = saved.customLabel;
                            console.log(`🏷️  Restored custom label: "${saved.customLabel}"`);
                        }
                        if (saved.customIconSet) {
                            instance.customIconSet = saved.customIconSet;
                            instance.customIconPackage = saved.customIconPackage || null;
                            console.log(`🎨 Restored custom icon: "${saved.customIconSet}"${saved.customIconPackage ? ` (${saved.customIconPackage})` : ''}`);
                        }
                        
                        // Re-create element to apply custom settings
                        if (saved.customLabel || saved.customIconSet) {
                            const element = document.querySelector(`[data-widget-instance="${instanceId}"]`);
                            if (element) {
                                const newElement = await this.createWidgetElement(widgetDef, instanceId, saved.x, saved.y);
                                element.replaceWith(newElement);
                            }
                        }
                    }
                }
            });
    }
    restoreWidgetVisuals(clientId, qaId) {
        // Find all widget instances for this QA and restore their appearance
        this.widgetInstances.forEach((instance, instanceId) => {
            if (instance.widgetDef.qaId === qaId) {
                const element = document.querySelector(`[data-widget-instance="${instanceId}"]`);
                if (element) {
                    // Remove disconnected state
                    element.classList.remove('disconnected');
                    element.style.opacity = '1';
                    element.style.pointerEvents = 'auto';
                    
                    // Restore original label
                    const textElement = element.querySelector('.device-text');
                    if (textElement) {
                        textElement.textContent = instance.widgetDef.label || instance.widgetDef.name;
                        textElement.style.color = '';
                    }
                    
                    // Update instance's clientId (it may have changed)
                    instance.clientId = clientId;
                }
            }
        });
    }

    savePlacedWidgets() {
        const { homemapConfig } = this.homeMap;
        
        console.log(`💾 savePlacedWidgets called - ${this.widgetInstances.size} widgets in memory`);
        
        const remoteWidgets = [];
        this.widgetInstances.forEach((instance, instanceId) => {
            const widgetData = {
                qaId: instance.widgetDef.qaId,
                widgetId: instance.widgetDef.id,
                floor: instance.floor,
                x: instance.x,
                y: instance.y,
                parameters: instance.parameters || {}
            };
            
            // Only save custom label/icon if set
            if (instance.customLabel) {
                widgetData.customLabel = instance.customLabel;
            }
            if (instance.customIconSet) {
                widgetData.customIconSet = instance.customIconSet;
            }
            if (instance.customIconPackage) {
                widgetData.customIconPackage = instance.customIconPackage;
            }
            
            remoteWidgets.push(widgetData);
        });

        homemapConfig.remoteWidgets = remoteWidgets;
        console.log(`💾 Saving ${remoteWidgets.length} remote widgets to config:`, remoteWidgets);
        this.homeMap.saveConfig();
        console.log(`✅ Config save requested`);
    }

    /**
     * Reposition remote widgets on a floor (called on window resize)
     * Converts from percentage positions to pixel positions accounting for image scaling
     */
    repositionRemoteWidgets(floorId, container, img) {
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

        // Reposition all remote widgets on this floor
        this.widgetInstances.forEach((instance, instanceId) => {
            if (instance.floor !== floorId) return;
            
            const element = document.querySelector(`[data-widget-instance="${instanceId}"]`);
            if (!element) return;

            // Remote widgets store positions as percentages (0-100)
            const xPercent = instance.x / 100;
            const yPercent = instance.y / 100;

            // Calculate pixel position within the actual rendered image
            const xInImage = xPercent * renderedWidth;
            const yInImage = yPercent * renderedHeight;
            
            // Widget position relative to container, accounting for scale
            const xPixel = (imageOffsetX + xInImage) / scale;
            const yPixel = (imageOffsetY + yInImage) / scale;
            
            // Set position
            element.style.left = `${xPixel}px`;
            element.style.top = `${yPixel}px`;
            element.style.transform = 'translate(-50%, -50%)';
        });
    }

    updateServerStatus(running) {
        // Update UI to show server status
        const statusIndicator = document.getElementById('ws-server-status');
        if (statusIndicator) {
            statusIndicator.classList.toggle('running', running);
            statusIndicator.textContent = running ? '🟢 Server Running' : '⚫ Server Stopped';
        }
    }

    updateConnectedClientsList(clients) {
        // Update UI to show connected clients
        const clientsList = document.getElementById('wsConnectedClients');
        if (clientsList) {
            if (clients && clients.length > 0) {
                clientsList.innerHTML = clients.map(clientId => 
                    `<div class="client-item">📱 ${clientId}</div>`
                ).join('');
            } else {
                clientsList.innerHTML = '<div class="no-clients">No clients connected</div>';
            }
        }
    }

    async showWidgetContextMenu(instanceId, event) {
        const instance = this.widgetInstances.get(instanceId);
        if (!instance) return;

        // Remove any existing context menu
        const existingMenu = document.querySelector('.widget-context-menu');
        if (existingMenu) existingMenu.remove();

        // Create context menu
        const menu = document.createElement('div');
        menu.className = 'widget-context-menu';
        menu.style.cssText = `
            position: fixed;
            left: ${event.clientX}px;
            top: ${event.clientY}px;
            background: #2d2d2d;
            border: 1px solid #444;
            border-radius: 6px;
            padding: 4px 0;
            min-width: 150px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            z-index: 10001;
            font-size: 14px;
        `;

        // Menu items
        const menuItems = [
            {
                label: '⚙️ Configure',
                action: async () => {
                    menu.remove();
                    await this.showWidgetParametersDialog(instanceId, event);
                }
            },
            {
                label: '🗑️ Remove',
                action: async () => {
                    menu.remove();
                    await this.removeWidgetInstance(instanceId);
                },
                color: '#e74c3c'
            }
        ];

        // Create menu items
        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.style.cssText = `
                padding: 8px 16px;
                cursor: pointer;
                color: ${item.color || '#e0e0e0'};
                transition: background 0.15s;
            `;
            menuItem.textContent = item.label;
            
            menuItem.addEventListener('mouseenter', () => {
                menuItem.style.background = '#3d3d3d';
            });
            
            menuItem.addEventListener('mouseleave', () => {
                menuItem.style.background = 'transparent';
            });
            
            menuItem.addEventListener('click', item.action);
            
            menu.appendChild(menuItem);
        });

        document.body.appendChild(menu);

        // Close menu when clicking outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        
        // Delay adding the listener to avoid immediate closure
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 10);

        // Adjust position if menu would go off screen
        const menuRect = menu.getBoundingClientRect();
        if (menuRect.right > window.innerWidth) {
            menu.style.left = `${window.innerWidth - menuRect.width - 10}px`;
        }
        if (menuRect.bottom > window.innerHeight) {
            menu.style.top = `${window.innerHeight - menuRect.height - 10}px`;
        }
    }

    async removeWidgetInstance(instanceId) {
        const instance = this.widgetInstances.get(instanceId);
        if (!instance) {
            console.error(`❌ Cannot remove widget ${instanceId} - not found in instances map`);
            return;
        }

        console.log(`🗑️ Removing widget instance ${instanceId}:`, instance);
        console.log(`📊 Before removal: ${this.widgetInstances.size} widgets in memory`);

        // Remove from DOM
        const element = document.querySelector(`[data-widget-instance="${instanceId}"]`);
        if (element) {
            element.remove();
            console.log(`✅ Removed widget ${instanceId} from DOM`);
        } else {
            console.warn(`⚠️ Widget ${instanceId} element not found in DOM`);
        }

        // Remove from instances map
        this.widgetInstances.delete(instanceId);
        console.log(`📊 After removal: ${this.widgetInstances.size} widgets in memory`);

        // Save updated configuration
        console.log(`💾 Saving configuration after removing widget ${instanceId}...`);
        this.savePlacedWidgets();

        this.showNotification(`Widget removed`, 'info');
        console.log(`✅ Widget instance ${instanceId} removed and config saved`);
    }

    async showWidgetParametersDialog(instanceId, event) {
        const instance = this.widgetInstances.get(instanceId);
        if (!instance) return;

        // Create dialog overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'widget-parameters-dialog';
        dialog.style.cssText = `
            background: #2d2d2d;
            border: 1px solid #444;
            border-radius: 8px;
            padding: 20px;
            min-width: 400px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        `;

        // Get current parameters
        const currentParams = instance.parameters || {};
        const currentLabel = instance.customLabel || '';
        
        // Build current qualified icon name for comparison
        // Use custom if set, otherwise use widget's default, otherwise 'defaultButton'
        let currentIconSet = instance.customIconSet || instance.widgetDef.iconSet || 'defaultButton';
        let currentIconPackage = instance.customIconPackage;
        
        // If not using custom and no package set, determine the package for the widget's default
        if (!instance.customIconSet && !currentIconPackage) {
            if (instance.widgetDef.iconSet) {
                // Widget has a default iconSet - it's probably built-in
                currentIconPackage = null; // Will be discovered
            } else {
                // Using 'defaultButton' - it's built-in
                currentIconPackage = 'com.fibaro.built-in';
            }
        }
        
        const currentQualifiedIcon = currentIconPackage 
            ? `${currentIconPackage}:${currentIconSet}` 
            : currentIconSet;
        
        console.log('Current icon:', { currentIconSet, currentIconPackage, currentQualifiedIcon });
        
        // Discover available icon sets
        const iconSets = await this.discoverIconSets();
        let iconSetOptions = '<option value="">Use default icon</option>';
        
        if (iconSets.length > 0) {
            const grouped = {};
            iconSets.forEach(set => {
                if (!grouped[set.location]) grouped[set.location] = [];
                grouped[set.location].push(set);
            });
            
            for (const [location, sets] of Object.entries(grouped)) {
                iconSetOptions += `<optgroup label="${location.charAt(0).toUpperCase() + location.slice(1)}">`;
                sets.forEach(set => {
                    const qualifiedValue = set.packageId ? `${set.packageId}:${set.name}` : set.name;
                    const selected = qualifiedValue === currentQualifiedIcon ? 'selected' : '';
                    iconSetOptions += `<option value="${qualifiedValue}" ${selected}>${set.name}</option>`;
                });
                iconSetOptions += '</optgroup>';
            }
        }

        dialog.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: #e0e0e0;">
                Configure Widget
            </h3>
            <div style="margin-bottom: 20px; color: #aaa; font-size: 14px;">
                <strong>${instance.widgetDef.name}</strong>
                <div style="font-size: 12px; margin-top: 5px;">
                    Customize appearance and parameters for this widget instance
                </div>
            </div>
            
            <div style="border-top: 1px solid #444; padding-top: 15px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #e0e0e0; font-size: 14px;">Appearance</h4>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #e0e0e0; font-size: 14px;">
                        Custom Label
                    </label>
                    <input type="text" id="custom-label" placeholder="Leave empty to use default: ${instance.widgetDef.label || instance.widgetDef.name}" 
                        style="width: 100%; padding: 8px; background: #1e1e1e; border: 1px solid #444; 
                        border-radius: 4px; color: #e0e0e0; font-size: 14px;"
                        value="${currentLabel}">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #e0e0e0; font-size: 14px;">
                        Icon Set
                    </label>
                    <select id="custom-icon" 
                        style="width: 100%; padding: 8px; background: #1e1e1e; border: 1px solid #444; 
                        border-radius: 4px; color: #e0e0e0; font-size: 14px;">
                        ${iconSetOptions}
                    </select>
                    <div style="font-size: 11px; color: #888; margin-top: 3px;">
                        Default: ${instance.widgetDef.iconSet || 'defaultButton (built-in)'}
                    </div>
                </div>
            </div>
            
            <div style="border-top: 1px solid #444; padding-top: 15px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: #e0e0e0; font-size: 14px;">Parameters</h4>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #e0e0e0; font-size: 14px;">
                        Parameter Name
                    </label>
                    <input type="text" id="param-name" placeholder="e.g., profileName, sceneId, command" 
                        style="width: 100%; padding: 8px; background: #1e1e1e; border: 1px solid #444; 
                        border-radius: 4px; color: #e0e0e0; font-size: 14px;"
                        value="${Object.keys(currentParams)[0] || ''}">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #e0e0e0; font-size: 14px;">
                        Parameter Value
                    </label>
                    <input type="text" id="param-value" placeholder="e.g., Away, 123, start" 
                        style="width: 100%; padding: 8px; background: #1e1e1e; border: 1px solid #444; 
                        border-radius: 4px; color: #e0e0e0; font-size: 14px;"
                        value="${Object.values(currentParams)[0] || ''}">
                    <div style="font-size: 11px; color: #888; margin-top: 3px;">
                        Parameters are sent to QuickApp when widget is clicked
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="cancel-btn" style="padding: 8px 16px; background: #444; border: none; 
                    border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 14px;">
                    Cancel
                </button>
                <button id="clear-btn" style="padding: 8px 16px; background: #e74c3c; border: none; 
                    border-radius: 4px; color: white; cursor: pointer; font-size: 14px;">
                    Reset All
                </button>
                <button id="save-btn" style="padding: 8px 16px; background: #4CAF50; border: none; 
                    border-radius: 4px; color: white; cursor: pointer; font-size: 14px;">
                    Save
                </button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Focus on first input
        setTimeout(() => {
            const nameInput = dialog.querySelector('#param-name');
            if (nameInput) nameInput.focus();
        }, 100);

        // Handle buttons
        const saveBtn = dialog.querySelector('#save-btn');
        const clearBtn = dialog.querySelector('#clear-btn');
        const cancelBtn = dialog.querySelector('#cancel-btn');

        const close = () => {
            document.body.removeChild(overlay);
        };

        saveBtn.addEventListener('click', async () => {
            const customLabel = dialog.querySelector('#custom-label').value.trim();
            const customIconQualified = dialog.querySelector('#custom-icon').value.trim();
            const paramName = dialog.querySelector('#param-name').value.trim();
            const paramValue = dialog.querySelector('#param-value').value.trim();

            // Validate parameters - if one is set, both must be set
            if ((paramName && !paramValue) || (!paramName && paramValue)) {
                this.showNotification('Please provide both parameter name and value, or leave both empty', 'error');
                return;
            }

            // Parse qualified icon name: "packageId:iconSetName" or just "iconSetName"
            let iconSetName = null;
            let iconPackage = null;
            
            if (customIconQualified) {
                if (customIconQualified.includes(':')) {
                    const [pkgId, setName] = customIconQualified.split(':', 2);
                    iconPackage = pkgId;
                    iconSetName = setName;
                } else {
                    // No package qualifier - top-level user icon set
                    iconSetName = customIconQualified;
                    iconPackage = null;
                }
            }

            // Update instance
            instance.customLabel = customLabel || null;
            instance.customIconSet = iconSetName;
            instance.customIconPackage = iconPackage;
            instance.parameters = (paramName && paramValue) ? { [paramName]: paramValue } : {};

            // Update the widget element visually
            const element = document.querySelector(`[data-widget-instance="${instanceId}"]`);
            if (element) {
                // Update label
                const labelElement = element.querySelector('.device-text');
                if (labelElement) {
                    labelElement.textContent = customLabel || instance.widgetDef.label || instance.widgetDef.name;
                }

                // Update icon (always update to reflect changes, including clearing to default)
                const iconElement = element.querySelector('.device-icon');
                if (iconElement) {
                    // Determine which icon to load
                    let finalIconSet, finalPackage;
                    
                    if (iconSetName) {
                        // User selected a custom icon
                        finalIconSet = iconSetName;
                        finalPackage = iconPackage;
                    } else if (instance.widgetDef.iconSet) {
                        // Fall back to widget's default
                        finalIconSet = instance.widgetDef.iconSet;
                        finalPackage = null; // Widget defaults usually don't have package
                    } else {
                        // Fall back to defaultButton
                        finalIconSet = 'defaultButton';
                        finalPackage = 'com.fibaro.built-in';
                    }
                    
                    console.log(`Loading icon for widget ${instanceId}:`, { finalIconSet, finalPackage });
                    
                    const iconSet = await this.homeMap.widgetManager.loadIconSet(finalIconSet, finalPackage);
                    const iconPath = this.getIconPathFromSet(iconSet);
                    
                    console.log(`Icon set loaded:`, { iconSet, iconPath });
                    
                    if (iconPath) {
                        await this.homeMap.widgetManager.loadDeviceIcon(iconElement, iconPath);
                        console.log(`✅ Icon updated for widget ${instanceId}`);
                    } else {
                        console.warn(`⚠️ No icon path found for ${finalIconSet}`);
                    }
                }
            }

            this.savePlacedWidgets();
            this.showNotification('Widget configuration saved', 'success');
            console.log(`✅ Widget ${instanceId} configured:`, {
                label: instance.customLabel,
                iconSet: instance.customIconSet,
                iconPackage: instance.customIconPackage,
                parameters: instance.parameters
            });
            close();
        });

        clearBtn.addEventListener('click', async () => {
            instance.parameters = {};
            instance.customLabel = null;
            instance.customIconSet = null;
            instance.customIconPackage = null;
            
            // Reset widget element to defaults
            const element = document.querySelector(`[data-widget-instance="${instanceId}"]`);
            if (element) {
                const labelElement = element.querySelector('.device-text');
                if (labelElement) {
                    labelElement.textContent = instance.widgetDef.label || instance.widgetDef.name;
                }
                
                const iconElement = element.querySelector('.device-icon');
                if (iconElement) {
                    const defaultIconSet = instance.widgetDef.iconSet || 'defaultButton';
                    const defaultPackage = instance.widgetDef.iconSet ? null : 'com.fibaro.built-in';
                    const iconSet = await this.homeMap.widgetManager.loadIconSet(defaultIconSet, defaultPackage);
                    const iconPath = this.getIconPathFromSet(iconSet);
                    if (iconPath) {
                        await this.homeMap.widgetManager.loadDeviceIcon(iconElement, iconPath);
                    }
                }
            }
            
            this.savePlacedWidgets();
            this.showNotification('Widget reset to defaults', 'info');
            console.log(`🗑️ Widget ${instanceId} reset to defaults`);
            close();
        });

        cancelBtn.addEventListener('click', close);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                close();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    showNotification(message, type = 'info') {
        if (this.homeMap.showNotification) {
            this.homeMap.showNotification(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    async getConnectedClients() {
        try {
            const clients = await this.homeMap.invoke('ws_get_connected_clients');
            return clients;
        } catch (error) {
            console.error('Failed to get connected clients:', error);
            return [];
        }
    }

    async discoverIconSets() {
        const iconSets = [];
        const dataPath = this.homeMap.dataPath;
        
        console.log('Discovering icon sets in:', dataPath);
        
        try {
            // Check built-in icons
            try {
                const builtInPath = `${dataPath}/icons/built-in`;
                const builtInDirs = await this.homeMap.invoke('list_directory', { path: builtInPath });
                builtInDirs.forEach(dir => {
                    if (dir.endsWith('/')) {
                        const name = dir.slice(0, -1);
                        iconSets.push({ 
                            name, 
                            location: 'built-in', 
                            path: `icons/built-in/${name}`,
                            packageId: 'com.fibaro.built-in'
                        });
                    }
                });
            } catch (e) {
                console.log('No built-in icons folder:', e.message);
            }
            
            // Check user icons (top-level icons folder)
            try {
                const iconsPath = `${dataPath}/icons`;
                const iconDirs = await this.homeMap.invoke('list_directory', { path: iconsPath });
                iconDirs.forEach(dir => {
                    if (dir.endsWith('/') && dir !== 'built-in/' && dir !== 'packages/') {
                        const name = dir.slice(0, -1);
                        iconSets.push({ 
                            name, 
                            location: 'user', 
                            path: `icons/${name}`,
                            packageId: null
                        });
                    }
                });
            } catch (e) {
                console.log('No user icons folder:', e.message);
            }
            
            // Check package icons
            try {
                const packagesPath = `${dataPath}/icons/packages`;
                const packageDirs = await this.homeMap.invoke('list_directory', { path: packagesPath });
                for (const pkgDir of packageDirs) {
                    if (pkgDir.endsWith('/')) {
                        const pkgName = pkgDir.slice(0, -1);
                        try {
                            const pkgIconPath = `${packagesPath}/${pkgName}`;
                            const iconSetDirs = await this.homeMap.invoke('list_directory', { path: pkgIconPath });
                            iconSetDirs.forEach(dir => {
                                if (dir.endsWith('/')) {
                                    const name = dir.slice(0, -1);
                                    iconSets.push({ 
                                        name, 
                                        location: `package: ${pkgName}`, 
                                        path: `icons/packages/${pkgName}/${name}`,
                                        packageId: pkgName
                                    });
                                }
                            });
                        } catch (e) {
                            console.log(`Could not read package ${pkgName}:`, e.message);
                        }
                    }
                }
            } catch (e) {
                console.log('No packages folder:', e.message);
            }
            
        } catch (error) {
            console.error('Error discovering icon sets:', error);
        }
        
        console.log(`Discovered ${iconSets.length} icon sets`);
        return iconSets;
    }

    getRemoteWidgetInfo() {
        const info = [];
        this.remoteWidgets.forEach((clientData, clientId) => {
            info.push({
                clientId,
                qaId: clientData.qaId,
                qaName: clientData.qaName,
                widgetCount: clientData.widgets.length,
                widgets: clientData.widgets.map(w => ({
                    id: w.id,
                    name: w.name
                }))
            });
        });
        return info;
    }
}
