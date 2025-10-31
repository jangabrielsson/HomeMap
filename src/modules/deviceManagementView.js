// deviceManagementView.js - Unified device management view
export class DeviceManagementView {
    constructor(app) {
        this.app = app;
        this.panel = null;
        this.hc3Devices = [];
        this.sortColumn = 'status'; // status (installed first), id, name, type
        this.sortDirection = 'asc'; // asc or desc
    }

    /**
     * Open the device management panel
     */
    async openPanel() {
        // Check if panel already exists
        if (this.panel) {
            return;
        }

        try {
            // Load mapping rules first
            await this.app.autoMapManager.loadMappingRules();

            // Fetch HC3 devices
            this.hc3Devices = await this.app.hc3ApiManager.fetchDevices();
            console.log(`Loaded ${this.hc3Devices.length} HC3 devices`);

            // Create panel
            await this.createPanel();
            
            // Show panel with animation
            setTimeout(() => {
                this.panel.classList.add('open');
            }, 10);

        } catch (error) {
            console.error('Failed to open device management:', error);
            alert(`Failed to load devices:\n\n${error.message || error}`);
        }
    }

    /**
     * Create the device management panel
     */
    async createPanel() {
        this.panel = document.createElement('div');
        this.panel.className = 'device-management-panel';
        this.panel.id = 'deviceManagementPanel';

        // Get available widgets from package manager (same as dialog does)
        const packageManager = this.app.widgetManager.packageManager;
        const builtInWidgets = await packageManager.discoverBuiltInWidgets();
        
        // Create widget options array with display names and values
        const widgetOptions = builtInWidgets.map(w => ({
            value: w.id,
            display: `${w.id} (com.fibaro.built-in)`
        }));
        
        // Add widgets from installed packages
        if (packageManager.installedPackages?.packages) {
            for (const [packageId, packageInfo] of Object.entries(packageManager.installedPackages.packages)) {
                for (const widgetId of packageInfo.manifest.provides.widgets) {
                    widgetOptions.push({
                        value: `${packageId}/${widgetId}`,
                        display: `${widgetId} (${packageId})`
                    });
                }
            }
        }
        
        console.log('Available widgets for device management:', widgetOptions);
        
        // Store for later use
        this.widgetOptions = widgetOptions;
        this.floors = this.app.homemapConfig.floors;

        // Build device list
        const deviceRows = this.hc3Devices.map(hc3Device => {
            const installedDevice = this.app.homemapConfig.devices.find(d => d.id === hc3Device.id);
            const isInstalled = !!installedDevice;
            
            // Get suggested widget
            const suggestedWidget = this.app.autoMapManager.findWidgetForDevice(hc3Device);
            const widget = installedDevice?.type || suggestedWidget || 'genericdevice';
            const floorId = installedDevice?.floor_id || this.floors[0]?.id;
            const deviceName = installedDevice?.name || hc3Device.name;
            
            const isMapped = suggestedWidget !== null;

            return {
                hc3Device,
                installedDevice,
                isInstalled,
                widget,
                floorId,
                deviceName,
                isMapped
            };
        });

        // Store device rows for later reference
        this.deviceRows = deviceRows;

        // Apply initial sorting
        this.sortDeviceRows();

        const installedCount = deviceRows.filter(d => d.isInstalled).length;
        const mappedCount = deviceRows.filter(d => d.isMapped && !d.isInstalled).length;
        const unmappedCount = deviceRows.filter(d => !d.isMapped && !d.isInstalled).length;

        this.panel.innerHTML = `
            <div class="device-management-content">
                <div class="device-management-header">
                    <h2>🛠️ Device Management</h2>
                    <button class="close-button" id="closeDeviceManagement">✕</button>
                </div>

                <div class="device-management-info">
                    <p>
                        <strong>${this.hc3Devices.length} devices</strong> from HC3 
                        (${installedCount} installed, ${mappedCount} available mapped, ${unmappedCount} available unmapped)
                    </p>
                </div>

                <div class="device-management-controls">
                    <button id="refreshHC3Devices" class="secondary-button">🔄 Refresh from HC3</button>
                </div>

                <div class="device-management-sort">
                    <span style="margin-right: 10px; font-weight: 500;">Sort by:</span>
                    <button class="sort-btn ${this.sortColumn === 'status' ? 'active' : ''}" data-sort="status">Status ${this.sortColumn === 'status' ? (this.sortDirection === 'asc' ? '↑' : '↓') : ''}</button>
                    <button class="sort-btn ${this.sortColumn === 'id' ? 'active' : ''}" data-sort="id">ID ${this.sortColumn === 'id' ? (this.sortDirection === 'asc' ? '↑' : '↓') : ''}</button>
                    <button class="sort-btn ${this.sortColumn === 'name' ? 'active' : ''}" data-sort="name">Name ${this.sortColumn === 'name' ? (this.sortDirection === 'asc' ? '↑' : '↓') : ''}</button>
                    <button class="sort-btn ${this.sortColumn === 'type' ? 'active' : ''}" data-sort="type">Type ${this.sortColumn === 'type' ? (this.sortDirection === 'asc' ? '↑' : '↓') : ''}</button>
                </div>

                <div class="device-management-list" id="deviceListContainer">
                    ${this.renderDeviceList()}
                </div>

                <div class="device-management-footer">
                    <button id="closeDeviceManagementFooter" class="secondary-button">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.panel);

        // Setup event handlers
        this.setupEventHandlers();
    }

    /**
     * Sort device rows based on current sort column and direction
     */
    sortDeviceRows() {
        const direction = this.sortDirection === 'asc' ? 1 : -1;
        
        this.deviceRows.sort((a, b) => {
            let comparison = 0;
            
            switch (this.sortColumn) {
                case 'status':
                    // Installed first, then mapped, then unmapped
                    if (a.isInstalled !== b.isInstalled) {
                        comparison = b.isInstalled - a.isInstalled;
                    } else if (a.isMapped !== b.isMapped) {
                        comparison = b.isMapped - a.isMapped;
                    } else {
                        comparison = a.deviceName.localeCompare(b.deviceName);
                    }
                    break;
                    
                case 'id':
                    comparison = a.hc3Device.id - b.hc3Device.id;
                    break;
                    
                case 'name':
                    comparison = a.deviceName.localeCompare(b.deviceName);
                    break;
                    
                case 'type':
                    comparison = a.hc3Device.type.localeCompare(b.hc3Device.type);
                    break;
            }
            
            return comparison * direction;
        });
    }

    /**
     * Render the device list HTML
     */
    renderDeviceList() {
        return this.deviceRows.map((row, index) => `
            <div class="device-row ${row.isInstalled ? 'installed' : ''}" data-index="${index}" data-device-id="${row.hc3Device.id}">
                <div class="device-row-content">
                    <div class="device-row-header">
                        <input type="text" 
                            class="device-name-input" 
                            data-index="${index}"
                            value="${this.escapeHtml(row.deviceName)}"
                            placeholder="Device name">
                        ${row.isInstalled ? '<span class="installed-badge">✓</span>' : ''}
                        ${row.isInstalled ? '<button class="edit-device-btn" data-index="' + index + '" title="Edit device properties">✏️</button>' : ''}
                        ${!row.isMapped && !row.isInstalled ? '<span class="unmapped-badge">Unmapped</span>' : ''}
                    </div>
                    <div class="device-row-meta">
                        ID: ${row.hc3Device.id} | Type: ${row.hc3Device.type}
                    </div>
                    <div class="device-row-selectors">
                        <div class="device-selector-group">
                            <label>Widget:</label>
                            <select class="device-widget-select" data-index="${index}">
                                ${this.widgetOptions.map(w => 
                                    `<option value="${w.value}" ${w.value === row.widget ? 'selected' : ''}>${w.display}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="device-selector-group">
                            <label>Floor:</label>
                            <select class="device-floor-select" data-index="${index}">
                                ${this.floors.map(f => 
                                    `<option value="${f.id}" ${f.id === row.floorId ? 'selected' : ''}>${this.escapeHtml(f.name)}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                </div>
                <div class="device-row-actions">
                    <button class="install-toggle-btn ${row.isInstalled ? 'uninstall' : 'install'}" 
                            data-index="${index}" 
                            title="${row.isInstalled ? 'Uninstall device' : 'Install device'}">
                        ${row.isInstalled ? 'Uninstall' : 'Install'}
                    </button>
                </div>
            </div>
        `).join('');
    }

    /**
     * Update the device list display after sorting
     */
    updateDeviceListDisplay() {
        const container = this.panel.querySelector('#deviceListContainer');
        if (container) {
            container.innerHTML = this.renderDeviceList();
            // Re-attach event handlers for the new elements
            this.attachDeviceListHandlers();
        }
        
        // Update sort buttons
        const sortButtons = this.panel.querySelectorAll('.sort-btn');
        sortButtons.forEach(btn => {
            const column = btn.dataset.sort;
            if (column === this.sortColumn) {
                btn.classList.add('active');
                btn.textContent = btn.textContent.replace(/[↑↓]/g, '').trim() + ' ' + (this.sortDirection === 'asc' ? '↑' : '↓');
            } else {
                btn.classList.remove('active');
                btn.textContent = btn.textContent.replace(/[↑↓]/g, '').trim();
            }
        });
    }

    /**
     * Setup event handlers for the panel
     */
    setupEventHandlers() {
        // Close buttons
        const closeBtn = this.panel.querySelector('#closeDeviceManagement');
        const closeFooterBtn = this.panel.querySelector('#closeDeviceManagementFooter');
        
        closeBtn.addEventListener('click', () => this.closePanel());
        if (closeFooterBtn) {
            closeFooterBtn.addEventListener('click', () => this.closePanel());
        }

        // Sort buttons
        const sortButtons = this.panel.querySelectorAll('.sort-btn');
        sortButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const column = btn.dataset.sort;
                if (this.sortColumn === column) {
                    // Toggle direction
                    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    // New column, default to ascending
                    this.sortColumn = column;
                    this.sortDirection = 'asc';
                }
                this.sortDeviceRows();
                this.updateDeviceListDisplay();
            });
        });

        // Refresh button
        const refreshBtn = this.panel.querySelector('#refreshHC3Devices');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await this.refreshDevices();
            });
        }

        // Close on overlay click
        this.panel.addEventListener('click', (e) => {
            if (e.target === this.panel) {
                this.closePanel();
            }
        });

        // Device list handlers
        this.attachDeviceListHandlers();
    }

    /**
     * Attach event handlers to device list elements
     */
    attachDeviceListHandlers() {
        // Install/Uninstall buttons
        const installButtons = this.panel.querySelectorAll('.install-toggle-btn');
        installButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                const index = parseInt(btn.dataset.index);
                const row = this.deviceRows[index];
                
                if (row.isInstalled) {
                    await this.uninstallDevice(index);
                } else {
                    await this.installDevice(index);
                }
            });
        });

        // Track changes on inputs for installed devices
        const nameInputs = this.panel.querySelectorAll('.device-name-input');
        const widgetSelects = this.panel.querySelectorAll('.device-widget-select');
        const floorSelects = this.panel.querySelectorAll('.device-floor-select');

        nameInputs.forEach(input => {
            input.addEventListener('change', async () => {
                const index = parseInt(input.dataset.index);
                await this.updateDevice(index);
            });
        });
        
        widgetSelects.forEach(select => {
            select.addEventListener('change', async () => {
                const index = parseInt(select.dataset.index);
                await this.updateDevice(index);
            });
        });
        
        floorSelects.forEach(select => {
            select.addEventListener('change', async () => {
                const index = parseInt(select.dataset.index);
                await this.updateDevice(index);
            });
        });

        // Edit device buttons
        const editButtons = this.panel.querySelectorAll('.edit-device-btn');
        editButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                this.editDeviceProperties(index);
            });
        });
    }

    /**
     * Install a device
     */
    async installDevice(index) {
        const row = this.deviceRows[index];
        const rowElement = this.panel.querySelector(`.device-row[data-index="${index}"]`);
        const nameInput = this.panel.querySelector(`.device-name-input[data-index="${index}"]`);
        const widgetSelect = this.panel.querySelector(`.device-widget-select[data-index="${index}"]`);
        const floorSelect = this.panel.querySelector(`.device-floor-select[data-index="${index}"]`);
        const installBtn = this.panel.querySelector(`.install-toggle-btn[data-index="${index}"]`);

        try {
            const floorId = floorSelect.value;
            const floor = this.app.homemapConfig.floors.find(f => f.id === floorId);
            
            // Calculate position for new device
            const existingDevicesOnFloor = this.app.homemapConfig.devices.filter(d => d.floor_id === floorId);
            const pos = this.app.autoMapManager.calculateGridPosition(
                existingDevicesOnFloor.length, 
                floor.width, 
                floor.height
            );

            // Create new device
            const newDevice = {
                id: row.hc3Device.id,
                name: nameInput.value.trim() || row.hc3Device.name,
                type: widgetSelect.value,
                floor_id: floorId,
                position: { x: pos.x, y: pos.y },
                state: {},
                params: {}
            };

            // Add to config
            this.app.homemapConfig.devices.push(newDevice);

            // Save
            await this.app.saveConfig();

            // Update UI
            row.isInstalled = true;
            row.installedDevice = newDevice;
            rowElement.classList.add('installed');
            
            // Update button
            installBtn.textContent = 'Uninstall';
            installBtn.classList.remove('install');
            installBtn.classList.add('uninstall');
            installBtn.title = 'Uninstall device';
            
            // Add installed badge if not present
            const header = rowElement.querySelector('.device-row-header');
            if (!header.querySelector('.installed-badge')) {
                const badge = document.createElement('span');
                badge.className = 'installed-badge';
                badge.textContent = '✓';
                header.appendChild(badge);
            }
            
            // Add edit button if not present
            if (!header.querySelector('.edit-device-btn')) {
                const editBtn = document.createElement('button');
                editBtn.className = 'edit-device-btn';
                editBtn.innerHTML = '✏️';
                editBtn.title = 'Edit device properties';
                editBtn.onclick = () => this.editDeviceProperties(index);
                header.appendChild(editBtn);
            }

            // Refresh floor display
            await this.app.floorManager.renderFloors();

            console.log(`Installed device: ${newDevice.name}`);

        } catch (error) {
            console.error('Failed to install device:', error);
            alert(`Failed to install device:\n\n${error.message || error}`);
        }
    }

    /**
     * Uninstall a device
     */
    async uninstallDevice(index) {
        const row = this.deviceRows[index];
        const rowElement = this.panel.querySelector(`.device-row[data-index="${index}"]`);
        const nameInput = this.panel.querySelector(`.device-name-input[data-index="${index}"]`);
        const widgetSelect = this.panel.querySelector(`.device-widget-select[data-index="${index}"]`);
        const floorSelect = this.panel.querySelector(`.device-floor-select[data-index="${index}"]`);
        const installBtn = this.panel.querySelector(`.install-toggle-btn[data-index="${index}"]`);

        if (!confirm(`Uninstall "${row.deviceName}"?`)) {
            return;
        }

        try {
            // Remove from config
            const deviceIndex = this.app.homemapConfig.devices.findIndex(d => d.id === row.hc3Device.id);
            if (deviceIndex !== -1) {
                this.app.homemapConfig.devices.splice(deviceIndex, 1);
            }

            // Save
            await this.app.saveConfig();

            // Update UI
            row.isInstalled = false;
            row.installedDevice = null;
            rowElement.classList.remove('installed');
            
            // Reset to defaults
            nameInput.value = row.hc3Device.name;
            const suggestedWidget = this.app.autoMapManager.findWidgetForDevice(row.hc3Device);
            widgetSelect.value = suggestedWidget || 'genericdevice';
            floorSelect.value = this.app.homemapConfig.floors[0]?.id;
            
            // Update button
            installBtn.textContent = 'Install';
            installBtn.classList.remove('uninstall');
            installBtn.classList.add('install');
            installBtn.title = 'Install device';
            
            // Remove installed badge
            const badge = rowElement.querySelector('.installed-badge');
            if (badge) {
                badge.remove();
            }
            
            // Remove edit button
            const editBtn = rowElement.querySelector('.edit-device-btn');
            if (editBtn) {
                editBtn.remove();
            }

            // Refresh floor display
            await this.app.floorManager.renderFloors();

            console.log(`Uninstalled device: ${row.deviceName}`);

        } catch (error) {
            console.error('Failed to uninstall device:', error);
            alert(`Failed to uninstall device:\n\n${error.message || error}`);
        }
    }

    /**
     * Update an installed device's settings
     */
    async updateDevice(index) {
        const row = this.deviceRows[index];
        
        if (!row.isInstalled) {
            return; // Can't update non-installed device
        }

        const nameInput = this.panel.querySelector(`.device-name-input[data-index="${index}"]`);
        const widgetSelect = this.panel.querySelector(`.device-widget-select[data-index="${index}"]`);
        const floorSelect = this.panel.querySelector(`.device-floor-select[data-index="${index}"]`);

        try {
            const device = this.app.homemapConfig.devices.find(d => d.id === row.hc3Device.id);
            
            if (!device) {
                console.error('Device not found in config');
                return;
            }

            const oldFloorId = device.floor_id;
            const newFloorId = floorSelect.value;

            // Update device properties
            device.name = nameInput.value.trim() || row.hc3Device.name;
            device.type = widgetSelect.value;
            device.floor_id = newFloorId;

            // If floor changed, recalculate position
            if (oldFloorId !== newFloorId) {
                const floor = this.app.homemapConfig.floors.find(f => f.id === newFloorId);
                const existingDevicesOnFloor = this.app.homemapConfig.devices.filter(
                    d => d.floor_id === newFloorId && d.id !== device.id
                );
                const pos = this.app.autoMapManager.calculateGridPosition(
                    existingDevicesOnFloor.length,
                    floor.width,
                    floor.height
                );
                device.position = { x: pos.x, y: pos.y };
            }

            // Save
            await this.app.saveConfig();

            // Refresh floor display
            await this.app.floorManager.renderFloors();

            console.log(`Updated device: ${device.name}`);

        } catch (error) {
            console.error('Failed to update device:', error);
            alert(`Failed to update device:\n\n${error.message || error}`);
        }
    }

    /**
     * Edit device properties dialog
     */
    editDeviceProperties(index) {
        const row = this.deviceRows[index];
        
        if (!row.isInstalled) {
            return;
        }

        const device = this.app.homemapConfig.devices.find(d => d.id === row.hc3Device.id);
        
        if (!device) {
            console.error('Device not found in config');
            return;
        }

        // Use the existing edit device dialog
        this.app.dialogManager.showEditDeviceDialog(device);
    }

    /**
     * Refresh devices from HC3
     */
    async refreshDevices() {
        try {
            // Close panel
            this.closePanel();

            // Reopen (which will fetch fresh data)
            await this.openPanel();

        } catch (error) {
            console.error('Failed to refresh devices:', error);
            alert(`Failed to refresh devices:\n\n${error.message || error}`);
        }
    }

    /**
     * Close the panel
     */
    closePanel() {
        if (!this.panel) return;

        this.panel.classList.remove('open');
        
        setTimeout(() => {
            if (this.panel && this.panel.parentElement) {
                this.panel.parentElement.removeChild(this.panel);
            }
            this.panel = null;
            this.deviceRows = [];
            this.availableWidgets = [];
        }, 300); // Match CSS transition duration
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
