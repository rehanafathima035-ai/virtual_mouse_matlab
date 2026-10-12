const { spawn } = require('child_process');
const path = require('path');

class MouseController {
  constructor() {
    this.driverPath = path.join(__dirname, 'native_driver', 'MouseDriver.exe');
    this.driverProcess = null;
    this.isReady = false;

    // Screen dimensions (default fallback, updated from driver)
    this.screenWidth = 1920;
    this.screenHeight = 1080;

    // Control and safety state
    this.enabled = true; // Can be toggled from frontend
    this.isDragging = false;

    // Sensitivity & Smoothing settings
    this.settings = {
      sensitivity: 1.2,
      smoothing: 0.35, // EMA alpha: lower = smoother, higher = more responsive
      deadzone: 4,     // pixels of movement to ignore (jitter reduction)
      flipX: true,     // Mirror mode (standard webcam natural mapping)
      flipY: false,
      clickCooldownMs: 350,
      scrollSpeed: 100,
      activeMargin: 0.15 // 15% margin for comfortable edge reach
    };

    // Tracking positions
    this.currentX = 960;
    this.currentY = 540;
    this.lastClickTime = 0;
    this.lastScrollTime = 0;

    this.initDriver();
  }

  initDriver() {
    try {
      this.driverProcess = spawn(this.driverPath, ['interactive'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.driverProcess.stdout.on('data', (data) => {
        const text = data.toString().trim();
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
          if (line.startsWith('SCREEN')) {
            const parts = line.split(' ');
            if (parts.length >= 3) {
              this.screenWidth = parseInt(parts[1], 10) || 1920;
              this.screenHeight = parseInt(parts[2], 10) || 1080;
              this.currentX = Math.round(this.screenWidth / 2);
              this.currentY = Math.round(this.screenHeight / 2);
              console.log(`[MouseController] Display detected: ${this.screenWidth}x${this.screenHeight}`);
            }
          } else if (line === 'READY') {
            this.isReady = true;
            this.sendCommand('GET_SCREEN');
          }
        }
      });

      this.driverProcess.stderr.on('data', (data) => {
        console.error(`[MouseController Driver Err]:`, data.toString());
      });

      this.driverProcess.on('close', (code) => {
        console.warn(`[MouseController] Driver process exited with code ${code}. Reconnecting in 1s...`);
        this.isReady = false;
        setTimeout(() => this.initDriver(), 1000);
      });
    } catch (err) {
      console.error('[MouseController] Failed to spawn native driver:', err.message);
    }
  }

  sendCommand(cmd) {
    if (this.driverProcess && this.driverProcess.stdin.writable) {
      this.driverProcess.stdin.write(cmd + '\n');
    }
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    return this.settings;
  }

  setEnabled(val) {
    this.enabled = Boolean(val);
    if (!this.enabled && this.isDragging) {
      this.releaseDrag();
    }
    return this.enabled;
  }

  /**
   * Maps normalized camera coordinates (0.0 to 1.0) to screen pixel coordinates
   * applying active margins and mirror flips.
   */
  mapCoordinates(normX, normY) {
    let nx = Math.max(0, Math.min(1, normX));
    let ny = Math.max(0, Math.min(1, normY));

    if (this.settings.flipX) nx = 1 - nx;
    if (this.settings.flipY) ny = 1 - ny;

    // Active margin calibration
    const margin = Math.max(0, Math.min(0.35, this.settings.activeMargin));
    let mappedX = (nx - margin) / (1 - 2 * margin);
    let mappedY = (ny - margin) / (1 - 2 * margin);

    mappedX = Math.max(0, Math.min(1, mappedX));
    mappedY = Math.max(0, Math.min(1, mappedY));

    const targetX = Math.round(mappedX * this.screenWidth);
    const targetY = Math.round(mappedY * this.screenHeight);

    return { targetX, targetY };
  }

  /**
   * Applies Exponential Moving Average (EMA) and deadzone jitter filter
   */
  processMove(targetX, targetY) {
    const alpha = Math.max(0.05, Math.min(1.0, this.settings.smoothing));

    const nextX = Math.round(this.currentX + alpha * (targetX - this.currentX));
    const nextY = Math.round(this.currentY + alpha * (targetY - this.currentY));

    const dx = Math.abs(nextX - this.currentX);
    const dy = Math.abs(nextY - this.currentY);

    if (dx >= this.settings.deadzone || dy >= this.settings.deadzone) {
      this.currentX = Math.max(0, Math.min(this.screenWidth - 1, nextX));
      this.currentY = Math.max(0, Math.min(this.screenHeight - 1, nextY));

      if (this.enabled) {
        this.sendCommand(`MOVE ${this.currentX} ${this.currentY}`);
      }
    }

    return { x: this.currentX, y: this.currentY };
  }

  leftClick() {
    const now = Date.now();
    if (now - this.lastClickTime < this.settings.clickCooldownMs) return false;
    this.lastClickTime = now;

    if (this.enabled) {
      this.sendCommand('LEFT_CLICK');
    }
    return true;
  }

  rightClick() {
    const now = Date.now();
    if (now - this.lastClickTime < this.settings.clickCooldownMs) return false;
    this.lastClickTime = now;

    if (this.enabled) {
      this.sendCommand('RIGHT_CLICK');
    }
    return true;
  }

  doubleClick() {
    const now = Date.now();
    if (now - this.lastClickTime < this.settings.clickCooldownMs) return false;
    this.lastClickTime = now;

    if (this.enabled) {
      this.sendCommand('DOUBLE_CLICK');
    }
    return true;
  }

  startDrag() {
    if (!this.isDragging) {
      this.isDragging = true;
      if (this.enabled) {
        this.sendCommand('DRAG_START');
      }
    }
  }

  releaseDrag() {
    if (this.isDragging) {
      this.isDragging = false;
      if (this.enabled) {
        this.sendCommand('DRAG_END');
      }
    }
  }

  scroll(direction) {
    const now = Date.now();
    if (now - this.lastScrollTime < 100) return false;
    this.lastScrollTime = now;

    const amount = direction === 'UP' ? this.settings.scrollSpeed : -this.settings.scrollSpeed;
    if (this.enabled) {
      this.sendCommand(`SCROLL ${amount}`);
    }
    return true;
  }

  /**
   * Dispatches higher level gesture commands received from MATLAB or Web
   */
  handleGesture(payload) {
    const { gesture, x, y } = payload;
    let mapped = { x: this.currentX, y: this.currentY };

    if (typeof x === 'number' && typeof y === 'number') {
      const { targetX, targetY } = this.mapCoordinates(x, y);
      mapped = this.processMove(targetX, targetY);
    }

    let actionExecuted = null;
    const g = (gesture || '').toUpperCase();

    switch (g) {
      case 'MOVE':
        if (this.isDragging) this.releaseDrag();
        actionExecuted = 'MOVE';
        break;

      case 'LEFT_CLICK':
      case 'CLICK':
        if (this.isDragging) this.releaseDrag();
        if (this.leftClick()) actionExecuted = 'LEFT_CLICK';
        break;

      case 'RIGHT_CLICK':
        if (this.isDragging) this.releaseDrag();
        if (this.rightClick()) actionExecuted = 'RIGHT_CLICK';
        break;

      case 'DOUBLE_CLICK':
        if (this.isDragging) this.releaseDrag();
        if (this.doubleClick()) actionExecuted = 'DOUBLE_CLICK';
        break;

      case 'DRAG':
      case 'DRAG_START':
        this.startDrag();
        actionExecuted = 'DRAG';
        break;

      case 'DRAG_END':
      case 'RELEASE':
        this.releaseDrag();
        actionExecuted = 'DRAG_END';
        break;

      case 'SCROLL_UP':
        if (this.scroll('UP')) actionExecuted = 'SCROLL_UP';
        break;

      case 'SCROLL_DOWN':
        if (this.scroll('DOWN')) actionExecuted = 'SCROLL_DOWN';
        break;

      default:
        break;
    }

    return {
      position: mapped,
      action: actionExecuted,
      screen: { width: this.screenWidth, height: this.screenHeight },
      enabled: this.enabled
    };
  }
}

module.exports = new MouseController();
