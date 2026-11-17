// Coral Bay Heist — the city itself.
// One seeded pass builds the whole map: ground, roads, sidewalks,
// buildings by district, the harbor, the casino strip, palms and
// streetlights. It also hands back the collision boxes and the
// landmark spots the missions and the traffic need.

import * as THREE from 'three';
import { WORLD, PALETTE } from './config.js';

const STREET_LINES = [-162, -108, -54, 0, 54, 108, 162];
const BLOCK_CENTERS = [-135, -81, -27, 27, 81, 135];

// A facade texture drawn once on a canvas: dark wall, a grid of
// windows, a few of them lit. Tinting the material changes the
// building colour while the windows stay put.
function makeWindowTexture(rng, warm) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#5a5a58';
  ctx.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 12; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const lit = rng.chance(0.42);
      ctx.fillStyle = lit ? (warm ? '#ffd98a' : '#bfe3ff') : '#23282e';
      ctx.fillRect(8 + col * 20, 10 + row * 20, 12, 12);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// The centre dashes are real geometry — one instanced mesh for the
// whole city — because a dashed texture shimmers into moiré stripes
// when a road is viewed at a grazing angle.
function makeDashes(group) {
  const geo = new THREE.BoxGeometry(0.35, 0.02, 3.2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xe8e4d8 });
  const spots = [];
  for (const x of STREET_LINES) {
    for (let z = -WORLD.half; z <= WORLD.half; z += 12) spots.push({ x, z, rotY: 0 });
  }
  for (const z of STREET_LINES) {
    for (let x = -WORLD.half; x <= WORLD.half; x += 12) spots.push({ x, z, rotY: Math.PI / 2 });
  }
  const dashes = new THREE.InstancedMesh(geo, mat, spots.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  spots.forEach((p, i) => {
    q.setFromAxisAngle(up, p.rotY);
    m4.compose(new THREE.Vector3(p.x, 0.03, p.z), q, new THREE.Vector3(1, 1, 1));
    dashes.setMatrixAt(i, m4);
  });
  group.add(dashes);
}

function box(w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

// True when the point is inside any building box (with a margin).
export function hitsCollider(colliders, x, z, margin) {
  for (let i = 0; i < colliders.length; i += 1) {
    const c = colliders[i];
    if (x > c.minX - margin && x < c.maxX + margin && z > c.minZ - margin && z < c.maxZ + margin) {
      return c;
    }
  }
  return null;
}

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  const colliders = [];
  const half = WORLD.half;

  const warmTex = makeWindowTexture(rng, true);
  const coolTex = makeWindowTexture(rng, false);

  const groundMat = new THREE.MeshLambertMaterial({ color: PALETTE.sand });
  const grassMat = new THREE.MeshLambertMaterial({ color: PALETTE.grass });
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const waterMat = new THREE.MeshLambertMaterial({ color: PALETTE.water });

  // Ground, grass fringe and the sea on the west edge.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(760, 760), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  group.add(ground);
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(760, 60), grassMat);
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(0, -0.02, half + 34);
  group.add(lawn);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(180, 760), waterMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-half - 92, 0.0, 0);
  group.add(sea);

  // Roads: one long strip per street line, both directions.
  const roadLen = half * 2 + 40;
  for (const x of STREET_LINES) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.street, roadLen), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.01, 0);
    group.add(road);
  }
  for (const z of STREET_LINES) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, WORLD.street), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.rotation.z = Math.PI / 2;
    road.position.set(0, 0.015, z);
    group.add(road);
  }
  makeDashes(group);
  // Sidewalks: pale strips flanking every road.
  for (const x of STREET_LINES) {
    for (const side of [-1, 1]) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(3, roadLen), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(x + side * (WORLD.street / 2 + 1.5), 0.02, 0);
      group.add(walk);
    }
  }
  for (const z of STREET_LINES) {
    for (const side of [-1, 1]) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, 3), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(0, 0.025, z + side * (WORLD.street / 2 + 1.5));
      group.add(walk);
    }
  }

  // Buildings, one or two per block, by district.
  const downtownMat = new THREE.MeshLambertMaterial({ color: PALETTE.buildingDowntown, map: coolTex });
  const resMat = new THREE.MeshLambertMaterial({ color: PALETTE.building, map: warmTex });
  const wareMat = new THREE.MeshLambertMaterial({ color: PALETTE.warehouse, map: warmTex });
  const casinoMat = new THREE.MeshLambertMaterial({ color: PALETTE.casino, map: warmTex });
  const neonPink = new THREE.MeshBasicMaterial({ color: PALETTE.neonPink });
  const neonTeal = new THREE.MeshBasicMaterial({ color: PALETTE.neonTeal });
  const neonGold = new THREE.MeshBasicMaterial({ color: PALETTE.neonGold });

  const addBuilding = (cx, cz, w, d, h, mat) => {
    const mesh = box(w, h, d, mat, cx, h / 2, cz);
    group.add(mesh);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    return mesh;
  };

  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      const isCasinoBlock = bx === -27 && bz === 135;
      const isWarehouseBlock = bx === 135 && bz === -27;
      const downtown = Math.abs(bx) < 60 && Math.abs(bz) < 60;
      const warehouseDistrict = bx >= 108;
      const casinoStrip = bz >= 108;
      if (isCasinoBlock) {
        addBuilding(bx, bz, 34, 30, 18, casinoMat);
        const sign = box(20, 3, 1.2, neonPink, bx, 20, bz - 15.6);
        group.add(sign);
        const sign2 = box(1.2, 3, 12, neonTeal, bx + 17.6, 19, bz);
        group.add(sign2);
      } else if (isWarehouseBlock) {
        addBuilding(bx, bz, 36, 26, 9, wareMat);
        const sign = box(16, 2, 1, neonGold, bx, 10.2, bz - 13.5);
        group.add(sign);
      } else if (warehouseDistrict) {
        addBuilding(bx, bz, rng.range(26, 34), rng.range(20, 28), rng.range(7, 11), wareMat);
      } else if (casinoStrip) {
        addBuilding(bx, bz, rng.range(22, 30), rng.range(18, 26), rng.range(12, 20), casinoStrip && rng.chance(0.5) ? casinoMat : resMat);
        if (rng.chance(0.6)) {
          const sign = box(rng.range(8, 14), 1.6, 1, rng.pick([neonPink, neonTeal, neonGold]), bx, rng.range(13, 18), bz - 13);
          group.add(sign);
        }
      } else if (downtown) {
        const h = rng.range(14, 30);
        addBuilding(bx, bz, rng.range(20, 28), rng.range(20, 28), h, downtownMat);
        if (rng.chance(0.5)) {
          addBuilding(bx + rng.range(-8, 8), bz + rng.range(-8, 8), rng.range(8, 12), rng.range(8, 12), rng.range(4, 8), resMat);
        }
      } else {
        addBuilding(bx, bz, rng.range(18, 28), rng.range(18, 28), rng.range(6, 14), resMat);
        if (rng.chance(0.4)) {
          addBuilding(bx + rng.range(-9, 9), bz + rng.range(-9, 9), rng.range(8, 12), rng.range(8, 12), rng.range(4, 7), resMat);
        }
      }
    }
  }

  // The harbor dock: planks reaching into the sea, and the getaway boat.
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x8a6b46 });
  const dock = box(22, 1, 6, dockMat, -half - 9, 0.5, -108);
  group.add(dock);
  const boatMat = new THREE.MeshLambertMaterial({ color: 0xf2f2ee });
  const boat = box(10, 2.4, 4, boatMat, -half - 22, 1.2, -108);
  group.add(boat);
  const boatTop = box(5, 1.6, 3, new THREE.MeshLambertMaterial({ color: PALETTE.neonTeal }), -half - 22, 3, -108);
  group.add(boatTop);

  // Palms along the harbor edge and a few on the south lawn.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5c38 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  const addPalm = (x, z) => {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
    trunk.position.set(x, 3.5, z);
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3.4, 7), leafMat);
    crown.position.set(x, 8.4, z);
    group.add(crown);
  };
  for (let z = -160; z <= 160; z += 40) {
    addPalm(-half - 4 + rng.range(-2, 2), z + rng.range(-6, 6));
  }
  for (let i = 0; i < 8; i += 1) {
    addPalm(rng.range(-160, 160), half + 18 + rng.range(0, 22));
  }

  // Streetlights at every other intersection.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x22262b });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const x of STREET_LINES) {
    for (const z of STREET_LINES) {
      if ((x + z) % 108 !== 0) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), poleMat);
      pole.position.set(x + 8.5, 3.5, z + 8.5);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lampMat);
      lamp.position.set(x + 8.5, 7.2, z + 8.5);
      group.add(lamp);
    }
  }

  scene.add(group);

  return {
    group,
    colliders,
    streets: STREET_LINES.slice(),
    spawn: { x: 0, z: -6, heading: 0 },
    casino: { x: -27, z: 135 },
    warehouse: { x: 135, z: -27 },
    harbor: { x: -168, z: -108 },
    // Every street intersection, for traffic routes and patrols.
    intersections() {
      const pts = [];
      for (const x of STREET_LINES) {
        for (const z of STREET_LINES) pts.push({ x, z });
      }
      return pts;
    },
  };
}
