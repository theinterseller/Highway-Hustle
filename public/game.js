/* Highway Hustle client */
(function () {
  'use strict';
  const S = window.Shared;
  const SP = window.Sprites;
  const { SEG, ROAD_W, LANES, MAX_SPEED: MAX, KMH, SPRITE_W, COLLIDES, mod, clamp } = S;
  const TRACK = S.buildTrack();
  const segs = TRACK.segs;
  const L = TRACK.length;

  const FOV = 100;
  const CAM_DEPTH = 1 / Math.tan(((FOV / 2) * Math.PI) / 180);
  // Camera presets: 'high' looks down on the road from above, 'low' is the classic chase view.
  const CAMS = {
    high: { h: 1900, horizon: 0.34, bottom: 0.9 },
    low: { h: 1000, horizon: 0.5, bottom: 0.98 },
  };
  let CAM_H, HORIZON, PLAYER_Z, camMode;
  function setCamera(mode) {
    camMode = CAMS[mode] ? mode : 'high';
    const c = CAMS[camMode];
    CAM_H = c.h;
    HORIZON = c.horizon;
    // place the player's bike at c.bottom of the screen height
    PLAYER_Z = (CAM_DEPTH * CAM_H) / (2 * (c.bottom - c.horizon));
  }
  const DRAW_DIST = 200;
  const FOG_DENSITY = 4;
  const ACCEL = MAX / 5;
  const BRAKE = -MAX;
  const DECEL = -MAX / 5;
  const OFFROAD_DECEL = -MAX / 2;
  const OFFROAD_LIMIT = MAX / 4;
  const CENTRIFUGAL = 0.3;
  const BIKE_W = SPRITE_W.bike / ROAD_W;

  const COL = {
    light: { road: '#616167', grass: '#8f9c45', rumble: '#f2c200', lane: '#e9e9e9', shoulder: '#a58b5e', edge: '#e9e9e9' },
    dark: { road: '#5a5a60', grass: '#84903e', rumble: '#1e1e1e', shoulder: '#9b8256', edge: '#e9e9e9' },
    start: { road: '#f4f4f4', grass: '#8f9c45', rumble: '#f4f4f4', shoulder: '#a58b5e' },
    fog: '#e3a07c',
  };
  const tint = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  };
  (function textureSegments() {
    const r = S.rng(3);
    let wear = 0;
    segs.forEach((sg) => {
      wear += (r() - 0.5) * 4;
      wear = clamp(wear, -8, 8);
      const n = wear + (r() - 0.5) * 5;
      const g = (r() - 0.5) * 14;
      const base = sg.start ? COL.start : sg.dark ? COL.dark : COL.light;
      sg.col = {
        road: sg.start ? base.road : tint(base.road, n),
        grass: tint(base.grass, g + (sg.index % 7 === 0 ? -10 : 0)),
        rumble: base.rumble, lane: base.lane, edge: base.edge,
        shoulder: tint(base.shoulder, g * 0.7),
      };
    });
  })();

  /* ---------- DOM ---------- */
  const $ = (s) => document.querySelector(s);
  const canvas = $('#game');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const k = Math.min(1, 1280 / (innerWidth * dpr));
    W = canvas.width = Math.round(innerWidth * dpr * k);
    H = canvas.height = Math.round(innerHeight * dpr * k);
  }
  addEventListener('resize', resize);
  resize();

  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
    del: (k) => { try { localStorage.removeItem(k); } catch {} },
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let toastT;
  function toast(m) {
    const t = $('#toast');
    t.textContent = m;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 3000);
  }
  function show(id) {
    ['#home', '#lobby', '#results'].forEach((s) => ($(s).hidden = s !== id));
    document.body.classList.toggle('racing', id === null);
  }

  /* ---------- audio ---------- */
  let soundOn = store.get('hh_sound') !== 'off';
  let ac = null, engOsc = null, engGain = null;
  function audioInit() {
    if (ac) return;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      engOsc = ac.createOscillator();
      const filt = ac.createBiquadFilter();
      engGain = ac.createGain();
      engOsc.type = 'sawtooth';
      filt.type = 'lowpass';
      filt.frequency.value = 900;
      engGain.gain.value = 0;
      engOsc.connect(filt).connect(engGain).connect(ac.destination);
      engOsc.start();
    } catch { ac = null; }
  }
  function sfx(freq, dur, type = 'square', vol = 0.08, slide = 0) {
    if (!soundOn || !ac) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ac.currentTime + dur);
    g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + dur);
  }
  function setSoundBtn() {
    $('#btnSound').textContent = soundOn ? '🔊' : '🔇';
    $('#btnSound').setAttribute('aria-label', soundOn ? 'Mute sound' : 'Unmute sound');
  }
  $('#btnSound').onclick = () => {
    soundOn = !soundOn;
    store.set('hh_sound', soundOn ? 'on' : 'off');
    setSoundBtn();
    audioInit();
  };
  setSoundBtn();

  setCamera(store.get('hh_cam') || 'high');
  function setCamBtn() {
    $('#btnCam').textContent = camMode === 'high' ? '🚁' : '🏍️';
    $('#btnCam').setAttribute('aria-label', camMode === 'high' ? 'Camera: high view. Tap for low view' : 'Camera: low view. Tap for high view');
  }
  $('#btnCam').onclick = () => {
    setCamera(camMode === 'high' ? 'low' : 'high');
    store.set('hh_cam', camMode);
    setCamBtn();
    toast(camMode === 'high' ? 'High camera: more road ahead.' : 'Low camera: classic chase view.');
  };
  addEventListener('keydown', (e) => { if (e.code === 'KeyC' && !(e.target && /INPUT/.test(e.target.tagName))) $('#btnCam').click(); });
  setCamBtn();

  /* ---------- input ---------- */
  const keys = { left: false, right: false, up: false, down: false };
  const touchMode = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  document.body.classList.toggle('touch', touchMode);
  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };
  addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; if (race) e.preventDefault(); }
    if (!e.repeat && (e.code === 'KeyZ' || e.code === 'KeyJ')) punch('l');
    if (!e.repeat && (e.code === 'KeyX' || e.code === 'KeyK')) punch('r');
  });
  addEventListener('keyup', (e) => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false; });
  addEventListener('blur', () => Object.keys(keys).forEach((k) => (keys[k] = false)));
  document.querySelectorAll('[data-key]').forEach((b) => {
    const k = b.dataset.key;
    const on = (e) => { e.preventDefault(); audioInit(); if (k === 'pl') punch('l'); else if (k === 'pr') punch('r'); else keys[k] = true; b.classList.add('on'); };
    const off = (e) => { e.preventDefault(); if (keys[k] !== undefined) keys[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('pointerleave', off);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  /* ---------- game state ---------- */
  let race = null; // current race
  let D = 0; // my total distance
  let px = 0; // my x (-1..1 is road)
  let speed = 0;
  let crashedUntil = 0;
  let myPunch = null;
  let nextPunchAt = 0;
  let finished = false;
  let bgOffset = 0;
  let shake = 0;
  let flash = 0;
  const attractTraffic = S.makeTraffic(42, L);
  let traffic = attractTraffic;
  let trafficNow = [];
  let clockOffset = 0;
  const remotes = new Map(); // id -> latest snapshot data
  let feed = [];
  const now = () => Date.now() + clockOffset;

  function punch(side) {
    if (!race || finished) return;
    const t = now();
    if (t < race.startAt || t < crashedUntil || t < nextPunchAt) return;
    nextPunchAt = t + 400;
    myPunch = { side, at: t };
    socket.emit('punch', side);
    sfx(240, 0.12, 'triangle', 0.08, -120);
  }

  function crash(fromTraffic) {
    if (now() < crashedUntil) return;
    crashedUntil = now() + 2000;
    speed = 0;
    shake = 1;
    flash = 0.6;
    sfx(120, 0.4, 'sawtooth', 0.12, -80);
    if (fromTraffic) socket.emit('crash');
  }

  /* ---------- update ---------- */
  const segAt = (z) => segs[Math.floor(mod(z, L) / SEG) % segs.length];
  const overlap = (x1, w1, x2, w2) => Math.abs(x1 - x2) < ((w1 + w2) / 2) * 0.78;

  function update(dt) {
    const t = now();
    const attract = !race;
    const raceT = race ? (t - race.startAt) / 1000 : t / 1000;
    trafficNow = S.trafficAt(traffic, attract ? raceT % 1000 : raceT, L);

    const pz = mod(D, L);
    const pSeg = segAt(pz);
    const sp = speed / MAX;
    const before = D;

    if (attract) {
      speed = MAX * 0.55;
      px += (0 - px) * dt;
    } else if (t < race.startAt) {
      speed = 0;
    } else if (t < crashedUntil) {
      speed = Math.max(0, speed - MAX * dt);
    } else {
      const dx = dt * 2 * sp;
      if (keys.left) px -= dx;
      if (keys.right) px += dx;
      px -= dx * sp * pSeg.curve * CENTRIFUGAL;
      const gas = touchMode ? !keys.down : keys.up;
      if (finished) speed += DECEL * dt * 1.5;
      else if (keys.down) speed += BRAKE * dt;
      else if (gas) speed += ACCEL * dt;
      else speed += DECEL * dt;

      if (px < -1 || px > 1) {
        if (speed > OFFROAD_LIMIT) speed += OFFROAD_DECEL * dt;
        for (const s of pSeg.sprites) {
          if (!COLLIDES[s.kind]) continue;
          const w = SPRITE_W[s.kind] / ROAD_W;
          const cx = s.x + (s.x > 0 ? w / 2 : -w / 2);
          if (overlap(px, BIKE_W, cx, w * 0.6)) {
            if (speed > MAX * 0.25) crash(true);
            else { speed = MAX / 8; D -= 40; }
            break;
          }
        }
      }
      for (const c of trafficNow) {
        let dz = c.z - pz;
        if (dz > L / 2) dz -= L;
        if (dz < -L / 2) dz += L;
        if (dz > -40 && dz < 200 && speed > c.speed && overlap(px, BIKE_W, c.x, c.w)) {
          if (speed > MAX * 0.42) crash(true);
          else { speed = c.speed * 0.6; D -= 60; sfx(160, 0.08, 'square', 0.05); }
          break;
        }
      }
      px = clamp(px, -2.3, 2.3);
      speed = clamp(speed, 0, MAX);
    }

    D += speed * dt;
    bgOffset += (pSeg.curve * (D - before)) / SEG / 1000;

    if (race && !finished && D >= race.laps * L) {
      finished = true;
      socket.emit('finish');
      const place = placeOf(race.me) || 1;
      $('#banner').textContent = `Finished P${place}`;
      $('#banner').hidden = false;
      sfx(660, 0.2, 'triangle', 0.1);
      setTimeout(() => sfx(990, 0.35, 'triangle', 0.1), 180);
    }

    shake = Math.max(0, shake - dt * 2.5);
    flash = Math.max(0, flash - dt * 1.5);

    if (engGain && ac) {
      const target = soundOn && race ? 0.025 + 0.02 * (speed / MAX) : 0;
      engGain.gain.setTargetAtTime(target, ac.currentTime, 0.08);
      engOsc.frequency.setTargetAtTime(55 + (speed / MAX) * 170, ac.currentTime, 0.05);
    }
  }

  /* ---------- render ---------- */
  function project(p, camX, camY, camZ) {
    p.camera.x = p.world.x - camX;
    p.camera.y = p.world.y - camY;
    p.camera.z = p.world.z - camZ;
    p.screen.scale = CAM_DEPTH / p.camera.z;
    p.screen.x = Math.round(W / 2 + (p.screen.scale * p.camera.x * W) / 2);
    p.screen.y = Math.round(H * HORIZON - (p.screen.scale * p.camera.y * H) / 2);
    p.screen.w = Math.round((p.screen.scale * ROAD_W * W) / 2);
  }
  function poly(x1, y1, x2, y2, x3, y3, x4, y4, c) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  }
  function drawSegment(x1, y1, w1, x2, y2, w2, fog, col) {
    const r1 = w1 / 9, r2 = w2 / 9, l1 = w1 / 40, l2 = w2 / 40, s1 = w1 / 3.5, s2 = w2 / 3.5;
    ctx.fillStyle = col.grass;
    ctx.fillRect(0, y2, W, y1 - y2 + 1);
    poly(x1 - w1 - r1 - s1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2 - s2, y2, col.shoulder);
    poly(x1 + w1 + r1 + s1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2 + s2, y2, col.shoulder);
    poly(x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, col.rumble);
    poly(x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, col.rumble);
    poly(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, col.road);
    if (col.edge) {
      const e1 = w1 / 60, e2 = w2 / 60, i1 = w1 / 30, i2 = w2 / 30;
      poly(x1 - w1 + i1, y1, x1 - w1 + i1 + e1, y1, x2 - w2 + i2 + e2, y2, x2 - w2 + i2, y2, col.edge);
      poly(x1 + w1 - i1, y1, x1 + w1 - i1 - e1, y1, x2 + w2 - i2 - e2, y2, x2 + w2 - i2, y2, col.edge);
    }
    if (col.lane) {
      const lw1 = (w1 * 2) / LANES, lw2 = (w2 * 2) / LANES;
      let lx1 = x1 - w1 + lw1, lx2 = x2 - w2 + lw2;
      for (let i = 1; i < LANES; i++, lx1 += lw1, lx2 += lw2) poly(lx1 - l1 / 2, y1, lx1 + l1 / 2, y1, lx2 + l2 / 2, y2, lx2 - l2 / 2, y2, col.lane);
    }
    if (fog < 1) {
      ctx.globalAlpha = 1 - fog;
      ctx.fillStyle = COL.fog;
      ctx.fillRect(0, y2, W, y1 - y2 + 1);
      ctx.globalAlpha = 1;
    }
  }
  function drawSprite(img, worldW, scale, x, y, offX, offY, clipY, rot, alpha) {
    const dw = (worldW * scale * W) / 2;
    const dh = dw * (img.height / img.width);
    if (dw < 1 || dw > W * 3) return null;
    const dx = x + dw * offX;
    const dy = y + dh * offY;
    const clipH = clipY ? Math.max(0, dy + dh - clipY) : 0;
    if (clipH >= dh) return null;
    if (rot || alpha !== undefined) {
      ctx.save();
      if (alpha !== undefined) ctx.globalAlpha = alpha;
      ctx.translate(dx + dw / 2, dy + dh);
      ctx.rotate(rot || 0);
      ctx.drawImage(img, -dw / 2, -dh, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(img, 0, 0, img.width, img.height - (img.height * clipH) / dh, dx, dy, dw, dh - clipH);
    }
    return { x: dx, y: dy, w: dw, h: dh };
  }

  function drawBackground() {
    const hz = H * (HORIZON + 0.02);
    const g = ctx.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, '#3a2a6b');
    g.addColorStop(0.45, '#b9567a');
    g.addColorStop(0.8, '#f29a6b');
    g.addColorStop(1, '#ffd29a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const sx = W * 0.66, sy = H * 0.41, sr = H * 0.085;
    const sg = ctx.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 3.2);
    sg.addColorStop(0, 'rgba(255,236,190,0.95)');
    sg.addColorStop(0.3, 'rgba(255,200,140,0.35)');
    sg.addColorStop(1, 'rgba(255,170,120,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx - sr * 3.2, sy - sr * 3.2, sr * 6.4, sr * 6.4);
    ctx.fillStyle = '#fff1cf';
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    const layer = (img, k, y, h, alpha) => {
      const off = mod(bgOffset * k * W * 40, W);
      if (alpha !== undefined) ctx.globalAlpha = alpha;
      ctx.drawImage(img, -off, y, W, h);
      ctx.drawImage(img, W - off, y, W, h);
      ctx.globalAlpha = 1;
    };
    layer(SP.clouds, 0.15, H * 0.04, H * 0.3, 0.9);
    layer(SP.hillsFar, 0.3, hz - H * 0.27, H * 0.3, 0.75);
    layer(SP.hillsNear, 0.55, hz - H * 0.2, H * 0.24);
    layer(SP.treeline, 0.9, hz - H * 0.075, H * 0.085);
    const haze = ctx.createLinearGradient(0, hz - H * 0.08, 0, hz + 2);
    haze.addColorStop(0, 'rgba(240,170,130,0)');
    haze.addColorStop(1, 'rgba(240,170,130,0.55)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, hz - H * 0.08, W, H * 0.08 + 2);
    ctx.fillStyle = COL.light.grass;
    ctx.fillRect(0, hz, W, H);
  }

  function placeDynamic(baseIndex) {
    for (let n = 0; n < DRAW_DIST; n++) {
      const s = segs[(baseIndex + n) % segs.length];
      s.cars.length = 0;
      s.riders.length = 0;
    }
    trafficNow.forEach((c) => segAt(c.z).cars.push(c));
    if (!race) return;
    const t = now();
    remotes.forEach((r, id) => {
      if (id === race.me) return;
      const age = Math.min(0.5, (t - r.at) / 1000);
      const d = r.c ? r.d : r.d + r.s * age;
      const meta = race.meta[id];
      if (!meta) return;
      segAt(d).riders.push({ id, z: mod(d, L), x: r.x, c: r.c, p: r.p, color: meta.color, name: meta.name });
    });
  }

  function render() {
    const camZ = mod(D - PLAYER_Z, L);
    const base = segAt(camZ);
    const basePct = (camZ % SEG) / SEG;
    const pz = mod(D, L);
    const pSeg = segAt(pz);
    const pPct = (pz % SEG) / SEG;
    const playerY = pSeg.p1.world.y + (pSeg.p2.world.y - pSeg.p1.world.y) * pPct;

    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 18 * shake, (Math.random() - 0.5) * 12 * shake);
    drawBackground();
    placeDynamic(base.index);

    let maxy = H;
    let x = 0;
    let dx = -(base.curve * basePct);
    for (let n = 0; n < DRAW_DIST; n++) {
      const s = segs[(base.index + n) % segs.length];
      s.looped = s.index < base.index;
      s.fog = 1 / Math.pow(Math.E, (n / DRAW_DIST) * (n / DRAW_DIST) * FOG_DENSITY);
      s.clip = maxy;
      const cz = camZ - (s.looped ? L : 0);
      project(s.p1, px * ROAD_W - x, playerY + CAM_H, cz);
      project(s.p2, px * ROAD_W - x - dx, playerY + CAM_H, cz);
      x += dx;
      dx += s.curve;
      if (s.p1.camera.z <= CAM_DEPTH || s.p2.screen.y >= s.p1.screen.y || s.p2.screen.y >= maxy) continue;
      const col = s.col;
      drawSegment(s.p1.screen.x, s.p1.screen.y, s.p1.screen.w, s.p2.screen.x, s.p2.screen.y, s.p2.screen.w, s.fog, col);
      maxy = s.p1.screen.y;
    }

    ctx.font = `700 ${Math.max(11, Math.round(H / 48))}px 'Barlow Condensed', Arial, sans-serif`;
    ctx.textAlign = 'center';
    for (let n = DRAW_DIST - 1; n > 0; n--) {
      const s = segs[(base.index + n) % segs.length];
      const sc = s.p1.screen.scale;
      for (const spr of s.sprites) {
        let img;
        if (spr.kind === 'billboard') img = SP.billboard[spr.text];
        else if (spr.kind === 'milestone') img = SP.milestone(spr.km);
        else img = SP[spr.kind][mod(s.index + Math.round(spr.x * 10), SP[spr.kind].length)];
        const sx = s.p1.screen.x + (sc * spr.x * ROAD_W * W) / 2;
        const offX = spr.kind === 'gantry' ? -0.5 : spr.x < 0 ? -1 : 0;
        drawSprite(img, SPRITE_W[spr.kind], sc, sx, s.p1.screen.y, offX, -1, s.clip);
      }
      const ahead = (z) => { let d = z - pz; if (d > L / 2) d -= L; if (d < -L / 2) d += L; return d > -60; };
      const objs = s.cars.filter((c) => ahead(c.z)).map((c) => ({ c, z: c.z }))
        .concat(s.riders.filter((r) => ahead(r.z)).map((r) => ({ r, z: r.z }))).sort((a, b) => b.z - a.z);
      for (const o of objs) {
        const pct = (mod(o.z, SEG)) / SEG;
        const scl = s.p1.screen.scale + (s.p2.screen.scale - s.p1.screen.scale) * pct;
        const bx = s.p1.screen.x + (s.p2.screen.x - s.p1.screen.x) * pct;
        const by = s.p1.screen.y + (s.p2.screen.y - s.p1.screen.y) * pct;
        if (by <= s.clip) {
          const ox = o.c ? o.c.x : o.r.x;
          const ww = ((o.c ? SPRITE_W[o.c.type] : SPRITE_W.bike) * scl * W) / 2;
          ctx.fillStyle = 'rgba(20,10,20,0.32)';
          ctx.beginPath();
          ctx.ellipse(bx + (scl * ox * ROAD_W * W) / 2, by, ww * 0.55, Math.max(1, ww * 0.07), 0, 0, Math.PI * 2);
          ctx.fill();
        }
        if (o.c) {
          const c = o.c;
          const set = SP[c.type];
          const img = set[c.color % set.length];
          drawSprite(img, SPRITE_W[c.type], scl, bx + (scl * c.x * ROAD_W * W) / 2, by, -0.5, -1, s.clip);
        } else {
          const r = o.r;
          const img = SP.rider(r.color, r.c ? 'n' : r.p || 'n');
          const rx = bx + (scl * r.x * ROAD_W * W) / 2;
          const box = r.c
            ? drawSprite(img, SPRITE_W.bike, scl, rx, by, -0.5, -1, 0, 1.25, 0.85)
            : drawSprite(img, SPRITE_W.bike, scl, rx, by, -0.5, -1, s.clip);
          if (box && box.w > 26 && box.y > 0) {
            ctx.fillStyle = 'rgba(10,8,30,0.6)';
            const tw = ctx.measureText(r.name).width + 10;
            ctx.fillRect(box.x + box.w / 2 - tw / 2, box.y - 22, tw, 18);
            ctx.fillStyle = '#fff';
            ctx.fillText(r.name, box.x + box.w / 2, box.y - 8);
          }
        }
      }
      if (s === pSeg) drawPlayer(pSeg, pPct);
    }
    ctx.restore();

    if (flash > 0) {
      ctx.fillStyle = `rgba(230,57,70,${flash * 0.45})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawPlayer(pSeg, pPct) {
    const t = now();
    const color = race ? race.meta[race.me].color : '#e63946';
    const crashed = race && t < crashedUntil;
    const pose = myPunch && t - myPunch.at < 260 ? myPunch.side : 'n';
    const img = SP.rider(color, crashed ? 'n' : pose);
    const scale = CAM_DEPTH / PLAYER_Z;
    const camY = pSeg.p1.camera.y + (pSeg.p2.camera.y - pSeg.p1.camera.y) * pPct;
    const lift = H > W ? H * 0.12 : touchMode ? H * 0.04 : 0;
    const y = H * HORIZON - (scale * camY * H) / 2 - lift;
    const bounce = speed > 0 ? (Math.random() - 0.5) * 3 * (speed / MAX) * (Math.abs(px) > 1 ? 3 : 1) : 0;
    const steer = race ? (keys.left ? -1 : 0) + (keys.right ? 1 : 0) : -pSeg.curve * 0.1;
    const sw = (SPRITE_W.bike * scale * W) / 2;
    ctx.fillStyle = 'rgba(20,10,20,0.35)';
    ctx.beginPath(); ctx.ellipse(W / 2 + (crashed ? sw * 0.3 : 0), y, sw * (crashed ? 0.9 : 0.5), sw * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    if (crashed) drawSprite(img, SPRITE_W.bike, scale, W / 2, y, -0.5, -1, 0, 1.3, 0.9);
    else drawSprite(img, SPRITE_W.bike, scale, W / 2, y + bounce, -0.5, -1, 0, steer * 0.14 * (0.4 + speed / MAX), 1);
  }

  /* ---------- HUD ---------- */
  function placeOf(id) {
    if (!race) return 0;
    const list = [...remotes.entries()].map(([rid, r]) => ({ id: rid, d: rid === race.me ? D : r.d }));
    if (!list.find((x) => x.id === race.me)) list.push({ id: race.me, d: D });
    list.sort((a, b) => b.d - a.d);
    return list.findIndex((x) => x.id === id) + 1;
  }
  let hudT = 0;
  function updateHUD(dt) {
    hudT += dt;
    const t = now();
    const cd = $('#countdown');
    if (race && t < race.startAt + 800) {
      const left = Math.ceil((race.startAt - t) / 1000);
      const txt = left > 0 ? String(left) : 'GO!';
      if (cd.textContent !== txt) {
        cd.textContent = txt;
        cd.classList.remove('pop');
        void cd.offsetWidth;
        cd.classList.add('pop');
        if (left > 0 && left <= 3) sfx(440, 0.15, 'square', 0.06);
        else if (left <= 0) sfx(880, 0.3, 'square', 0.07);
      }
      cd.hidden = left > 3;
    } else cd.hidden = true;
    if (!race || hudT < 0.1) return;
    hudT = 0;
    const total = remotes.size || 1;
    $('#hudPlace').textContent = `P${placeOf(race.me)}`;
    $('#hudOf').textContent = `/${Math.max(total, Object.keys(race.meta).length)}`;
    $('#hudLap').textContent = `Lap ${clamp(Math.floor(Math.max(0, D) / L) + 1, 1, race.laps)}/${race.laps}`;
    $('#hudSpeed').textContent = Math.round(speed * KMH);
    const mine = remotes.get(race.me);
    const h = mine ? mine.h : 100;
    $('#hudHealth').style.width = `${h}%`;
    $('#hudHealth').classList.toggle('low', h <= 40);
    const bar = $('#hudTrack');
    const raceLen = race.laps * L;
    let html = '';
    remotes.forEach((r, id) => {
      const meta = race.meta[id];
      if (!meta) return;
      const d = id === race.me ? D : r.d;
      html += `<i class="${id === race.me ? 'me' : ''}" style="left:${clamp(d / raceLen, 0, 1) * 100}%;background:${meta.color}"></i>`;
    });
    bar.innerHTML = html;
    if (race.firstFinishAt && !finished) {
      const left = Math.max(0, Math.ceil((race.firstFinishAt + 45000 - t) / 1000));
      $('#hudClock').textContent = `Race ends in ${left}s`;
      $('#hudClock').hidden = false;
    } else $('#hudClock').hidden = true;
  }
  function pushFeed(text, mine) {
    feed.push({ text, mine, at: Date.now() });
    feed = feed.slice(-4);
    renderFeed();
  }
  function renderFeed() {
    const t = Date.now();
    feed = feed.filter((f) => t - f.at < 3500);
    $('#feed').innerHTML = feed.map((f) => `<div class="${f.mine ? 'mine' : ''}">${esc(f.text)}</div>`).join('');
  }
  setInterval(renderFeed, 500);

  /* ---------- loop ---------- */
  let last = performance.now();
  function frame(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000);
    last = ts;
    update(dt);
    render();
    updateHUD(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- networking ---------- */
  const socket = io();
  let lobby = null;
  setInterval(() => {
    if (!race) return;
    socket.emit('state', { d: Math.round(D), x: Math.round(px * 100) / 100, s: Math.round(speed), c: now() < crashedUntil ? 1 : 0 });
  }, 66);

  socket.on('connect', () => {
    $('#conn').hidden = true;
    const code = store.get('hh_code');
    const pid = store.get('hh_pid');
    if (code && pid) socket.emit('rejoin', { code, playerId: pid });
  });
  socket.on('disconnect', () => ($('#conn').hidden = false));
  socket.on('errorMsg', (m) => toast(m));
  socket.on('joined', ({ code, playerId }) => {
    store.set('hh_code', code);
    store.set('hh_pid', playerId);
  });
  socket.on('rejoinFailed', () => {
    store.del('hh_code');
    store.del('hh_pid');
    endRaceLocal();
    renderHome();
  });
  socket.on('replaced', () => { endRaceLocal(); toast('This game continues in another tab.'); renderHome(); });
  socket.on('left', () => {
    store.del('hh_code');
    store.del('hh_pid');
    lobby = null;
    endRaceLocal();
    renderHome();
  });

  socket.on('lobby', (l) => {
    lobby = l;
    if (l.phase === 'lobby') { endRaceLocal(); renderLobby(); }
    else if (l.phase === 'results' && l.results && !race) renderResults(l.results);
  });

  socket.on('race', (p) => {
    clockOffset = p.now - Date.now();
    const meta = {};
    p.riders.forEach((r) => (meta[r.id] = r));
    const meId = store.get('hh_pid');
    race = { id: p.race, laps: p.laps, startAt: p.startAt, meta, me: meId, firstFinishAt: 0 };
    traffic = S.makeTraffic(p.seed, L);
    remotes.clear();
    D = p.you ? p.you.d : 0;
    px = p.you ? p.you.x : 0;
    speed = 0;
    crashedUntil = 0;
    finished = p.you ? p.you.finished : false;
    feed = [];
    $('#banner').hidden = true;
    show(null);
    audioInit();
    if (touchMode && innerHeight > innerWidth) toast('Tip: turn your phone sideways for the best view.');
  });

  socket.on('snap', (m) => {
    if (!race) return;
    const off = m.t - Date.now();
    clockOffset += (off - clockOffset) * 0.1;
    race.firstFinishAt = m.firstFinishAt;
    const t = now();
    m.r.forEach(([id, d, x, s, h, c, p]) => {
      const prev = remotes.get(id);
      remotes.set(id, { d, x, s, h, c: !!c, p: p || (prev && t - (prev.pAt || 0) < 250 ? prev.p : 0), pAt: p ? t : prev ? prev.pAt : 0, at: t });
    });
  });

  socket.on('hit', (h) => {
    if (!race) return;
    const name = (id) => (id && race.meta[id] ? race.meta[id].name : 'Traffic');
    if (h.to === race.me) {
      if (h.from) {
        speed *= 0.82;
        px += h.side === 'l' ? -0.16 : 0.16;
        shake = Math.max(shake, 0.5);
        flash = Math.max(flash, 0.35);
        sfx(150, 0.15, 'square', 0.1, -60);
      }
      if (h.ko) {
        crashedUntil = now() + 3000;
        speed = 0;
        shake = 1;
        pushFeed(h.from ? `${name(h.from)} knocked you out!` : 'You wrecked! Health restored.', true);
      }
    } else if (h.from === race.me) {
      sfx(90, 0.12, 'square', 0.12);
      pushFeed(h.ko ? `KO! You knocked out ${name(h.to)}` : `Hit ${name(h.to)} −${h.dmg}`, true);
    } else if (h.ko && h.from) {
      pushFeed(`${name(h.from)} knocked out ${name(h.to)}`);
    }
  });

  socket.on('results', ({ results }) => {
    endRaceLocal();
    renderResults(results);
  });

  function endRaceLocal() {
    race = null;
    remotes.clear();
    traffic = attractTraffic;
    finished = false;
    crashedUntil = 0;
    $('#banner').hidden = true;
    $('#countdown').hidden = true;
    document.body.classList.remove('racing');
  }

  /* ---------- screens ---------- */
  function renderHome() {
    show('#home');
    const n = $('#name');
    if (!n.value) n.value = store.get('hh_name') || '';
    const code = new URLSearchParams(location.search).get('room');
    if (code) $('#code').value = code.toUpperCase().slice(0, 4);
  }
  function getName() {
    const n = $('#name').value.trim();
    if (!n) { toast('Enter your rider name first.'); $('#name').focus(); return null; }
    store.set('hh_name', n);
    audioInit();
    return n;
  }
  $('#btnQuick').onclick = () => { const n = getName(); if (n) socket.emit('quick', { name: n }); };
  $('#btnCreate').onclick = () => { const n = getName(); if (n) socket.emit('create', { name: n }); };
  $('#btnJoin').onclick = () => {
    const n = getName();
    const c = $('#code').value.trim().toUpperCase();
    if (!n) return;
    if (c.length !== 4) { toast('Room codes are 4 letters.'); $('#code').focus(); return; }
    socket.emit('join', { code: c, name: n });
  };
  $('#code').addEventListener('input', (e) => (e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '')));

  function renderLobby() {
    if (!lobby) return;
    show('#lobby');
    const host = lobby.hostId === lobby.me;
    $('#lobbyCode').textContent = lobby.code;
    $('#lobbyPlayers').innerHTML = lobby.players.map((p) => `<li class="${p.connected ? '' : 'off'}"><strong>${esc(p.name)}</strong>
      ${p.id === lobby.hostId ? '<span class="tag">Host</span>' : ''}${p.id === lobby.me ? '<span class="tag you">You</span>' : ''}
      ${p.connected ? '' : '<span class="muted">reconnecting…</span>'}</li>`).join('');
    const humans = lobby.players.filter((p) => p.connected).length;
    const maxBots = lobby.maxRiders - humans;
    const st = lobby.settings;
    const chips = (vals, cur, key, fmt) => vals.map((v) => `<button class="chip" data-${key}="${v}" aria-pressed="${cur === v}" ${host ? '' : 'disabled'}>${fmt(v)}</button>`).join('');
    $('#lobbySettings').innerHTML = `
      <div class="setting"><span>Laps</span><div class="chips">${chips([1, 2, 3, 5], st.laps, 'laps', (v) => v)}</div></div>
      <div class="setting"><span>Bot riders</span><div class="chips">${chips([0, 1, 3, 5, 7].filter((v) => v <= maxBots || v === st.bots), st.bots, 'bots', (v) => v)}</div></div>
      ${host ? '' : '<p class="muted">The host picks the settings.</p>'}`;
    if (host) {
      document.querySelectorAll('[data-laps]').forEach((b) => (b.onclick = () => socket.emit('settings', { laps: Number(b.dataset.laps) })));
      document.querySelectorAll('[data-bots]').forEach((b) => (b.onclick = () => socket.emit('settings', { bots: Number(b.dataset.bots) })));
    }
    $('#btnStart').hidden = !host;
    $('#lobbyWait').hidden = host;
    const hostP = lobby.players.find((p) => p.id === lobby.hostId);
    $('#lobbyWait').textContent = `${hostP ? hostP.name : 'The host'} starts the race.`;
  }
  $('#btnStart').onclick = () => { audioInit(); socket.emit('start'); };
  $('#btnShare').onclick = async () => {
    const url = `${location.origin}/?room=${lobby.code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Highway Hustle', text: `Race me on Highway Hustle. Room ${lobby.code}`, url });
      else { await navigator.clipboard.writeText(url); toast('Invite link copied.'); }
    } catch (e) { if (e && e.name !== 'AbortError') toast(`Room code: ${lobby.code}`); }
  };
  document.querySelectorAll('.btnLeave').forEach((b) => (b.onclick = () => socket.emit('leave')));

  const fmtTime = (ms) => {
    if (!ms) return '—';
    const s = ms / 1000;
    return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
  };
  function renderResults(results) {
    show('#results');
    const me = store.get('hh_pid');
    const mine = results.find((r) => r.id === me);
    $('#resTitle').textContent = mine ? (mine.dnf ? 'Did not finish' : mine.place === 1 ? 'You won the race!' : `You finished P${mine.place}`) : 'Race results';
    $('#resList').innerHTML = results.map((r) => `<tr class="${r.id === me ? 'me' : ''}"><td class="pl">${r.place}</td>
      <td><span class="dot" style="background:${r.color}"></span>${esc(r.name)}${r.bot ? ' <span class="muted">bot</span>' : ''}</td>
      <td>${r.dnf ? 'DNF' : fmtTime(r.time)}</td><td>${r.kos}</td></tr>`).join('');
    const host = lobby && lobby.hostId === me;
    $('#btnAgain').hidden = !host;
    $('#btnAgain').textContent = lobby && lobby.quick ? 'Race again' : 'Back to lobby';
    $('#resWait').hidden = host;
  }
  $('#btnAgain').onclick = () => socket.emit('again');

  /* how to play */
  function showHelp() { $('#help').hidden = false; $('#helpClose').focus(); }
  $('#btnHelp').onclick = showHelp;
  $('#helpClose').onclick = () => { $('#help').hidden = true; store.set('hh_help', '1'); };
  $('#help').addEventListener('click', (e) => { if (e.target.id === 'help') $('#helpClose').click(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#help').hidden) $('#helpClose').click(); });

  if (store.get('hh_code')) show('');
  else renderHome();
  if (!store.get('hh_help')) showHelp();
})();
