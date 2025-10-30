// Event polling and dispatch system for HC3 events

import { getPropertyValue } from './utils.js';

export class EventManager {
    constructor(homeMap) {
        this.homeMap = homeMap;
        this.lastEventId = 0;
        this.isPolling = false;
        this.eventDispatch = {}; // Event dispatch table: eventType -> { idMap: Map(deviceId -> {device, widget, eventDef}) }
    }

    /**
     * Build event dispatch table for efficient event routing
     */
    buildEventDispatch(devices, widgets) {
        this.eventDispatch = {};
        
        devices.forEach(device => {
            const widget = widgets[device.type];
            if (!widget || !widget.events) return;
            
            Object.entries(widget.events).forEach(([eventType, eventDef]) => {
                if (!this.eventDispatch[eventType]) {
                    this.eventDispatch[eventType] = {
                        idMap: new Map()
                    };
                }
                
                this.eventDispatch[eventType].idMap.set(device.id, {
                    device,
                    widget,
                    eventDef
                });
            });
        });
        
        console.log('Event dispatch table built:', Object.keys(this.eventDispatch));
    }

    startEventPolling() {
        if (this.isPolling) {
            console.log('Event polling already running');
            return;
        }
        this.isPolling = true;
        console.log('Starting event polling...');
        this.pollEvents();
    }

    stopEventPolling() {
        this.isPolling = false;
        console.log('Stopped event polling');
    }

    async pollEvents() {
        const { config } = this.homeMap;
        
        while (this.isPolling) {
            try {
                // Check if auth is locked before attempting API call
                if (this.homeMap.hc3ApiManager.isAuthLocked()) {
                    console.log('Auth locked, stopping event polling');
                    this.stopEventPolling();
                    break;
                }

                const url = `${config.protocol}://${config.host}/api/refreshStates?last=${this.lastEventId}&timeout=30`;
                
                const response = await this.homeMap.hc3ApiManager.fetch(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Basic ${btoa(`${config.user}:${config.password}`)}`
                    },
                    timeout: 35000
                });

                if (!response.ok) {
                    // Check for authentication failures
                    if (response.status === 401 || response.status === 403) {
                        console.error('Event polling auth failure:', response.status);
                        await this.homeMap.hc3ApiManager.handleAuthFailure(response.status);
                        this.stopEventPolling();
                        break;
                    }

                    console.error('Event polling failed:', response.status);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    continue;
                }

                const text = await response.text();
                const data = JSON.parse(text);
                
                if (data.last) {
                    this.lastEventId = data.last;
                }

                if (data.events && Array.isArray(data.events)) {
                    await this.processEvents(data.events);
                    
                    if (data.events.length > 0) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            } catch (error) {
                if (!this.isPolling) {
                    console.log('Polling stopped, exiting poll loop');
                    break;
                }
                
                const errorMsg = error.message || error.toString();
                
                if (errorMsg.includes('resource id') || errorMsg.includes('invalid')) {
                    console.warn('HTTP resource error (likely due to reload), continuing...', errorMsg);
                } else {
                    console.error('Event polling error:', errorMsg);
                }
                
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    async processEvents(events) {
        console.log(`Processing ${events.length} events`);
        
        for (const event of events) {
            console.log(`Event type: ${event.type}`, event);
            await this.dispatchEvent(event);
        }
    }

    async dispatchEvent(event) {
        const dispatch = this.eventDispatch[event.type];
        if (!dispatch) return;
        
        const deviceId = event.data?.id;
        if (!deviceId) {
            console.warn(`Could not extract device id from event`);
            return;
        }
        
        const dispatchInfo = dispatch.idMap.get(deviceId);
        if (!dispatchInfo) return;
        
        const { device, widget, eventDef } = dispatchInfo;
        
        console.log(`Dispatching ${event.type} for device ${deviceId}`);
        console.log(`Event data:`, JSON.stringify(event.data).substring(0, 500));
        
        // Extract property name for property-based events (needed for conditional updates)
        let eventProperty = null;
        if (event.type === 'DevicePropertyUpdatedEvent') {
            eventProperty = event.data?.property;
            console.log(`Event is for property: ${eventProperty}, device state properties:`, Object.keys(device.state || {}));
            
            // Check if this property is handled by the widget
            // Property can either be in state OR mentioned in conditional updates
            if (eventProperty && device.state) {
                const isInState = eventProperty in device.state;
                const isInUpdates = eventDef.updates && Object.values(eventDef.updates).some(updatePath => {
                    // Check if the property is mentioned in any conditional update
                    return updatePath.includes(eventProperty);
                });
                
                if (!isInState && !isInUpdates) {
                    console.log(`Ignoring event for property ${eventProperty}, not tracked in device state or updates`);
                    return;
                }
                
                console.log(`Property ${eventProperty} is handled (inState: ${isInState}, inUpdates: ${isInUpdates})`);
            }
        }
        
        // Update state from event
        if (eventDef.updates) {
            if (!device.state) {
                device.state = { ...widget.state };
            }
            
            for (const [stateProp, eventPathTemplate] of Object.entries(eventDef.updates)) {
                console.log(`Processing event update: ${stateProp} <- ${eventPathTemplate}`);
                
                // If eventPath includes a condition, check it
                // Supports: "prop == event.property ? value" or "(prop1 == event.property || prop2 == event.property) ? value"
                let eventPath = eventPathTemplate;
                if (eventPath.includes('==')) {
                    // Try simple condition first: "prop == event.property ? value"
                    let condMatch = eventPath.match(/^(\w+)\s*==\s*event\.property\s*\?\s*(.+)$/);
                    
                    if (condMatch) {
                        const [, requiredProp, valuePath] = condMatch;
                        if (eventProperty !== requiredProp) {
                            console.log(`Skipping update for ${stateProp}: property is ${eventProperty}, not ${requiredProp}`);
                            continue;
                        }
                        eventPath = valuePath;
                        console.log(`Conditional match for ${stateProp}, using value path: ${valuePath}`);
                    } else {
                        // Try OR condition: "(prop1 == event.property || prop2 == event.property) ? value"
                        condMatch = eventPath.match(/^\((.+?)\)\s*\?\s*(.+)$/);
                        if (condMatch) {
                            const [, condition, valuePath] = condMatch;
                            console.log(`Evaluating OR condition: ${condition}`);
                            
                            // Extract all property names from the condition
                            const propMatches = condition.matchAll(/(\w+)\s*==\s*event\.property/g);
                            let matched = false;
                            
                            for (const match of propMatches) {
                                const propName = match[1];
                                console.log(`Checking if ${eventProperty} matches ${propName}`);
                                if (eventProperty === propName) {
                                    matched = true;
                                    break;
                                }
                            }
                            
                            if (!matched) {
                                console.log(`Skipping update for ${stateProp}: property ${eventProperty} doesn't match any in OR condition`);
                                continue;
                            }
                            
                            eventPath = valuePath;
                            console.log(`OR condition matched for ${stateProp}, using value path: ${valuePath}`);
                        }
                    }
                }
                
                let value = eventPath.startsWith('event.') 
                    ? event.data[eventPath.substring(6)]
                    : getPropertyValue(event, eventPath);
                
                console.log(`Extracted value from event for ${stateProp}:`, value, `(type: ${typeof value})`);
                
                // HC3 sometimes returns objects like {value: X, path: "...", source: "HC"}
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    console.log(`Object has keys:`, Object.keys(value));
                    if ('value' in value) {
                        console.log(`Unwrapping HC3 value object from event for ${stateProp}`);
                        value = value.value;
                    }
                }
                
                // Parse color string when updating colorComponents
                // The "color" event sends a string "R,G,B,WW,CW", but we want to store it as colorComponents object
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
                console.log(`Updated device ${deviceId} state.${stateProp} =`, value, `(type: ${typeof value})`);
            }
        }
        
        // Get the icon and text elements
        const deviceInfo = this.homeMap.deviceIcons.get(deviceId);
        if (!deviceInfo) return;
        
        const iconElement = deviceInfo.element;
        const textElement = deviceInfo.textElement;
        
        // Re-render with updated state
        await this.homeMap.renderDevice(device, widget, iconElement, textElement);
    }
}
