// WebSocket server for remote QuickApp widget integration
// Allows HC3 QuickApps to register widgets and receive user interactions

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{Mutex, RwLock};
use tokio_tungstenite::{accept_async, tungstenite::Message};
use futures_util::{StreamExt, SinkExt};
use serde_json::Value;
use tauri::{AppHandle, Emitter};

type ClientId = String;
type WebSocketSender = futures_util::stream::SplitSink<
    tokio_tungstenite::WebSocketStream<TcpStream>,
    Message
>;

pub struct WebSocketServer {
    clients: Arc<RwLock<HashMap<ClientId, Arc<Mutex<WebSocketSender>>>>>,
    app_handle: AppHandle,
    is_running: Arc<Mutex<bool>>,
}

impl WebSocketServer {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            clients: Arc::new(RwLock::new(HashMap::new())),
            app_handle,
            is_running: Arc::new(Mutex::new(false)),
        }
    }

    pub async fn start(&self, port: u16, bind_address: String) -> Result<(), String> {
        let mut is_running = self.is_running.lock().await;
        if *is_running {
            return Err("WebSocket server is already running".to_string());
        }
        *is_running = true;
        drop(is_running);

        let addr = format!("{}:{}", bind_address, port);
        let listener = TcpListener::bind(&addr)
            .await
            .map_err(|e| format!("Failed to bind to {}: {}", addr, e))?;

        println!("🔌 WebSocket server listening on {}", addr);

        let clients = self.clients.clone();
        let app_handle = self.app_handle.clone();
        let is_running = self.is_running.clone();

        tokio::spawn(async move {
            while *is_running.lock().await {
                match listener.accept().await {
                    Ok((stream, peer_addr)) => {
                        println!("📥 New connection from: {}", peer_addr);
                        let clients_clone = clients.clone();
                        let app_clone = app_handle.clone();
                        
                        tokio::spawn(async move {
                            if let Err(e) = Self::handle_connection(
                                stream,
                                peer_addr,
                                clients_clone,
                                app_clone,
                            ).await {
                                eprintln!("Connection error: {}", e);
                            }
                        });
                    }
                    Err(e) => {
                        eprintln!("Accept error: {}", e);
                        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                    }
                }
            }
            println!("🔌 WebSocket server stopped");
        });

        // Emit event to frontend
        let _ = self.app_handle.emit("ws-server-started", serde_json::json!({
            "address": addr
        }));

        Ok(())
    }

    pub async fn stop(&self) -> Result<(), String> {
        let mut is_running = self.is_running.lock().await;
        if !*is_running {
            return Err("WebSocket server is not running".to_string());
        }
        *is_running = false;

        // Close all client connections
        let mut clients = self.clients.write().await;
        for (client_id, sender) in clients.drain() {
            println!("📤 Closing connection: {}", client_id);
            let mut sender = sender.lock().await;
            let _ = sender.close().await;
        }

        // Emit event to frontend
        let _ = self.app_handle.emit("ws-server-stopped", serde_json::json!({}));

        Ok(())
    }

    async fn handle_connection(
        stream: TcpStream,
        peer_addr: SocketAddr,
        clients: Arc<RwLock<HashMap<ClientId, Arc<Mutex<WebSocketSender>>>>>,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let ws_stream = accept_async(stream)
            .await
            .map_err(|e| format!("WebSocket handshake failed: {}", e))?;

        let (sender, mut receiver) = ws_stream.split();
        let sender = Arc::new(Mutex::new(sender));
        
        let client_id = format!("client_{}", peer_addr);
        
        // Register client
        {
            let mut clients_map = clients.write().await;
            clients_map.insert(client_id.clone(), sender.clone());
        }

        println!("✅ Client connected: {}", client_id);

        // Emit connection event to frontend
        let _ = app_handle.emit("ws-client-connected", serde_json::json!({
            "clientId": client_id,
            "address": peer_addr.to_string()
        }));

        // Handle incoming messages
        while let Some(msg) = receiver.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    println!("📨 Received from {}: {}", client_id, text);
                    
                    // Parse and route message
                    match serde_json::from_str::<Value>(&text) {
                        Ok(json) => {
                            if let Err(e) = Self::handle_message(
                                &client_id,
                                json,
                                &app_handle,
                            ).await {
                                eprintln!("Message handling error: {}", e);
                            }
                        }
                        Err(e) => {
                            eprintln!("JSON parse error: {}", e);
                        }
                    }
                }
                Ok(Message::Close(_)) => {
                    println!("📤 Client closed connection: {}", client_id);
                    break;
                }
                Ok(Message::Ping(data)) => {
                    let mut sender = sender.lock().await;
                    let _ = sender.send(Message::Pong(data)).await;
                }
                Err(e) => {
                    eprintln!("WebSocket error from {}: {}", client_id, e);
                    break;
                }
                _ => {}
            }
        }

        // Unregister client
        {
            let mut clients_map = clients.write().await;
            clients_map.remove(&client_id);
        }

        println!("❌ Client disconnected: {}", client_id);

        // Emit disconnection event to frontend
        let _ = app_handle.emit("ws-client-disconnected", serde_json::json!({
            "clientId": client_id
        }));

        Ok(())
    }

    async fn handle_message(
        client_id: &str,
        message: Value,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        let msg_type = message.get("type")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'type' field")?;

        match msg_type {
            "register-widgets" => {
                // QA is registering its widgets
                let _ = app_handle.emit("ws-register-widgets", serde_json::json!({
                    "clientId": client_id,
                    "qaId": message.get("qaId"),
                    "qaName": message.get("qaName"),
                    "widgets": message.get("widgets")
                }));
            }
            "widget-update" => {
                // QA is updating a widget's state
                let _ = app_handle.emit("ws-widget-update", serde_json::json!({
                    "clientId": client_id,
                    "widgetId": message.get("widgetId"),
                    "changes": message.get("changes")
                }));
            }
            "unregister-widgets" => {
                // QA is unregistering its widgets
                let _ = app_handle.emit("ws-unregister-widgets", serde_json::json!({
                    "clientId": client_id,
                    "qaId": message.get("qaId")
                }));
            }
            "heartbeat" => {
                // Simple keepalive, no action needed
                println!("💓 Heartbeat from {}", client_id);
            }
            _ => {
                eprintln!("Unknown message type: {}", msg_type);
            }
        }

        Ok(())
    }

    pub async fn send_to_client(
        &self,
        client_id: &str,
        message: Value,
    ) -> Result<(), String> {
        let clients = self.clients.read().await;
        
        if let Some(sender) = clients.get(client_id) {
            let msg_text = serde_json::to_string(&message)
                .map_err(|e| format!("JSON serialization error: {}", e))?;
            
            let mut sender = sender.lock().await;
            sender.send(Message::Text(msg_text))
                .await
                .map_err(|e| format!("Send error: {}", e))?;
            
            Ok(())
        } else {
            Err(format!("Client not found: {}", client_id))
        }
    }

    pub async fn request_widget_registration(
        &self,
        client_id: &str,
    ) -> Result<(), String> {
        println!("📤 Requesting widget registration from client: {}", client_id);
        
        self.send_to_client(client_id, serde_json::json!({
            "type": "request-widgets",
            "message": "Please send your widget definitions"
        })).await
    }

    pub async fn request_all_widgets(&self) -> Result<(), String> {
        let clients = self.clients.read().await;
        let client_ids: Vec<String> = clients.keys().cloned().collect();
        drop(clients);

        println!("📤 Requesting widgets from {} clients", client_ids.len());
        
        for client_id in client_ids {
            if let Err(e) = self.request_widget_registration(&client_id).await {
                eprintln!("Failed to request widgets from {}: {}", client_id, e);
            }
        }
        
        Ok(())
    }

    pub async fn broadcast(&self, message: Value) -> Result<(), String> {
        let clients = self.clients.read().await;
        let msg_text = serde_json::to_string(&message)
            .map_err(|e| format!("JSON serialization error: {}", e))?;

        for (client_id, sender) in clients.iter() {
            let mut sender = sender.lock().await;
            if let Err(e) = sender.send(Message::Text(msg_text.clone())).await {
                eprintln!("Broadcast error to {}: {}", client_id, e);
            }
        }

        Ok(())
    }

    pub async fn get_connected_clients(&self) -> Vec<String> {
        let clients = self.clients.read().await;
        clients.keys().cloned().collect()
    }
}
