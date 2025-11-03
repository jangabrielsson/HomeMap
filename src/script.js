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
import { AutoMapManager } from './modules/autoMapManager.js';
import { DeviceManagementView } from './modules/deviceManagementView.js';
import { FloorManagementDialog } from './modules/floorManagementDialog.js';
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
        this.autoMapManager = new AutoMapManager(this);
        this.deviceManagementView = new DeviceManagementView(this);
        this.floorManagementDialog = new FloorManagementDialog(this);
        
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
        const manageDevicesBtn = document.getElementById('autoDiscoverBtn');
        
        if (editToggle) {
            editToggle.addEventListener('change', (e) => {
                this.editMode = e.target.checked;
                this.toggleEditMode();
            });
        }
        
        if (manageDevicesBtn) {
            manageDevicesBtn.addEventListener('click', async () => {
                await this.deviceManagementView.openPanel();
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
        
        // Backup HomeMap button
        const backupHomemapBtn = document.getElementById('backupHomemapBtn');
        backupHomemapBtn.addEventListener('click', async () => {
            await this.backupHomeMapData();
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
            
            // Populate house name and icon from config (with fallback if config not loaded)
            document.getElementById('houseName').value = this.homemapConfig?.name || '';
            document.getElementById('houseIcon').value = this.homemapConfig?.icon || '🏠';
            
            // Load widget background settings from config
            const widgetBg = this.homemapConfig?.widgetBackground || {
                enabled: true,
                color: '#FFFF00',
                opacity: 50
            };
            console.log('Widget background config:', widgetBg);
            
            document.getElementById('enableWidgetBackground').checked = widgetBg.enabled;
            
            // Set color value - ensure it's uppercase hex format
            const colorValue = (widgetBg.color || '#FFFF00').toUpperCase();
            const colorInput = document.getElementById('widgetBackgroundColor');
            console.log('Setting color input to:', colorValue);
            colorInput.value = colorValue;
            
            // Force refresh of color picker by triggering a change event
            colorInput.dispatchEvent(new Event('change', { bubbles: true }));
            
            document.getElementById('widgetBackgroundOpacity').value = widgetBg.opacity || 50;
            document.getElementById('opacityValue').textContent = `${widgetBg.opacity || 50}%`;
            
            // Update opacity display when slider changes
            document.getElementById('widgetBackgroundOpacity').addEventListener('input', (e) => {
                document.getElementById('opacityValue').textContent = `${e.target.value}%`;
            });
            
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
            
            // Update house name and icon in config (only if config is loaded)
            const houseName = document.getElementById('houseName').value.trim();
            const houseIcon = document.getElementById('houseIcon').value.trim();
            
            if (this.homemapConfig && (houseName !== this.homemapConfig.name || houseIcon !== this.homemapConfig.icon)) {
                this.homemapConfig.name = houseName || 'My Home Map';
                this.homemapConfig.icon = houseIcon || '🏠';
                
                // Save updated config
                const filePath = `${this.dataPath}/config.json`;
                const content = JSON.stringify(this.homemapConfig, null, 4);
                await this.invoke('save_config', { filePath, content });
                
                // Update window title
                this.updateWindowTitle();
            }
            
            // Update widget background settings in config
            const enableBackground = document.getElementById('enableWidgetBackground').checked;
            const backgroundColor = document.getElementById('widgetBackgroundColor').value;
            const backgroundOpacity = parseInt(document.getElementById('widgetBackgroundOpacity').value);
            
            if (this.homemapConfig) {
                this.homemapConfig.widgetBackground = {
                    enabled: enableBackground,
                    color: backgroundColor,
                    opacity: backgroundOpacity
                };
                
                // Save updated config
                const filePath = `${this.dataPath}/config.json`;
                const content = JSON.stringify(this.homemapConfig, null, 4);
                await this.invoke('save_config', { filePath, content });
            }
            
            // Apply widget background settings immediately
            this.applyWidgetBackgroundSettings();
            
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

    async backupHomeMapData() {
        try {
            if (!this.dataPath) {
                alert('HomeMap data path not loaded yet.');
                return;
            }

            // Generate backup filename with timestamp
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T')[0];
            const defaultFilename = `homemap-backup-${timestamp}.zip`;

            // Show save dialog
            const savePath = await window.__TAURI__.dialog.save({
                defaultPath: defaultFilename,
                filters: [{
                    name: 'Zip Archive',
                    extensions: ['zip']
                }]
            });

            if (!savePath) {
                // User cancelled
                return;
            }

            // Call backend to create backup
            console.log('Creating backup from:', this.dataPath, 'to:', savePath);
            await this.invoke('create_backup', { 
                sourcePath: this.dataPath, 
                destPath: savePath 
            });

            alert('Backup created successfully!\n\nLocation: ' + savePath);
        } catch (error) {
            console.error('Failed to create backup:', error);
            alert('Failed to create backup: ' + error);
        }
    }

    toggleEditMode() {
        // Show/hide zoom controls and auto-discover button
        const zoomControls = document.getElementById('zoomControls');
        const autoDiscoverBtn = document.getElementById('autoDiscoverBtn');
        
        if (this.editMode) {
            zoomControls.style.display = 'flex';
            autoDiscoverBtn.style.display = 'block';
        } else {
            zoomControls.style.display = 'none';
            autoDiscoverBtn.style.display = 'none';
        }
        
        // Update all device elements
        document.querySelectorAll('.device').forEach(deviceEl => {
            if (this.editMode) {
                deviceEl.classList.add('edit-mode');
            } else {
                deviceEl.classList.remove('edit-mode');
            }
        });
        
        // Re-render floors to show/hide [+] tab
        this.floorManager.renderFloors();
        
        console.log(`Edit mode: ${this.editMode ? 'ON' : 'OFF'}`);
    }

    /**
     * Apply widget background circle settings to all devices
     */
    applyWidgetBackgroundSettings() {
        const widgetBg = this.homemapConfig?.widgetBackground || {
            enabled: true,
            color: '#FFFF00',
            opacity: 50
        };
        
        document.querySelectorAll('.device').forEach(deviceEl => {
            const existingBg = deviceEl.querySelector('.device-background');
            if (existingBg) {
                existingBg.remove();
            }
            
            if (widgetBg.enabled) {
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
        
        console.log('Widget background settings applied');
    }

    async init() {
        try {
            console.log('Getting HC3 config...');
            this.config = await this.invoke('get_hc3_config');
            console.log('Config received:', this.config);
            
            // Check if HC3 has been explicitly configured in settings
            const isConfigured = await this.invoke('is_hc3_configured');
            console.log('HC3 configured:', isConfigured);
            
            if (!isConfigured) {
                console.log('Showing welcome dialog...');
                // Show welcome dialog for first-time users
                this.showWelcomeDialog().then(() => {
                    console.log('Welcome dialog closed');
                }).catch(err => {
                    console.error('Welcome dialog error:', err);
                });
                // Load the HomeMap config immediately (don't wait for dialog)
                console.log('Loading HomeMap config (unconfigured path)...');
                await this.loadHomeMapConfig();
                this.hc3ApiManager.updateStatus('warning', 'HC3 not configured. Please set your credentials in Settings.');
                return;
            }
            
            await this.hc3ApiManager.testConnection();
            console.log('HomeMap initialized with HC3:', this.config.host);
            
            // Load HomeMap configuration
            await this.loadHomeMapConfig();
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.hc3ApiManager.updateStatus('error', `Configuration Error: ${error.message}`);
        }
    }
    
    async showWelcomeDialog() {
        const message = `Welcome to HomeMap!

To get started, you need to configure your HC3 connection.

Please click the Settings button (⚙️) in the top-right corner and enter:
• HC3 IP Address or Hostname
• Username
• Password
• Protocol (http or https)

You can also configure floor plans and manage devices once connected!`;
        
        await window.__TAURI__.dialog.message(message, { 
            title: 'Welcome to HomeMap',
            kind: 'info'
        });
    }

    async copyBundledAssetsIfNeeded() {
        try {
            console.log('=== copyBundledAssetsIfNeeded STARTING ===');
            const manifestVersion = '1.0.0';
            const versionKey = 'bundled_assets_version';
            
            // Check if we've already copied this version
            const copiedVersion = localStorage.getItem(versionKey);
            console.log('Copied version from storage:', copiedVersion);
            if (copiedVersion === manifestVersion) {
                console.log('Bundled assets already copied for version', manifestVersion);
                return;
            }
            
            // Check if assets already exist (e.g., copied by Rust on iOS)
            try {
                const testPath = `${this.dataPath}/config.json`;
                const testRead = await this.invoke('read_file_as_text', { filePath: testPath });
                if (testRead) {
                    console.log('Assets already exist (likely copied by Rust), skipping JS copy');
                    localStorage.setItem(versionKey, manifestVersion);
                    return;
                }
            } catch (err) {
                // Assets don't exist, continue with copy
                console.log('Assets not found, will copy from bundled resources');
            }
            
            console.log('Copying bundled assets to data directory...');
            console.log('Data path:', this.dataPath);
            
            // Fetch manifest from bundled assets using Rust command (embedded at compile time)
            console.log('Reading asset-manifest.json from bundled assets...');
            const manifestB64 = await this.invoke('read_bundled_asset', { 
                assetPath: 'asset-manifest.json' 
            });
            const manifestJson = atob(manifestB64);
            const manifest = JSON.parse(manifestJson);
            console.log(`Found ${manifest.files.length} files to copy`);
            
            let successCount = 0;
            let errorCount = 0;
            
            // Copy each file from manifest
            for (const file of manifest.files) {
                try {
                    // Read file from bundled assets using Rust command
                    const fileB64 = await this.invoke('read_bundled_asset', { 
                        assetPath: file 
                    });
                    
                    // Write to data directory
                    const targetPath = `${this.dataPath}/${file}`;
                    await this.invoke('write_file_base64', { 
                        filePath: targetPath,
                        b64: fileB64 
                    });
                    
                    successCount++;
                    if (successCount % 5 === 0) {
                        console.log(`Progress: ${successCount}/${manifest.files.length} files copied`);
                    }
                } catch (err) {
                    console.error(`Error copying ${file}:`, err);
                    errorCount++;
                }
            }
            
            console.log(`Asset copy complete: ${successCount} succeeded, ${errorCount} failed`);
            
            // Store version to avoid re-copying
            if (successCount > 0) {
                localStorage.setItem(versionKey, manifestVersion);
            }
            
        } catch (error) {
            console.error('Failed to copy bundled assets:', error);
            // Don't block app startup on asset copy failure
        }
    }

    async loadHomeMapConfig() {
        try {
            console.log('Loading HomeMap config...');
            this.dataPath = await this.invoke('get_data_path');
            console.log('Data path:', this.dataPath);
            
            // Check if this is first run (no bundled assets copied yet)
            const versionKey = 'bundled_assets_version';
            const copiedVersion = localStorage.getItem(versionKey);
            const isFirstRun = !copiedVersion;
            
            if (isFirstRun) {
                // On first run, wait for asset copy to complete
                console.log('First run detected, waiting for asset copy...');
                await this.copyBundledAssetsIfNeeded();
                console.log('Asset copy completed, continuing startup...');
            } else {
                // On subsequent runs, copy in background (updates)
                this.copyBundledAssetsIfNeeded().then(() => {
                    console.log('Background asset copy completed');
                }).catch(err => {
                    console.error('Background asset copy failed:', err);
                });
            }
            
            // Initialize widget manager now that we have dataPath
            this.widgetManager = new WidgetManager(this.dataPath, this.invoke);
            
            this.homemapConfig = await this.invoke('get_homemap_config');
            console.log('HomeMap config:', this.homemapConfig);
            
            // Ensure at least one floor exists - create default if none
            if (!this.homemapConfig.floors || this.homemapConfig.floors.length === 0) {
                console.warn('No floors found in config, creating default floor');
                this.homemapConfig.floors = [{
                    id: 'default-floor',
                    name: 'Main Floor',
                    image: 'images/default-floor.png'
                }];
                
                // Save the updated config
                const filePath = `${this.dataPath}/config.json`;
                const content = JSON.stringify(this.homemapConfig, null, 4);
                await this.invoke('save_config', { filePath, content });
                
                alert('No floors were found in your configuration.\n\nA default floor "Main Floor" has been created.\n\nYou can edit it or add more floors in Edit Mode.');
            }
            
            // Update window title and header
            await this.updateAppTitle();
            
            // Load widget definitions for devices
            await this.loadWidgets();
            
            // Also load all available widgets for device management dropdowns
            await this.widgetManager.loadAllAvailableWidgets();
            
            this.floorManager.renderFloors();
            
            // Apply widget background settings
            this.applyWidgetBackgroundSettings();
            
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
        const appName = this.homemapConfig?.name || 'HomeMap';
        const iconPath = this.homemapConfig?.icon;
        
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

    updateWindowTitle() {
        // Simple wrapper to update title and header
        const appName = this.homemapConfig?.name || 'HomeMap';
        const icon = this.homemapConfig?.icon || '🏠';
        
        // Update window title
        document.title = appName;
        
        // Update header with icon (treating icon as emoji)
        const header = document.querySelector('header h1');
        if (header) {
            header.textContent = `${icon} ${appName}`;
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
