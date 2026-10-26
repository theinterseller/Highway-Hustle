/* Shared between server (Node) and browser: track layout, traffic, constants. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Shared = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SEG = 200; // segment length (world units)
  const RUMBLE = 3; // segments per kerb stripe
  const ROAD_W = 2000; // half road width
  const LANES = 3;
  const MAX_SPEED = SEG * 60; // world units per second
  const KMH = 220 / MAX_SPEED; // speedo reads 220 km/h at top speed

  // World widths of every sprite (world units). Divide by ROAD_W for road-relative width.
  const SPRITE_W = {
    tree: 1700, palm: 1500, billboard: 2300, milestone: 320, gantry: 4700, dhaba: 2700,
    truck: 1250, auto: 850, car: 1000, cow: 1150, bike: 520,
  };
  const COLLIDES = { tree: 1, palm: 1, billboard: 1, milestone: 1, dhaba: 1 };
  const BILLBOARDS = ['HORN OK PLEASE', 'DHABA 2 KM', 'NH-24', 'CHAI 500 M', 'DRIVE SLOW', 'PUNCTURE SHOP'];

  const mod = (v, m) => ((v % m) + m) % m;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function rng(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const easeIn = (a, b, p) => a + (b - a) * p * p;
  const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);

  function buildTrack() {
    const segs = [];
    const lastY = () => (segs.length ? segs[segs.length - 1].p2.world.y : 0);
    function add(curve, y) {
      const n = segs.length;
      segs.push({
        index: n, curve, sprites: [], cars: [], riders: [],
        p1: { world: { x: 0, y: lastY(), z: n * SEG }, camera: {}, screen: {} },
        p2: { world: { x: 0, y, z: (n + 1) * SEG }, camera: {}, screen: {} },
        dark: Math.floor(n / RUMBLE) % 2 === 1,
      });
    }
    function road(enter, hold, leave, curve, hill) {
      const sy = lastY();
      const ey = sy + hill * SEG;
      const total = enter + hold + leave;
      for (let i = 0; i < enter; i++) add(easeIn(0, curve, i / enter), easeInOut(sy, ey, i / total));
      for (let i = 0; i < hold; i++) add(curve, easeInOut(sy, ey, (enter + i) / total));
      for (let i = 0; i < leave; i++) add(easeInOut(curve, 0, i / leave), easeInOut(sy, ey, (enter + hold + i) / total));
    }

    road(25, 25, 25, 0, 0);
    road(50, 50, 50, 4, 20);
    road(25, 25, 25, -4, 0);
    road(25, 25, 25, 4, -10);
    road(50, 50, 50, 0, 40);
    road(50, 50, 50, 0, -40);
    road(50, 100, 50, -6, 20);
    [5, -2, -5, 8, 5, -7, 5, -2].forEach((h) => road(10, 10, 10, 0, h));
    road(50, 50, 50, 6, -20);
    road(50, 100, 50, 0, 0);
    road(25, 25, 25, -4, 15);
    road(25, 25, 25, 4, -15);
    road(25, 25, 25, -2, 10);
    road(50, 100, 50, 2, -lastY() / SEG);

    segs[0].start = segs[1].start = segs[2].start = true;

    // Scenery, deterministic so every player sees the same highway.
    const r = rng(7);
    segs[3].sprites.push({ kind: 'gantry', x: 0 });
    for (let n = 12; n < segs.length - 6; n += 3 + Math.floor(r() * 4)) {
      const side = r() < 0.5 ? -1 : 1;
      const p = r();
      const kind = p < 0.45 ? 'tree' : p < 0.8 ? 'palm' : 'tree';
      segs[n].sprites.push({ kind, x: side * (1.2 + r() * 1.4) });
      if (r() < 0.35) segs[n].sprites.push({ kind: r() < 0.5 ? 'tree' : 'palm', x: -side * (1.3 + r() * 1.6) });
    }
    for (let n = 40, i = 0; n < segs.length - 10; n += 110 + Math.floor(r() * 60), i++) {
      const side = i % 2 ? -1 : 1;
      if (i % 3 === 2) segs[n].sprites.push({ kind: 'dhaba', x: side * 1.3 });
      else segs[n].sprites.push({ kind: 'billboard', x: side * 1.25, text: i % BILLBOARDS.length });
    }
    for (let n = 30, km = 1; n < segs.length - 5; n += 100, km++) segs[n].sprites.push({ kind: 'milestone', x: 1.08, km });

    return { segs, length: segs.length * SEG };
  }

  function makeTraffic(seed, length, count) {
    const r = rng(seed);
    const lanes = [-0.62, 0, 0.62];
    const out = [];
    for (let i = 0; i < (count || 34); i++) {
      const p = r();
      const type = p < 0.28 ? 'truck' : p < 0.52 ? 'auto' : p < 0.84 ? 'car' : 'cow';
      const speed = { truck: 0.17 + r() * 0.1, auto: 0.14 + r() * 0.1, car: 0.3 + r() * 0.15, cow: 0 }[type] * MAX_SPEED;
      out.push({
        type, speed,
        z0: 5000 + r() * (length - 6000),
        x: lanes[Math.floor(r() * 3)] + (r() - 0.5) * 0.12,
        phase: r() * Math.PI * 2,
        color: Math.floor(r() * 5),
        w: SPRITE_W[type] / ROAD_W,
      });
    }
    return out;
  }

  /** Positions of every traffic object at race time t (seconds). */
  function trafficAt(list, t, length) {
    const tt = Math.max(0, t);
    return list.map((c) => ({
      type: c.type, speed: c.speed, color: c.color, w: c.w,
      z: mod(c.z0 + c.speed * tt, length),
      x: c.type === 'cow' ? clamp(c.x + 0.3 * Math.sin(tt * 0.35 + c.phase), -0.85, 0.85) : c.x,
    }));
  }

  return { SEG, RUMBLE, ROAD_W, LANES, MAX_SPEED, KMH, SPRITE_W, COLLIDES, BILLBOARDS, mod, clamp, rng, buildTrack, makeTraffic, trafficAt };
});
