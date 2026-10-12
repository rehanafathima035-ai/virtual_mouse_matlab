/**
 * Web CV Engine - In-Browser Computer Vision Alternative
 * Uses HTML5 Canvas and real-time color / brightness fingertip tracking
 * so users can test immediately in Chrome / Edge even before starting MATLAB.
 */

class WebCvEngine {
  constructor(videoElementId, previewCanvasId, onGestureCallback) {
    this.video = document.getElementById(videoElementId);
    this.canvas = document.getElementById(previewCanvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.onGesture = onGestureCallback;

    this.stream = null;
    this.isActive = false;
    this.animId = null;

    this.prevY = 0.5;
    this.lastClickTime = 0;
    this.fpsCount = 0;
    this.fpsTimer = performance.now();
    this.currentFps = 0;
  }

  async start() {
    if (this.isActive) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });

      this.video.srcObject = this.stream;
      await this.video.play();
      this.isActive = true;

      if (this.canvas) {
        this.canvas.width = 320;
        this.canvas.height = 240;
      }

      this.processLoop();
      return true;
    } catch (err) {
      console.error('[WebCvEngine] Failed to access webcam:', err);
      alert('Camera access denied or webcam in use: ' + err.message);
      return false;
    }
  }

  stop() {
    this.isActive = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
  }

  processLoop() {
    if (!this.isActive) return;
    this.animId = requestAnimationFrame(() => this.processLoop());

    if (!this.video || this.video.readyState !== 4) return;

    // Draw downsampled frame for fast real-time analysis
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Mirror image for natural user experience
    this.ctx.save();
    this.ctx.scale(-1, 1);
    this.ctx.drawImage(this.video, -w, 0, w, h);
    this.ctx.restore();

    const imgData = this.ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Fast Color Segmentation (Chai-Ngan YCbCr skin approximation in RGB)
    let sumX = 0;
    let sumY = 0;
    let skinPixelCount = 0;
    let minY = h;
    let minX = w;
    let maxX = 0;
    let maxY = 0;
    let topFingertipX = w / 2;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Standard skin heuristic in RGB
      const isSkin = (r > 95 && g > 40 && b > 20 &&
                      r > g && r > b &&
                      (r - Math.min(g, b)) > 15 &&
                      Math.abs(r - g) > 15);

      if (isSkin) {
        const pixelIdx = i / 4;
        const x = pixelIdx % w;
        const y = Math.floor(pixelIdx / w);

        sumX += x;
        sumY += y;
        skinPixelCount++;

        if (y < minY) {
          minY = y;
          topFingertipX = x;
        }
        if (y > maxY) maxY = y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }

    // Calculate FPS
    this.fpsCount++;
    const now = performance.now();
    if (now - this.fpsTimer >= 1000) {
      this.currentFps = Math.round((this.fpsCount * 1000) / (now - this.fpsTimer));
      this.fpsCount = 0;
      this.fpsTimer = now;
    }

    // Classify Gesture if hand detected
    if (skinPixelCount > 800) {
      const centroidX = sumX / skinPixelCount;
      const centroidY = sumY / skinPixelCount;

      // Pointer coordinate: tracking top-most fingertip point
      const normX = topFingertipX / w;
      const normY = minY / h;

      const handHeight = maxY - minY;
      const handWidth = maxX - minX;
      const aspectRatio = handHeight / Math.max(1, handWidth);

      let gesture = 'MOVE';
      const dY = normY - this.prevY;
      this.prevY = normY;

      // Gesture decision heuristics
      if (aspectRatio < 1.15 && (now - this.lastClickTime > 400)) {
        // Closed fist (compact shape) -> DRAG
        gesture = 'DRAG';
      } else if (aspectRatio > 1.65 && (now - this.lastClickTime > 400)) {
        // Two fingers close/pinch -> LEFT CLICK
        gesture = 'LEFT_CLICK';
        this.lastClickTime = now;
      } else if (handWidth > 130 && (now - this.lastClickTime > 400)) {
        // Two fingers spread wide (V-sign) -> RIGHT CLICK
        gesture = 'RIGHT_CLICK';
        this.lastClickTime = now;
      } else if (Math.abs(dY) > 0.04) {
        gesture = dY < 0 ? 'SCROLL_UP' : 'SCROLL_DOWN';
      }

      // Draw tracking overlays on camera preview
      this.ctx.strokeStyle = '#10b981';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(minX, minY, handWidth, handHeight);

      // Fingertip marker
      this.ctx.fillStyle = '#06b6d4';
      this.ctx.beginPath();
      this.ctx.arc(topFingertipX, minY, 6, 0, Math.PI * 2);
      this.ctx.fill();

      // Stream frame to backend for MATLAB bridge
      if (!this.lastFrameUpload || (now - this.lastFrameUpload > 50)) {
        this.lastFrameUpload = now;
        this.canvas.toBlob((blob) => {
          if (blob) {
            fetch('/api/frame', { method: 'POST', body: blob }).catch(() => {});
          }
        }, 'image/jpeg', 0.6);
      }

      if (this.onGesture) {
        this.onGesture({
          gesture: gesture,
          x: normX,
          y: normY,
          confidence: 0.92,
          fps: this.currentFps,
          source: 'BROWSER_CV'
        });
      }
    }
  }
}

window.WebCvEngine = WebCvEngine;
