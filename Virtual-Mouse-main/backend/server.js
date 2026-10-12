const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const mouse = require('./mouseController');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Camera bridge buffer
let latestFrameBuffer = null;

app.post('/api/frame', express.raw({ type: ['image/jpeg', 'application/octet-stream'], limit: '5mb' }), (req, res) => {
  latestFrameBuffer = req.body;
  res.sendStatus(200);
});

app.post('/api/frame-base64', (req, res) => {
  if (req.body && req.body.image) {
    const base64Data = req.body.image.replace(/^data:image\/\w+;base64,/, '');
    latestFrameBuffer = Buffer.from(base64Data, 'base64');
  }
  res.sendStatus(200);
});

app.get('/api/frame.jpg', (req, res) => {
  if (!latestFrameBuffer || latestFrameBuffer.length === 0) {
    return res.status(404).send('No frame available yet');
  }
  res.set('Content-Type', 'image/jpeg');
  res.send(latestFrameBuffer);
});

// System telemetry state
const state = {
  lastMatlabHeartbeat: null,
  matlabConnected: false,
  matlabFps: 0,
  lastGesture: 'IDLE',
  lastAction: null,
  confidence: 1.0,
  source: 'NONE',
  totalGesturesProcessed: 0,
  startTime: Date.now()
};

// Check MATLAB connection liveness every 2 seconds
setInterval(() => {
  if (state.lastMatlabHeartbeat && Date.now() - state.lastMatlabHeartbeat > 3000) {
    if (state.matlabConnected) {
      state.matlabConnected = false;
      broadcast({
        type: 'STATUS_CHANGE',
        matlabConnected: false,
        message: 'MATLAB Computer Vision disconnected or idle'
      });
    }
  }
}, 1000);

// Broadcast helper for WebSockets
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// REST Endpoints
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ONLINE',
    uptime: Math.round((Date.now() - state.startTime) / 1000),
    matlabConnected: state.matlabConnected,
    matlabFps: state.matlabFps,
    mouseEnabled: mouse.enabled,
    screenWidth: mouse.screenWidth,
    screenHeight: mouse.screenHeight,
    currentPos: { x: mouse.currentX, y: mouse.currentY },
    settings: mouse.settings,
    connectedClients: wss.clients.size,
    totalGestures: state.totalGesturesProcessed
  });
});

app.get('/api/settings', (req, res) => {
  res.json({
    settings: mouse.settings,
    enabled: mouse.enabled,
    screen: { width: mouse.screenWidth, height: mouse.screenHeight }
  });
});

app.post('/api/settings', (req, res) => {
  const { enabled, ...newSettings } = req.body;
  if (typeof enabled !== 'undefined') {
    mouse.setEnabled(enabled);
  }
  if (Object.keys(newSettings).length > 0) {
    mouse.updateSettings(newSettings);
  }

  broadcast({
    type: 'SETTINGS_UPDATE',
    settings: mouse.settings,
    enabled: mouse.enabled
  });

  res.json({ success: true, settings: mouse.settings, enabled: mouse.enabled });
});

// Primary ingestion endpoint for MATLAB CV script
app.post('/api/gesture', (req, res) => {
  const { gesture, x, y, confidence, fps, source } = req.body;

  state.lastMatlabHeartbeat = Date.now();
  if (!state.matlabConnected) {
    state.matlabConnected = true;
    console.log('[Backend] MATLAB Computer Vision connected!');
    broadcast({
      type: 'STATUS_CHANGE',
      matlabConnected: true,
      message: 'MATLAB Computer Vision stream active'
    });
  }

  if (typeof fps === 'number') state.matlabFps = Math.round(fps);
  if (gesture) state.lastGesture = gesture;
  state.confidence = confidence || 1.0;
  state.source = source || 'MATLAB_CV';
  state.totalGesturesProcessed++;

  // Process mouse action & movement
  const result = mouse.handleGesture({ gesture, x, y });
  state.lastAction = result.action;

  // Stream to all connected frontend dashboards
  broadcast({
    type: 'TELEMETRY',
    gesture: state.lastGesture,
    action: result.action,
    position: result.position,
    normalized: { x, y },
    confidence: state.confidence,
    fps: state.matlabFps,
    source: state.source,
    enabled: mouse.enabled,
    timestamp: Date.now()
  });

  res.json({
    success: true,
    action: result.action,
    position: result.position,
    mouseEnabled: mouse.enabled
  });
});

// Quick action trigger endpoint
app.post('/api/action', (req, res) => {
  const { action } = req.body;
  const result = mouse.handleGesture({ gesture: action });
  broadcast({
    type: 'ACTION_EXECUTED',
    action: result.action,
    position: result.position,
    source: 'API'
  });
  res.json({ success: true, action: result.action });
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log(`[WS] Client connected. Total active clients: ${wss.clients.size}`);

  // Send initial handshake state
  ws.send(JSON.stringify({
    type: 'INIT_STATE',
    matlabConnected: state.matlabConnected,
    matlabFps: state.matlabFps,
    mouseEnabled: mouse.enabled,
    settings: mouse.settings,
    screen: { width: mouse.screenWidth, height: mouse.screenHeight },
    currentPos: { x: mouse.currentX, y: mouse.currentY }
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'GESTURE_EVENT') {
        const result = mouse.handleGesture(data.payload);
        broadcast({
          type: 'TELEMETRY',
          gesture: data.payload.gesture || 'MOVE',
          action: result.action,
          position: result.position,
          normalized: { x: data.payload.x, y: data.payload.y },
          confidence: data.payload.confidence || 1.0,
          fps: data.payload.fps || 30,
          source: data.payload.source || 'BROWSER_CV',
          enabled: mouse.enabled,
          timestamp: Date.now()
        });
      } else if (data.type === 'UPDATE_SETTINGS') {
        if (typeof data.enabled !== 'undefined') mouse.setEnabled(data.enabled);
        if (data.settings) mouse.updateSettings(data.settings);
        broadcast({
          type: 'SETTINGS_UPDATE',
          settings: mouse.settings,
          enabled: mouse.enabled
        });
      } else if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      }
    } catch (err) {
      console.error('[WS] Error processing message:', err.message);
    }
  });

  ws.on('close', () => {
    console.log(`[WS] Client disconnected. Total active clients: ${wss.clients.size}`);
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` HAND GESTURE VIRTUAL MOUSE - BACKEND RUNNING`);
  console.log(` Local Dashboard:  http://localhost:${PORT}`);
  console.log(` API Endpoint:     http://localhost:${PORT}/api/gesture`);
  console.log(` WebSocket:        ws://localhost:${PORT}/ws`);
  console.log(` Native Driver:    ${mouse.screenWidth}x${mouse.screenHeight}`);
  console.log(`=======================================================`);
});
