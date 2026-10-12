/**
 * Visualizer - Canvas Renderer for Virtual Mouse Display
 * Renders real-time cursor tracking, motion trails, ripples, and active margin bounds.
 */

class MouseVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.targetX = 0.5;
    this.targetY = 0.5;
    this.currX = 0.5;
    this.currY = 0.5;

    this.trail = [];
    this.maxTrail = 20;
    this.ripples = [];

    this.isInteracting = false;
    this.onManualMove = null; // Callback for manual touchpad interaction
    this.onManualClick = null;

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.setupInteractivity();
    this.animate();
  }

  resizeCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = Math.max(340, rect.width * 0.5625); // 16:9 aspect
  }

  setupInteractivity() {
    // Allows user to click and drag directly on canvas to test mouse control
    this.canvas.addEventListener('mousedown', (e) => {
      this.isInteracting = true;
      this.handleMousePos(e, 'DOWN');
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isInteracting) {
        this.handleMousePos(e, 'MOVE');
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isInteracting) {
        this.isInteracting = false;
        this.handleMousePos(e, 'UP');
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      this.addRipple(nx, ny, 'RIGHT_CLICK');
      if (this.onManualClick) this.onManualClick('RIGHT_CLICK', nx, ny);
    });
  }

  handleMousePos(e, type) {
    const rect = this.canvas.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    this.setNormalizedTarget(nx, ny);

    if (type === 'DOWN') {
      this.addRipple(nx, ny, 'LEFT_CLICK');
      if (this.onManualClick) this.onManualClick('LEFT_CLICK', nx, ny);
    } else if (type === 'MOVE' && this.onManualMove) {
      this.onManualMove(nx, ny);
    }
  }

  setNormalizedTarget(nx, ny) {
    this.targetX = Math.max(0, Math.min(1, nx));
    this.targetY = Math.max(0, Math.min(1, ny));
  }

  addRipple(nx, ny, type) {
    let color = '#10b981'; // Green for left click
    if (type === 'RIGHT_CLICK') color = '#ef4444'; // Red
    else if (type === 'DOUBLE_CLICK') color = '#3b82f6'; // Blue
    else if (type === 'SCROLL_UP' || type === 'SCROLL_DOWN') color = '#8b5cf6'; // Purple
    else if (type === 'DRAG') color = '#f59e0b'; // Amber

    this.ripples.push({
      x: nx * this.canvas.width,
      y: ny * this.canvas.height,
      radius: 5,
      maxRadius: 45,
      opacity: 1,
      color: color
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const w = this.canvas.width;
    const h = this.canvas.height;
    if (!w || !h) return;

    // Smooth cursor interpolation
    this.currX += (this.targetX - this.currX) * 0.35;
    this.currY += (this.targetY - this.currY) * 0.35;

    const px = this.currX * w;
    const py = this.currY * h;

    // Update trail
    this.trail.unshift({ x: px, y: py });
    if (this.trail.length > this.maxTrail) {
      this.trail.pop();
    }

    // Clear background
    this.ctx.fillStyle = '#0b1120';
    this.ctx.fillRect(0, 0, w, h);

    // Draw grid lines
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
    this.ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x < w; x += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, h);
      this.ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(w, y);
      this.ctx.stroke();
    }

    // Draw Active Margin boundary indicator (15% margins)
    const margin = 0.15;
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    this.ctx.setLineDash([4, 4]);
    this.ctx.strokeRect(w * margin, h * margin, w * (1 - 2 * margin), h * (1 - 2 * margin));
    this.ctx.setLineDash([]);

    // Draw Motion Trail (Comet glow effect)
    if (this.trail.length > 1) {
      for (let i = 0; i < this.trail.length - 1; i++) {
        const pt = this.trail[i];
        const nextPt = this.trail[i + 1];
        const progress = 1 - (i / this.trail.length);

        this.ctx.beginPath();
        this.ctx.moveTo(pt.x, pt.y);
        this.ctx.lineTo(nextPt.x, nextPt.y);
        this.ctx.strokeStyle = `rgba(56, 189, 248, ${progress * 0.6})`;
        this.ctx.lineWidth = progress * 6;
        this.ctx.lineCap = 'round';
        this.ctx.stroke();
      }
    }

    // Render expanding action ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.radius += 2.5;
      r.opacity -= 0.035;

      if (r.opacity <= 0 || r.radius >= r.maxRadius) {
        this.ripples.splice(i, 1);
        continue;
      }

      this.ctx.beginPath();
      this.ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      this.ctx.strokeStyle = r.color;
      this.ctx.globalAlpha = r.opacity;
      this.ctx.lineWidth = 2.5;
      this.ctx.stroke();
      this.ctx.globalAlpha = 1.0;
    }

    // Render Cursor Reticle
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = '#06b6d4';

    // Outer reticle circle
    this.ctx.beginPath();
    this.ctx.arc(px, py, 12, 0, Math.PI * 2);
    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Crosshairs
    this.ctx.beginPath();
    this.ctx.moveTo(px - 16, py);
    this.ctx.lineTo(px - 6, py);
    this.ctx.moveTo(px + 6, py);
    this.ctx.lineTo(px + 16, py);
    this.ctx.moveTo(px, py - 16);
    this.ctx.lineTo(px, py - 6);
    this.ctx.moveTo(px, py + 6);
    this.ctx.lineTo(px, py + 16);
    this.ctx.strokeStyle = '#06b6d4';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    // Center Core dot
    this.ctx.beginPath();
    this.ctx.arc(px, py, 4, 0, Math.PI * 2);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fill();

    this.ctx.shadowBlur = 0; // Reset shadow
  }
}

window.MouseVisualizer = MouseVisualizer;
