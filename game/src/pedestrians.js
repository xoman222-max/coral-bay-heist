// Pedestrians: colourful walkers on the sidewalks who scatter when they hear
// gunfire or see a car coming, plus the gang enforcers who fight back.
import * as THREE from 'three';
import { CITY } from './config.js';
import { clamp, distance2D, pick, range } from './random.js';

const SHIRT_COLORS = [0xe63946, 0x2a9d8f, 0xe9c46a, 0x7b5ea7, 0xf4a261, 0x48cae4, 0xef476f, 0x90be6d];
const SKIN_COLORS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const NAMES = ['Rosa', 'Dee', 'Marco', 'Tessa', 'Lou', 'Priya', 'Sam', 'Nia', 'Cole', 'Ana', 'Vic', 'June'];

export function createPedMesh(shirt, skin, scale) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2b2d42 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.8, 0.26), pantsMat);
  legs.position.y = 0.4;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.34), shirtMat);
  torso.position.y = 1.15;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skinMat);
  head.position.y = 1.75;
  g.add(head);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.14), shirtMat);
  armL.position.set(-0.4, 1.15, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.4;
  g.add(armR);
  g.userData.armL = armL;
  g.userData.armR = armR;
  g.userData.legs = legs;
  g.scale.setScalar(scale || 1);
  return g;
}

export function createPedestrians(scene, city, rand) {
  const peds = [];
  const HALF = CITY.half;
  const streetCoords = city.streetCoords;

  function randomSidewalkSpot() {
    const street = pick(rand, streetCoords);
    const along = range(rand, -HALF + 10, HALF - 10);
    if (rand() < 0.5) return { x: along, z: street + 9.2, axis: 'x' };
    return { x: street + 9.2, z: along, axis: 'z' };
  }

  function spawnPed(x, z, kind) {
    const spot = x === undefined ? randomSidewalkSpot() : { x, z, axis: 'x' };
    const mesh = createPedMesh(pick(rand, SHIRT_COLORS), pick(rand, SKIN_COLORS), range(rand, 0.92, 1.08));
    mesh.position.set(spot.x, 0, spot.z);
    scene.add(mesh);
    const ped = {
      mesh, x: spot.x, z: spot.z,
      name: pick(rand, NAMES),
      kind: kind || 'walker',
      heading: rand() * Math.PI * 2,
      speed: range(rand, 1.2, 2.2),
      walkPhase: rand() * 6,
      flee: 0,           // seconds of panicked running left
      fleeFrom: null,
      health: kind === 'enforcer' ? 80 : 40,
      alive: true,
      shootTimer: range(rand, 1, 2),
      punchTimer: 0,
    };
    if (kind === 'enforcer') {
      // Dark jacket + red band: the Bay Sharks crew.
      mesh.children[1].material = new THREE.MeshLambertMaterial({ color: 0x1f2430 });
      mesh.children[2].material = new THREE.MeshLambertMaterial({ color: 0xd90429 });
    }
    peds.push(ped);
    return ped;
  }

  for (let i = 0; i < 22; i += 1) spawnPed();

  function scare(x, z, radius) {
    for (const p of peds) {
      if (!p.alive) continue;
      if (distance2D(x, z, p.x, p.z) < radius) {
        p.flee = 4 + rand() * 2;
        p.fleeFrom = { x, z };
        p.speed = 5.5;
      }
    }
  }

  function update(dt, playerPos, playerCar) {
    for (const p of peds) {
      if (!p.alive) continue;
      let tx;
      let tz;
      if (p.flee > 0) {
        p.flee -= dt;
        const dx = p.x - (p.fleeFrom ? p.fleeFrom.x : playerPos.x);
        const dz = p.z - (p.fleeFrom ? p.fleeFrom.z : playerPos.z);
        const len = Math.hypot(dx, dz) || 1;
        tx = p.x + (dx / len) * 10;
        tz = p.z + (dz / len) * 10;
        if (p.flee <= 0) p.speed = range(rand, 1.2, 2.2);
      } else if (p.kind === 'enforcer') {
        // Enforcers hold their ground near the player and shoot when close.
        tx = p.x;
        tz = p.z;
      } else {
        // Stroll along the sidewalk; turn around at the city edge.
        tx = p.x + Math.sin(p.heading) * 8;
        tz = p.z + Math.cos(p.heading) * 8;
        if (Math.abs(tx) > HALF - 6 || Math.abs(tz) > HALF - 6) p.heading += Math.PI;
      }
      // A car bearing down scatters walkers off the road.
      if (playerCar) {
        const d = distance2D(p.x, p.z, playerCar.x, playerCar.z);
        if (d < 7 && Math.abs(playerCar.speed) > 4 && p.flee <= 0) {
          p.flee = 2.5;
          p.fleeFrom = { x: playerCar.x, z: playerCar.z };
          p.speed = 5.5;
        }
      }
      const dx = tx - p.x;
      const dz = tz - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.15) {
        const want = Math.atan2(dx, dz);
        let diff = want - p.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.heading += clamp(diff, -3 * dt, 3 * dt);
        const step = Math.min(dist, p.speed * dt);
        const nx = p.x + Math.sin(p.heading) * step;
        const nz = p.z + Math.cos(p.heading) * step;
        if (!city.isBlocked(nx, nz, 0.5)) { p.x = nx; p.z = nz; }
        else p.heading += Math.PI / 2;
      }
      p.walkPhase += dt * p.speed * 2.4;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      p.mesh.userData.armL.rotation.x = Math.sin(p.walkPhase) * 0.6;
      p.mesh.userData.armR.rotation.x = -Math.sin(p.walkPhase) * 0.6;
    }
  }

  function nearest(x, z, maxDist, kind) {
    let best = null;
    let bestD = maxDist;
    for (const p of peds) {
      if (!p.alive) continue;
      if (kind && p.kind !== kind) continue;
      const d = distance2D(x, z, p.x, p.z);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  function remove(ped) {
    ped.alive = false;
    scene.remove(ped.mesh);
  }

  return { peds, spawnPed, scare, update, nearest, remove };
}
