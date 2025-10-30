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
        const { config, http } = this.homeMap;
        
        while (this.isPolling) {
            try {
                const url = `${config.protocol}://${config.host}/api/refreshStates?last=${this.lastEventId}&timeout=30`;
                
                const response = await http.fetch(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Basic ${btoa(`${config.user}:${config.password}`)}`
                    },
                    timeout: 35000
                });

                if (!response.ok) {
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
        
        // Check if event matches the property we care about
        if (event.type === 'DevicePropertyUpdatedEvent') {
            const eventProperty = event.data?.property;
            console.log(`Event is for property: ${eventProperty}, device state properties:`, Object.keys(device.state || {}));
            
            if (eventProperty && device.state && !(eventProperty in device.state)) {
                console.log(`Ignoring event for property ${eventProperty}, not tracked in device state`);
                return;
            }
        }
        
        // Update state from event
        if (eventDef.updates) {
            if (!device.state) {
                device.state = { ...widget.state };
            }
            
            for (const [stateProp, eventPath] of Object.entries(eventDef.updates)) {
                console.log(`Processing event update: ${stateProp} <- ${eventPath}`);
                
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
