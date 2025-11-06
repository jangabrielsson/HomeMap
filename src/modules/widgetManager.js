// widgetManager.js - Widget loading, rendering, and icon management
import { APP_VERSION, MIN_WIDGET_VERSION, isVersionCompatible } from './utils.js';
import packageManager from './packageManager.js';

export class WidgetManager {
    constructor(dataPath, invokeFunction) {
        this.dataPath = dataPath;
        this.invoke = invokeFunction;
        this.widgets = {};
        this.iconSets = new Map();
        this.packageManager = packageManager;
    }

    /**
     * Load an icon set from disk and cache it
     * Now supports package-aware icon loading
     */
    async loadIconSet(iconSetName, packageId = null) {
        // Handle legacy full-path format from backups: "icons/built-in/dimLight"
        // Extract the actual iconSet name and infer packageId if not provided
        if (iconSetName && iconSetName.includes('/')) {
            const parts = iconSetName.split('/');
            if (parts[0] === 'icons') {
                if (parts[1] === 'built-in' && parts.length >= 3) {
                    // "icons/built-in/dimLight" -> iconSetName="dimLight", packageId="com.fibaro.built-in"
                    iconSetName = parts.slice(2).join('/');
                    if (!packageId) packageId = 'com.fibaro.built-in';
                } else if (parts[1] === 'packages' && parts.length >= 4) {
                    // "icons/packages/my-package/iconset" -> iconSetName="iconset", packageId="my-package"
                    if (!packageId) packageId = parts[2];
                    iconSetName = parts.slice(3).join('/');
                } else if (parts.length >= 2) {
                    // "icons/dimLight" -> iconSetName="dimLight", no package (legacy root location)
                    iconSetName = parts.slice(1).join('/');
                }
            }
        }
        
        const cacheKey = packageId ? `${packageId}/${iconSetName}` : iconSetName;
        
        // Check cache first
        if (this.iconSets.has(cacheKey)) {
            return this.iconSets.get(cacheKey);
        }
        
        try {
            // Determine icon set path based on package
            let iconSetPath;
            let iconPathPrefix;
            let files = null;
            
            if (packageId && packageId !== 'legacy' && packageId !== 'com.fibaro.built-in') {
                // Package icon set
                iconSetPath = `${this.dataPath}/icons/packages/${packageId}/${iconSetName}`;
                iconPathPrefix = `icons/packages/${packageId}/${iconSetName}`;
                try {
                    files = await this.invoke('list_directory', { path: iconSetPath });
                } catch (error) {
                    console.warn(`Package icon set not found at ${iconSetPath}`);
                }
            } else if (packageId === 'com.fibaro.built-in') {
                // Try built-in first
                iconSetPath = `${this.dataPath}/icons/built-in/${iconSetName}`;
                iconPathPrefix = `icons/built-in/${iconSetName}`;
                try {
                    files = await this.invoke('list_directory', { path: iconSetPath });
                } catch {
                    // Fallback to root icons directory (legacy)
                    iconSetPath = `${this.dataPath}/icons/${iconSetName}`;
                    iconPathPrefix = `icons/${iconSetName}`;
                    try {
                        files = await this.invoke('list_directory', { path: iconSetPath });
                    } catch (error) {
                        console.warn(`Built-in icon set not found at ${iconSetPath}`);
                    }
                }
            } else {
                // Legacy or no package - try root first
                iconSetPath = `${this.dataPath}/icons/${iconSetName}`;
                iconPathPrefix = `icons/${iconSetName}`;
                try {
                    files = await this.invoke('list_directory', { path: iconSetPath });
                } catch {
                    // Try built-in as fallback
                    iconSetPath = `${this.dataPath}/icons/built-in/${iconSetName}`;
                    iconPathPrefix = `icons/built-in/${iconSetName}`;
                    try {
                        files = await this.invoke('list_directory', { path: iconSetPath });
                    } catch (error) {
                        console.warn(`Icon set not found at ${iconSetPath}`);
                    }
                }
            }
            
            if (!files) {
                console.error(`Failed to load icon set "${iconSetName}"`);
                return {};
            }
            
            // Build a map of icon names to full paths
            const iconMap = {};
            const supportedExtensions = ['.svg', '.png', '.jpg', '.jpeg'];
            
            for (const file of files) {
                const ext = file.substring(file.lastIndexOf('.')).toLowerCase();
                if (supportedExtensions.includes(ext)) {
                    const iconName = file.substring(0, file.lastIndexOf('.'));
                    iconMap[iconName] = `${iconPathPrefix}/${file}`;
                }
            }
            
            const packageInfo = packageId ? ` from ${packageId}` : '';
            console.log(`Loaded icon set "${iconSetName}"${packageInfo}:`, Object.keys(iconMap));
            
            // Cache it
            this.iconSets.set(cacheKey, iconMap);
            return iconMap;
        } catch (error) {
            console.error(`Failed to load icon set "${iconSetName}" (package: ${packageId}):`, error);
            return {};
        }
    }

    /**
     * Load all widget definitions for the devices in config
     */
    async loadWidgets(devices) {
        this.widgets = {};
        
        // Initialize package manager if not already done
        if (!this.packageManager.dataPath) {
            await this.packageManager.init();
        }
        
        // Get unique widget types from devices
        const widgetTypes = [...new Set(devices?.map(d => d.type) || [])];
        
        for (const type of widgetTypes) {
            try {
                // Try to resolve widget through package manager
                // Check if device has explicit widget reference
                const device = devices.find(d => d.type === type);
                const explicitWidget = device?.widget;
                
                let widget = await this.packageManager.resolveWidget(type, explicitWidget);
                
                // Fallback to old method for backward compatibility
                if (!widget) {
                    try {
                        const jsonContent = await this.invoke('read_widget_json', { widgetType: type });
                        widget = JSON.parse(jsonContent);
                        widget._package = 'legacy'; // Mark as legacy
                    } catch (error) {
                        console.warn(`No widget found for ${type} in packages or legacy location`);
                        continue;
                    }
                }
                
                // Check widget version compatibility
                if (widget.widgetVersion && !isVersionCompatible(widget.widgetVersion, MIN_WIDGET_VERSION)) {
                    console.error(`Widget "${type}" version ${widget.widgetVersion} is not compatible with app version ${APP_VERSION} (requires >= ${MIN_WIDGET_VERSION})`);
                    continue;
                }
                
                // Load icon set if specified
                if (widget.iconSet) {
                    widget.iconSetMap = await this.loadIconSet(widget.iconSet, widget._package);
                } else if (widget.render?.icon?.set) {
                    // New render format
                    widget.iconSetMap = await this.loadIconSet(widget.render.icon.set, widget._package);
                }
                
                this.widgets[type] = widget;
                const packageInfo = widget._package ? ` from ${widget._package}` : '';
                console.log(`Loaded widget definition for ${type}${packageInfo}`);
            } catch (error) {
                console.error(`Failed to load widget ${type}:`, error);
            }
        }

        return this.widgets;
    }

    /**
     * Load all available widgets from built-in and packages
     * This is used to populate widget dropdowns even when no devices are configured yet
     */
    async loadAllAvailableWidgets() {
        try {
            // Load built-in widgets
            const builtInPath = `${this.dataPath}/widgets/built-in`;
            try {
                const files = await this.invoke('list_directory', { path: builtInPath });
                console.log('Found built-in widget files:', files);
                
                for (const file of files) {
                    if (file.endsWith('.json')) {
                        const widgetType = file.replace('.json', '');
                        if (!this.widgets[widgetType]) {
                            try {
                                const jsonContent = await this.invoke('read_widget_json', { widgetType });
                                const widget = JSON.parse(jsonContent);
                                widget._package = 'com.fibaro.built-in';
                                
                                // Load icon set if specified
                                if (widget.iconSet) {
                                    widget.iconSetMap = await this.loadIconSet(widget.iconSet, widget._package);
                                } else if (widget.render?.icon?.set) {
                                    widget.iconSetMap = await this.loadIconSet(widget.render.icon.set, widget._package);
                                }
                                
                                this.widgets[widgetType] = widget;
                                console.log(`Loaded built-in widget: ${widgetType}`);
                            } catch (error) {
                                console.warn(`Failed to load widget ${widgetType}:`, error);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to load built-in widgets:', error);
            }
            
            // TODO: Also load package widgets when packages are supported
            
            console.log(`Total widgets available: ${Object.keys(this.widgets).length}`);
            return this.widgets;
        } catch (error) {
            console.error('Failed to load available widgets:', error);
            return this.widgets;
        }
    }

    /**
     * Get a specific widget definition
     */
    getWidget(type) {
        return this.widgets[type];
    }

    /**
     * Render a device using its widget definition
     */
    async renderDevice(device, widget, iconElement, textElement) {
        if (!widget.render) {
            console.warn(`No render definition for device ${device.id}`);
            return;
        }
        
        const state = device.state || {};
        
        // Check if device has custom parameters that override widget settings
        let effectiveIconSetMap = widget.iconSetMap;
        if (device.params?.iconSet) {
            console.log(`Device ${device.id} uses custom iconSet: ${device.params.iconSet}`);
            effectiveIconSetMap = await this.loadIconSet(device.params.iconSet, device.params.iconPackage || null);
        }
        
        // Render icon
        if (widget.render.icon) {
            const iconName = this.getIconFromRenderDef(state, widget.render.icon);
            if (iconName && effectiveIconSetMap) {
                const iconPath = effectiveIconSetMap[iconName];
                if (iconPath) {
                    // Check if we need inline SVG for manipulation
                    const needsInlineSvg = widget.render.svg && iconPath.endsWith('.svg');
                    
                    if (needsInlineSvg) {
                        await this.loadInlineSvg(iconElement, iconPath, widget, state);
                    } else {
                        await this.loadDeviceIcon(iconElement, iconPath);
                    }
                } else {
                    console.warn(`Icon "${iconName}" not found in icon set for device ${device.id}`);
                }
            }
        }
        
        // Render subtext
        if (widget.render.subtext && textElement) {
            const shouldShow = widget.render.subtext.visible 
                ? this.evaluateCondition(state, widget.render.subtext.visible)
                : true;
            
            if (shouldShow) {
                const text = this.interpolateTemplate(widget.render.subtext.template, state);
                textElement.textContent = text;
                textElement.style.display = 'block';
            } else {
                textElement.style.display = 'none';
            }
        }
        
        // Apply custom styles to icon
        if (widget.render.style && iconElement) {
            console.log(`Applying custom styles. State:`, JSON.stringify(state, null, 2));
            for (const [styleProp, styleValue] of Object.entries(widget.render.style)) {
                console.log(`Processing style ${styleProp} with template: ${styleValue}`);
                const interpolatedValue = this.interpolateTemplate(styleValue, state);
                iconElement.style[styleProp] = interpolatedValue;
                console.log(`Applied style ${styleProp}: ${interpolatedValue}`);
            }
        }
    }

    /**
     * Determine which icon to use based on render definition
     */
    getIconFromRenderDef(state, iconDef) {
        switch (iconDef.type) {
            case 'static':
                return iconDef.icon;
            
            case 'conditional':
                const propValue = state[iconDef.property];
                console.log(`Evaluating conditional icon, property "${iconDef.property}", value:`, propValue, 'state:', state);
                
                for (const condition of iconDef.conditions) {
                    // Create evaluation context with the specific property value
                    const evalContext = { [iconDef.property]: propValue };
                    if (this.evaluateCondition(evalContext, condition.when)) {
                        return condition.icon;
                    }
                }
                return null;
            
            default:
                console.warn(`Unknown icon type: ${iconDef.type}`);
                return null;
        }
    }

    /**
     * Evaluate a condition string against state
     */
    evaluateCondition(state, conditionStr) {
        let expr = conditionStr; // Declare at function scope for error handler
        try {
            // Simple evaluation - replace state properties in condition
            
            console.log(`Evaluating condition "${conditionStr}" with state:`, JSON.stringify(state));
            console.log(`State has keys:`, Object.keys(state));
            
            // Check if state is empty
            if (Object.keys(state).length === 0) {
                console.error(`State object is empty! Cannot evaluate condition.`);
                return false;
            }
            
            for (const [key, value] of Object.entries(state)) {
                const regex = new RegExp(`\\b${key}\\b`, 'g');
                
                console.log(`  Processing key "${key}" (${typeof value}), value:`, value);
                
                // Handle different value types
                if (value === undefined) {
                    console.warn(`Value for "${key}" is undefined, replacing with undefined`);
                    expr = expr.replace(regex, 'undefined');
                } else if (value === null) {
                    expr = expr.replace(regex, 'null');
                } else if (typeof value === 'boolean') {
                    expr = expr.replace(regex, String(value));
                } else if (typeof value === 'number') {
                    expr = expr.replace(regex, String(value));
                } else if (typeof value === 'string') {
                    expr = expr.replace(regex, `"${value}"`);
                } else {
                    // For objects/arrays, try JSON.stringify or skip
                    console.warn(`Skipping complex value for "${key}":`, typeof value, value);
                    continue;
                }
                
                console.log(`  After replacing "${key}": "${expr}"`);
            }
            
            console.log(`Final expression: "${expr}"`);
            
            if (expr === conditionStr) {
                console.error(`No replacements were made! Expression unchanged: "${expr}"`);
                return false;
            }
            
            // eslint-disable-next-line no-eval
            const result = eval(expr);
            console.log(`Evaluation result: ${result}`);
            return result;
        } catch (error) {
            console.error(`Error evaluating condition "${conditionStr}":`, error);
            console.error(`  Final expression was: "${expr}"`);
            return false;
        }
    }

    /**
     * Interpolate template string with state values
     * Supports nested properties like ${colorComponents.red} and expressions like ${value * 1.8}
     */
    interpolateTemplate(template, state) {
        let result = template;
        
        // Match ${property} or ${expression}
        const regex = /\$\{([^}]+)\}/g;
        result = result.replace(regex, (match, expression) => {
            console.log(`Interpolating expression: ${expression}`);
            
            // Check if it's a simple expression (contains operators like *, +, -, /, >, <, etc.)
            if (/[*+\-/<>!=]/.test(expression)) {
                try {
                    // Replace property names with their values
                    let evalExpr = expression;
                    
                    // Find all property references (words that might be properties)
                    // Sort by length descending to replace longer names first (e.g., "colorComponents.red" before "value")
                    const propertyRefs = [...new Set(expression.match(/[a-zA-Z_][a-zA-Z0-9_.]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*|[a-zA-Z_][a-zA-Z0-9_]*/g))];
                    propertyRefs.sort((a, b) => b.length - a.length);
                    
                    for (const propPath of propertyRefs) {
                        // Skip if it looks like a number or keyword
                        if (/^\d+$/.test(propPath)) continue;
                        
                        // Traverse nested properties
                        const keys = propPath.split('.');
                        let value = state;
                        
                        for (const key of keys) {
                            if (value && typeof value === 'object' && key in value) {
                                value = value[key];
                            } else {
                                value = undefined;
                                break;
                            }
                        }
                        
                        if (value !== undefined) {
                            // Replace the property reference with its value
                            const regex = new RegExp(`\\b${propPath.replace(/\./g, '\\.')}\\b`, 'g');
                            evalExpr = evalExpr.replace(regex, value);
                            console.log(`  Replaced ${propPath} with ${value}: ${evalExpr}`);
                        }
                    }
                    
                    // Evaluate the expression
                    console.log(`  Evaluating: ${evalExpr}`);
                    // eslint-disable-next-line no-eval
                    const result = eval(evalExpr);
                    console.log(`  Result: ${result}`);
                    return result;
                } catch (error) {
                    console.error(`Error evaluating expression "${expression}":`, error);
                    return match;
                }
            }
            
            // Otherwise, treat as a property path
            const keys = expression.split('.');
            let value = state;
            
            for (const key of keys) {
                console.log(`  Traversing key: ${key}, current value type: ${typeof value}`);
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                    console.log(`  Found value: ${value}`);
                } else {
                    console.warn(`Property path "${expression}" not found in state at key "${key}"`);
                    // For color components, return 0 as default instead of original template
                    if (expression.startsWith('colorComponents.')) {
                        console.log(`Returning default value 0 for missing color component`);
                        return 0;
                    }
                    return match; // Return original if not found
                }
            }
            
            console.log(`Final interpolated value for ${expression}: ${value}`);
            return value !== undefined ? value : match;
        });
        
        return result;
    }

    /**
     * Load an icon image and set it on the element
     */
    async loadDeviceIcon(iconElement, iconPath) {
        const fullPath = `${this.dataPath}/${iconPath}`;
        console.log(`Loading icon from: ${fullPath}`);
        try {
            const base64Icon = await this.invoke('read_image_as_base64', { imagePath: fullPath });
            iconElement.src = base64Icon;
            console.log(`Icon loaded successfully for ${iconPath}`);
        } catch (error) {
            console.error(`Failed to load icon ${iconPath}:`, error);
            console.error(`Full path attempted: ${fullPath}`);
        }
    }
    
    /**
     * Load SVG inline and apply dynamic styles to internal elements
     */
    async loadInlineSvg(iconElement, iconPath, widget, state) {
        const fullPath = `${this.dataPath}/${iconPath}`;
        console.log(`Loading inline SVG from: ${fullPath}`);
        
        try {
            // Read SVG as text
            const svgText = await this.invoke('read_file_as_text', { filePath: fullPath });
            
            // Create a temporary container to parse the SVG
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
            const svgElement = svgDoc.documentElement;
            
            // Set size attributes
            svgElement.setAttribute('width', '32px');
            svgElement.setAttribute('height', '32px');
            
            // Apply SVG-specific styles if defined
            if (widget.render.svg) {
                const selector = widget.render.svg.selector || 'g';
                const targetElement = svgElement.querySelector(selector);
                
                if (targetElement && widget.render.svg.style) {
                    for (const [styleProp, styleValue] of Object.entries(widget.render.svg.style)) {
                        const interpolatedValue = this.interpolateTemplate(styleValue, state);
                        targetElement.style[styleProp] = interpolatedValue;
                        console.log(`Applied SVG style to ${selector} - ${styleProp}: ${interpolatedValue}`);
                    }
                }
            }
            
            // Replace the img element with the inline SVG
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svgElement);
            const base64Svg = `data:image/svg+xml;base64,${btoa(svgString)}`;
            iconElement.src = base64Svg;
            
            console.log(`Inline SVG loaded and styled successfully for ${iconPath}`);
        } catch (error) {
            console.error(`Failed to load inline SVG ${iconPath}:`, error);
            console.error(`Full path attempted: ${fullPath}`);
        }
    }
}
