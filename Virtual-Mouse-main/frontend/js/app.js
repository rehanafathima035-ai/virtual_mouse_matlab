/**
 * App - Main Frontend Controller
 * Handles WebSocket communication, telemetry updates, settings sync, and UI state.
 */

document.addEventListener('DOMContentLoaded', () => {
  // UI Element References
  const wsStatusDot = document.getElementById('ws-status-dot');
  const wsStatusText = document.getElementById('ws-status-text');
  const matlabStatusDot = document.getElementById('matlab-status-dot');
  const matlabStatusText = document.getElementById('matlab-status-text');
  const latencyBadge = document.getElementById('latency-badge');
  const fpsBadge = document.getElementById('fps-badge');

  const currentGestureText = document.getElementById('current-gesture-text');
  const currentGestureIcon = document.getElementById('current-gesture-icon');
  const currentActionBadge = document.getElementById('current-action-badge');
  const coordDisplay = document.getElementById('coord-display');
  const normCoordDisplay = document.getElementById('norm-coord-display');

  const mouseToggle = document.getElementById('mouse-toggle');
  const sliderSensitivity = document.getElementById('slider-sensitivity');
  const valSensitivity = document.getElementById('val-sensitivity');
  const sliderSmoothing = document.getElementById('slider-smoothing');
  const valSmoothing = document.getElementById('val-smoothing');
  const sliderCooldown = document.getElementById('slider-cooldown');
  const valCooldown = document.getElementById('val-cooldown');
  const checkFlipX = document.getElementById('check-flip-x');
  const checkFlipY = document.getElementById('check-flip-y');

  const eventLogList = document.getElementById('event-log-list');
  const btnClearLog = document.getElementById('btn-clear-log');

  // Mode Selection & Web CV
  const btnModeMatlab = document.getElementById('btn-mode-matlab');
  const btnModeBrowser = document.getElementById('btn-mode-browser');
  const browserCamContainer = document.getElementById('browser-cam-container');
  const btnToggleWebcam = document.getElementById('btn-toggle-webcam');

  // Initialize Canvas Visualizer
  const visualizer = new window.MouseVisualizer('virtual-mouse-canvas');

  // Manual Interaction Callbacks
  visualizer.onManualMove = (nx, ny) => {
    sendWsMessage({
      type: 'GESTURE_EVENT',
      payload: { gesture: 'MOVE', x: nx, y: ny, confidence: 1.0, source: 'TOUCHPAD' }
    });
  };

  visualizer.onManualClick = (action, nx, ny) => {
    sendWsMessage({
      type: 'GESTURE_EVENT',
      payload: { gesture: action, x: nx, y: ny, confidence: 1.0, source: 'TOUCHPAD' }
    });
    logEvent(action, `Manual trigger at (${Math.round(nx * 100)}%, ${Math.round(ny * 100)}%)`);
  };

  // Initialize Web CV Engine
  let webCvEngine = null;
  if (window.WebCvEngine) {
    webCvEngine = new window.WebCvEngine('webcam-video', 'webcam-canvas', (payload) => {
      sendWsMessage({
        type: 'GESTURE_EVENT',
        payload: payload
      });
    });
  }

  // WebSocket Connection
  let ws = null;
  let pingInterval = null;
  let lastPingTime = 0;

  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      wsStatusDot.className = 'status-dot active';
      wsStatusText.innerText = 'Connected';
      logEvent('SYSTEM', 'Connected to backend telemetry server');

      // Setup ping for latency
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          lastPingTime = performance.now();
          ws.send(JSON.stringify({ type: 'PING' }));
        }
      }, 2000);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      wsStatusDot.className = 'status-dot inactive';
      wsStatusText.innerText = 'Disconnected';
      matlabStatusDot.className = 'status-dot inactive';
      matlabStatusText.innerText = 'Offline';
      if (pingInterval) clearInterval(pingInterval);
      setTimeout(connectWebSocket, 1500);
    };

    ws.onerror = (err) => {
      console.warn('WebSocket connection error:', err);
      ws.close();
    };
  }

  function sendWsMessage(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  // Handle incoming telemetry and state updates
  function handleServerMessage(msg) {
    switch (msg.type) {
      case 'INIT_STATE':
        syncInitialState(msg);
        break;

      case 'TELEMETRY':
        handleTelemetry(msg);
        break;

      case 'STATUS_CHANGE':
        updateMatlabStatus(msg.matlabConnected, msg.message);
        break;

      case 'SETTINGS_UPDATE':
        updateSettingsUi(msg.settings, msg.enabled);
        break;

      case 'PONG':
        const latency = Math.round(performance.now() - lastPingTime);
        latencyBadge.innerText = `${latency} ms`;
        break;

      case 'ACTION_EXECUTED':
        if (msg.action) {
          visualizer.addRipple(visualizer.currX, visualizer.currY, msg.action);
          logEvent(msg.action, `Action executed via ${msg.source}`);
        }
        break;
    }
  }

  function syncInitialState(state) {
    updateMatlabStatus(state.matlabConnected);
    updateSettingsUi(state.settings, state.mouseEnabled);
    if (state.currentPos) {
      coordDisplay.innerText = `X: ${state.currentPos.x} | Y: ${state.currentPos.y}`;
    }
  }

  function updateMatlabStatus(connected, message) {
    if (connected) {
      matlabStatusDot.className = 'status-dot active';
      matlabStatusText.innerText = 'Active Stream';
    } else {
      matlabStatusDot.className = 'status-dot waiting';
      matlabStatusText.innerText = 'Waiting for MATLAB';
    }
    if (message) logEvent('CV_STATUS', message);
  }

  function handleTelemetry(t) {
    // 1. Update Visualizer Canvas
    if (t.normalized && typeof t.normalized.x === 'number') {
      visualizer.setNormalizedTarget(t.normalized.x, t.normalized.y);
      normCoordDisplay.innerText = `(${(t.normalized.x * 100).toFixed(1)}%, ${(t.normalized.y * 100).toFixed(1)}%)`;
    }

    if (t.position) {
      coordDisplay.innerText = `X: ${t.position.x} | Y: ${t.position.y}`;
    }

    if (t.fps) {
      fpsBadge.innerText = `${t.fps} FPS`;
    }

    // 2. Gesture HUD
    const gesture = t.gesture || 'IDLE';
    currentGestureText.innerText = gesture;
    currentGestureIcon.innerText = getGestureIcon(gesture);

    if (t.action) {
      currentActionBadge.innerText = t.action;
      currentActionBadge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30';
      visualizer.addRipple(visualizer.currX, visualizer.currY, t.action);
      logEvent(t.action, `Gesture: ${gesture} from ${t.source}`);
    } else {
      currentActionBadge.innerText = t.enabled ? 'ACTIVE' : 'MOUSE OFF';
      currentActionBadge.className = t.enabled ?
        'px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
        'px-3 py-1 rounded-full text-xs font-bold bg-slate-700 text-slate-400 border border-slate-600';
    }
  }

  function getGestureIcon(gesture) {
    switch (gesture.toUpperCase()) {
      case 'MOVE': return '☝️';
      case 'LEFT_CLICK':
      case 'CLICK': return '✌️';
      case 'RIGHT_CLICK': return '🤟';
      case 'DOUBLE_CLICK': return '⚡';
      case 'SCROLL_UP': return '⬆️';
      case 'SCROLL_DOWN': return '⬇️';
      case 'DRAG': return '✊';
      default: return '🖐️';
    }
  }

  function updateSettingsUi(settings, enabled) {
    if (typeof enabled !== 'undefined') {
      mouseToggle.checked = enabled;
    }
    if (settings) {
      if (settings.sensitivity) {
        sliderSensitivity.value = settings.sensitivity;
        valSensitivity.innerText = `${settings.sensitivity}x`;
      }
      if (settings.smoothing) {
        sliderSmoothing.value = settings.smoothing;
        valSmoothing.innerText = settings.smoothing;
      }
      if (settings.clickCooldownMs) {
        sliderCooldown.value = settings.clickCooldownMs;
        valCooldown.innerText = `${settings.clickCooldownMs}ms`;
      }
      if (typeof settings.flipX !== 'undefined') {
        checkFlipX.checked = settings.flipX;
      }
      if (typeof settings.flipY !== 'undefined') {
        checkFlipY.checked = settings.flipY;
      }
    }
  }

  function pushSettings() {
    const payload = {
      enabled: mouseToggle.checked,
      settings: {
        sensitivity: parseFloat(sliderSensitivity.value),
        smoothing: parseFloat(sliderSmoothing.value),
        clickCooldownMs: parseInt(sliderCooldown.value, 10),
        flipX: checkFlipX.checked,
        flipY: checkFlipY.checked
      }
    };
    sendWsMessage({ type: 'UPDATE_SETTINGS', ...payload });
  }

  // Settings Change Listeners
  mouseToggle.addEventListener('change', () => {
    pushSettings();
    logEvent('MOUSE_TOGGLE', `Virtual Mouse Control set to ${mouseToggle.checked ? 'ENABLED' : 'DISABLED'}`);
  });

  sliderSensitivity.addEventListener('input', () => {
    valSensitivity.innerText = `${sliderSensitivity.value}x`;
    pushSettings();
  });

  sliderSmoothing.addEventListener('input', () => {
    valSmoothing.innerText = sliderSmoothing.value;
    pushSettings();
  });

  sliderCooldown.addEventListener('input', () => {
    valCooldown.innerText = `${sliderCooldown.value}ms`;
    pushSettings();
  });

  checkFlipX.addEventListener('change', pushSettings);
  checkFlipY.addEventListener('change', pushSettings);

  // Quick Action Buttons
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      visualizer.addRipple(visualizer.currX, visualizer.currY, action);
      logEvent('TEST_BUTTON', `Triggered ${action}`);
    });
  });

  // Mode Selection
  btnModeMatlab.addEventListener('click', () => {
    btnModeMatlab.className = 'px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-600 text-white shadow-lg shadow-cyan-600/30';
    btnModeBrowser.className = 'px-4 py-2 rounded-lg text-sm font-semibold bg-slate-800 text-slate-400 hover:text-white border border-slate-700';
    browserCamContainer.classList.add('hidden');
    if (webCvEngine && webCvEngine.isActive) {
      webCvEngine.stop();
      btnToggleWebcam.innerText = 'Start In-Browser Camera';
    }
  });

  btnModeBrowser.addEventListener('click', () => {
    btnModeBrowser.className = 'px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-600 text-white shadow-lg shadow-cyan-600/30';
    btnModeMatlab.className = 'px-4 py-2 rounded-lg text-sm font-semibold bg-slate-800 text-slate-400 hover:text-white border border-slate-700';
    browserCamContainer.classList.remove('hidden');
  });

  // Toggle Browser Webcam
  btnToggleWebcam.addEventListener('click', async () => {
    if (!webCvEngine) return;
    if (webCvEngine.isActive) {
      webCvEngine.stop();
      btnToggleWebcam.innerText = 'Start In-Browser Camera';
      btnToggleWebcam.className = 'w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition';
      logEvent('BROWSER_CV', 'Stopped in-browser camera tracking');
    } else {
      const started = await webCvEngine.start();
      if (started) {
        btnToggleWebcam.innerText = 'Stop In-Browser Camera';
        btnToggleWebcam.className = 'w-full py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition';
        logEvent('BROWSER_CV', 'Started in-browser camera tracking');
      }
    }
  });

  // Event Log Helper
  function logEvent(tag, detail) {
    const time = new Date().toLocaleTimeString();
    const li = document.createElement('li');
    li.className = 'text-xs flex items-center justify-between py-1 border-b border-slate-800/80';
    li.innerHTML = `
      <div class="flex items-center space-x-2">
        <span class="text-slate-500 font-mono">${time}</span>
        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-400 border border-slate-700">${tag}</span>
        <span class="text-slate-300 truncate max-w-[200px]">${detail}</span>
      </div>
    `;
    eventLogList.prepend(li);

    // Limit log length
    if (eventLogList.children.length > 50) {
      eventLogList.removeChild(eventLogList.lastChild);
    }
  }

  btnClearLog.addEventListener('click', () => {
    eventLogList.innerHTML = '';
  });

  // Start WebSocket
  connectWebSocket();
});
