#!/usr/bin/env node

/**
 * HomeMap WebSocket UI Widget Test Client
 * 
 * Demonstrates interactive UI widgets with buttons, sliders, switches, etc.
 * 
 * Usage:
 *   node test-ui-widget-client.js [homemap-ip] [port]
 * 
 * Example:
 *   node test-ui-widget-client.js 192.168.1.100 8765
 */

const WebSocket = require('ws');

// Configuration
const HOMEMAP_IP = process.argv[2] || '127.0.0.1';
const HOMEMAP_PORT = process.argv[3] || 8765;
const WS_URL = `ws://${HOMEMAP_IP}:${HOMEMAP_PORT}`;

console.log('='.repeat(60));
console.log('HomeMap UI Widget Test Client');
console.log('='.repeat(60));
console.log(`Connecting to: ${WS_URL}`);
console.log('');

let ws = null;
let isConnected = false;

// Widget state
let lightState = {
    power: false,
    brightness: 50
};

let thermostatState = {
    current: 22.5,
    target: 22,
    mode: 'heat'
};

// Widget definitions with UI
const widgets = [
    {
        id: 'dimmer-control',
        name: 'Living Room Dimmer',
        iconSet: 'lightdim',
        label: 'Dimmer (OFF)',
        ui: {
            type: 'dialog',
            title: 'Living Room Dimmer',
            elements: [
                {
                    id: 'power',
                    type: 'switch',
                    label: 'Power',
                    value: false
                },
                {
                    id: 'brightness',
                    type: 'slider',
                    label: 'Brightness',
                    min: 0,
                    max: 100,
                    value: 50,
                    unit: '%'
                },
                {
                    id: 'preset-day',
                    type: 'button',
                    label: 'Day Mode',
                    icon: '☀️'
                },
                {
                    id: 'preset-night',
                    type: 'button',
                    label: 'Night Mode',
                    icon: '🌙'
                }
            ]
        }
    },
    {
        id: 'thermostat',
        name: 'Living Room Thermostat',
        iconSet: 'temperature',
        label: '22°C',
        ui: {
            type: 'dialog',
            title: 'Thermostat Control',
            elements: [
                {
                    id: 'current',
                    type: 'label',
                    label: 'Current Temperature',
                    value: '22.5°C',
                    color: '#4CAF50'
                },
                {
                    id: 'target',
                    type: 'slider',
                    label: 'Target Temperature',
                    min: 16,
                    max: 30,
                    step: 0.5,
                    value: 22,
                    unit: '°C'
                },
                {
                    id: 'mode-heat',
                    type: 'button',
                    label: 'Heat Mode',
                    icon: '🔥',
                    style: 'primary'
                },
                {
                    id: 'mode-cool',
                    type: 'button',
                    label: 'Cool Mode',
                    icon: '❄️'
                }
            ]
        }
    }
];

// Connect to HomeMap
function connect() {
    console.log('📡 Attempting to connect...');
    
    ws = new WebSocket(WS_URL);
    
    ws.on('open', () => {
        isConnected = true;
        console.log('✅ Connected to HomeMap\n');
        registerWidgets();
    });
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            handleMessage(message);
        } catch (error) {
            console.error('❌ Failed to parse message:', error);
        }
    });
    
    ws.on('close', () => {
        isConnected = false;
        console.log('⏹️  Connection closed');
        console.log('🔄 Reconnecting in 3 seconds...\n');
        setTimeout(connect, 3000);
    });
    
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
    });
}

// Register widgets with HomeMap
function registerWidgets() {
    const message = {
        type: 'register-widgets',
        qaId: 'ui-test-client',
        qaName: 'UI Test QuickApp',
        widgets: widgets
    };
    
    send(message);
    console.log('📝 Registered UI widgets:');
    widgets.forEach(w => {
        console.log(`   - ${w.name} (${w.ui.elements.length} UI elements)`);
    });
    console.log('');
}

// Handle messages from HomeMap
function handleMessage(message) {
    switch (message.type) {
        case 'widget-event':
            handleWidgetEvent(message);
            break;
            
        case 'request-widgets':
            console.log('📥 Received request-widgets');
            registerWidgets();
            break;
            
        default:
            console.log('📥 Unknown message type:', message.type);
    }
}

// Handle widget interaction events
function handleWidgetEvent(message) {
    const { widgetId, event, data } = message;
    
    if (event === 'ui-action') {
        const { elementId, action, value } = data;
        console.log(`🎛️  UI Action: ${widgetId} → ${elementId} ${action} = ${value}`);
        
        // Handle dimmer control
        if (widgetId === 'dimmer-control') {
            handleDimmerAction(elementId, action, value);
        }
        
        // Handle thermostat control
        if (widgetId === 'thermostat') {
            handleThermostatAction(elementId, action, value);
        }
    } else {
        console.log(`👆 Widget clicked: ${widgetId}`);
    }
}

// Handle dimmer UI actions
function handleDimmerAction(elementId, action, value) {
    switch (elementId) {
        case 'power':
            lightState.power = value;
            updateDimmerWidget();
            break;
            
        case 'brightness':
            lightState.brightness = value;
            if (lightState.power) {
                updateDimmerWidget();
            }
            break;
            
        case 'preset-day':
            lightState.power = true;
            lightState.brightness = 100;
            updateDimmerWidget();
            break;
            
        case 'preset-night':
            lightState.power = true;
            lightState.brightness = 20;
            updateDimmerWidget();
            break;
    }
}

// Handle thermostat UI actions
function handleThermostatAction(elementId, action, value) {
    switch (elementId) {
        case 'target':
            thermostatState.target = value;
            updateThermostatWidget();
            break;
            
        case 'mode-heat':
            thermostatState.mode = 'heat';
            updateThermostatWidget();
            break;
            
        case 'mode-cool':
            thermostatState.mode = 'cool';
            updateThermostatWidget();
            break;
    }
}

// Update dimmer widget state
function updateDimmerWidget() {
    const message = {
        type: 'widget-update',
        widgetId: 'dimmer-control',
        changes: {
            iconSet: lightState.power ? 'lightdim' : 'lightdim-off',
            label: lightState.power ? `Dimmer (${lightState.brightness}%)` : 'Dimmer (OFF)',
            ui: {
                elements: [
                    {
                        id: 'power',
                        value: lightState.power
                    },
                    {
                        id: 'brightness',
                        value: lightState.brightness
                    }
                ]
            }
        }
    };
    
    send(message);
    console.log(`   💡 Light: ${lightState.power ? 'ON' : 'OFF'} @ ${lightState.brightness}%`);
}

// Update thermostat widget state
function updateThermostatWidget() {
    const message = {
        type: 'widget-update',
        widgetId: 'thermostat',
        changes: {
            label: `${thermostatState.target}°C`,
            ui: {
                elements: [
                    {
                        id: 'current',
                        value: `${thermostatState.current}°C`
                    },
                    {
                        id: 'target',
                        value: thermostatState.target
                    },
                    {
                        id: 'mode-heat',
                        style: thermostatState.mode === 'heat' ? 'primary' : 'secondary'
                    },
                    {
                        id: 'mode-cool',
                        style: thermostatState.mode === 'cool' ? 'primary' : 'secondary'
                    }
                ]
            }
        }
    };
    
    send(message);
    console.log(`   🌡️  Target: ${thermostatState.target}°C (${thermostatState.mode} mode)`);
}

// Send message to HomeMap
function send(message) {
    if (isConnected && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

// Simulate temperature changes
setInterval(() => {
    if (!isConnected) return;
    
    // Randomly adjust current temperature
    const delta = (Math.random() - 0.5) * 0.5;
    thermostatState.current = Math.round((thermostatState.current + delta) * 10) / 10;
    
    // Update display
    const message = {
        type: 'widget-update',
        widgetId: 'thermostat',
        changes: {
            ui: {
                elements: [
                    {
                        id: 'current',
                        value: `${thermostatState.current}°C`,
                        color: thermostatState.current > thermostatState.target ? '#e74c3c' : '#4CAF50'
                    }
                ]
            }
        }
    };
    send(message);
}, 5000);

// Start connection
connect();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down...');
    
    if (isConnected) {
        send({
            type: 'unregister-widgets',
            qaId: 'ui-test-client'
        });
        ws.close();
    }
    
    process.exit(0);
});
