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
import { RemoteWidgetManager } from './modules/remoteWidgetManager.js';
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
        this.remoteWidgetManager = new RemoteWidgetManager(this);
        
        // Zoom state
        this.zoomLevel = 100; // Default 100%
        this.zoomLevels = {}; // Per-floor zoom levels
        
        // Restore state
        this.isRestoring = false; // Prevent multiple simultaneous restores
        this.dialogOpen = false; // Prevent multiple dialog opens
        
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
            editToggle.onchange = (e) => {
                this.editMode = e.target.checked;
                this.toggleEditMode();
            };
        }
        
        if (manageDevicesBtn) {
            manageDevicesBtn.onclick = async () => {
                await this.deviceManagementView.openPanel();
            };
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
        settingsBtn.onclick = async () => {
            await this.openSettings();
        };

        // Close settings
        closeSettings.onclick = () => {
            this.closeSettings();
        };

        cancelSettings.onclick = () => {
            this.closeSettings();
        };

        // Save settings
        saveSettings.onclick = async () => {
            await this.saveSettings();
        };

        // Browse for homemapdata folder (desktop only)
        // Use immediate mobile detection to avoid triggering folder dialogs
        this.checkIfMobile().then(isMobile => {
            if (isMobile) {
                // Hide browse button and path input on mobile
                browseHomemapPath.style.display = 'none';
                const pathInputContainer = document.querySelector('.path-input');
                const homemapPathInput = document.getElementById('homemapPath');
                if (pathInputContainer && homemapPathInput) {
                    pathInputContainer.style.display = 'none';
                    // Add explanation text for mobile users
                    const explanation = document.createElement('small');
                    explanation.style.color = '#888';
                    explanation.textContent = 'HomeMap data is automatically managed on mobile devices';
                    pathInputContainer.parentNode.appendChild(explanation);
                }
            }
        });
        
        browseHomemapPath.onclick = async () => {
            await this.browseHomemapPath();
        };
        
        // WebSocket server controls
        const wsStartServer = document.getElementById('wsStartServer');
        const wsStopServer = document.getElementById('wsStopServer');
        
        wsStartServer.onclick = async () => {
            const port = parseInt(document.getElementById('wsPort').value) || 8765;
            const bindAddress = document.getElementById('wsBindAddress').value || '0.0.0.0';
            
            const success = await this.remoteWidgetManager.startServer(port, bindAddress);
            if (success) {
                wsStartServer.disabled = true;
                wsStopServer.disabled = false;
                // Check the "Enable WebSocket Server" checkbox when server starts
                document.getElementById('wsEnabled').checked = true;
            }
        };
        
        wsStopServer.onclick = async () => {
            const success = await this.remoteWidgetManager.stopServer();
            if (success) {
                wsStartServer.disabled = false;
                wsStopServer.disabled = true;
                // Uncheck the "Enable WebSocket Server" checkbox when server stops
                document.getElementById('wsEnabled').checked = false;
            }
        };
        
        // Backup HomeMap button
        const backupHomemapBtn = document.getElementById('backupHomemapBtn');
        backupHomemapBtn.onclick = async () => {
            await this.backupHomeMapData();
        };
        
        // Restore HomeMap button
        const restoreHomemapBtn = document.getElementById('restoreHomemapBtn');
        if (restoreHomemapBtn) {
            restoreHomemapBtn.onclick = async () => {
                await this.showRestoreDialogNEW();
            };
        }
        
        // Install package button
        const installPackageBtn = document.getElementById('installPackageBtn');
        installPackageBtn.onclick = async () => {
            await this.installPackage();
        };
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
            
            // Load WebSocket settings from homemapConfig
            const wsConfig = this.homemapConfig?.websocket || {
                enabled: false,
                port: 8765,
                bindAddress: '0.0.0.0',
                autoStart: false
            };
            document.getElementById('wsEnabled').checked = wsConfig.enabled || false;
            document.getElementById('wsPort').value = wsConfig.port || 8765;
            document.getElementById('wsBindAddress').value = wsConfig.bindAddress || '0.0.0.0';
            
            // Update server button states
            const wsStartServer = document.getElementById('wsStartServer');
            const wsStopServer = document.getElementById('wsStopServer');
            if (this.remoteWidgetManager && this.remoteWidgetManager.serverRunning) {
                wsStartServer.disabled = true;
                wsStopServer.disabled = false;
            } else {
                wsStartServer.disabled = false;
                wsStopServer.disabled = true;
            }
            
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
            
            // Save WebSocket settings to homemapConfig
            if (this.homemapConfig) {
                const wsEnabled = document.getElementById('wsEnabled').checked;
                const wsPort = parseInt(document.getElementById('wsPort').value) || 8765;
                const wsBindAddress = document.getElementById('wsBindAddress').value || '0.0.0.0';
                
                this.homemapConfig.websocket = {
                    enabled: wsEnabled,
                    port: wsPort,
                    bindAddress: wsBindAddress,
                    autoStart: wsEnabled  // Auto-start if enabled
                };
                
                // Save homemapConfig with WebSocket settings
                const filePath = `${this.dataPath}/config.json`;
                const content = JSON.stringify(this.homemapConfig, null, 4);
                await this.invoke('save_config', { filePath, content });
            }
            
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
                // Check if the selected path has a homemapdata subfolder or is itself a homemapdata folder
                const pathExists = await this.invoke('path_exists', { path: path });
                if (!pathExists) {
                    alert('Selected path does not exist.');
                    return;
                }
                
                // Check if it's a homemapdata folder (contains config.json) or a parent folder
                const configPath = path.endsWith('homemapdata') ? 
                    `${path}/config.json` : 
                    `${path}/homemapdata/config.json`;
                
                const hasConfig = await this.invoke('path_exists', { path: configPath });
                
                if (hasConfig) {
                    // It's a valid homemapdata folder or contains one
                    const finalPath = path.endsWith('homemapdata') ? path : `${path}/homemapdata`;
                    document.getElementById('homemapPath').value = finalPath;
                } else {
                    // Ask if user wants to create a new homemapdata folder here
                    const createNew = confirm(
                        `The selected folder doesn't contain HomeMap data.\n\n` +
                        `Would you like to create a new homemapdata folder at:\n${path}/homemapdata\n\n` +
                        `This will copy the default configuration and templates.`
                    );
                    
                    if (createNew) {
                        try {
                            const newPath = await this.invoke('create_config_folder', { destinationPath: path });
                            document.getElementById('homemapPath').value = newPath;
                            alert('New HomeMap data folder created successfully!');
                        } catch (createError) {
                            console.error('Failed to create config folder:', createError);
                            alert('Failed to create HomeMap data folder: ' + createError);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Failed to browse folder:', error);
            if (error.includes('not supported on mobile')) {
                alert('Folder selection is not available on mobile devices. HomeMap data is automatically managed.');
            } else {
                alert('Failed to select folder: ' + error);
            }
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

    async showRestoreDialogNEW() {
        const callTime = Date.now();
        console.error('🚨🚨🚨 showRestoreDialogNEW CALLED AT', callTime, '🚨🚨🚨');
        console.error('Call stack:', new Error().stack);
        console.error('Call count:', (window.__restoreDialogCallCount = (window.__restoreDialogCallCount || 0) + 1));
        console.error('Current flags - isRestoring:', this.isRestoring, 'dialogOpen:', this.dialogOpen);
        
        // Store call time globally for debugging
        if (!window.__restoreDialogCalls) {
            window.__restoreDialogCalls = [];
        }
        window.__restoreDialogCalls.push({
            time: callTime,
            isRestoring: this.isRestoring,
            dialogOpen: this.dialogOpen,
            stack: new Error().stack
        });
        
        // CRITICAL: Prevent multiple simultaneous dialogs
        if (this.isRestoring || this.dialogOpen) {
            console.error('❌❌❌ BLOCKING: Dialog already open or restore in progress! ❌❌❌');
            console.error('isRestoring:', this.isRestoring, 'dialogOpen:', this.dialogOpen);
            console.error('All calls so far:', window.__restoreDialogCalls);
            return;
        }
        
        this.dialogOpen = true;
        console.log('Set dialogOpen = true');
        
        const dialog = document.getElementById('restoreDialog');
        const filePathInput = document.getElementById('restoreFilePath');
        const browseBtn = document.getElementById('browseRestoreFile');
        const doRestoreBtn = document.getElementById('doRestore');
        const cancelBtn = document.getElementById('cancelRestore');
        const warningBox = document.getElementById('restoreWarning');
        
        console.log('Dialog elements:', { dialog, filePathInput, browseBtn, doRestoreBtn, cancelBtn, warningBox });
        
        // Reset form
        filePathInput.value = '';
        doRestoreBtn.disabled = true;
        warningBox.style.display = 'none';
        
        // Show dialog (use flex to center it properly)
        dialog.style.display = 'flex';
        
        // Add global click logger for debugging
        const globalClickLogger = (e) => {
            console.log('Global click:', e.target.id || e.target.tagName, e.target);
        };
        document.addEventListener('click', globalClickLogger);
        setTimeout(() => document.removeEventListener('click', globalClickLogger), 10000); // Remove after 10s
        
        // Check if we're on mobile and show appropriate options
        const isMobile = await this.checkIfMobile();
        console.log('Is mobile platform:', isMobile);
        const showBackupsBtn = document.getElementById('showAvailableBackups');
        const backupsList = document.getElementById('availableBackupsList');
        
        if (isMobile) {
            console.log('Setting up mobile file restore');
            showBackupsBtn.style.display = 'block';
            
            // On mobile, set up the file input handler directly
            const mobileFileInput = document.getElementById('mobileRestoreFileInput');
            console.log('Mobile file input:', mobileFileInput);
            
            // Simple onclick approach - no cloning, no event listener
            browseBtn.onclick = (e) => {
                console.log('=== BROWSE BUTTON CLICKED ===');
                e.preventDefault();
                e.stopPropagation();
                console.log('Browse button clicked, triggering file input');
                mobileFileInput.click();
                console.log('File input click() called');
            };
            console.log('Browse button onclick set directly, handler:', browseBtn.onclick);
            
            mobileFileInput.onchange = async (e) => {
                console.log('File selected via input:', e.target.files[0]);
                const file = e.target.files[0];
                if (file) {
                    // Read the file and save it temporarily
                    const arrayBuffer = await file.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);
                    
                    // Save the file to temp location via backend
                    try {
                        const tempPath = await this.invoke('save_temp_file', {
                            fileName: file.name,
                            data: Array.from(uint8Array)
                        });
                        
                        filePathInput.value = tempPath;
                        doRestoreBtn.disabled = false;
                        warningBox.style.display = 'block';
                        console.log('✅ File processed, button ENABLED, path:', tempPath);
                        console.log('✅ Button disabled status after enable:', doRestoreBtn.disabled);
                    } catch (error) {
                        console.error('Failed to save temp file:', error);
                        alert('Failed to process file: ' + error);
                    }
                }
                // Reset the input so the same file can be selected again
                mobileFileInput.value = '';
            };
            // The label in HTML will trigger the file input when clicked
            console.log('Mobile file input handler set up');
        } else {
            // Desktop: Browse for backup file using Tauri dialog
            console.log('Setting up browse button handler for desktop');
            browseBtn.onclick = async () => {
                console.log('Browse button clicked (desktop)');
                try {
                    // Desktop file selection
                    const selected = await window.__TAURI__.dialog.open({
                        multiple: false,
                        filters: [{
                            name: 'HomeMap Backup',
                            extensions: ['zip']
                        }]
                    });
                    
                    console.log('🔍 Dialog returned:', selected, 'Type:', typeof selected);
                    
                    if (selected) {
                        filePathInput.value = selected;
                        doRestoreBtn.disabled = false;
                        warningBox.style.display = 'block';
                        console.log('✅ File selected, button ENABLED, path:', selected);
                        console.log('✅ Button disabled status after enable:', doRestoreBtn.disabled);
                    } else {
                        console.log('⚠️ No file selected or dialog returned null/undefined');
                        alert('No file was selected. The file picker returned empty. Please try again or use "Show Available Backups" instead.');
                    }
                } catch (error) {
                    console.error('Failed to select backup file:', error);
                    alert('Failed to select backup file: ' + error);
                }
            };
        }
        
        // Show available backups (mobile)
        showBackupsBtn.onclick = async () => {
            try {
                const backups = await this.invoke('list_backup_files');
                this.showAvailableBackups(backups, filePathInput, doRestoreBtn, warningBox, backupsList);
            } catch (error) {
                console.error('Failed to list backup files:', error);
                alert('Failed to list backup files: ' + error);
            }
        };
        
        // Clear any existing onclick handlers before setting new ones
        console.log('Setting up restore dialog button handlers');
        
        // Reset handlers to null to clear any previous assignments
        doRestoreBtn.onclick = null;
        cancelBtn.onclick = null;
        
        // Restore button - set handler with proper event handling
        doRestoreBtn.onclick = async (e) => {
            // CRITICAL: Stop event propagation immediately
            if (e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
            
            console.log('=== Restore button clicked ===');
            
            if (this.isRestoring) {
                console.log('Restore already in progress, ignoring click');
                return;
            }
            
            // Get the file path and backup option to show in confirmation
            const filePath = document.getElementById('restoreFilePath').value;
            const backupExisting = document.getElementById('backupBeforeRestore').checked;
            
            if (!filePath) {
                alert('Please select a backup file first.');
                return;
            }
            
            // Show confirmation dialog
            const confirmMsg = backupExisting 
                ? 'This will restore your HomeMap data from the backup.\n\nYour current data will be backed up first.'
                : 'This will restore your HomeMap data from the backup.\n\n⚠️ WARNING: Your current data will be OVERWRITTEN!';
            
            try {
                const confirmed = await window.__TAURI__.dialog.ask(confirmMsg, {
                    title: 'Confirm Restore',
                    type: 'warning',
                    okLabel: 'Restore',
                    cancelLabel: 'Cancel'
                });
                
                if (!confirmed) {
                    console.log('User cancelled restore');
                    return; // User clicked Cancel - stop here
                }
                
                // User clicked OK - NOW perform the restore
                console.log('User confirmed, starting restore...');
                
                // Disable button and set flag
                doRestoreBtn.disabled = true;
                doRestoreBtn.style.opacity = '0.5';
                this.isRestoring = true;
                
                // Call the restore function
                await this.restoreHomeMapData();
                
            } catch (err) {
                console.error('Dialog or restore error:', err);
                // Re-enable button on error
                doRestoreBtn.disabled = false;
                doRestoreBtn.style.opacity = '1';
                this.isRestoring = false;
                alert('Error during restore: ' + err);
            }
        };
        console.log('Set doRestoreBtn.onclick handler');
        
        // Cancel button - prevent event bubbling
        cancelBtn.onclick = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            console.log('Cancel button clicked, closing dialog');
            dialog.style.display = 'none';
            this.isRestoring = false; // Reset flag
            this.dialogOpen = false; // Reset dialog open flag
        };
        console.log('Set cancelBtn.onclick handler');
        
        // Close on outside click - with proper event handling
        dialog.onclick = (e) => {
            console.log('=== Dialog clicked ===, target:', e.target.id || e.target.tagName, 'is dialog:', e.target === dialog);
            // Only close if clicking directly on the dialog background, not on any child elements
            if (e.target === dialog) {
                console.log('Closing dialog (clicked on background)');
                e.preventDefault();
                e.stopPropagation();
                dialog.style.display = 'none';
                this.isRestoring = false; // Reset flag
                this.dialogOpen = false; // Reset dialog open flag
            } else {
                console.log('Not closing (clicked on child element)');
            }
        };
    }
    
    async checkIfMobile() {
        // Use the platform-specific constant determined at build time
        try {
            return await this.invoke('is_mobile_platform');
        } catch (error) {
            console.error('Failed to check platform type:', error);
            // Default to desktop if we can't determine (safer for functionality)
            return false;
        }
    }
    
    showAvailableBackups(backups, filePathInput, doRestoreBtn, warningBox, backupsList) {
        const container = document.getElementById('backupFilesContainer');
        container.innerHTML = '';
        
        if (backups.length === 0) {
            container.innerHTML = '<p style="color: #888; text-align: center;">No HomeMap backup files found in common locations.</p>';
        } else {
            backups.forEach(backup => {
                const item = document.createElement('div');
                item.className = 'backup-file-item';
                
                const infoDiv = document.createElement('div');
                infoDiv.className = 'backup-file-content';
                infoDiv.innerHTML = `
                    <div class="backup-file-name">${backup.filename}</div>
                    <div class="backup-file-info">
                        Size: ${this.formatFileSize(backup.size)} | 
                        Modified: ${backup.modified}
                    </div>
                `;
                
                // Create delete button
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'backup-delete-btn';
                deleteBtn.innerHTML = '🗑️';
                deleteBtn.title = 'Delete this backup';
                deleteBtn.onclick = async (e) => {
                    e.stopPropagation(); // Prevent selecting the item
                    if (confirm(`Delete backup "${backup.filename}"?`)) {
                        try {
                            await this.invoke('delete_backup_file', { filePath: backup.path });
                            // Refresh the list
                            const updatedBackups = await this.invoke('list_backup_files');
                            this.showAvailableBackups(updatedBackups, filePathInput, doRestoreBtn, warningBox, backupsList);
                        } catch (error) {
                            console.error('Failed to delete backup:', error);
                            alert('Failed to delete backup: ' + error);
                        }
                    }
                };
                
                infoDiv.onclick = () => {
                    // Remove selection from other items
                    container.querySelectorAll('.backup-file-item').forEach(i => i.classList.remove('selected'));
                    // Select this item
                    item.classList.add('selected');
                    // Set the file path
                    filePathInput.value = backup.path;
                    doRestoreBtn.disabled = false;
                    warningBox.style.display = 'block';
                };
                
                item.appendChild(infoDiv);
                item.appendChild(deleteBtn);
                container.appendChild(item);
            });
        }
        
        backupsList.style.display = 'block';
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    async restoreHomeMapData() {
        console.log('=== restoreHomeMapData called ===');
        
        let dialogClosed = false;
        let userConfirmedRestore = false;
        
        try {
            const filePath = document.getElementById('restoreFilePath').value;
            const backupExisting = document.getElementById('backupBeforeRestore').checked;
            const restoreConfig = document.getElementById('restoreConfig').checked;
            const restoreImages = document.getElementById('restoreImages').checked;
            const restoreIcons = document.getElementById('restoreIcons').checked;
            const restoreWidgets = document.getElementById('restoreWidgets').checked;
            const restoreUiPreferences = document.getElementById('restoreUiPreferences').checked;
            
            if (!filePath) {
                alert('Please select a backup file first.');
                this.isRestoring = false;
                return;
            }
            
            if (!this.dataPath) {
                alert('HomeMap data path not loaded yet.');
                this.isRestoring = false;
                return;
            }
            
            // Confirmation already done in button handler, proceed with restore
            console.log('Proceeding with restore...');
            userConfirmedRestore = true;
            
            // Call backend to restore data
            console.log('Restoring from:', filePath, 'to:', this.dataPath);
            
            const result = await this.invoke('restore_homemap_data', {
                backupPath: filePath,
                targetPath: this.dataPath,
                options: {
                    backup_existing: backupExisting,
                    restore_config: restoreConfig,
                    restore_images: restoreImages,
                    restore_icons: restoreIcons,
                    restore_widgets: restoreWidgets,
                    restore_ui_preferences: restoreUiPreferences
                }
            });
            
            console.log('Backend restore completed successfully');
            
            // Close the restore dialog first
            const dialog = document.getElementById('restoreDialog');
            if (dialog) {
                dialog.style.display = 'none';
                dialogClosed = true;
            }
            this.dialogOpen = false;
            
            // Show success message using Tauri dialog (more reliable than alert)
            try {
                await window.__TAURI__.dialog.message(
                    '✅ HomeMap data restored successfully!\n\nThe app will now reload to apply the changes.',
                    { title: 'Restore Complete', type: 'info' }
                );
            } catch (err) {
                console.error('Dialog error, using alert:', err);
                alert('✅ HomeMap data restored successfully!\n\nThe app will now reload to apply the changes.');
            }
            
            // Reload the app
            window.location.replace(window.location.href);
            
        } catch (error) {
            console.error('Failed to restore backup:', error);
            
            // Ensure dialog is closed and ALL state is reset on error
            if (!dialogClosed) {
                const dialog = document.getElementById('restoreDialog');
                if (dialog) {
                    dialog.style.display = 'none';
                }
            }
            this.isRestoring = false;
            this.dialogOpen = false;
            console.log('Error occurred, reset all flags');
            
            // Provide user-friendly error messages
            let userMessage = 'Failed to restore backup: ';
            if (error.includes('missing config.json')) {
                userMessage += 'The selected file is not a valid HomeMap backup archive. Please select a ZIP file created by HomeMap\'s backup function.';
            } else if (error.includes('Invalid config.json format')) {
                userMessage += 'The backup file appears to be corrupted. The configuration data is not readable.';
            } else if (error.includes('not a HomeMap backup')) {
                userMessage += 'This doesn\'t appear to be a HomeMap backup file. Please select a ZIP file created by HomeMap.';
            } else if (error.includes('Failed to open backup file')) {
                userMessage += 'Could not open the backup file. Please check that the file exists and is not corrupted.';
            } else if (error.includes('Failed to create target directory')) {
                userMessage += 'Could not create the destination folder. Please check file permissions.';
            } else {
                userMessage += error;
            }
            
            alert(userMessage);
        }
    }

    toggleEditMode() {
        // Show/hide zoom controls and auto-discover button
        const zoomControls = document.getElementById('zoomControls');
        const autoDiscoverBtn = document.getElementById('autoDiscoverBtn');
        const widgetPalette = document.getElementById('widgetPalette');
        
        if (this.editMode) {
            // Add edit-mode class to body for CSS styling (e.g., touch-action)
            document.body.classList.add('edit-mode');
            
            zoomControls.style.display = 'flex';
            autoDiscoverBtn.style.display = 'block';
            
            // Only show widget palette if there are remote widgets available
            const hasRemoteWidgets = this.remoteWidgetManager && this.remoteWidgetManager.remoteWidgets.size > 0;
            widgetPalette.style.display = hasRemoteWidgets ? 'flex' : 'none';
            
            // Update widget palette with current remote widgets
            if (this.remoteWidgetManager) {
                this.remoteWidgetManager.updateWidgetPalette();
                // Setup drop zones for remote widgets
                this.remoteWidgetManager.setupFloorDropZones();
            }
            
            // Reposition all devices to sync with current layout
            this.floorManager.repositionAllDevices();
        } else {
            // Remove edit-mode class from body
            document.body.classList.remove('edit-mode');
            
            zoomControls.style.display = 'none';
            autoDiscoverBtn.style.display = 'none';
            widgetPalette.style.display = 'none';
            
            // Reposition devices after palette closes (wait for CSS transition)
            setTimeout(() => {
                this.floorManager.repositionAllDevices();
            }, 350); // Slightly longer than the 300ms transition
        }
        
        // Update all device elements
        document.querySelectorAll('.device').forEach(deviceEl => {
            if (this.editMode) {
                deviceEl.classList.add('edit-mode');
            } else {
                deviceEl.classList.remove('edit-mode');
            }
        });
        
        // Just show/hide the [+] tab without re-rendering everything
        let addTab = document.querySelector('.add-floor-tab');
        if (this.editMode) {
            // Add [+] tab if it doesn't exist
            if (!addTab) {
                addTab = document.createElement('button');
                addTab.className = 'tab add-floor-tab';
                addTab.textContent = '+';
                addTab.title = 'Add Floor';
                addTab.onclick = () => this.floorManagementDialog.showAddFloorDialog();
                document.getElementById('floorTabs').appendChild(addTab);
            }
        } else {
            // Remove [+] tab if it exists
            if (addTab) {
                addTab.remove();
            }
        }
        
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

    async syncBuiltinResourcesIfNeeded() {
        try {
            console.log('=== Checking if built-in resources need syncing ===');
            
            // Get app version from Rust
            const appVersion = await this.invoke('get_app_version');
            console.log('App version:', appVersion);
            
            // Check stored version
            const versionFile = `${this.dataPath}/.builtin-version`;
            let storedVersion = null;
            
            try {
                storedVersion = await this.invoke('read_file_as_text', { filePath: versionFile });
                storedVersion = storedVersion.trim();
                console.log('Stored built-in version:', storedVersion);
            } catch (err) {
                console.log('No version file found - first run or needs sync');
            }
            
            // Check if sync is needed
            if (storedVersion === appVersion) {
                console.log('Built-in resources already synced for version', appVersion);
                return;
            }
            
            console.log('Syncing built-in resources from bundled assets...');
            
            // Read manifest to find built-in resources
            const manifestB64 = await this.invoke('read_bundled_asset', { 
                assetPath: 'asset-manifest.json' 
            });
            const manifestJson = atob(manifestB64);
            const manifest = JSON.parse(manifestJson);
            
            // Filter for built-in resources only (widgets/built-in/* and icons/built-in/*)
            const builtinFiles = manifest.files.filter(file => 
                file.startsWith('widgets/built-in/') || file.startsWith('icons/built-in/')
            );
            
            console.log(`Found ${builtinFiles.length} built-in files to sync`);
            
            let successCount = 0;
            let errorCount = 0;
            
            // Sync each built-in file
            for (const file of builtinFiles) {
                try {
                    const fileB64 = await this.invoke('read_bundled_asset', { 
                        assetPath: file 
                    });
                    
                    const targetPath = `${this.dataPath}/${file}`;
                    await this.invoke('write_file_base64', { 
                        filePath: targetPath,
                        b64: fileB64 
                    });
                    
                    successCount++;
                } catch (err) {
                    console.error(`Error syncing ${file}:`, err);
                    errorCount++;
                }
            }
            
            console.log(`Built-in sync complete: ${successCount} succeeded, ${errorCount} failed`);
            
            // Update version file
            if (successCount > 0 || builtinFiles.length === 0) {
                await this.invoke('write_file_as_text', { 
                    filePath: versionFile,
                    content: appVersion 
                });
                console.log('Updated built-in version to', appVersion);
            }
            
        } catch (error) {
            console.error('Failed to sync built-in resources:', error);
        }
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
                // Still check if built-in resources need syncing (for app upgrades)
                await this.syncBuiltinResourcesIfNeeded();
                return;
            }
            
            // Check if assets already exist (e.g., copied by Rust on iOS)
            try {
                const testPath = `${this.dataPath}/config.json`;
                const testRead = await this.invoke('read_file_as_text', { filePath: testPath });
                if (testRead) {
                    console.log('Assets already exist (likely copied by Rust), skipping JS copy');
                    localStorage.setItem(versionKey, manifestVersion);
                    // Still check if built-in resources need syncing
                    await this.syncBuiltinResourcesIfNeeded();
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
            
            // Initialize remote widget manager
            this.remoteWidgetManager = new RemoteWidgetManager(this);
            await this.remoteWidgetManager.initialize();
            
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
            
            // Auto-start WebSocket server if configured
            if (this.remoteWidgetManager) {
                await this.remoteWidgetManager.autoStartServerIfConfigured();
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
