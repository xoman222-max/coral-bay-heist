// Coral Bay Heist — the wanted level and the people who enforce it.
// Police cars chase and ram; enforcers fight on foot. The wanted
// level only falls when the player is genuinely out of sight.

import * as THREE from 'three';
import { WANTED } from './config.js';
import { createCar, updatePoliceCar } from './vehicles.js';

export class Wanted {
  constructor() {
    this.level = 0;
    this.hiddenTimer = 0;
  }
  add(n) {
    this.level = Math.min(WANTED.maxStars, this.level + n);
    this.hiddenTimer = 0;
  }
  set(n) {
    this.level = Math.max(0, Math.min(WANTED.maxStars, n));
    this.hiddenTimer = 0;
  }
  clear() {
    this.level = 0;
    this.hiddenTimer = 0;
  }
  // Call every frame. nearestCop is how far the closest cop is;
  // Infinity when no cop can see the player at all.
  update(dt, nearestCop) {
    if (this.level === 0) return;
    if (nearestCop > WANTED.hideDistance) {
      this.hiddenTimer += dt;
      if (this.hiddenTimer >= WANTED.decaySeconds) {
        this.level -= 1;
        this.hiddenTimer = 0;
      }
    } else {
      this.hiddenTimer = 0;
    }
  }
}

export function makeEnforcerMesh() {
  const group = new THREE.Group();
  const vest = new THREE.MeshLambertMaterial({ color: 0x1c1c22 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc99b76 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.0, 8), vest);
  body.position.y = 0.95;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), skin);
  head.position.y = 1.7;
  group.add(head);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.7), new THREE.MeshLambertMaterial({ color: 0x0c0c0c }));
  gun.position.set(0.3, 1.15, 0.4);
  group.add(gun);
  return group;
}

export function createEnforcer(x, z) {
  const mesh = makeEnforcerMesh();
  mesh.position.set(x, 0, z);
  return {
    mesh,
    x,
    z,
    health: 3,
    shootTimer: 1.2,
    heading: 0,
    alive: true,
  };
}

// One enforcer's turn: face the player, and every couple of seconds
// fire a shot that hurts if it lands. Returns the damage dealt.
export function updateEnforcer(foe, dt, playerX, playerZ, onShot) {
  if (!foe.alive) return 0;
  const dx = playerX - foe.x;
  const dz = playerZ - foe.z;
  const dist = Math.hypot(dx, dz);
  foe.heading = Math.atan2(dx, dz);
  foe.mesh.rotation.y = foe.heading;
  foe.shootTimer -= dt;
  let damage = 0;
  if (foe.shootTimer <= 0 && dist < 42) {
    foe.shootTimer = 1.6 + Math.random() * 0.9;
    // A shot lands a little more than half the time at close range.
    const hitChance = dist < 14 ? 0.62 : 0.34;
    if (Math.random() < hitChance) damage = 6 + Math.floor(Math.random() * 6);
    if (onShot) onShot(foe, damage > 0);
  }
  return damage;
}

// Keep one police car per wanted star on the road, chasing the player.
// Spawn points snap onto the nearest street line, so a fresh cop
// never materialises inside a building.
export function maintainPolice(policeCars, scene, wanted, playerX, playerZ, rng, colliders) {
  const snap = (v) => {
    const s = Math.round(v / 54) * 54;
    return Math.abs(s - v) < 12 ? s : v;
  };
  while (policeCars.length < wanted.level) {
    const angle = rng.range(0, Math.PI * 2);
    let x = Math.max(-170, Math.min(170, playerX + Math.sin(angle) * 42));
    let z = Math.max(-170, Math.min(170, playerZ + Math.cos(angle) * 42));
    x = snap(x);
    z = snap(z);
    const car = createCar(0xf2f2f2, x, z, angle, { police: true, kind: 'police' });
    scene.add(car.mesh);
    policeCars.push(car);
  }
  while (policeCars.length > wanted.level) {
    const car = policeCars.pop();
    scene.remove(car.mesh);
  }
}

export function updatePolice(policeCars, dt, colliders, playerX, playerZ, time) {
  let nearest = Infinity;
  for (const car of policeCars) {
    updatePoliceCar(car, dt, colliders, playerX, playerZ, time);
    const d = Math.hypot(car.x - playerX, car.z - playerZ);
    if (d < nearest) nearest = d;
  }
  return nearest;
}

// A tracer line from a muzzle to its target, fading over half a second.
export function makeTracer(scene, from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(from.x, from.y, from.z),
    new THREE.Vector3(to.x, to.y, to.z),
  ]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95 }));
  scene.add(line);
  return { line, life: 0.45 };
}

export function updateTracers(tracers, scene, dt) {
  for (let i = tracers.length - 1; i >= 0; i -= 1) {
    const t = tracers[i];
    t.life -= dt;
    t.line.material.opacity = Math.max(0, t.life / 0.45) * 0.95;
    if (t.life <= 0) {
      scene.remove(t.line);
      t.line.geometry.dispose();
      t.line.material.dispose();
      tracers.splice(i, 1);
    }
  }
}
