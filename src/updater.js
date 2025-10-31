// Auto-updater functionality for HomeMap
// Based on Tauri 2.x updater plugin with dialog and process plugins

async function setupUpdater() {
    const { check } = window.__TAURI__?.updater || {};
    
    if (!check) {
        console.log('Updater not available (dev mode or missing plugin)');
    } else {
        console.log('Updater initialized');
        
        // Listen for menu "Check for Updates" event
        await window.__TAURI__.event.listen('check-for-updates', () => {
            console.log('Check for updates triggered from menu');
            checkForUpdates(false);
        });
        
        // Listen for menu "Create Configuration" event
        await window.__TAURI__.event.listen('create-config', () => {
            console.log('Create configuration triggered from menu');
            createConfiguration();
        });
    }
    
    // Listen for menu "About" event (always available, not just when updater is)
    await window.__TAURI__.event.listen('show-about', async () => {
        console.log('Show about triggered from menu');
        await showAboutDialog();
    });
}

async function checkForUpdates(silent = false) {
    try {
        console.log('Checking for updates...');
        const { check } = window.__TAURI__.updater;
        const update = await check();
        
        if (update?.available) {
            const version = update.version;
            let body = update.body || 'Bug fixes and improvements';
            
            // Clean up release notes (remove manual installation instructions)
            body = body.replace(/## Installation[\s\S]*$/i, '').trim();
            body = body.replace(/### Manual Installation[\s\S]*$/i, '').trim();
            
            const message = `A new version (${version}) is available!\n\n${body}\n\nThe update will be downloaded and installed automatically.`;
            
            // Try dialog API with fallback for ACL errors
            let shouldUpdate = true;
            if (window.__TAURI__?.dialog) {
                try {
                    const { ask } = window.__TAURI__.dialog;
                    shouldUpdate = await ask(message, {
                        title: 'Update Available',
                        kind: 'info',
                        okLabel: 'Update',
                        cancelLabel: 'Later'
                    });
                } catch (error) {
                    console.log('Dialog failed, auto-installing:', error.message);
                }
            }
            
            if (shouldUpdate) {
                console.log('Downloading and installing update...');
                await update.downloadAndInstall();
                
                // Try to restart
                if (window.__TAURI__?.process?.relaunch) {
                    try {
                        const { ask } = window.__TAURI__.dialog;
                        const shouldRelaunch = await ask(
                            'Update installed successfully. Restart now?',
                            { 
                                title: 'Update Complete', 
                                kind: 'info', 
                                okLabel: 'Restart Now', 
                                cancelLabel: 'Later' 
                            }
                        );
                        if (shouldRelaunch) {
                            await window.__TAURI__.process.relaunch();
                        }
                    } catch (error) {
                        console.log('Auto-restarting...', error.message);
                        await window.__TAURI__.process.relaunch();
                    }
                } else {
                    console.log('Update installed. Please restart the application manually.');
                }
            }
        } else if (!silent) {
            console.log('No updates available');
            if (window.__TAURI__?.dialog) {
                const { message } = window.__TAURI__.dialog;
                await message('You are running the latest version!', 
                             { title: 'No Updates', kind: 'info' });
            }
        }
    } catch (error) {
        console.error('Update check failed:', error);
        if (!silent && window.__TAURI__?.dialog) {
            const { message } = window.__TAURI__.dialog;
            await message(`Failed to check for updates: ${error.message}`, 
                         { title: 'Update Error', kind: 'error' });
        }
    }
}

async function createConfiguration() {
    if (!window.__TAURI__?.dialog) {
        console.error('Dialog plugin not available');
        return;
    }
    
    try {
        const { open, message } = window.__TAURI__.dialog;
        
        // Ask user to select a folder
        const selected = await open({
            directory: true,
            multiple: false,
            title: 'Select location to create homemapdata folder'
        });
        
        if (!selected) {
            console.log('User cancelled folder selection');
            return;
        }
        
        console.log('Selected folder:', selected);
        
        // Call Rust command to create the configuration
        const result = await window.__TAURI__.core.invoke('create_config_folder', {
            destinationPath: selected
        });
        
        console.log('Configuration created at:', result);
        
        // Show success message
        await message(
            `Configuration folder created successfully at:\n\n${result}\n\nPlease add your floor plan images to the images folder and edit config.json to add your devices.`,
            {
                title: 'Configuration Created',
                kind: 'info'
            }
        );
        
    } catch (error) {
        console.error('Failed to create configuration:', error);
        
        if (window.__TAURI__?.dialog) {
            const { message } = window.__TAURI__.dialog;
            await message(
                `Failed to create configuration:\n\n${error}`,
                {
                    title: 'Error',
                    kind: 'error'
                }
            );
        }
    }
}

async function showAboutDialog() {
    try {
        // Get version from tauri.conf.json via Tauri API
        const { getName, getVersion } = window.__TAURI__.app;
        const appName = await getName();
        const version = await getVersion();
        
        const message = `${appName}
Version ${version}

A HC3 Home Automation Visualization Tool

© 2024-2025 Jan Gabrielsson`;
        
        if (window.__TAURI__?.dialog) {
            const { message: showMessage } = window.__TAURI__.dialog;
            await showMessage(message, {
                title: `About ${appName}`,
                kind: 'info'
            });
        }
    } catch (error) {
        console.error('Failed to show about dialog:', error);
    }
}

// Initialize on app start
if (window.__TAURI__) {
    setupUpdater();
}
