// HC3 API communication manager

export class HC3ApiManager {
    constructor(homeMap) {
        this.homeMap = homeMap;
    }

    /**
     * Test connection to HC3
     */
    async testConnection() {
        try {
            const config = this.homeMap.config;
            const url = `${config.protocol}://${config.host}/api/settings/info`;
            console.log('Testing connection to:', url);
            
            const response = await this.homeMap.http.fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${btoa(`${config.user}:${config.password}`)}`
                }
            });

            console.log('Response:', response);

            if (response.ok) {
                const text = await response.text();
                const data = JSON.parse(text);
                console.log('HC3 data:', data);
                this.updateStatus('connected', `Connected to HC3 v${data.softVersion || 'unknown'}`);
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Connection test failed:', error);
            this.updateStatus('error', `Connection Failed: ${error.message}`);
        }
    }

    /**
     * Update connection status display
     */
    updateStatus(state, message) {
        this.homeMap.statusEl.textContent = message;
        this.homeMap.statusDot.className = 'status-dot';
        if (state === 'connected') {
            this.homeMap.statusDot.classList.add('connected');
        } else if (state === 'error') {
            this.homeMap.statusDot.classList.add('error');
        }
    }

    /**
     * Execute an action on a device
     */
    async executeAction(device, action, value = null) {
        const config = this.homeMap.config;
        
        // Build API URL by replacing ${id} with device.id
        const apiUrl = action.api.replace('${id}', device.id);
        const fullUrl = `${config.protocol}://${config.host}${apiUrl}`;
        
        console.log(`Executing action: ${action.method} ${fullUrl}`);
        
        // Prepare request body if action has a body defined
        let requestBody = null;
        if (action.body) {
            // Deep clone the body
            const bodyStr = JSON.stringify(action.body);
            
            if (value !== null) {
                let replacedStr = bodyStr;
                
                // If value is an object (like RGB color), replace each property
                if (typeof value === 'object' && !Array.isArray(value)) {
                    console.log('Replacing template variables with object:', value);
                    for (const [key, val] of Object.entries(value)) {
                        // Replace "${key}" with actual value (no quotes for numbers)
                        const regex = new RegExp(`"?\\$\\{${key}\\}"?`, 'g');
                        replacedStr = replacedStr.replace(regex, val !== undefined ? val : 0);
                    }
                } else {
                    // Single value replacement (backward compatibility)
                    replacedStr = bodyStr.replace(/"?\$\{value\}"?/g, value);
                }
                
                console.log('Body after replacement:', replacedStr);
                requestBody = JSON.parse(replacedStr);
            } else {
                requestBody = JSON.parse(bodyStr);
            }
            console.log('Request body object:', requestBody);
        }
        
        // Make the API call using Tauri HTTP plugin
        const fetchOptions = {
            method: action.method || 'GET',
            headers: {
                'Authorization': 'Basic ' + btoa(`${config.user}:${config.password}`),
                'X-Fibaro-Version': '2',
                'Accept-Language': 'en'
            }
        };
        
        if (requestBody) {
            const bodyJson = JSON.stringify(requestBody);
            console.log('Sending body:', bodyJson);
            fetchOptions.headers['Content-Type'] = 'application/json';
            fetchOptions.body = bodyJson;
        }
        
        const response = await this.homeMap.http.fetch(fullUrl, fetchOptions);
        
        console.log(`Action response - Status: ${response.status}, OK: ${response.ok}`);
        console.log('Response headers:', response.headers);
        console.log('Response data:', response.data);
        
        if (!response.ok) {
            // Try to get error details
            let errorDetail = response.statusText || 'Bad Request';
            
            // Try to read response text if available
            try {
                const responseText = await response.text();
                console.error('Response text:', responseText);
                if (responseText) {
                    errorDetail += ` - ${responseText}`;
                }
            } catch (e) {
                console.warn('Could not read response text');
            }
            
            if (response.data) {
                errorDetail += ` - Data: ${JSON.stringify(response.data)}`;
            }
            
            console.error('Full error response:', response);
            throw new Error(`HTTP ${response.status}: ${errorDetail}`);
        }
        
        console.log(`Action executed successfully for device ${device.id}`);
    }

    /**
     * Save configuration to backend
     */
    async saveConfig() {
        try {
            const configJson = JSON.stringify(this.homeMap.homemapConfig, null, 4);
            await this.homeMap.invoke('save_config', { configJson });
            console.log('Config saved successfully');
        } catch (error) {
            console.error('Failed to save config:', error);
            alert(`Failed to save config: ${error}`);
        }
    }

    /**
     * Update device icon by fetching current state from HC3
     */
    async updateDeviceIcon(device, iconElement, textElement) {
        const widget = this.homeMap.widgetManager.getWidget(device.type);
        if (!widget) {
            console.warn(`No widget definition for device ${device.id} (type: ${device.type})`);
            return;
        }
        
        // Initialize device state if not exists
        if (!device.state) {
            device.state = { ...widget.state };
        }
        
        // Fetch current device status from HC3 using getters
        if (widget.getters) {
            try {
                const config = this.homeMap.config;
                
                for (const [stateProp, getter] of Object.entries(widget.getters)) {
                    if (getter.api) {
                        const api = getter.api.replace('${id}', device.id);
                        const url = `${config.protocol}://${config.host}${api}`;
                        
                        const response = await this.homeMap.http.fetch(url, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Basic ${btoa(`${config.user}:${config.password}`)}`
                            }
                        });

                        if (response.ok) {
                            const text = await response.text();
                            const data = JSON.parse(text);
                            
                            // Debug: Log the raw data to see structure
                            console.log(`Raw API data for device ${device.id}, getter path '${getter.path}':`, JSON.stringify(data).substring(0, 500));
                            
                            // Extract value using path
                            let value = this.homeMap.getPropertyValue(data, getter.path);
                            console.log(`Extracted value before unwrapping for ${stateProp}:`, value, `(type: ${typeof value})`);
                            
                            // HC3 sometimes returns objects like {value: X, path: "...", source: "HC"}
                            // If we got an object with a 'value' property, unwrap it
                            if (value && typeof value === 'object' && !Array.isArray(value)) {
                                console.log(`Object structure:`, Object.keys(value), value);
                                if ('value' in value) {
                                    console.log(`Unwrapping HC3 value object for ${stateProp} - has 'value' key`);
                                    value = value.value;
                                } else {
                                    console.log(`Object does NOT have 'value' key, keys are:`, Object.keys(value));
                                }
                            }
                            
                            // Parse color string if needed (HC3 format: "R,G,B,WW,CW")
                            // colorComponents is already an object, but color property is a string
                            if (stateProp === 'colorComponents' && typeof value === 'string') {
                                const parts = value.split(',').map(n => parseInt(n.trim()));
                                value = {
                                    red: parts[0] || 0,
                                    green: parts[1] || 0,
                                    blue: parts[2] || 0,
                                    warmWhite: parts[3] || 0,
                                    coldWhite: parts[4] || 0
                                };
                                console.log(`Parsed color string to colorComponents object:`, value);
                            }
                            
                            device.state[stateProp] = value;
                            console.log(`Set device ${device.id} state.${stateProp} =`, value, `(type: ${typeof value})`);
                        } else {
                            console.error(`Failed to fetch status for device ${device.id}: HTTP ${response.status}`);
                        }
                    }
                }
                
                // Render with updated state
                await this.homeMap.widgetManager.renderDevice(device, widget, iconElement, textElement);
            } catch (error) {
                console.error(`Error fetching status for device ${device.id}:`, error);
            }
        }
    }
}
