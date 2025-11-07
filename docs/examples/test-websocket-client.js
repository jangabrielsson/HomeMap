#!/usr/bin/env node

/**
 * HomeMap WebSocket Test Client
 * 
 * Tests the WebSocket protocol by simulating a QuickApp
 * 
 * Usage:
 *   node test-websocket-client.js [homemap-ip] [port]
 * 
 * Example:
 *   node test-websocket-client.js 192.168.1.100 8765
 */

const WebSocket = require('ws');

// Configuration
const HOMEMAP_IP = process.argv[2] || '192.168.1.100';
const HOMEMAP_PORT = process.argv[3] || 8765;
const WS_URL = `ws://${HOMEMAP_IP}:${HOMEMAP_PORT}`;

console.log('='.repeat(60));
console.log('HomeMap WebSocket Test Client');
console.log('='.repeat(60));
console.log(`Connecting to: ${WS_URL}`);
console.log('');

let ws = null;
let isConnected = false;
let buttonState = false;

// Widget definitions
// IMPORTANT: Widget IDs must be stable across reconnections!
// If you change or remove widget IDs, HomeMap will automatically
// clean up those widget instances from floor plans.
const widgets = [
    {
        id: 'test-button',  // Stable ID - don't change!
        name: 'Test Button',
        iconSet: 'binarySwitch',
        label: 'Click Me'
    },
    {
        id: 'test-light',   // Stable ID - don't change!
        name: 'Test Light',
        iconSet: 'dimLight',
        label: 'Light'
    }
];

function connect() {
    console.log('📡 Connecting...');
    
    ws = new WebSocket(WS_URL);
    
    ws.on('open', () => {
        isConnected = true;
        console.log('✅ Connected to HomeMap\n');
        
        // Register widgets
        registerWidgets();
        
        // Start heartbeat
        startHeartbeat();
    });
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            handleMessage(message);
        } catch (error) {
            console.error('❌ Failed to parse message:', error);
        }
    });
    
    ws.on('close', () => {
        isConnected = false;
        console.log('\n❌ Disconnected from HomeMap');
        console.log('🔄 Reconnecting in 5 seconds...\n');
        
        setTimeout(connect, 5000);
    });
    
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
    });
}

function registerWidgets() {
    const message = {
        type: 'register-widgets',
        qaId: 'test-client',
        qaName: 'WebSocket Test Client',
        widgets: widgets
    };
    
    sendMessage(message);
    console.log('📝 Registered widgets:');
    widgets.forEach(w => {
        console.log(`   - ${w.name} (${w.id})`);
    });
    console.log('');
    console.log('💡 Now go to HomeMap, enter Edit Mode, and add these widgets to your floor plan!');
    console.log('💡 Then exit Edit Mode and click the widgets to test.\n');
}

function handleMessage(message) {
    console.log('📨 Received:', message.type);
    
    if (message.type === 'widget-event') {
        handleWidgetEvent(message);
    }
    else if (message.type === 'request-widgets') {
        console.log('📤 HomeMap requested widget registration - re-sending...\n');
        registerWidgets();
    }
}

function handleWidgetEvent(event) {
    const { widgetId, event: eventType, data } = event;
    
    console.log(`🖱️  Widget clicked: ${widgetId}`);
    console.log(`   Floor: ${data.floor}`);
    console.log(`   Position: (${data.x}, ${data.y})`);
    
    // Show parameters if present
    if (data.parameters && Object.keys(data.parameters).length > 0) {
        console.log(`   📋 Parameters:`, data.parameters);
        Object.entries(data.parameters).forEach(([key, value]) => {
            console.log(`      ${key} = ${value}`);
        });
    }
    console.log('');
    
    // Handle different widgets
    if (widgetId === 'test-button') {
        buttonState = !buttonState;
        
        const changes = {
            label: buttonState ? 'ON' : 'OFF',
            color: buttonState ? '#4CAF50' : '#F44336'
        };
        
        updateWidget(widgetId, changes);
        console.log(`   ✨ Button is now: ${buttonState ? 'ON' : 'OFF'}\n`);
    }
    else if (widgetId === 'test-light') {
        const brightness = Math.floor(Math.random() * 100);
        
        const changes = {
            label: `${brightness}%`,
            color: brightness > 50 ? '#FFD700' : '#808080'
        };
        
        updateWidget(widgetId, changes);
        console.log(`   ✨ Light brightness: ${brightness}%\n`);
    }
}

function updateWidget(widgetId, changes) {
    const message = {
        type: 'widget-update',
        widgetId: widgetId,
        changes: changes
    };
    
    sendMessage(message);
    console.log('   📤 Sent update');
}

function sendMessage(data) {
    if (!isConnected || !ws) {
        console.warn('⚠️  Not connected, cannot send message');
        return false;
    }
    
    try {
        ws.send(JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('❌ Failed to send message:', error);
        return false;
    }
}

function startHeartbeat() {
    setInterval(() => {
        if (isConnected) {
            sendMessage({ type: 'heartbeat' });
        }
    }, 30000);
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down...');
    
    if (isConnected && ws) {
        // Unregister widgets
        sendMessage({
            type: 'unregister-widgets',
            qaId: 'test-client'
        });
        
        ws.close();
    }
    
    process.exit(0);
});

// Start
connect();

// Interactive test commands
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: ''
});

console.log('Commands:');
console.log('  toggle - Toggle test button');
console.log('  light  - Randomize light');
console.log('  status - Show connection status');
console.log('  help   - Show this help');
console.log('  quit   - Exit');
console.log('');

rl.on('line', (line) => {
    const cmd = line.trim().toLowerCase();
    
    switch (cmd) {
        case 'toggle':
            buttonState = !buttonState;
            updateWidget('test-button', {
                label: buttonState ? 'ON' : 'OFF',
                color: buttonState ? '#4CAF50' : '#F44336'
            });
            console.log(`Button toggled to: ${buttonState ? 'ON' : 'OFF'}\n`);
            break;
            
        case 'light':
            const brightness = Math.floor(Math.random() * 100);
            updateWidget('test-light', {
                label: `${brightness}%`,
                color: brightness > 50 ? '#FFD700' : '#808080'
            });
            console.log(`Light set to: ${brightness}%\n`);
            break;
            
        case 'status':
            console.log(`Connection: ${isConnected ? '✅ Connected' : '❌ Disconnected'}`);
            console.log(`Widgets: ${widgets.length}`);
            console.log('');
            break;
            
        case 'help':
            console.log('Commands:');
            console.log('  toggle - Toggle test button');
            console.log('  light  - Randomize light');
            console.log('  status - Show connection status');
            console.log('  help   - Show this help');
            console.log('  quit   - Exit');
            console.log('');
            break;
            
        case 'quit':
        case 'exit':
            process.emit('SIGINT');
            break;
            
        default:
            if (cmd) {
                console.log(`Unknown command: ${cmd}`);
                console.log('Type "help" for available commands\n');
            }
    }
});
