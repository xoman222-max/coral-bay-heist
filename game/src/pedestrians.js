// Coral Bay Heist — pedestrians.
// They stroll the sidewalks, and when a building gets in the way
// they slide around it instead of turning square into the wall.

import * as THREE from 'three';
import { Rng } from './random.js';
import { hitsCollider } from './city.js';
import { WORLD } from './config.js';

const SHIRT_COLORS = [0xe8e4da, 0x4f7fb8, 0xc96a4a, 0x7fb069, 0xd9a441, 0x9b6bc4, 0x5bc0be];

export function makePedMesh(rng) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: rng.pick(SHIRT_COLORS) });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a986 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2e3440 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.95, 8), shirt);
  body.position.y = 0.95;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), skin);
  head.position.y = 1.68;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.16), pants);
  legL.position.set(-0.14, 0.28, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.16), pants);
  legR.position.set(0.14, 0.28, 0);
  group.add(legR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  return group;
}

export function createPed(rng, streets) {
  const onVertical = rng.chance(0.5);
  const street = rng.pick(streets);
  const along = rng.range(-WORLD.half + 10, WORLD.half - 10);
  const side = rng.pick([-1, 1]);
  const x = onVertical ? street + side * 8.5 : along;
  const z = onVertical ? along : street + side * 8.5;
  const mesh = makePedMesh(rng);
  mesh.position.set(x, 0, z);
  return {
    mesh,
    x,
    z,
    heading: onVertical ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2),
    speed: rng.range(1.2, 2.4),
    walkPhase: rng.range(0, Math.PI * 2),
    fleeing: false,
  };
}

// Walk one step. The pedestrian tries its heading first; if a
// building blocks it, it sidesteps along the wall, and only then
// turns around. That is the slide.
export function updatePed(ped, dt, colliders, dangerX, dangerZ, dangerNear) {
  let heading = ped.heading;
  let speed = ped.speed;
  if (dangerNear) {
    const dx = ped.x - dangerX;
    const dz = ped.z - dangerZ;
    const d = Math.hypot(dx, dz) || 1;
    heading = Math.atan2(dx / d, dz / d);
    speed = 5.5;
    ped.fleeing = true;
  } else if (ped.fleeing) {
    ped.fleeing = false;
  }
  const tryMove = (hx, hz) => {
    const nx = ped.x + Math.sin(hx) * speed * dt;
    const nz = ped.z + Math.cos(hz) * speed * dt;
    if (Math.abs(nx) > 176 || Math.abs(nz) > 176) return false;
    if (hitsCollider(colliders, nx, nz, 0.7)) return false;
    ped.x = nx;
    ped.z = nz;
    return true;
  };
  if (!tryMove(heading, heading)) {
    // Slide: step sideways along the wall.
    if (!tryMove(heading + Math.PI / 2, heading + Math.PI / 2)) {
      if (!tryMove(heading - Math.PI / 2, heading - Math.PI / 2)) {
        heading += Math.PI;
        ped.heading = heading;
      }
    }
  }
  ped.heading = heading;
  ped.walkPhase += dt * speed * 3.2;
  const swing = Math.sin(ped.walkPhase) * 0.5;
  ped.mesh.userData.legL.rotation.x = swing;
  ped.mesh.userData.legR.rotation.x = -swing;
  ped.mesh.position.set(ped.x, Math.abs(Math.sin(ped.walkPhase)) * 0.05, ped.z);
  ped.mesh.rotation.y = ped.heading;
}

export function spawnPeds(scene, rng, streets, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const ped = createPed(rng, streets);
    scene.add(ped.mesh);
    peds.push(ped);
  }
  return peds;
}
