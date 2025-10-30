/**
 * Package Manager Module
 * 
 * Handles widget package (.hwp) installation, uninstallation, and resolution.
 * Supports namespaced packages with priority-based widget resolution.
 */

// Simple path join helper
function joinPath(...parts) {
    return parts.join('/').replace(/\/+/g, '/');
}

class PackageManager {
    constructor() {
        this.installedPackages = null;
        this.widgetMappings = null;
        this.dataPath = null;
        
        // Get Tauri APIs from window
        this.invoke = window.__TAURI__.core.invoke;
        this.dialog = window.__TAURI__.dialog;
        this.fs = window.__TAURI__.fs;
    }

    /**
     * Initialize package manager
     */
    async init() {
        this.dataPath = await this.invoke('get_data_path');
        await this.loadInstalledPackages();
        await this.loadWidgetMappings();
    }

    /**
     * Load installed packages registry
     */
    async loadInstalledPackages() {
        try {
            const registryPath = joinPath(this.dataPath, 'installed-packages.json');
            
            // Try to read via Rust command (has proper permissions)
            try {
                const content = await this.invoke('read_file_as_text', { filePath: registryPath });
                this.installedPackages = JSON.parse(content);
            } catch (error) {
                // File doesn't exist yet - create empty registry
                this.installedPackages = {
                    version: '1.0',
                    packages: {}
                };
                await this.saveInstalledPackages();
            }
        } catch (error) {
            console.error('Error loading installed packages:', error);
            this.installedPackages = { version: '1.0', packages: {} };
        }
    }

    /**
     * Save installed packages registry
     */
    async saveInstalledPackages() {
        try {
            const registryPath = joinPath(this.dataPath, 'installed-packages.json');
            const content = JSON.stringify(this.installedPackages, null, 2);
            
            // Use Rust command to write file (has proper permissions)
            await this.invoke('save_config', { 
                filePath: registryPath,
                content: content 
            });
        } catch (error) {
            console.error('Error saving installed packages:', error);
            throw error;
        }
    }

    /**
     * Load widget mappings (device type → widget)
     */
    async loadWidgetMappings() {
        try {
            const mappingsPath = joinPath(this.dataPath, 'widget-mappings.json');
            
            // Try to read via Rust command (has proper permissions)
            try {
                const content = await this.invoke('read_file_as_text', { filePath: mappingsPath });
                this.widgetMappings = JSON.parse(content);
            } catch (error) {
                // File doesn't exist yet - create empty mappings
                this.widgetMappings = {
                    version: '1.0',
                    mappings: {},
                    defaults: {}
                };
                await this.saveWidgetMappings();
            }
        } catch (error) {
            console.error('Error loading widget mappings:', error);
            this.widgetMappings = { version: '1.0', mappings: {}, defaults: {} };
        }
    }

    /**
     * Save widget mappings
     */
    async saveWidgetMappings() {
        try {
            const mappingsPath = joinPath(this.dataPath, 'widget-mappings.json');
            const content = JSON.stringify(this.widgetMappings, null, 2);
            
            // Use Rust command to write file (has proper permissions)
            await this.invoke('save_config', { 
                filePath: mappingsPath,
                content: content 
            });
        } catch (error) {
            console.error('Error saving widget mappings:', error);
            throw error;
        }
    }

    /**
     * Install a widget package from .hwp file
     */
    async installPackage(hwpPath = null) {
        try {
            // If no path provided, show file picker
            if (!hwpPath) {
                const selected = await this.dialog.open({
                    title: 'Select Widget Package',
                    filters: [{
                        name: 'HomeMap Widget Package',
                        extensions: ['hwp']
                    }],
                    multiple: false
                });
                
                if (!selected) return null; // User cancelled
                
                // Handle both string and object response
                hwpPath = typeof selected === 'string' ? selected : selected.path;
                console.log('Selected file:', hwpPath);
            }

            console.log('Installing package from:', hwpPath);

            // Extract package using Rust command
            // Tauri automatically converts camelCase to snake_case
            const extracted = await this.invoke('extract_widget_package', { 
                hwpPath: hwpPath,
                dataPath: this.dataPath
            });
            const { manifest, tempDir } = extracted;

            console.log('Package extracted:', manifest);

            // Check if package is already installed
            const existingPackage = this.installedPackages.packages[manifest.id];
            if (existingPackage) {
                let message;
                if (existingPackage.version === manifest.version) {
                    message = `Package "${manifest.name}" (v${existingPackage.version}) is already installed.\n\nDo you want to reinstall it?`;
                } else {
                    message = `Package "${manifest.name}" (v${existingPackage.version}) is already installed.\n\nDo you want to update it to version ${manifest.version}?`;
                }
                
                // Use Tauri dialog instead of native confirm to avoid blocking
                const action = await this.dialog.confirm(message, {
                    title: 'Package Already Installed',
                    kind: 'warning'
                });
                
                if (!action) {
                    console.log('Installation cancelled by user');
                    return null;
                }
                
                if (existingPackage.version === manifest.version) {
                    console.log(`Reinstalling package version ${manifest.version}`);
                } else {
                    console.log(`Updating package from ${existingPackage.version} to ${manifest.version}`);
                }
            }

            // Check version compatibility
            if (!this.isVersionCompatible(manifest.requires.homeMapVersion)) {
                throw new Error(`Package requires HomeMap ${manifest.requires.homeMapVersion}`);
            }

            // Check for conflicts
            const conflicts = await this.checkConflicts(manifest);
            if (conflicts.length > 0) {
                console.warn('Package conflicts detected:', conflicts);
                // TODO: Show conflict resolution UI
                // For now, proceed with installation (namespaced)
            }

            // Install package files
            await this.installPackageFiles(manifest, tempDir);

            // Register package
            await this.registerPackage(manifest, tempDir);

            // Cleanup temp directory
            // Note: We might want to keep it for now during development
            // await this.fs.remove(tempDir, { recursive: true });

            console.log('Package installed successfully:', manifest.id);
            return manifest;

        } catch (error) {
            console.error('Error installing package:', error);
            throw error;
        }
    }

    /**
     * Check if HomeMap version is compatible with package requirements
     */
    isVersionCompatible(requiredVersion) {
        // Simple version check - can be enhanced with semver parsing
        // For now, just check if it starts with ">=" and compare
        if (requiredVersion.startsWith('>=')) {
            const required = requiredVersion.substring(2).trim();
            // TODO: Get actual HomeMap version from somewhere
            const current = '0.1.7'; // Placeholder
            return current >= required;
        }
        return true;
    }

    /**
     * Check for conflicts with existing packages
     */
    async checkConflicts(manifest) {
        const conflicts = [];

        // Check widget ID conflicts
        for (const widgetId of manifest.provides.widgets) {
            const existing = await this.findInstalledWidget(widgetId);
            if (existing && existing.package !== manifest.id) {
                conflicts.push({
                    type: 'widget',
                    id: widgetId,
                    existing: existing.package,
                    new: manifest.id
                });
            }
        }

        // Check icon set conflicts
        for (const iconSet of manifest.provides.iconSets) {
            const existing = await this.findInstalledIconSet(iconSet);
            if (existing && existing.package !== manifest.id) {
                conflicts.push({
                    type: 'iconSet',
                    id: iconSet,
                    existing: existing.package,
                    new: manifest.id
                });
            }
        }

        return conflicts;
    }

    /**
     * Find if a widget is already installed
     */
    async findInstalledWidget(widgetId) {
        for (const [packageId, packageInfo] of Object.entries(this.installedPackages.packages)) {
            if (packageInfo.manifest.provides.widgets.includes(widgetId)) {
                return { package: packageId, info: packageInfo };
            }
        }
        return null;
    }

    /**
     * Find if an icon set is already installed
     */
    async findInstalledIconSet(iconSet) {
        for (const [packageId, packageInfo] of Object.entries(this.installedPackages.packages)) {
            if (packageInfo.manifest.provides.iconSets.includes(iconSet)) {
                return { package: packageId, info: packageInfo };
            }
        }
        return null;
    }

    /**
     * Install package files to homemapdata
     */
    async installPackageFiles(manifest, tempDir) {
        const packageId = manifest.id;
        const packageDir = joinPath(this.dataPath, 'widgets', 'packages', packageId);

        // Create package directory using Rust command
        await this.invoke('create_dir', { path: packageDir });

        // Copy manifest
        const manifestSrc = joinPath(tempDir, 'manifest.json');
        const manifestDst = joinPath(packageDir, 'manifest.json');
        await this.invoke('copy_file', { src: manifestSrc, dst: manifestDst });

        // Copy widgets
        const widgetsSrc = joinPath(tempDir, 'widgets');
        const widgetsSrcAlt = joinPath(tempDir, 'widget.json');
        
        // Check if widgets/ directory exists
        const widgetsDirExists = await this.invoke('path_exists', { path: widgetsSrc });
        const widgetFileExists = await this.invoke('path_exists', { path: widgetsSrcAlt });

        if (widgetsDirExists && await this.invoke('is_directory', { path: widgetsSrc })) {
            // Copy all widget files from widgets/ directory
            const entries = await this.invoke('list_directory', { path: widgetsSrc });
            for (const entry of entries) {
                if (entry.endsWith('.json')) {
                    const src = joinPath(widgetsSrc, entry);
                    const dst = joinPath(packageDir, entry);
                    await this.invoke('copy_file', { src, dst });
                }
            }
        } else if (widgetFileExists) {
            // Single widget.json file - rename to first widget ID
            const widgetId = manifest.provides.widgets[0];
            const dst = joinPath(packageDir, `${widgetId}.json`);
            await this.invoke('copy_file', { src: widgetsSrcAlt, dst });
        }

        // Copy icon sets
        const iconsSrc = joinPath(tempDir, 'icons');
        const iconsExists = await this.invoke('path_exists', { path: iconsSrc });
        
        if (iconsExists && await this.invoke('is_directory', { path: iconsSrc })) {
            const iconsPackageDir = joinPath(this.dataPath, 'icons', 'packages', packageId);
            await this.invoke('create_dir', { path: iconsPackageDir });

            const entries = await this.invoke('list_directory', { path: iconsSrc });
            for (const entry of entries) {
                const srcPath = joinPath(iconsSrc, entry);
                if (await this.invoke('is_directory', { path: srcPath })) {
                    const dstDir = joinPath(iconsPackageDir, entry);
                    await this.copyDirectory(srcPath, dstDir);
                }
            }
        }
    }

    /**
     * Recursively copy a directory
     */
    async copyDirectory(src, dst) {
        await this.invoke('create_dir', { path: dst });
        
        const entries = await this.invoke('list_directory', { path: src });
        for (const entry of entries) {
            const srcPath = joinPath(src, entry);
            const dstPath = joinPath(dst, entry);
            
            if (await this.invoke('is_directory', { path: srcPath })) {
                await this.copyDirectory(srcPath, dstPath);
            } else {
                await this.invoke('copy_file', { src: srcPath, dst: dstPath });
            }
        }
    }

    /**
     * Register installed package in registry
     */
    async registerPackage(manifest, tempDir) {
        const packageId = manifest.id;
        
        // Build file list
        const files = {
            widgets: [],
            icons: []
        };

        // Add widget files
        for (const widgetId of manifest.provides.widgets) {
            const widgetPath = `widgets/packages/${packageId}/${widgetId}.json`;
            files.widgets.push(widgetPath);
        }

        // Add icon set directories
        for (const iconSet of manifest.provides.iconSets) {
            const iconPath = `icons/packages/${packageId}/${iconSet}/`;
            files.icons.push(iconPath);
        }

        // Register in installed packages
        this.installedPackages.packages[packageId] = {
            version: manifest.version,
            installedAt: new Date().toISOString(),
            installedFrom: 'local',
            manifest: manifest,
            files: files
        };

        await this.saveInstalledPackages();
    }

    /**
     * Uninstall a package
     */
    async uninstallPackage(packageId) {
        const packageInfo = this.installedPackages.packages[packageId];
        if (!packageInfo) {
            throw new Error(`Package not found: ${packageId}`);
        }

        // Remove widget files
        const packageDir = joinPath(this.dataPath, 'widgets', 'packages', packageId);
        await this.fs.remove(packageDir, { recursive: true });

        // Remove icon files
        const iconsDir = joinPath(this.dataPath, 'icons', 'packages', packageId);
        const iconsExists = await this.fs.exists(iconsDir);
        if (iconsExists) {
            await this.fs.remove(iconsDir, { recursive: true });
        }

        // Remove from registry
        delete this.installedPackages.packages[packageId];
        await this.saveInstalledPackages();

        console.log('Package uninstalled:', packageId);
    }

    /**
     * Get list of installed packages
     */
    getInstalledPackages() {
        return Object.entries(this.installedPackages.packages).map(([id, info]) => ({
            id,
            ...info
        }));
    }

    /**
     * Resolve widget for a device type
     * Priority: explicit > mapping > built-in > packages > generic
     */
    async resolveWidget(deviceType, explicitWidget = null) {
        // 1. Explicit widget reference
        if (explicitWidget) {
            const parts = explicitWidget.split('/');
            if (parts.length === 2) {
                const [packageId, widgetId] = parts;
                return await this.loadPackageWidget(packageId, widgetId);
            }
        }

        // 2. Check widget mappings
        if (this.widgetMappings.mappings[deviceType]) {
            const mapping = this.widgetMappings.mappings[deviceType];
            return await this.loadPackageWidget(mapping.package, mapping.widget);
        }

        // 3. Try built-in widget by device type name
        const builtInWidget = await this.loadBuiltInWidget(deviceType);
        if (builtInWidget) return builtInWidget;

        // 4. Search installed packages
        const matches = await this.findWidgetsByDeviceType(deviceType);
        if (matches.length > 0) {
            return matches[0]; // Return first match for now
        }

        // 5. Return null - let widgetManager handle generic fallback
        return null;
    }

    /**
     * Load widget from a specific package
     */
    async loadPackageWidget(packageId, widgetId) {
        try {
            const widgetPath = joinPath(this.dataPath, 'widgets', 'packages', packageId, `${widgetId}.json`);
            const content = await this.invoke('read_file_as_text', { filePath: widgetPath });
            const widget = JSON.parse(content);
            widget._package = packageId;
            return widget;
        } catch (error) {
            console.error(`Failed to load package widget ${packageId}/${widgetId}:`, error);
            return null;
        }
    }

    /**
     * Load built-in widget
     */
    async loadBuiltInWidget(widgetId) {
        try {
            // Try built-in directory first
            let widgetPath = joinPath(this.dataPath, 'widgets', 'built-in', `${widgetId}.json`);
            
            try {
                const content = await this.invoke('read_file_as_text', { filePath: widgetPath });
                const widget = JSON.parse(content);
                widget._package = 'com.fibaro.built-in';
                return widget;
            } catch (error) {
                // Fallback to root widgets directory for backward compatibility
                widgetPath = joinPath(this.dataPath, 'widgets', `${widgetId}.json`);
                try {
                    const content = await this.invoke('read_file_as_text', { filePath: widgetPath });
                    const widget = JSON.parse(content);
                    widget._package = 'com.fibaro.built-in';
                    return widget;
                } catch (error2) {
                    return null;
                }
            }
        } catch (error) {
            console.error(`Failed to load built-in widget ${widgetId}:`, error);
            return null;
        }
    }

    /**
     * Find widgets that support a device type
     */
    async findWidgetsByDeviceType(deviceType) {
        const matches = [];

        for (const [packageId, packageInfo] of Object.entries(this.installedPackages.packages)) {
            if (packageInfo.manifest.deviceTypes?.includes(deviceType)) {
                // Load all widgets from this package
                for (const widgetId of packageInfo.manifest.provides.widgets) {
                    const widget = await this.loadPackageWidget(packageId, widgetId);
                    if (widget && widget.type === deviceType) {
                        matches.push(widget);
                    }
                }
            }
        }

        return matches;
    }

    /**
     * Set widget mapping for a device type
     */
    async setWidgetMapping(deviceType, packageId, widgetId) {
        this.widgetMappings.mappings[deviceType] = {
            package: packageId,
            widget: widgetId
        };
        await this.saveWidgetMappings();
    }

    /**
     * Remove widget mapping for a device type
     */
    async removeWidgetMapping(deviceType) {
        delete this.widgetMappings.mappings[deviceType];
        await this.saveWidgetMappings();
    }
}

// Create singleton instance
const packageManager = new PackageManager();

export default packageManager;
