// Coral Bay Heist — the story: six missions, in order.
// The runner owns the marker, the briefing lines and the stage
// logic; the game itself only answers the questions the runner asks
// (where is the player, is that the Cruiser, are the enforcers dead).

import * as THREE from 'three';
import { MISSIONS } from './config.js';

function makeMarker(scene) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.2, 0.28, 10, 40),
    new THREE.MeshBasicMaterial({ color: 0x2fe6c8 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.25;
  group.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x2fe6c8, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
  );
  beam.position.y = 13;
  group.add(beam);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9),
    new THREE.MeshBasicMaterial({ color: 0xffc94d }),
  );
  diamond.position.y = 4.2;
  group.add(diamond);
  group.visible = false;
  scene.add(group);
  return { group, ring, diamond };
}

function near(a, b, range) {
  return Math.hypot(a.x - b.x, a.z - b.z) < range;
}

export class MissionRunner {
  constructor(scene) {
    this.scene = scene;
    this.index = -1; // no mission running
    this.stage = 0;
    this.crack = 0;
    this.marker = makeMarker(scene);
    this.lines = [];
    this.lineTimer = 0;
    this.currentLine = '';
    this.done = false;
  }

  get def() {
    return this.index >= 0 ? MISSIONS[this.index] : null;
  }

  get markerPos() {
    if (!this.marker.group.visible) return null;
    return { x: this.marker.group.position.x, z: this.marker.group.position.z };
  }

  start(index, ctx) {
    this.index = index;
    this.stage = 0;
    this.crack = 0;
    this.done = false;
    const def = MISSIONS[index];
    this.lines = def.brief.slice();
    this.lineTimer = 0;
    this.currentLine = '';
    if (def.startWanted) ctx.setWanted(def.startWanted);
    if (def.id === 'cruiser') ctx.spawnCruiser(def.cruiserSpot);
    this.placeMarker(ctx);
    ctx.setObjective(`${def.title} — ${this.stageText()}`);
  }

  stageText() {
    const def = this.def;
    if (!def) return '';
    switch (def.id) {
      case 'errand': return this.stage === 0 ? 'Pick up the parcel' : 'Deliver it to Marina';
      case 'cruiser': return 'Steal the Coral Cruiser';
      case 'heat': return 'Lose the cops — get to zero stars';
      case 'warehouse': return this.stage === 0 ? 'Reach the warehouse' : 'Take out the enforcers';
      case 'heist': return this.stage === 0 ? 'Reach the casino vault' : 'Hold still — crack the vault';
      case 'getaway': return 'Reach the boat at the harbor';
      default: return '';
    }
  }

  placeMarker(ctx) {
    const def = this.def;
    if (!def) return;
    let at = null;
    if (def.id === 'errand') at = this.stage === 0 ? def.pickup : def.dropoff;
    else if (def.id === 'cruiser') at = def.cruiserSpot;
    else if (def.id === 'warehouse') at = def.warehouse;
    else if (def.id === 'heist') at = def.vault;
    else if (def.id === 'getaway') at = def.boat;
    if (at) {
      this.marker.group.position.set(at.x, 0, at.z);
      this.marker.group.visible = true;
    } else {
      this.marker.group.visible = false;
    }
  }

  hideMarker() {
    this.marker.group.visible = false;
  }

  // One line of briefing at a time, each on screen for a few seconds.
  updateLines(dt, ctx) {
    if (this.lines.length === 0) return;
    this.lineTimer -= dt;
    if (this.lineTimer <= 0) {
      this.currentLine = this.lines.shift();
      this.lineTimer = 3.4;
      ctx.showLine(this.currentLine);
    }
  }

  complete(ctx) {
    const def = this.def;
    ctx.addCash(def.reward);
    ctx.showLine(def.complete);
    ctx.showToast(`${def.title} complete — +$${def.reward}`);
    this.hideMarker();
    this.done = true;
    const next = this.index + 1;
    this.index = -1;
    if (next >= MISSIONS.length) {
      ctx.onGameWon();
    } else {
      ctx.onMissionComplete(next);
    }
  }

  update(dt, ctx, time) {
    // Marker pulse.
    if (this.marker.group.visible) {
      const s = 1 + Math.sin(time * 3) * 0.08;
      this.marker.ring.scale.set(s, s, 1);
      this.marker.diamond.rotation.y += dt * 2;
      this.marker.diamond.position.y = 4.2 + Math.sin(time * 2) * 0.4;
    }
    this.updateLines(dt, ctx);
    if (this.index < 0 || this.done) return;
    const def = this.def;
    const pos = ctx.playerPos();
    switch (def.id) {
      case 'errand': {
        const target = this.stage === 0 ? def.pickup : def.dropoff;
        if (near(pos, target, 4.5)) {
          if (this.stage === 0) {
            this.stage = 1;
            ctx.showLine('Parcel picked up. Now get it to Marina.');
            this.placeMarker(ctx);
            ctx.setObjective(`${def.title} — ${this.stageText()}`);
          } else {
            this.complete(ctx);
          }
        }
        break;
      }
      case 'cruiser': {
        if (ctx.isDrivingCruiser()) this.complete(ctx);
        break;
      }
      case 'heat': {
        if (ctx.wantedLevel() === 0) this.complete(ctx);
        break;
      }
      case 'warehouse': {
        if (this.stage === 0) {
          if (near(pos, def.warehouse, 12)) {
            this.stage = 1;
            ctx.spawnEnforcers(def.enforcers, def.warehouse);
            ctx.setObjective(`${def.title} — ${this.stageText()}`);
            ctx.showLine('Marlo Vane: "There they are. Make it count."');
          }
        } else if (ctx.enforcersLeft() === 0) {
          this.complete(ctx);
        }
        break;
      }
      case 'heist': {
        if (this.stage === 0) {
          if (near(pos, def.vault, 4.5)) {
            this.stage = 1;
            ctx.setWanted(2);
            ctx.setObjective(`${def.title} — ${this.stageText()}`);
            ctx.showLine('Marina Sol: "The alarm is up. Hold it together."');
          }
        } else if (near(pos, def.vault, 6)) {
          this.crack += dt;
          ctx.setObjective(`${def.title} — cracking the vault ${Math.min(99, Math.floor((this.crack / def.crackSeconds) * 100))}%`);
          if (this.crack >= def.crackSeconds) this.complete(ctx);
        }
        break;
      }
      case 'getaway': {
        if (near(pos, def.boat, 6)) this.complete(ctx);
        break;
      }
      default:
        break;
    }
  }
}
