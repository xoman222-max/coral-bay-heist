// Seeded randomness for Coral Bay Heist.
//
// mulberry32 gives the same city, traffic and screenshot scenes for the same
// seed, which is what makes ?shot=...&seed=N repeatable. Everything else in
// this file is a small helper over one such generator: pick one item, a value
// in a range, a whole number, a coin flip, or a clamped/lerped number.
export function createRandom(seed) {
  let state = seed | 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One element of an array, uniformly.
export function pick(rand, array) {
  return array[Math.floor(rand() * array.length)];
}

// A float in [min, max).
export function range(rand, min, max) {
  return min + rand() * (max - min);
}

// A whole number in [min, max] inclusive.
export function int(rand, min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}

// True with probability p (0..1).
export function chance(rand, p) {
  return rand() < p;
}

export function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Shortest signed angle from a to b, in radians, in (-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Turn `heading` toward `target` by at most `maxStep` radians this call.
export function turnToward(heading, target, maxStep) {
  return heading + clamp(angleDiff(heading, target), -maxStep, maxStep);
}

export function distance2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}
