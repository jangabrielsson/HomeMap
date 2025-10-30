// Imports
import { APP_VERSION, MIN_WIDGET_VERSION, isVersionCompatible, getPropertyValue as getPropertyValueUtil, timeAgo } from './modules/utils.js';
import { 
    isDeviceOnFloor, 
    getDevicePosition, 
    getDeviceFloors,
    updateDevicePosition,
    addDeviceToFloor,
    removeDeviceFromFloor,
    normalizeDeviceFormat
} from './modules/deviceHelpers.js';
import { EventManager } from './modules/eventManager.js';
import { WidgetManager } from './modules/widgetManager.js';
import { DialogManager } from './modules/dialogManager.js';
import { FloorManager } from './modules/floorManager.js';
import { ContextMenuManager } from './modules/contextMenuManager.js';
import { HC3ApiManager } from './modules/hc3ApiManager.js';
import packageManager from './modules/packageManager.js';

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
        this.deviceIcons = new Map(); // Store device icon elements for quick updates
        this.editMode = false;
        this.draggedDevice = null;
        this.dragOffset = { x: 0, y: 0 };
        
        // Initialize managers
        this.eventManager = new EventManager(this);
        this.widgetManager = null; // Will be initialized after we have dataPath
        this.dialogManager = new DialogManager(this);
        this.floorManager = new FloorManager(this);
        this.contextMenuManager = new ContextMenuManager(this);
        this.hc3ApiManager = new HC3ApiManager(this);
        
        // Zoom state
        this.zoomLevel = 100; // Default 100%
        this.zoomLevels = {}; // Per-floor zoom levels
        
        this.setupEditMode();
        this.setupSettings();
        this.setupZoomControls();
        this.setupCleanup();
        this.init();
    }

    // Helper functions - use imported functions
    isDeviceOnFloor(device, floorId) {
        return isDeviceOnFloor(device, floorId);
    }

    getDevicePosition(device, floorId) {
        return getDevicePosition(device, floorId);
    }

    getDeviceFloors(device) {
        return getDeviceFloors(device);
    }

    updateDevicePosition(device, floorId, position) {
        return updateDevicePosition(device, floorId, position);
    }

    addDeviceToFloor(device, floorId, position) {
        return addDeviceToFloor(device, floorId, position);
    }

    removeDeviceFromFloor(device, floorId) {
        return removeDeviceFromFloor(device, floorId);
    }

    getPropertyValue(obj, path) {
        return getPropertyValueUtil(obj, path);
    }

    timeAgo(timestamp) {
        return timeAgo(timestamp);
    }

    isWidgetCompatible(widgetVersion) {
        return isVersionCompatible(widgetVersion, MIN_WIDGET_VERSION);
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
        
        // Install package button
        const installPackageBtn = document.getElementById('installPackageBtn');
        installPackageBtn.addEventListener('click', async () => {
            await this.installPackage();
        });
    }

    setupZoomControls() {
        const zoomSlider = document.getElementById('zoomSlider');
        const zoomIn = document.getElementById('zoomIn');
        const zoomOut = document.getElementById('zoomOut');
        const zoomFit = document.getElementById('zoomFit');
        const zoomReset = document.getElementById('zoomReset');
        const zoomLevel = document.getElementById('zoomLevel');

        // Load saved zoom levels from localStorage
        const saved = localStorage.getItem('homemap_zoom_levels');
        if (saved) {
            try {
                this.zoomLevels = JSON.parse(saved);
            } catch (e) {
                console.warn('Failed to parse saved zoom levels');
            }
        }

        // Slider change
        zoomSlider.addEventListener('input', (e) => {
            const zoom = parseInt(e.target.value);
            this.setZoom(zoom);
        });

        // Zoom in button
        zoomIn.addEventListener('click', () => {
            const newZoom = Math.min(200, this.zoomLevel + 10);
            zoomSlider.value = newZoom;
            this.setZoom(newZoom);
        });

        // Zoom out button
        zoomOut.addEventListener('click', () => {
            const newZoom = Math.max(50, this.zoomLevel - 10);
            zoomSlider.value = newZoom;
            this.setZoom(newZoom);
        });

        // Fit to window button
        zoomFit.addEventListener('click', () => {
            this.fitToWindow();
        });

        // Reset button
        zoomReset.addEventListener('click', () => {
            zoomSlider.value = 100;
            this.setZoom(100);
        });
    }

    setZoom(zoom) {
        this.zoomLevel = zoom;
        
        // Save zoom level for current floor
        if (this.currentFloor) {
            this.zoomLevels[this.currentFloor] = zoom;
            localStorage.setItem('homemap_zoom_levels', JSON.stringify(this.zoomLevels));
        }
        
        // Update UI
        document.getElementById('zoomLevel').textContent = zoom + '%';
        
        // Apply transform to floor container
        const activeFloor = document.querySelector('.floor-view.active');
        if (activeFloor) {
            const scale = zoom / 100;
            activeFloor.style.transform = `scale(${scale})`;
            activeFloor.style.transformOrigin = 'center center';
        }
    }

    fitToWindow() {
        const activeFloor = document.querySelector('.floor-view.active');
        if (!activeFloor) return;
        
        const floorImage = activeFloor.querySelector('.floor-image');
        if (!floorImage) return;
        
        const container = this.floorContainerEl;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // Wait for image to load if needed
        if (!floorImage.complete) {
            floorImage.addEventListener('load', () => this.fitToWindow(), { once: true });
            return;
        }
        
        const imageWidth = floorImage.naturalWidth;
        const imageHeight = floorImage.naturalHeight;
        
        // Calculate scale to fit (with 10px padding)
        const scaleX = (containerWidth - 20) / imageWidth;
        const scaleY = (containerHeight - 20) / imageHeight;
        const scale = Math.min(scaleX, scaleY);
        
        // Convert to percentage and round to nearest 10
        const zoomPercent = Math.round((scale * 100) / 10) * 10;
        const clampedZoom = Math.max(50, Math.min(200, zoomPercent));
        
        // Update slider and apply zoom
        document.getElementById('zoomSlider').value = clampedZoom;
        this.setZoom(clampedZoom);
    }

    restoreZoomForFloor(floorId) {
        // Restore saved zoom level for this floor, or default to 100%
        const savedZoom = this.zoomLevels[floorId] || 100;
        document.getElementById('zoomSlider').value = savedZoom;
        this.setZoom(savedZoom);
    }

    async openSettings() {
        try {
            // Reset auth lock when opening settings so user can test connection
            this.hc3ApiManager.resetAuthLock();
            
            // Get current settings from backend
            const settings = await this.invoke('get_app_settings');
            
            // Populate form
            document.getElementById('hc3Host').value = settings.hc3_host || '';
            document.getElementById('hc3User').value = settings.hc3_user || '';
            document.getElementById('hc3Password').value = settings.hc3_password || '';
            document.getElementById('hc3Protocol').value = settings.hc3_protocol || 'http';
            document.getElementById('homemapPath').value = settings.homemap_path || '';
            
            // Load and display installed packages
            await this.loadInstalledPackages();
            
            // Show panel
            document.getElementById('settingsPanel').classList.add('open');
        } catch (error) {
            console.error('Failed to load settings:', error);
            alert('Failed to load settings: ' + error);
        }
    }
    
    async loadInstalledPackages() {
        try {
            const packagesList = document.getElementById('installedPackagesList');
            const packages = packageManager.getInstalledPackages();
            
            if (packages.length === 0) {
                packagesList.innerHTML = '<p class="no-packages">No packages installed yet</p>';
                return;
            }
            
            packagesList.innerHTML = packages.map(pkg => `
                <div class="package-item">
                    <div class="package-info">
                        <strong>${pkg.manifest.name}</strong> v${pkg.version}
                        <br>
                        <small>by ${pkg.manifest.author} • ${pkg.manifest.id}</small>
                    </div>
                    <button class="danger-button" onclick="window.homeMap.uninstallPackage('${pkg.id}')">Uninstall</button>
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load installed packages:', error);
        }
    }
    
    async installPackage() {
        try {
            console.log('Starting package installation...');
            const manifest = await packageManager.installPackage();
            if (manifest) {
                console.log('Package installed, manifest:', manifest);
                
                // Reload installed packages list first
                console.log('Reloading installed packages...');
                await this.loadInstalledPackages();
                console.log('Installed packages reloaded');
                
                // Reload widgets to pick up new package
                if (this.homemapConfig && this.homemapConfig.devices) {
                    console.log('Reloading widgets...');
                    await this.loadWidgets();
                    console.log('Widgets reloaded');
                }
                
                console.log('Installation complete');
                
                // Show success message using Tauri dialog (non-blocking)
                await window.__TAURI__.dialog.message(`Package "${manifest.name}" installed successfully!`, {
                    title: 'Installation Complete',
                    kind: 'info'
                });
            }
        } catch (error) {
            console.error('Failed to install package:', error);
            await window.__TAURI__.dialog.message(`Failed to install package: ${error.message}`, {
                title: 'Installation Failed',
                kind: 'error'
            });
        }
    }
    
    async uninstallPackage(packageId) {
        const confirmed = await window.__TAURI__.dialog.confirm(
            `Are you sure you want to uninstall "${packageId}"?`,
            {
                title: 'Confirm Uninstall',
                kind: 'warning'
            }
        );
        
        if (!confirmed) {
            return;
        }
        
        try {
            await packageManager.uninstallPackage(packageId);
            await window.__TAURI__.dialog.message('Package uninstalled successfully!', {
                title: 'Uninstall Complete',
                kind: 'info'
            });
            await this.loadInstalledPackages();
            // Reload widgets
            await this.loadWidgets();
        } catch (error) {
            console.error('Failed to uninstall package:', error);
            await window.__TAURI__.dialog.message(`Failed to uninstall package: ${error.message}`, {
                title: 'Uninstall Failed',
                kind: 'error'
            });
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
            
            // Reload config so the app uses the new credentials
            this.config = await this.invoke('get_hc3_config');
            console.log('Config reloaded with new credentials');
            
            // Reset auth lock when credentials are updated
            this.hc3ApiManager.resetAuthLock();
            
            // Test connection with new credentials
            await this.hc3ApiManager.testConnection();
            
            this.closeSettings();
            
            // Restart event polling if we have devices and it's not running
            if (this.homemapConfig?.devices?.length > 0 && !this.eventManager.isPolling) {
                console.log('Restarting event polling with new credentials');
                this.startEventPolling();
            }
            
            alert('Settings saved and applied successfully!');
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
        // Show/hide zoom controls
        const zoomControls = document.getElementById('zoomControls');
        if (this.editMode) {
            zoomControls.style.display = 'flex';
        } else {
            zoomControls.style.display = 'none';
        }
        
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
            
            await this.hc3ApiManager.testConnection();
            console.log('HomeMap initialized with HC3:', this.config.host);
            
            // Load HomeMap configuration
            await this.loadHomeMapConfig();
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.hc3ApiManager.updateStatus('error', `Configuration Error: ${error.message}`);
        }
    }

    async loadHomeMapConfig() {
        try {
            console.log('Loading HomeMap config...');
            this.dataPath = await this.invoke('get_data_path');
            console.log('Data path:', this.dataPath);
            
            // Initialize widget manager now that we have dataPath
            this.widgetManager = new WidgetManager(this.dataPath, this.invoke);
            
            this.homemapConfig = await this.invoke('get_homemap_config');
            console.log('HomeMap config:', this.homemapConfig);
            
            // Update window title and header
            await this.updateAppTitle();
            
            // Load widget definitions
            await this.loadWidgets();
            
            this.floorManager.renderFloors();
            
            // Start event polling only if we have devices and auth is not locked
            if (this.homemapConfig.devices && this.homemapConfig.devices.length > 0) {
                if (!this.hc3ApiManager.isAuthLocked()) {
                    console.log(`Starting event polling for ${this.homemapConfig.devices.length} devices`);
                    this.startEventPolling();
                } else {
                    console.log('Auth is locked, skipping event polling. Please update credentials in Settings.');
                }
            } else {
                console.log('No devices configured, skipping event polling');
            }
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
        // Delegate to WidgetManager
        return await this.widgetManager.loadIconSet(iconSetName);
    }

    async loadWidgets() {
        // Delegate to WidgetManager
        await this.widgetManager.loadWidgets(this.homemapConfig.devices);
        
        // Build event dispatch table
        this.buildEventDispatchTable();
    }

    async saveConfig() {
        // Delegate to HC3ApiManager
        await this.hc3ApiManager.saveConfig();
    }

    buildEventDispatchTable() {
        // Delegate to EventManager
        this.eventManager.buildEventDispatch(this.homemapConfig.devices, this.widgetManager.widgets);
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
            await this.hc3ApiManager.saveConfig();
            
            // Re-render all floors to update the UI
            this.floorManager.renderFloors();
            
            // Show the target floor to see the moved device
            this.floorManager.showFloor(targetFloor.id);
            
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
            const widget = this.widgetManager.getWidget(device.type);
            if (!widget || !widget.ui) {
                return; // No UI defined for this widget - clicking does nothing
            }
            
            const ui = widget.ui;
            
            // Handle new composable rows format
            if (ui.rows) {
                this.dialogManager.showComposableDialog(device, widget, ui);
                return;
            }
            
            // Legacy: Handle slider type UI
            if (ui.type === 'slider') {
                this.dialogManager.showSlider(device, widget, ui);
                return;
            }
            
            // Legacy: Handle buttons type UI
            if (ui.type === 'buttons') {
                this.dialogManager.showButtonsDialog(device, widget, ui);
                return;
            }
        });
    }

    async renderDevice(device, widget, iconElement, textElement) {
        // Delegate to WidgetManager
        await this.widgetManager.renderDevice(device, widget, iconElement, textElement);
    }

    getIconFromRenderDef(state, iconDef) {
        // Delegate to WidgetManager
        return this.widgetManager.getIconFromRenderDef(state, iconDef);
    }

    evaluateCondition(state, conditionStr) {
        // Delegate to WidgetManager
        return this.widgetManager.evaluateCondition(state, conditionStr);
    }

    interpolateTemplate(template, state) {
        // Delegate to WidgetManager
        return this.widgetManager.interpolateTemplate(template, state);
    }

    async loadDeviceIcon(iconElement, iconPath) {
        // Delegate to WidgetManager
        await this.widgetManager.loadDeviceIcon(iconElement, iconPath);
    }

    startEventPolling() {
        this.eventManager.startEventPolling();
    }

    stopEventPolling() {
        this.eventManager.stopEventPolling();
    }

    async processEvents(events) {
        await this.eventManager.processEvents(events);
    }

    async dispatchEvent(event) {
        await this.eventManager.dispatchEvent(event);
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
