// widgetManager.js - Widget loading, rendering, and icon management
import { APP_VERSION, MIN_WIDGET_VERSION, isVersionCompatible } from './utils.js';

export class WidgetManager {
    constructor(dataPath, invokeFunction) {
        this.dataPath = dataPath;
        this.invoke = invokeFunction;
        this.widgets = {};
        this.iconSets = new Map();
    }

    /**
     * Load an icon set from disk and cache it
     */
    async loadIconSet(iconSetName) {
        // Check cache first
        if (this.iconSets.has(iconSetName)) {
            return this.iconSets.get(iconSetName);
        }
        
        try {
            // List files in the icon set directory
            const iconSetPath = `${this.dataPath}/icons/${iconSetName}`;
            const files = await this.invoke('list_directory', { path: iconSetPath });
            
            // Build a map of icon names to full paths
            const iconMap = {};
            const supportedExtensions = ['.svg', '.png', '.jpg', '.jpeg'];
            
            for (const file of files) {
                const ext = file.substring(file.lastIndexOf('.')).toLowerCase();
                if (supportedExtensions.includes(ext)) {
                    const iconName = file.substring(0, file.lastIndexOf('.'));
                    iconMap[iconName] = `icons/${iconSetName}/${file}`;
                }
            }
            
            console.log(`Loaded icon set "${iconSetName}":`, Object.keys(iconMap));
            
            // Cache it
            this.iconSets.set(iconSetName, iconMap);
            return iconMap;
        } catch (error) {
            console.error(`Failed to load icon set "${iconSetName}":`, error);
            return {};
        }
    }

    /**
     * Load all widget definitions for the devices in config
     */
    async loadWidgets(devices) {
        this.widgets = {};
        
        // Get unique widget types from devices
        const widgetTypes = [...new Set(devices?.map(d => d.type) || [])];
        
        for (const type of widgetTypes) {
            try {
                const jsonContent = await this.invoke('read_widget_json', { widgetType: type });
                const widget = JSON.parse(jsonContent);
                
                // Check widget version compatibility
                if (!isVersionCompatible(widget.widgetVersion, MIN_WIDGET_VERSION)) {
                    console.error(`Widget "${type}" version ${widget.widgetVersion} is not compatible with app version ${APP_VERSION} (requires >= ${MIN_WIDGET_VERSION})`);
                    continue;
                }
                
                // Load icon set if specified
                if (widget.iconSet) {
                    widget.iconSetMap = await this.loadIconSet(widget.iconSet);
                }
                
                this.widgets[type] = widget;
                console.log(`Loaded widget definition for ${type} (version ${widget.widgetVersion})`);
            } catch (error) {
                console.error(`Failed to load widget ${type}:`, error);
            }
        }

        return this.widgets;
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
        
        // Render icon
        if (widget.render.icon) {
            const iconName = this.getIconFromRenderDef(state, widget.render.icon);
            if (iconName && widget.iconSetMap) {
                const iconPath = widget.iconSetMap[iconName];
                if (iconPath) {
                    await this.loadDeviceIcon(iconElement, iconPath);
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
     */
    interpolateTemplate(template, state) {
        let result = template;
        for (const [key, value] of Object.entries(state)) {
            result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
        }
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
}
