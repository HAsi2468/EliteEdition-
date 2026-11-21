/**
 * Elite Edition ERP — Milestone & Goal Celebration Particle Burst
 *
 * Lightweight, zero-dependency HTML5 canvas confetti burst
 * that runs strictly on requestAnimationFrame and auto-destroys.
 */

class CelebrationEngine {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.animId = null;
  }

  ensureCanvas() {
    if (typeof document === 'undefined') return null;
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'erp-celebration-canvas';
      this.canvas.style.position = 'fixed';
      this.canvas.style.top = '0';
      this.canvas.style.left = '0';
      this.canvas.style.width = '100vw';
      this.canvas.style.height = '100vh';
      this.canvas.style.pointerEvents = 'none';
      this.canvas.style.zIndex = '999999';
      document.body.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
    }
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    return this.ctx;
  }

  trigger(originX, originY, particleCount = 45) {
    if (typeof window === 'undefined') return;
    const ctx = this.ensureCanvas();
    if (!ctx) return;

    const x = typeof originX === 'number' ? originX : window.innerWidth / 2;
    const y = typeof originY === 'number' ? originY : window.innerHeight / 2;

    const colors = ['#38bdf8', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#f43f5e'];

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.8;
      const speed = 4 + Math.random() * 8;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3.5,
        size: 4 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 12,
        alpha: 1,
        life: 0.95 + Math.random() * 0.05
      });
    }

    if (!this.animId) {
      this.render();
    }
  }

  render() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22; // gravity
      p.vx *= 0.98; // air resistance
      p.rotation += p.vRot;
      p.alpha *= p.life;

      if (p.alpha <= 0.02 || p.y > this.canvas.height + 50) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
      this.ctx.restore();
    }

    if (this.particles.length > 0) {
      this.animId = requestAnimationFrame(() => this.render());
    } else {
      this.animId = null;
      if (this.canvas && this.canvas.parentNode) {
        this.canvas.parentNode.removeChild(this.canvas);
        this.canvas = null;
        this.ctx = null;
      }
    }
  }

  /**
   * Compact 14-particle glass sparkle burst directly from a button click point
   */
  sparkleBurst(x, y, colors = ['#38bdf8', '#34d399', '#a78bfa', '#fbbf24', '#ffffff']) {
    if (typeof window === 'undefined') return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.ensureCanvas();
    const originX = typeof x === 'number' ? x : window.innerWidth / 2;
    const originY = typeof y === 'number' ? y : window.innerHeight / 2;
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i) / 14 + (Math.random() - 0.5) * 0.3;
      const speed = 2.4 + Math.random() * 4.2;
      this.particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: 3 + Math.random() * 3.5,
        color: colors[i % colors.length],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 16,
        alpha: 1,
        life: 0.91 + Math.random() * 0.04,
      });
    }
    if (!this.animId) {
      this.render();
    }
  }
}

export const celebration = new CelebrationEngine();
export default celebration;
