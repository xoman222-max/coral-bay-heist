// HUD: the DOM panels (health, cash, wanted stars, objective, speed, ammo,
// clock, messages, dialogue) and the 2D canvas minimap drawn every frame:
// streets, water, the player arrow, cars, police, pedestrians and the beacon.
import { CITY } from './config.js';

const HALF = CITY.half;

export function createHud() {
  const el = (id) => document.getElementById(id);
  const hud = el('hud');
  const healthFill = el('healthfill');
  const healthText = el('healthtext');
  const armorFill = el('armorfill');
  const armorText = el('armortext');
  const cashEl = el('cash');
  const starsEl = el('stars');
  const missionTitle = el('missiontitle');
  const missionText = el('missiontext');
  const missionDist = el('missiondist');
  const speedEl = el('speed');
  const carNameEl = el('carname');
  const ammoEl = el('ammotext');
  const clockEl = el('clocktext');
  const dayEl = el('daytext');
  const msgEl = el('msg');
  const dialogEl = el('dialog');
  const crosshair = el('crosshair');
  const minimap = el('minimap');
  const mctx = minimap.getContext('2d');
  let msgTimer = 0;
  let dialogTimer = 0;

  function show(on) { hud.classList.toggle('on', on); }

  function setMessage(text, seconds) {
    msgEl.textContent = text;
    msgTimer = seconds || 2.5;
  }

  function setDialog(who, text, seconds) {
    dialogEl.innerHTML = '';
    const whoEl = document.createElement('span');
    whoEl.className = 'who';
    whoEl.textContent = who + ': ';
    const textEl = document.createElement('span');
    textEl.textContent = text;
    dialogEl.appendChild(whoEl);
    dialogEl.appendChild(textEl);
    dialogEl.style.display = 'block';
    dialogTimer = seconds || 5;
  }

  function hideDialog() { dialogEl.style.display = 'none'; dialogTimer = 0; }

  function drawMinimap(state) {
    const W = minimap.width;
    const H = minimap.height;
    const scale = W / (HALF * 2 + 40);
    const toX = (x) => W / 2 + x * scale;
    const toY = (z) => H / 2 + z * scale;
    mctx.fillStyle = '#141c2e';
    mctx.fillRect(0, 0, W, H);
    // Bay water at the bottom.
    mctx.fillStyle = '#1d6f8e';
    mctx.fillRect(0, toY(HALF + 4), W, H - toY(HALF + 4));
    // Streets.
    mctx.strokeStyle = '#3a4356';
    mctx.lineWidth = 7;
    for (let i = -2; i <= 2; i += 1) {
      const c = i * 48;
      mctx.beginPath(); mctx.moveTo(toX(c), 0); mctx.lineTo(toX(c), H); mctx.stroke();
      mctx.beginPath(); mctx.moveTo(0, toY(c)); mctx.lineTo(W, toY(c)); mctx.stroke();
    }
    // Blocks.
    mctx.fillStyle = '#232c40';
    for (let bx = -2; bx <= 2; bx += 1) {
      for (let bz = -2; bz <= 2; bz += 1) {
        mctx.fillRect(toX(bx * 48 - 17), toY(bz * 48 - 17), 34 * scale, 34 * scale);
      }
    }
    // Mission beacon.
    if (state.target) {
      const bx = toX(state.target.x);
      const by = toY(state.target.z);
      const pulse = 5 + Math.sin(performance.now() / 200) * 2;
      mctx.fillStyle = '#ffd23e';
      mctx.beginPath(); mctx.arc(bx, by, pulse + 3, 0, Math.PI * 2); mctx.fill();
      mctx.fillStyle = '#1a1200';
      mctx.font = 'bold 11px sans-serif';
      mctx.textAlign = 'center';
      mctx.fillText('!', bx, by + 4);
    }
    // Traffic (white) and police (blue/red flashing).
    for (const car of state.traffic || []) {
      mctx.fillStyle = '#e8ecf2';
      mctx.fillRect(toX(car.x) - 2, toY(car.z) - 2, 4, 4);
    }
    for (const car of state.policeCars || []) {
      mctx.fillStyle = Math.floor(performance.now() / 300) % 2 === 0 ? '#ff3333' : '#3388ff';
      mctx.beginPath(); mctx.arc(toX(car.x), toY(car.z), 4, 0, Math.PI * 2); mctx.fill();
    }
    for (const cop of state.policeCops || []) {
      mctx.fillStyle = '#3388ff';
      mctx.fillRect(toX(cop.x) - 2, toY(cop.z) - 2, 4, 4);
    }
    // Player arrow (yellow, rotated by heading).
    const px = toX(state.player.x);
    const py = toY(state.player.z);
    mctx.save();
    mctx.translate(px, py);
    mctx.rotate(Math.atan2(Math.sin(state.player.heading), Math.cos(state.player.heading)) * 0 + state.player.heading);
    // Canvas y is down and world z is down, so heading maps directly.
    mctx.fillStyle = '#ffd23e';
    mctx.beginPath();
    mctx.moveTo(0, -8); mctx.lineTo(6, 6); mctx.lineTo(-6, 6); mctx.closePath();
    mctx.fill();
    mctx.restore();
    // Viewport ring.
    mctx.strokeStyle = 'rgba(255,255,255,0.5)';
    mctx.lineWidth = 1;
    mctx.strokeRect(1, 1, W - 2, H - 2);
  }

  function update(dt, state) {
    if (msgTimer > 0) {
      msgTimer -= dt;
      if (msgTimer <= 0) msgEl.textContent = '';
    }
    if (dialogTimer > 0) {
      dialogTimer -= dt;
      if (dialogTimer <= 0) hideDialog();
    }
    healthFill.style.width = Math.max(0, state.health) + '%';
    healthFill.style.background = state.health > 50
      ? 'linear-gradient(90deg, #37d67a, #a8e063)'
      : state.health > 25 ? 'linear-gradient(90deg, #f2a65a, #ffd23e)' : '#e5534b';
    healthText.textContent = String(Math.max(0, Math.round(state.health)));
    armorFill.style.width = Math.max(0, state.armor) + '%';
    armorText.textContent = String(Math.round(state.armor));
    cashEl.textContent = '$' + state.cash.toLocaleString('en-US');
    let stars = '';
    for (let i = 0; i < 5; i += 1) {
      stars += i < state.wanted
        ? '<span>&#9733;</span>'
        : '<span class="off">&#9733;</span>';
    }
    starsEl.innerHTML = stars;
    missionTitle.textContent = state.missionTitle || 'Coral Bay Heist';
    missionText.textContent = state.missionText || '';
    missionDist.textContent = state.target
      ? state.target.label + ' — ' + Math.round(state.targetDist) + ' m away'
      : '';
    speedEl.textContent = String(Math.round(Math.abs(state.speed) * 2.2));
    carNameEl.textContent = state.carName || 'On foot';
    ammoEl.textContent = String(state.ammo);
    const hours = Math.floor(state.hours);
    const minutes = Math.floor((state.hours - hours) * 60);
    clockEl.textContent = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
    dayEl.textContent = 'Day ' + state.day + (state.wanted > 0 ? '  •  HEAT!' : '');
    crosshair.style.display = state.aiming ? 'block' : 'none';
    drawMinimap(state);
  }

  return { show, update, setMessage, setDialog, hideDialog };
}
