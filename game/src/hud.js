// Coral Bay Heist — the HUD: cash, health, wanted stars, objective,
// subtitles, toasts and the live minimap. It only touches the DOM;
// the game tells it what to show.

export class Hud {
  constructor() {
    this.cashEl = document.getElementById('hud-cash');
    this.healthEl = document.getElementById('hud-health-fill');
    this.starsEl = document.getElementById('hud-stars');
    this.objectiveEl = document.getElementById('hud-objective');
    this.subtitleEl = document.getElementById('hud-subtitle');
    this.toastEl = document.getElementById('hud-toast');
    this.minimap = document.getElementById('hud-minimap');
    this.mapCtx = this.minimap.getContext('2d');
    this.startEl = document.getElementById('screen-start');
    this.winEl = document.getElementById('screen-win');
    this.overEl = document.getElementById('screen-over');
    this.pauseEl = document.getElementById('screen-pause');
    this.subtitleTimer = 0;
    this.toastTimer = 0;
  }

  setCash(n) {
    this.cashEl.textContent = `$${n.toLocaleString('en-US')}`;
  }

  setHealth(h) {
    const pct = Math.max(0, Math.min(100, h));
    this.healthEl.style.width = `${pct}%`;
    this.healthEl.style.background = pct > 50 ? '#58d68d' : pct > 25 ? '#f5b041' : '#e74c3c';
  }

  setWanted(n) {
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < n ? '★' : '☆';
    this.starsEl.textContent = stars;
    this.starsEl.style.color = n > 0 ? '#ffd94d' : '#5a6470';
  }

  setObjective(text) {
    this.objectiveEl.textContent = text;
  }

  showLine(text) {
    this.subtitleEl.textContent = text;
    this.subtitleTimer = 3.4;
  }

  showToast(text) {
    this.toastEl.textContent = text;
    this.toastTimer = 3.0;
  }

  tick(dt) {
    if (this.subtitleTimer > 0) {
      this.subtitleTimer -= dt;
      if (this.subtitleTimer <= 0) this.subtitleEl.textContent = '';
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.textContent = '';
    }
  }

  // The minimap: roads, buildings, the player arrow, police dots,
  // the mission marker and the Cruiser, all top-down.
  drawMinimap(view) {
    const ctx = this.mapCtx;
    const size = 180;
    const scale = size / 380; // world -190..190 maps to the canvas
    const toX = (x) => size / 2 + x * scale;
    const toZ = (z) => size / 2 + z * scale;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(12, 18, 26, 0.85)';
    ctx.fillRect(0, 0, size, size);
    // Sea on the west edge.
    ctx.fillStyle = '#1f7fa8';
    ctx.fillRect(0, 0, toX(-180), size);
    // Roads.
    ctx.strokeStyle = '#4a5058';
    ctx.lineWidth = 7;
    for (const x of view.streets) {
      ctx.beginPath();
      ctx.moveTo(toX(x), 0);
      ctx.lineTo(toX(x), size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, toZ(x));
      ctx.lineTo(size, toZ(x));
      ctx.stroke();
    }
    // Buildings.
    ctx.fillStyle = '#8d97a5';
    for (const c of view.colliders) {
      ctx.fillRect(toX(c.minX), toZ(c.minZ), (c.maxX - c.minX) * scale, (c.maxZ - c.minZ) * scale);
    }
    // Mission marker.
    if (view.marker) {
      ctx.fillStyle = '#ffc94d';
      ctx.beginPath();
      ctx.arc(toX(view.marker.x), toZ(view.marker.z), 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // The Cruiser.
    if (view.cruiser) {
      ctx.fillStyle = '#ff5fa2';
      ctx.beginPath();
      ctx.arc(toX(view.cruiser.x), toZ(view.cruiser.z), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police.
    ctx.fillStyle = '#ff4444';
    for (const p of view.police) {
      ctx.beginPath();
      ctx.arc(toX(p.x), toZ(p.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow, pointing along the heading.
    const px = toX(view.player.x);
    const pz = toZ(view.player.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(Math.atan2(Math.sin(view.player.heading), Math.cos(view.player.heading)) + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  showStart() {
    this.startEl.style.display = 'flex';
    this.winEl.style.display = 'none';
    this.overEl.style.display = 'none';
    this.pauseEl.style.display = 'none';
  }
  hideStart() {
    this.startEl.style.display = 'none';
  }
  showWin(cash) {
    document.getElementById('win-cash').textContent = `$${cash.toLocaleString('en-US')}`;
    this.winEl.style.display = 'flex';
  }
  showGameOver() {
    this.overEl.style.display = 'flex';
  }
  showPause(on) {
    this.pauseEl.style.display = on ? 'flex' : 'none';
  }
}
