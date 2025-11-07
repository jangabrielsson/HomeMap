-- HomeMap Remote Widget Example QuickApp
-- This QuickApp demonstrates how to create interactive widgets in HomeMap

--[[
SETUP INSTRUCTIONS:
1. Create new QuickApp in HC3
2. Paste this code
3. Update HOMEMAP_IP with your HomeMap device's IP address
4. Save and start the QuickApp
5. In HomeMap, enter Edit Mode
6. Look for "Example Remote Widgets" in the widget palette
7. Drag widgets onto your floor plan
8. Exit Edit Mode and click widgets to test

FEATURES:
- Auto-reconnect on disconnect
- Multiple widget types
- State management
- Click event handling
--]]

-- Configuration
local HOMEMAP_IP = "192.168.1.100"  -- <<< CHANGE THIS to your HomeMap IP
local HOMEMAP_PORT = 8765
local RECONNECT_DELAY = 5000  -- milliseconds

function QuickApp:onInit()
    self:debug("HomeMap Remote Widget QuickApp starting...")
    
    -- State
    self.ws = nil
    self.isConnected = false
    
    -- Widget definitions
    -- IMPORTANT: Widget IDs must be stable across reconnections!
    -- If you change or remove widget IDs, HomeMap will automatically
    -- clean up those widget instances from floor plans.
    self.widgets = {
        {
            id = "scene-toggle",      -- Stable ID - don't change!
            name = "Scene Toggle",
            iconSet = "dimLight",
            label = "Living Room",
            state = false
        },
        {
            id = "alarm-control",     -- Stable ID - don't change!
            name = "Alarm Control",
            iconSet = "alarm-off",
            label = "Disarmed",
            state = "disarmed"
        },
        {
            id = "mode-switch",       -- Stable ID - don't change!
            name = "Mode Switch",
            iconSet = "binarySwitch",
            label = "Home Mode",
            state = "home"
        }
    }
    
    -- Connect to HomeMap
    self:connectToHomeMap()
end

function QuickApp:connectToHomeMap()
    self:debug("Connecting to HomeMap at ws://" .. HOMEMAP_IP .. ":" .. HOMEMAP_PORT)
    
    self.ws = net.WebSocketClient()
    self.ws:connect("ws://" .. HOMEMAP_IP .. ":" .. HOMEMAP_PORT, {
        onConnected = function()
            self:onConnected()
        end,
        
        onMessage = function(msg)
            self:onMessage(msg)
        end,
        
        onDisconnected = function()
            self:onDisconnected()
        end,
        
        onError = function(err)
            self:onError(err)
        end
    })
end

function QuickApp:onConnected()
    self.isConnected = true
    self:debug("✅ Connected to HomeMap")
    self:updateProperty("log", "Connected to HomeMap")
    
    -- Register our widgets
    self:registerWidgets()
    
    -- Start heartbeat
    self:startHeartbeat()
end

function QuickApp:registerWidgets()
    local message = {
        type = "register-widgets",
        qaId = "qa-" .. self.id,
        qaName = "Example Remote Widgets",
        widgets = self.widgets
    }
    
    self:sendMessage(message)
    self:debug("📝 Registered " .. #self.widgets .. " widgets with HomeMap")
end

function QuickApp:onMessage(msg)
    local ok, data = pcall(function() return json.decode(msg) end)
    if not ok then
        self:error("Failed to parse message:", msg)
        return
    end
    
    self:debug("📨 Received:", data.type)
    
    if data.type == "widget-event" then
        self:handleWidgetEvent(data)
    elseif data.type == "request-widgets" then
        self:debug("📤 HomeMap requested widget registration - re-sending...")
        self:registerWidgets()
    end
end

function QuickApp:handleWidgetEvent(event)
    local widgetId = event.widgetId
    local eventType = event.event
    local data = event.data
    
    self:debug("🖱️ Widget clicked:", widgetId)
    
    -- Show parameters if present
    if data.parameters and next(data.parameters) ~= nil then
        self:debug("📋 Parameters:")
        for key, value in pairs(data.parameters) do
            self:debug("   " .. key .. " = " .. value)
        end
    end
    
    -- Find widget
    local widget = nil
    for _, w in ipairs(self.widgets) do
        if w.id == widgetId then
            widget = w
            break
        end
    end
    
    if not widget then
        self:error("Unknown widget:", widgetId)
        return
    end
    
    -- Handle different widget types
    if widgetId == "scene-toggle" then
        self:handleSceneToggle(widget, data.parameters)
    elseif widgetId == "alarm-control" then
        self:handleAlarmControl(widget, data.parameters)
    elseif widgetId == "mode-switch" then
        self:handleModeSwitch(widget, data.parameters)
    end
end

function QuickApp:handleSceneToggle(widget, parameters)
    -- Toggle state
    widget.state = not widget.state
    
    -- Update visual
    local changes = {
        iconSet = widget.state and "dimLight" or "dimLight",  -- You can use different icons
        label = widget.state and "Living Room (ON)" or "Living Room (OFF)",
        color = widget.state and "#FFD700" or "#FFFFFF"
    }
    
    self:updateWidget(widget.id, changes)
    
    -- Do your automation here
    self:debug("Scene is now:", widget.state and "ON" or "OFF")
    
    -- Example: Use parameters for profile name or scene ID
    if parameters and parameters.profileName then
        self:debug("Activating profile:", parameters.profileName)
        -- Your logic to activate the profile
    elseif parameters and parameters.sceneId then
        local sceneId = tonumber(parameters.sceneId)
        self:debug("Executing scene:", sceneId)
        fibaro.scene.execute(sceneId)
    elseif widget.state then
        -- Default behavior
        -- fibaro.scene.execute(123)  -- Replace with your scene ID
    end
end

function QuickApp:handleAlarmControl(widget)
    -- Cycle through states: disarmed -> armed_home -> armed_away -> disarmed
    local states = {"disarmed", "armed_home", "armed_away"}
    local currentIndex = 1
    
    for i, state in ipairs(states) do
        if state == widget.state then
            currentIndex = i
            break
        end
    end
    
    -- Next state
    local nextIndex = (currentIndex % #states) + 1
    widget.state = states[nextIndex]
    
    -- Update visual
    local labels = {
        disarmed = "Disarmed",
        armed_home = "Armed (Home)",
        armed_away = "Armed (Away)"
    }
    
    local icons = {
        disarmed = "alarm-off",
        armed_home = "alarm-on",  -- If you have these icons
        armed_away = "alarm-on"
    }
    
    local colors = {
        disarmed = "#4CAF50",  -- Green
        armed_home = "#FFA500",  -- Orange
        armed_away = "#F44336"   -- Red
    }
    
    local changes = {
        iconSet = icons[widget.state] or "alarm-off",
        label = labels[widget.state],
        color = colors[widget.state]
    }
    
    self:updateWidget(widget.id, changes)
    
    self:debug("Alarm state:", widget.state)
    
    -- Do your alarm control here
end

function QuickApp:handleModeSwitch(widget)
    -- Toggle between home/away/night modes
    local modes = {"home", "away", "night"}
    local currentIndex = 1
    
    for i, mode in ipairs(modes) do
        if mode == widget.state then
            currentIndex = i
            break
        end
    end
    
    local nextIndex = (currentIndex % #modes) + 1
    widget.state = modes[nextIndex]
    
    -- Update visual
    local labels = {
        home = "Home Mode",
        away = "Away Mode",
        night = "Night Mode"
    }
    
    local changes = {
        label = labels[widget.state],
        color = widget.state == "night" and "#9C27B0" or "#FFFFFF"  -- Purple for night
    }
    
    self:updateWidget(widget.id, changes)
    
    self:debug("Mode:", widget.state)
    
    -- Do your mode switch automation here
end

function QuickApp:updateWidget(widgetId, changes)
    local message = {
        type = "widget-update",
        widgetId = widgetId,
        changes = changes
    }
    
    self:sendMessage(message)
end

function QuickApp:sendMessage(data)
    if not self.isConnected or not self.ws then
        self:warning("Not connected, cannot send message")
        return false
    end
    
    local ok, jsonStr = pcall(function() return json.encode(data) end)
    if not ok then
        self:error("Failed to encode message:", data)
        return false
    end
    
    self.ws:sendMessage(jsonStr)
    return true
end

function QuickApp:startHeartbeat()
    if self.heartbeatTimer then
        clearInterval(self.heartbeatTimer)
    end
    
    self.heartbeatTimer = setInterval(function()
        if self.isConnected then
            self:sendMessage({ type = "heartbeat" })
        end
    end, 30000)  -- Every 30 seconds
end

function QuickApp:onDisconnected()
    self.isConnected = false
    self:warning("❌ Disconnected from HomeMap")
    self:updateProperty("log", "Disconnected - will reconnect in " .. (RECONNECT_DELAY/1000) .. "s")
    
    -- Stop heartbeat
    if self.heartbeatTimer then
        clearInterval(self.heartbeatTimer)
        self.heartbeatTimer = nil
    end
    
    -- Reconnect after delay
    setTimeout(function()
        if not self.isConnected then
            self:connectToHomeMap()
        end
    end, RECONNECT_DELAY)
end

function QuickApp:onError(err)
    self:error("WebSocket error:", err)
end

-- Cleanup on QuickApp deletion
function QuickApp:onDelete()
    if self.ws and self.isConnected then
        -- Unregister widgets
        self:sendMessage({
            type = "unregister-widgets",
            qaId = "qa-" .. self.id
        })
        
        -- Close connection
        self.ws:close()
    end
    
    if self.heartbeatTimer then
        clearInterval(self.heartbeatTimer)
    end
end

-- Manual reconnect button (optional)
function QuickApp:button1()
    self:debug("Manual reconnect triggered")
    if self.ws then
        self.ws:close()
    end
    self:connectToHomeMap()
end

-- Quick UI button definitions (optional)
--[[
{
  "type": "button",
  "name": "Reconnect",
  "action": "button1"
}
--]]
