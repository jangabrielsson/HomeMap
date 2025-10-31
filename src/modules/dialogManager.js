// dialogManager.js - UI dialogs for device management and widget interactions
import { normalizeDeviceFormat } from './deviceHelpers.js';

export class DialogManager {
    constructor(homeMapInstance) {
        this.app = homeMapInstance;
    }

    /**
     * Discover available icon sets
     */
    async discoverIconSets() {
        const iconSets = [];
        const dataPath = this.app.dataPath;
        
        console.log('Discovering icon sets in:', dataPath);
        
        try {
            // Check built-in icons
            try {
                const builtInPath = `${dataPath}/icons/built-in`;
                console.log('Checking built-in path:', builtInPath);
                const builtInDirs = await this.app.invoke('list_directory', { path: builtInPath });
                console.log('Built-in dirs found:', builtInDirs);
                builtInDirs.forEach(dir => {
                    if (dir.endsWith('/')) {
                        const name = dir.slice(0, -1);
                        iconSets.push({ name, location: 'built-in', path: `icons/built-in/${name}` });
                    }
                });
            } catch (e) {
                console.log('No built-in icons folder:', e.message);
            }
            
            // Check user icons (top-level icons folder)
            try {
                const iconsPath = `${dataPath}/icons`;
                console.log('Checking user icons path:', iconsPath);
                const iconDirs = await this.app.invoke('list_directory', { path: iconsPath });
                console.log('User icon dirs found:', iconDirs);
                iconDirs.forEach(dir => {
                    if (dir.endsWith('/') && dir !== 'built-in/' && dir !== 'packages/') {
                        const name = dir.slice(0, -1);
                        iconSets.push({ name, location: 'user', path: `icons/${name}` });
                    }
                });
            } catch (e) {
                console.log('No user icons folder:', e.message);
            }
            
            // Check package icons
            try {
                const packagesPath = `${dataPath}/icons/packages`;
                console.log('Checking packages path:', packagesPath);
                const packageDirs = await this.app.invoke('list_directory', { path: packagesPath });
                console.log('Package dirs found:', packageDirs);
                for (const pkgDir of packageDirs) {
                    if (pkgDir.endsWith('/')) {
                        const pkgName = pkgDir.slice(0, -1);
                        try {
                            const pkgIconPath = `${packagesPath}/${pkgName}`;
                            const iconSetDirs = await this.app.invoke('list_directory', { path: pkgIconPath });
                            iconSetDirs.forEach(dir => {
                                if (dir.endsWith('/')) {
                                    const name = dir.slice(0, -1);
                                    iconSets.push({ name, location: `package: ${pkgName}`, path: `icons/packages/${pkgName}/${name}` });
                                }
                            });
                        } catch (e) {
                            // Skip packages without icon folders
                        }
                    }
                }
            } catch (e) {
                console.log('No package icons folder:', e.message);
            }
        } catch (error) {
            console.error('Error discovering icon sets:', error);
        }
        
        console.log('Total icon sets discovered:', iconSets);
        return iconSets;
    }

    /**
     * Show dialog to add a new device
     */
    async showAddDeviceDialog(floorId, position) {
        const modal = document.createElement('div');
        modal.className = 'slider-modal';
        
        // Ensure package manager is initialized
        const packageManager = this.app.widgetManager.packageManager;
        if (!packageManager.dataPath) {
            await packageManager.init();
        }
        
        // Build floor checkboxes
        const floorsHtml = this.app.homemapConfig.floors.map(floor => {
            const isChecked = floor.id === floorId; // Default to the floor we clicked on
            return `
                <div class="floor-checkbox">
                    <input type="checkbox" id="add-floor-${floor.id}" value="${floor.id}" ${isChecked ? 'checked' : ''}>
                    <label for="add-floor-${floor.id}">${floor.name}</label>
                </div>
            `;
        }).join('');
        
        // Build widget type options - include all installed packages
        let widgetOptions = '';
        
        console.log('Building widget options...');
        console.log('Package manager:', packageManager);
        console.log('Installed packages:', packageManager.installedPackages);
        
        // Add all built-in widgets
        const builtInWidgets = await packageManager.discoverBuiltInWidgets();
        if (builtInWidgets.length > 0) {
            widgetOptions += '<optgroup label="Built-in Widgets">';
            builtInWidgets.forEach(w => {
                widgetOptions += `<option value="${w.id}">${w.id} (com.fibaro.built-in)</option>`;
            });
            widgetOptions += '</optgroup>';
        }
        
        // Add widgets from installed packages
        if (packageManager.installedPackages?.packages) {
            const availableWidgets = [];
            
            for (const [packageId, packageInfo] of Object.entries(packageManager.installedPackages.packages)) {
                for (const widgetId of packageInfo.manifest.provides.widgets) {
                    // Always add package version with full reference
                    availableWidgets.push({
                        id: widgetId,
                        package: packageId,
                        fullRef: `${packageId}/${widgetId}`
                    });
                }
            }
            
            if (availableWidgets.length > 0) {
                widgetOptions += '<optgroup label="Installed Packages">';
                availableWidgets.forEach(w => {
                    widgetOptions += `<option value="${w.fullRef}">${w.id} (${w.package})</option>`;
                });
                widgetOptions += '</optgroup>';
            }
        }
        
        // Discover available icon sets
        const iconSets = await this.discoverIconSets();
        let iconSetOptions = '<option value="">Use widget default icons</option>';
        if (iconSets.length > 0) {
            const grouped = {};
            iconSets.forEach(set => {
                if (!grouped[set.location]) grouped[set.location] = [];
                grouped[set.location].push(set);
            });
            
            for (const [location, sets] of Object.entries(grouped)) {
                iconSetOptions += `<optgroup label="${location.charAt(0).toUpperCase() + location.slice(1)}">`;
                sets.forEach(set => {
                    iconSetOptions += `<option value="${set.name}">${set.name}</option>`;
                });
                iconSetOptions += '</optgroup>';
            }
        }
        
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
                        <label>Custom Icon Set <span style="color: #888; font-size: 0.9em;">(Optional)</span></label>
                        <select id="addDeviceIconSet" class="form-input">
                            ${iconSetOptions}
                        </select>
                        <small style="color: #888; display: block; margin-top: 4px;">
                            Override the widget's default icons with your own icon set
                        </small>
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
        const iconSetSelect = modal.querySelector('#addDeviceIconSet');
        
        // Add button
        modal.querySelector('.btn-apply').addEventListener('click', async () => {
            const deviceId = parseInt(idInput.value);
            const deviceName = nameInput.value.trim();
            const deviceType = typeSelect.value;
            const customIconSet = iconSetSelect.value;
            const selectedFloors = Array.from(modal.querySelectorAll('.floor-checkbox input:checked'))
                .map(cb => cb.value);
            
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
            if (this.app.homemapConfig.devices.find(d => d.id === deviceId)) {
                alert(`Device with ID ${deviceId} already exists`);
                return;
            }
            
            // Create device entries - one per selected floor (simple format)
            const newDevices = selectedFloors.map(fId => {
                const device = {
                    id: deviceId,
                    name: deviceName,
                    floor_id: fId,
                    position: fId === floorId ? position : { x: 500, y: 300 } // Use click position for current floor
                };
                
                // Handle widget reference - could be simple type or package/widget
                if (deviceType.includes('/')) {
                    // Explicit package reference (e.g., "com.jangabrielsson.gauge/gauge")
                    device.widget = deviceType;
                    // Extract the widget ID part for type
                    device.type = deviceType.split('/')[1];
                } else {
                    // Simple widget type
                    device.type = deviceType;
                }
                
                // Add custom parameters if specified
                if (customIconSet) {
                    device.params = {
                        iconSet: customIconSet
                    };
                }
                
                return device;
            });
            
            // Add all device entries to config
            this.app.homemapConfig.devices.push(...newDevices);
            
            console.log('Adding new device(s):', newDevices);
            console.log('Total devices now:', this.app.homemapConfig.devices.length);
            
            const wasEmpty = this.app.homemapConfig.devices.length === newDevices.length;
            
            try {
                await this.app.saveConfig();
                console.log('Config saved successfully');
                
                // Reload widgets for the new device type if needed
                await this.app.loadWidgets();
                console.log('Widgets reloaded');
                
                // Re-render floors to show the new device
                this.app.floorManager.renderFloors();
                console.log('Floors rendered');
                
                // Start event polling if this was the first device (but only if auth is not locked)
                if (wasEmpty && !this.app.eventManager.isPolling) {
                    if (!this.app.hc3ApiManager.isAuthLocked()) {
                        console.log('First device added, starting event polling');
                        this.app.startEventPolling();
                    } else {
                        console.log('First device added, but auth is locked - skipping event polling');
                    }
                }
            } catch (error) {
                console.error('Error adding device:', error);
                alert(`Failed to add device: ${error.message}`);
                // Remove all added device entries if save failed
                newDevices.forEach(newDev => {
                    const index = this.app.homemapConfig.devices.findIndex(d => 
                        d.id === newDev.id && d.floor_id === newDev.floor_id
                    );
                    if (index !== -1) {
                        this.app.homemapConfig.devices.splice(index, 1);
                    }
                });
                return;
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

    /**
     * Show dialog to edit an existing device
     */
    async showEditDeviceDialog(device) {
        const modal = document.createElement('div');
        modal.className = 'slider-modal';
        
        // Ensure package manager is initialized
        const packageManager = this.app.widgetManager.packageManager;
        if (!packageManager.dataPath) {
            await packageManager.init();
        }
        
        // Get current device floors
        const deviceFloors = this.app.getDeviceFloors(device);
        
        // Build floor checkboxes
        const floorsHtml = this.app.homemapConfig.floors.map(floor => {
            const isChecked = deviceFloors.includes(floor.id);
            return `
                <div class="floor-checkbox">
                    <input type="checkbox" id="floor-${floor.id}" value="${floor.id}" ${isChecked ? 'checked' : ''}>
                    <label for="floor-${floor.id}">${floor.name}</label>
                </div>
            `;
        }).join('');
        
        // Build widget type options - include all installed packages
        let widgetOptions = '';
        
        // Determine current widget reference (could be "type" or explicit "widget")
        const currentWidget = device.widget || device.type;
        
        // Get loaded widget types to avoid duplicates
        const loadedWidgetTypes = new Set(Object.keys(this.app.widgetManager.widgets));
        
        // Add built-in widgets (including both loaded and unloaded)
        const builtInWidgets = await packageManager.discoverBuiltInWidgets();
        if (builtInWidgets.length > 0) {
            widgetOptions += '<optgroup label="Built-in Widgets">';
            builtInWidgets.forEach(w => {
                const selected = w.id === currentWidget ? 'selected' : '';
                widgetOptions += `<option value="${w.id}" ${selected}>${w.id} (com.fibaro.built-in)</option>`;
            });
            widgetOptions += '</optgroup>';
        }
        
        // Add widgets from installed packages that aren't loaded yet
        if (packageManager.installedPackages?.packages) {
            const availableWidgets = [];
            
            for (const [packageId, packageInfo] of Object.entries(packageManager.installedPackages.packages)) {
                for (const widgetId of packageInfo.manifest.provides.widgets) {
                    const fullRef = `${packageId}/${widgetId}`;
                    // Always add package version with full reference
                    availableWidgets.push({
                        id: widgetId,
                        fullRef: fullRef,
                        package: packageId,
                        selected: fullRef === currentWidget
                    });
                }
            }
            
            if (availableWidgets.length > 0) {
                widgetOptions += '<optgroup label="Installed Packages">';
                availableWidgets.forEach(w => {
                    const selected = w.selected ? 'selected' : '';
                    widgetOptions += `<option value="${w.fullRef}" ${selected}>${w.id} (${w.package})</option>`;
                });
                widgetOptions += '</optgroup>';
            }
        }
        
        // Discover available icon sets
        const iconSets = await this.discoverIconSets();
        const currentIconSet = device.params?.iconSet || '';
        let iconSetOptions = '<option value="">Use widget default icons</option>';
        if (iconSets.length > 0) {
            const grouped = {};
            iconSets.forEach(set => {
                if (!grouped[set.location]) grouped[set.location] = [];
                grouped[set.location].push(set);
            });
            
            for (const [location, sets] of Object.entries(grouped)) {
                iconSetOptions += `<optgroup label="${location.charAt(0).toUpperCase() + location.slice(1)}">`;
                sets.forEach(set => {
                    const selected = set.name === currentIconSet ? 'selected' : '';
                    iconSetOptions += `<option value="${set.name}" ${selected}>${set.name}</option>`;
                });
                iconSetOptions += '</optgroup>';
            }
        }
        
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
                        <label>Custom Icon Set <span style="color: #888; font-size: 0.9em;">(Optional)</span></label>
                        <select id="editDeviceIconSet" class="form-input">
                            ${iconSetOptions}
                        </select>
                        <small style="color: #888; display: block; margin-top: 4px;">
                            Override the widget's default icons with your own icon set
                        </small>
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
        const iconSetSelect = modal.querySelector('#editDeviceIconSet');
        
        // Save button
        modal.querySelector('.btn-apply').addEventListener('click', async () => {
            try {
                const newName = nameInput.value.trim();
                const newType = typeSelect.value;
                const customIconSet = iconSetSelect.value;
                const selectedFloors = Array.from(modal.querySelectorAll('.floor-checkbox input:checked'))
                    .map(cb => cb.value);
                
                if (!newName) {
                    alert('Device name cannot be empty');
                    return;
                }
                
                if (selectedFloors.length === 0) {
                    alert('Device must be on at least one floor');
                    return;
                }
                
                // Update device properties
                const configDevice = this.app.homemapConfig.devices.find(d => d.id === device.id);
                if (configDevice) {
                    // Handle widget reference - could be simple type or package/widget
                    let actualType = newType;
                    if (newType.includes('/')) {
                        // Explicit package reference (e.g., "com.jangabrielsson.gauge/gauge")
                        configDevice.widget = newType;
                        device.widget = newType;
                        // Extract the widget ID part for type
                        actualType = newType.split('/')[1];
                    } else {
                        // Simple widget type - remove any existing widget reference
                        delete configDevice.widget;
                        delete device.widget;
                    }
                    
                    const typeChanged = configDevice.type !== actualType;
                    
                    configDevice.name = newName;
                    configDevice.type = actualType;
                    device.name = newName;
                    device.type = actualType;
                    
                    // Handle custom parameters
                    if (customIconSet) {
                        if (!configDevice.params) configDevice.params = {};
                        if (!device.params) device.params = {};
                        configDevice.params.iconSet = customIconSet;
                        device.params.iconSet = customIconSet;
                    } else {
                        // Remove iconSet if empty
                        if (configDevice.params?.iconSet) delete configDevice.params.iconSet;
                        if (device.params?.iconSet) delete device.params.iconSet;
                        // Clean up empty params object
                        if (configDevice.params && Object.keys(configDevice.params).length === 0) delete configDevice.params;
                        if (device.params && Object.keys(device.params).length === 0) delete device.params;
                    }
                    
                    // Update floor assignments
                    const currentFloors = this.app.getDeviceFloors(device);
                    
                    // Remove from floors no longer selected
                    for (const floorId of currentFloors) {
                        if (!selectedFloors.includes(floorId)) {
                            this.app.removeDeviceFromFloor(device, floorId);
                        }
                    }
                    
                    // Add to newly selected floors
                    for (const floorId of selectedFloors) {
                        if (!currentFloors.includes(floorId)) {
                            const position = this.app.getDevicePosition(device, this.app.currentFloor) || { x: 500, y: 300 };
                            this.app.addDeviceToFloor(device, floorId, position);
                        }
                    }
                    
                    // Normalize format (convert back to single-floor if only one floor)
                    normalizeDeviceFormat(device);
                    normalizeDeviceFormat(configDevice);
                    
                    await this.app.saveConfig();
                    
                    // If type changed, reload to update widget
                    if (typeChanged) {
                        console.log('Device type changed, reloading...');
                        await this.app.loadWidgets();
                        this.app.floorManager.renderFloors();
                    } else {
                        this.app.floorManager.renderFloors();
                    }
                    
                    console.log('About to close modal...');
                    // Close the dialog
                    document.body.removeChild(modal);
                    console.log('Modal closed');
                } else {
                    console.error('Device not found in config');
                    alert('Error: Device not found in configuration');
                }
            } catch (error) {
                console.error('Error saving device:', error);
                alert('Error saving device: ' + error.message);
            }
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

    /**
     * Show dialog to confirm device deletion
     */
    showDeleteDeviceDialog(device) {
        const modal = document.createElement('div');
        modal.className = 'slider-modal';
        
        const deviceFloors = this.app.getDeviceFloors(device);
        const floorsText = this.app.homemapConfig.floors
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
                this.app.removeDeviceFromFloor(device, floorId);
            }
            
            // Remove from devices array
            const index = this.app.homemapConfig.devices.findIndex(d => d.id === device.id);
            if (index !== -1) {
                this.app.homemapConfig.devices.splice(index, 1);
            }
            
            await this.app.saveConfig();
            this.app.floorManager.renderFloors();
            
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

    /**
     * Show composable UI dialog (new format with rows and multiple element types)
     */
    async showComposableDialog(device, widget, ui) {
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
                    
                    case 'colorSelect':
                        const colorState = device.state?.colorComponents || { red: 0, green: 0, blue: 0 };
                        const hexColor = this.rgbToHex(colorState.red || 0, colorState.green || 0, colorState.blue || 0);
                        elementsHtml += `
                            <div class="color-select-container" data-property="${element.property}" data-action="${element.action}">
                                <label class="ui-label">${element.label || 'Color'}</label>
                                <input type="color" value="${hexColor}" class="color-picker">
                                <div class="color-rgb-display">
                                    <span>R: <span class="rgb-value red-value">${colorState.red || 0}</span></span>
                                    <span>G: <span class="rgb-value green-value">${colorState.green || 0}</span></span>
                                    <span>B: <span class="rgb-value blue-value">${colorState.blue || 0}</span></span>
                                </div>
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
                    await this.app.hc3ApiManager.executeAction(device, action, value);
                    
                    // Refresh device state after a short delay
                    setTimeout(async () => {
                        await this.app.hc3ApiManager.updateDeviceIcon(device);
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
                    await this.app.hc3ApiManager.executeAction(device, action);
                    document.body.removeChild(modal);
                    
                    // Refresh device state after a short delay
                    setTimeout(async () => {
                        await this.app.hc3ApiManager.updateDeviceIcon(device);
                    }, 500);
                } catch (error) {
                    console.error(`Failed to execute action ${actionName}:`, error);
                    alert(`Failed: ${error.message}`);
                }
            });
        });
        
        // Setup color picker listeners
        modal.querySelectorAll('.color-select-container').forEach(container => {
            const colorPicker = container.querySelector('.color-picker');
            const actionName = container.dataset.action;
            const action = widget.actions[actionName];
            const redDisplay = container.querySelector('.red-value');
            const greenDisplay = container.querySelector('.green-value');
            const blueDisplay = container.querySelector('.blue-value');
            
            console.log(`Setting up color picker for action: ${actionName}`, action);
            
            // Update RGB display as color changes
            colorPicker.addEventListener('input', () => {
                const rgb = this.hexToRgb(colorPicker.value);
                redDisplay.textContent = rgb.red;
                greenDisplay.textContent = rgb.green;
                blueDisplay.textContent = rgb.blue;
                console.log(`Color input changed to:`, rgb);
            });
            
            // Execute action when color is selected
            colorPicker.addEventListener('change', async () => {
                console.log(`Color picker change event fired!`);
                const rgb = this.hexToRgb(colorPicker.value);
                
                // Add warmWhite and coldWhite with default values
                const colorData = {
                    ...rgb,
                    warmWhite: 0,
                    coldWhite: 0
                };
                
                if (!action) {
                    console.error(`Action ${actionName} not found in widget`);
                    return;
                }
                
                try {
                    console.log(`Executing color action ${actionName} with color data:`, colorData);
                    await this.app.hc3ApiManager.executeAction(device, action, colorData);
                    
                    // Refresh device state after a short delay
                    setTimeout(async () => {
                        const deviceInfo = this.app.deviceIcons.get(device.id);
                        if (deviceInfo) {
                            await this.app.hc3ApiManager.updateDeviceIcon(device, deviceInfo.element, deviceInfo.textElement);
                        }
                    }, 500);
                } catch (error) {
                    console.error(`Failed to execute color action ${actionName}:`, error);
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

    /**
     * Show legacy buttons dialog
     */
    async showButtonsDialog(device, widget, ui) {
        const modal = document.createElement('div');
        modal.className = 'slider-modal';
        
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
                        await this.app.hc3ApiManager.executeAction(device, action);
                        document.body.removeChild(modal);
                        
                        // Refresh device icon after action
                        const deviceInfo = this.app.deviceIcons.get(device.id);
                        if (deviceInfo) {
                            setTimeout(() => {
                                this.app.hc3ApiManager.updateDeviceIcon(device, deviceInfo.element, deviceInfo.textElement);
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

    /**
     * Show legacy slider dialog
     */
    async showSlider(device, widget, ui) {
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
                    await this.app.hc3ApiManager.executeAction(device, action, value);
                    document.body.removeChild(modal);
                    
                    // Refresh device icon after action
                    const deviceInfo = this.app.deviceIcons.get(device.id);
                    if (deviceInfo) {
                        setTimeout(() => {
                            this.app.hc3ApiManager.updateDeviceIcon(device, deviceInfo.element, deviceInfo.textElement);
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
    
    /**
     * Convert RGB values to hex color
     */
    rgbToHex(r, g, b) {
        const toHex = (n) => {
            const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
    
    /**
     * Convert hex color to RGB values
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            red: parseInt(result[1], 16),
            green: parseInt(result[2], 16),
            blue: parseInt(result[3], 16)
        } : { red: 0, green: 0, blue: 0 };
    }
}
