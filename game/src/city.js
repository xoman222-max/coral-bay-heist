// Coral Bay: a procedural three.js city. Streets on a grid, buildings of many
// heights and colours, lamps, palms, benches, a beach and a pier over the bay,
// and a sun that slides from sunset gold into night. Also owns the collision
// boxes, the pickup spawns, the mission beacon and the particle pool.
import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';
import { pick, range } from './random.js';

const PITCH = CITY.blockSize + CITY.streetWidth; // 48
const HALF = CITY.half;

function lambert(color, opts) {
  return new THREE.MeshLambertMaterial(Object.assign({ color }, opts || {}));
}

export function buildCity(scene, rand) {
  const colliders = [];   // { minX, maxX, minZ, maxZ }
  const pickups = [];     // { mesh, kind, x, z, taken, bob }
  const streetPoints = [];
  const dummy = new THREE.Object3D(); // scratch transform for instanced meshes
  const group = new THREE.Group();
  scene.add(group);

  // --- Ground, roads, sidewalks, beach and bay -------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2 + 220, HALF * 2 + 220),
    lambert(PALETTE.ground),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 40);
  group.add(ground);

  const dashSpots = [];
  const roadMat = lambert(PALETTE.road);
  const walkMat = lambert(PALETTE.sidewalk);
  const streetCoords = [];
  for (let i = -2; i <= 2; i += 1) streetCoords.push(i * PITCH);
  // Road strips (both directions) + centre dashes.
  for (const c of streetCoords) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, CITY.streetWidth), roadMat);
      road.rotation.x = -Math.PI / 2;
      if (horizontal) road.position.set(0, 0, c);
      else { road.rotation.z = Math.PI / 2; road.position.set(c, 0, 0); }
      group.add(road);
      // Dashed centre line (collected, instanced below).
      for (let d = -HALF + 6; d < HALF - 6; d += 12) {
        if (horizontal) dashSpots.push([d, c, 0]);
        else dashSpots.push([c, d, Math.PI / 2]);
      }
    }
    // Sidewalk strips flanking each street.
    for (const off of [-CITY.streetWidth / 2 - 2, CITY.streetWidth / 2 + 2]) {
      for (const horizontal of [true, false]) {
        const walk = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, 4), walkMat);
        walk.rotation.x = -Math.PI / 2;
        if (horizontal) walk.position.set(0, 0.01, c + off);
        else { walk.rotation.z = Math.PI / 2; walk.position.set(c + off, 0.01, 0); }
        group.add(walk);
      }
    }
  }

  // Flush the centre-line dashes into one instanced draw.
  const dashGeo = new THREE.PlaneGeometry(4, 0.5);
  const dashInst = new THREE.InstancedMesh(dashGeo, lambert(0xf5d76e), Math.max(1, dashSpots.length));
  dashSpots.forEach(([x, z, rot], i) => {
    dummy.position.set(x, 0.02, z);
    dummy.rotation.set(-Math.PI / 2, 0, rot);
    dummy.updateMatrix();
    dashInst.setMatrixAt(i, dummy.matrix);
  });
  dashInst.instanceMatrix.needsUpdate = true;
  group.add(dashInst);

  // Beach strip and bay water to the south (positive z).
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 220, 26), lambert(PALETTE.sand));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.0, HALF + 13);
  group.add(sand);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2 + 260, 120),
    new THREE.MeshLambertMaterial({ color: PALETTE.water, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.2, HALF + 86);
  group.add(water);

  // Pier: wooden deck jutting into the bay at x = -48.
  const pierMat = lambert(PALETTE.pier);
  const pier = new THREE.Mesh(new THREE.BoxGeometry(8, 0.6, 46), pierMat);
  pier.position.set(-48, 0.4, HALF + 34);
  group.add(pier);
  colliders.push({ minX: -52, maxX: -44, minZ: HALF + 11, maxZ: HALF + 57, low: true });
  for (let i = 0; i < 5; i += 1) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.4, 6), pierMat);
    post.position.set(-51.5 + (i % 2) * 7, 0.4, HALF + 16 + i * 9);
    group.add(post);
  }

  // --- Buildings --------------------------------------------------------------
  // Windows are InstancedMeshes (one for lit, one for dark): 2500 separate
  // window meshes would cost hundreds of draw calls; two instanced draws do it.
  const windowLitMat = new THREE.MeshBasicMaterial({ color: PALETTE.windowLit });
  const windowDarkMat = new THREE.MeshBasicMaterial({ color: PALETTE.windowDark });
  const litWindows = [];
  const darkWindows = [];
  function addWindow(x, y, z, rotY) {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, rotY, 0);
    dummy.updateMatrix();
    (rand() < 0.45 ? litWindows : darkWindows).push(dummy.matrix.clone());
  }
  const buildings = new THREE.Group();
  group.add(buildings);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  // Parcels are the land BETWEEN streets: streets run at multiples of 48, so
  // parcels are centred at -120, -72, -24, 24, 72, 120. Buildings used to sit
  // on the street coordinates themselves and their corners jutted into the
  // road, trapping traffic and police; parcels keep every road clear.
  // The southern row is skipped: that edge is the beach and the pier.
  for (let px = 0; px < 6; px += 1) {
    for (let pz = 0; pz < 5; pz += 1) {
      const cx = -120 + px * PITCH;
      const cz = -120 + pz * PITCH;
      // Four buildings per parcel, leaving a small plaza gap in the middle.
      for (const [ox, oz] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) {
        const w = range(rand, 10, 13);
        const d = range(rand, 10, 13);
        const downtown = Math.abs(cx) <= 24 && Math.abs(cz) <= 24;
        const h = range(rand, CITY.buildingMin, CITY.buildingMax) * (downtown ? 1.6 : 1);
        const color = pick(rand, PALETTE.building);
        const mesh = new THREE.Mesh(boxGeo, lambert(color));
        mesh.scale.set(w, h, d);
        mesh.position.set(cx + ox, h / 2, cz + oz);
        buildings.add(mesh);
        // Roof rim.
        const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6), lambert(0x2e3440));
        rim.position.set(cx + ox, h + 0.25, cz + oz);
        buildings.add(rim);
        // Lit / dark windows on all four faces, as instanced quads.
        const floors = Math.max(2, Math.floor(h / 4));
        for (let f = 0; f < floors; f += 1) {
          for (let k = 0; k < 2; k += 1) {
            const wx = cx + ox - w / 2 + 3 + k * (w - 6);
            const wz = cz + oz - d / 2 + 3 + k * (d - 6);
            addWindow(wx, 2.5 + f * 4, cz + oz + d / 2 + 0.06, 0);
            addWindow(wx, 2.5 + f * 4, cz + oz - d / 2 - 0.06, Math.PI);
            addWindow(cx + ox + w / 2 + 0.06, 2.5 + f * 4, wz, Math.PI / 2);
            addWindow(cx + ox - w / 2 - 0.06, 2.5 + f * 4, wz, -Math.PI / 2);
          }
        }
        colliders.push({
          minX: cx + ox - w / 2, maxX: cx + ox + w / 2,
          minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2,
        });
      }
      // A palm or two in each block plaza.
      const palm = makePalm(rand);
      palm.position.set(cx + range(rand, -3, 3), 0, cz + range(rand, -3, 3));
      group.add(palm);
    }
  }

  // Flush the collected windows into two instanced draws.
  const winGeo = new THREE.PlaneGeometry(1.6, 1.8);
  for (const [list, mat] of [[litWindows, windowLitMat], [darkWindows, windowDarkMat]]) {
    const inst = new THREE.InstancedMesh(winGeo, mat, Math.max(1, list.length));
    list.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.instanceMatrix.needsUpdate = true;
    buildings.add(inst);
  }

  // --- Street lamps, palms along the roads, benches ----------------------------
  const lampHeads = [];
  const lampMat = lambert(0x3a3f4a);
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: PALETTE.lamp });
  let lampCount = 0;
  for (const c of streetCoords) {
    for (let d = -HALF + 10; d < HALF - 8; d += 32) {
      for (const [x, z] of [[c + 8, d], [d, c - 8]]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.5, 6), lampMat);
        pole.position.set(x, 2.75, z);
        group.add(pole);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lampGlowMat);
        head.position.set(x, 5.6, z);
        group.add(head);
        lampHeads.push(head);
        // Only every sixth lamp gets a real point light: 80 lights would stall the frame.
        lampCount += 1;
        if (lampCount % 16 === 0) {
          const light = new THREE.PointLight(0xffd9a0, 0, 26, 1.6);
          light.position.set(x, 5.4, z);
          group.add(light);
          lampHeads.push(light);
        }
      }
    }
  }
  for (let i = 0; i < 14; i += 1) {
    const palm = makePalm(rand);
    const along = range(rand, -HALF + 8, HALF - 8);
    const street = pick(rand, streetCoords);
    if (rand() < 0.5) palm.position.set(along, 0, street + 8.5);
    else palm.position.set(street + 8.5, 0, along);
    group.add(palm);
  }
  const benchMat = lambert(0x8b5a2b);
  for (let i = 0; i < 14; i += 1) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.8), benchMat);
    const street = pick(rand, streetCoords);
    const along = range(rand, -HALF + 10, HALF - 10);
    if (rand() < 0.5) bench.position.set(along, 0.45, street + 9.5);
    else { bench.position.set(street + 9.5, 0.45, along); bench.rotation.y = Math.PI / 2; }
    group.add(bench);
  }

  // --- Pickups: ammo crates, health kits, armour vests ------------------------
  const pickupDefs = [
    { kind: 'ammo', color: 0xffc93c, label: 'AMMO' },
    { kind: 'health', color: 0x37d67a, label: 'HEALTH' },
    { kind: 'armor', color: 0x57b6ff, label: 'ARMOR' },
  ];
  for (let i = 0; i < 18; i += 1) {
    const def = pickupDefs[i % 3];
    const street = pick(rand, streetCoords);
    const along = range(rand, -HALF + 12, HALF - 12);
    const x = rand() < 0.5 ? along : street + 9;
    const z = rand() < 0.5 ? street + 9 : along;
    const mesh = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), lambert(def.color));
    box.position.y = 0.9;
    mesh.add(box);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.08, 6, 20),
      new THREE.MeshBasicMaterial({ color: def.color }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.25;
    mesh.add(ring);
    mesh.position.set(x, 0, z);
    group.add(mesh);
    pickups.push({ mesh, kind: def.kind, x, z, taken: false, bob: rand() * 6 });
  }

  // --- Mission beacon ----------------------------------------------------------
  const beacon = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  beacon.add(beam);
  const beaconRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.18, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  beaconRing.rotation.x = Math.PI / 2;
  beaconRing.position.y = 0.3;
  beacon.add(beaconRing);
  beacon.visible = false;
  scene.add(beacon);

  // --- Particles: one pool of small boxes, reused for sparks / smoke / muzzle --
  const particlePool = [];
  const particleGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  for (let i = 0; i < 90; i += 1) {
    const m = new THREE.Mesh(particleGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    m.visible = false;
    scene.add(m);
    particlePool.push({ mesh: m, vel: new THREE.Vector3(), life: 0, maxLife: 1, gravity: 0 });
  }
  let particleCursor = 0;
  function spawnParticles(x, y, z, color, count, speed, life, gravity) {
    for (let i = 0; i < count; i += 1) {
      const p = particlePool[particleCursor];
      particleCursor = (particleCursor + 1) % particlePool.length;
      p.mesh.visible = true;
      p.mesh.material.color.setHex(color);
      p.mesh.position.set(x, y, z);
      p.vel.set((rand() - 0.5) * speed, rand() * speed * 0.7 + 1, (rand() - 0.5) * speed);
      p.life = life * (0.6 + rand() * 0.7);
      p.maxLife = p.life;
      p.gravity = gravity;
    }
  }

  // --- Lights and sky ----------------------------------------------------------
  const sun = new THREE.DirectionalLight(0xffb36b, 1.6);
  sun.position.set(80, 60, -40);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0x9db8dd, 0x3a2f28, 0.7);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0x2a1e33, 120, 420);

  function setTimeOfDay(hours) {
    // hours 0..24; sunset ~18.5, night after 20. Sun elevation follows a sine.
    const t = ((hours - 6) / 12) * Math.PI; // 6h sunrise, 18h sunset
    const elev = Math.sin(t);
    const day = Math.max(0, Math.min(1, elev * 1.6 + 0.25));
    const dusk = Math.max(0, 1 - Math.abs(elev) * 3) * (hours > 12 ? 1 : 0.4);
    const sky = new THREE.Color(PALETTE.skyDay).lerp(new THREE.Color(PALETTE.skyNight), 1 - day);
    sky.lerp(new THREE.Color(PALETTE.skyDusk), dusk * 0.7);
    scene.background = sky;
    scene.fog.color.copy(sky);
    sun.intensity = 1.35 + day * 2.0;
    sun.color.setHex(dusk > 0.4 ? 0xff8c4a : 0xfff2d0);
    sun.position.set(Math.cos(t) * 120, Math.max(12, elev * 120 + 20), -60);
    hemi.intensity = 0.9 + day * 0.6;
    const lampOn = day < 0.45;
    for (const head of lampHeads) {
      if (head.isPointLight) head.intensity = lampOn ? 14 : 0;
      else head.material.color.setHex(lampOn ? PALETTE.lamp : 0x555a66);
    }
  }

  function isBlocked(x, z, r) {
    if (Math.abs(x) > HALF + 20 || Math.abs(z) > HALF + 55) return true;
    for (const c of colliders) {
      if (c.low) continue;
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
    }
    return false;
  }

  function update(dt, time, hours) {
    setTimeOfDay(hours);
    beaconRing.rotation.z += dt * 1.5;
    beam.material.opacity = 0.2 + Math.sin(time * 3) * 0.08;
    for (const p of pickups) {
      if (p.taken) continue;
      p.mesh.children[0].position.y = 0.9 + Math.sin(time * 2 + p.bob) * 0.25;
      p.mesh.children[0].rotation.y += dt * 1.5;
    }
    for (const p of particlePool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; continue; }
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const s = Math.max(0.1, p.life / p.maxLife);
      p.mesh.scale.setScalar(s);
    }
    water.position.y = -0.2 + Math.sin(time * 0.8) * 0.08;
  }

  // Street points for traffic / pedestrian spawns.
  for (const c of streetCoords) {
    for (let d = -HALF + 10; d < HALF - 8; d += 24) {
      streetPoints.push({ x: c, z: d, alongZ: true });
      streetPoints.push({ x: d, z: c, alongZ: false });
    }
  }

  return {
    colliders, pickups, streetPoints, beacon, streetCoords,
    isBlocked, update, setTimeOfDay, spawnParticles,
    sparks(x, y, z) { spawnParticles(x, y, z, 0xffc93c, 12, 9, 0.6, 12); },
    smoke(x, y, z) { spawnParticles(x, y, z, 0x555555, 6, 3, 1.4, -1.5); },
    muzzle(x, y, z) { spawnParticles(x, y, z, 0xffe27a, 6, 6, 0.12, 0); },
    blood(x, y, z) { spawnParticles(x, y, z, 0xc0392b, 10, 7, 0.5, 14); },
  };
}

function makePalm(rand) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.3, range(rand, 4, 6.5), 6),
    lambert(PALETTE.trunk),
  );
  trunk.position.y = trunk.geometry.parameters.height / 2;
  trunk.rotation.z = (rand() - 0.5) * 0.2;
  g.add(trunk);
  const topY = trunk.geometry.parameters.height;
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.7), lambert(PALETTE.leaf));
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.1, topY + 0.2, Math.sin(a) * 1.1);
    leaf.rotation.y = -a;
    leaf.rotation.z = 0.5;
    g.add(leaf);
  }
  return g;
}
