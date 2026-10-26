/* Game art, drawn once at load with canvas gradients and shading (no image files). */
(function () {
  'use strict';
  const K = 2; // draw at 2x for crisp sprites

  function make(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w * K;
    c.height = h * K;
    const x = c.getContext('2d');
    x.scale(K, K);
    x.lineJoin = 'round';
    x.lineCap = 'round';
    draw(x, w, h);
    return c;
  }
  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  function shade(hex, amt) {
    const [r, g, b] = rgb(hex);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt)));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  function path(c, pts) {
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
  }
  function rr(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r);
    else c.rect(x, y, w, h);
  }
  function lin(c, x0, y0, x1, y1, stops) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    return g;
  }
  function rad(c, x, y, r0, r1, stops) {
    const g = c.createRadialGradient(x, y, r0, x, y, r1);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    return g;
  }
  function rng(seed) {
    let a = seed * 9301 + 49297;
    return () => ((a = (a * 9301 + 49297) % 233280) / 233280);
  }
  function glow(c, x, y, r, col) {
    c.fillStyle = rad(c, x, y, 0, r, [[0, col], [1, 'rgba(255,60,40,0)']]);
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
  function tyre(c, x, y, w, h) {
    rr(c, x, y, w, h, Math.min(w, h) * 0.35);
    c.fillStyle = lin(c, x, 0, x + w, 0, [[0, '#050505'], [0.5, '#2c2c2c'], [1, '#050505']]);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.06)';
    c.lineWidth = 1;
    for (let yy = y + 4; yy < y + h - 2; yy += 5) { c.beginPath(); c.moveTo(x + 3, yy); c.lineTo(x + w - 3, yy); c.stroke(); }
  }
  function plate(c, x, y, w, h, text) {
    rr(c, x, y, w, h, 2);
    c.fillStyle = lin(c, 0, y, 0, y + h, [[0, '#ffffff'], [1, '#dcdcdc']]);
    c.fill();
    c.strokeStyle = '#333'; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#111';
    c.font = `700 ${Math.round(h * 0.68)}px Arial, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, x + w / 2, y + h / 2 + 0.5);
  }

  /* ---------- rider + motorcycle, rear view ---------- */
  function rider(color, pose) {
    return make(160, 180, (c) => {
      const cx = 80;
      const leather = '#1d1e24';
      // rear tyre and swingarm
      tyre(c, cx - 14, 118, 28, 62);
      c.fillStyle = '#3a3d44';
      rr(c, cx - 24, 116, 6, 34, 3); c.fill();
      rr(c, cx + 18, 116, 6, 34, 3); c.fill();
      // exhaust (chrome)
      rr(c, cx + 22, 108, 14, 40, 7);
      c.fillStyle = lin(c, cx + 22, 0, cx + 36, 0, [[0, '#6f757d'], [0.35, '#f2f4f7'], [0.6, '#aeb4bb'], [1, '#5a6068']]);
      c.fill();
      c.fillStyle = '#1a1a1a';
      c.beginPath(); c.ellipse(cx + 29, 147, 5, 2.5, 0, 0, Math.PI * 2); c.fill();
      // rear fender + tail
      path(c, [[cx - 26, 104], [cx + 26, 104], [cx + 20, 122], [cx - 20, 122]]);
      c.fillStyle = lin(c, 0, 104, 0, 122, [[0, '#3b3e46'], [1, '#15161a']]);
      c.fill();
      glow(c, cx, 109, 16, 'rgba(255,60,40,0.55)');
      rr(c, cx - 12, 105, 24, 7, 3);
      c.fillStyle = lin(c, 0, 105, 0, 112, [[0, '#ff6a55'], [1, '#c81d10']]);
      c.fill();
      // indicators
      c.fillStyle = '#ff9f1a';
      rr(c, cx - 34, 110, 9, 5, 2); c.fill();
      rr(c, cx + 25, 110, 9, 5, 2); c.fill();
      plate(c, cx - 13, 114, 26, 11, 'DL3S');
      // boots on pegs
      [[cx - 46, 112], [cx + 30, 112]].forEach(([x, y]) => {
        rr(c, x, y, 16, 14, 4);
        c.fillStyle = lin(c, 0, y, 0, y + 14, [[0, '#2a2a2a'], [1, '#050505']]);
        c.fill();
      });
      // legs (denim)
      [[cx - 46, 84, -1], [cx + 22, 84, 1]].forEach(([x, y]) => {
        rr(c, x, y, 24, 32, 10);
        c.fillStyle = lin(c, x, 0, x + 24, 0, [[0, '#1c2a44'], [0.5, '#34496f'], [1, '#18233a']]);
        c.fill();
      });
      // seat
      rr(c, cx - 22, 92, 44, 14, 6);
      c.fillStyle = '#0d0d0f'; c.fill();
      // handlebar + grips + mirrors
      c.strokeStyle = '#121212'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(cx - 54, 78); c.quadraticCurveTo(cx, 70, cx + 54, 78); c.stroke();
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(cx - 48, 76); c.lineTo(cx - 58, 56); c.moveTo(cx + 48, 76); c.lineTo(cx + 58, 56); c.stroke();
      [[cx - 60, 52], [cx + 60, 52]].forEach(([x, y]) => {
        c.fillStyle = '#111'; c.beginPath(); c.ellipse(x, y, 7, 5, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(160,190,220,0.7)'; c.beginPath(); c.ellipse(x, y, 5, 3, 0, 0, Math.PI * 2); c.fill();
      });
      // torso: leather jacket with coloured panels
      const torso = [[cx - 33, 98], [cx + 33, 98], [cx + 28, 46], [cx + 18, 38], [cx - 18, 38], [cx - 28, 46]];
      path(c, torso);
      c.fillStyle = lin(c, cx - 33, 0, cx + 33, 0, [[0, '#0c0d10'], [0.3, '#2a2c34'], [0.5, '#34363f'], [0.7, '#2a2c34'], [1, '#0c0d10']]);
      c.fill();
      c.save();
      path(c, torso); c.clip();
      c.fillStyle = color;
      path(c, [[cx - 33, 60], [cx - 20, 60], [cx - 24, 98], [cx - 36, 98]]); c.fill();
      path(c, [[cx + 33, 60], [cx + 20, 60], [cx + 24, 98], [cx + 36, 98]]); c.fill();
      path(c, [[cx - 30, 40], [cx + 30, 40], [cx + 24, 52], [cx - 24, 52]]); c.fill();
      // back protector hump + seams
      rr(c, cx - 14, 52, 28, 38, 12);
      c.fillStyle = lin(c, 0, 52, 0, 90, [[0, 'rgba(255,255,255,0.12)'], [1, 'rgba(0,0,0,0.25)']]);
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 1.2;
      for (let y = 60; y < 96; y += 9) { c.beginPath(); c.moveTo(cx - 26, y); c.quadraticCurveTo(cx, y + 4, cx + 26, y); c.stroke(); }
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(cx - 33, 90, 66, 8);
      c.restore();
      // arms
      const arm = (x1, y1, x2, y2, punch) => {
        const g = lin(c, x1, y1, x2, y2, [[0, '#2b2d35'], [1, '#121318']]);
        c.strokeStyle = g; c.lineWidth = punch ? 13 : 12;
        c.beginPath();
        if (punch) { c.moveTo(x1, y1); c.lineTo(x2, y2); }
        else { c.moveTo(x1, y1); c.quadraticCurveTo(x1 + (x2 - x1) * 0.2, y1 + 22, x2, y2); }
        c.stroke();
        c.strokeStyle = color; c.lineWidth = 3;
        c.beginPath(); c.moveTo(x1, y1 - 2); c.lineTo(x1 + (x2 - x1) * 0.55, y1 + (y2 - y1) * 0.55 - (punch ? 2 : 0)); c.stroke();
        c.fillStyle = rad(c, x2 - 2, y2 - 2, 1, 9, [[0, '#4a4a4a'], [1, '#0a0a0a']]);
        c.beginPath(); c.arc(x2, y2, punch ? 9 : 7.5, 0, Math.PI * 2); c.fill();
      };
      const L0 = [cx - 26, 50], R0 = [cx + 26, 50];
      if (pose === 'l') { arm(L0[0], L0[1], cx - 74, 44, true); arm(R0[0], R0[1], cx + 48, 76); }
      else if (pose === 'r') { arm(L0[0], L0[1], cx - 48, 76); arm(R0[0], R0[1], cx + 74, 44, true); }
      else { arm(L0[0], L0[1], cx - 48, 76); arm(R0[0], R0[1], cx + 48, 76); }
      // neck + helmet
      rr(c, cx - 8, 34, 16, 10, 4); c.fillStyle = '#111'; c.fill();
      c.fillStyle = rad(c, cx - 7, 16, 2, 26, [[0, shade(color, 70)], [0.45, color], [1, shade(color, -80)]]);
      c.beginPath(); c.ellipse(cx, 24, 20, 22, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.beginPath(); c.ellipse(cx, 24, 4, 21, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = shade(color, -60);
      c.fillRect(cx - 20, 34, 40, 6);
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.beginPath(); c.ellipse(cx - 9, 13, 6, 3.5, -0.5, 0, Math.PI * 2); c.fill();
    });
  }

  /* ---------- traffic ---------- */
  const TRUCK_COLORS = ['#e0a800', '#d9480f', '#1e63c9', '#1f8a5f', '#b8326d'];
  function truck(i) {
    const col = TRUCK_COLORS[i % TRUCK_COLORS.length];
    const r = rng(i + 3);
    return make(250, 280, (c, w) => {
      // tarpaulin load on top
      path(c, [[18, 26], [w - 18, 26], [w - 30, 2], [30, 2]]);
      c.fillStyle = lin(c, 0, 2, 0, 26, [[0, '#4f5b3a'], [1, '#2f3824']]); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1.5;
      for (let x = 40; x < w - 30; x += 26) { c.beginPath(); c.moveTo(x, 4); c.lineTo(x - 6, 26); c.stroke(); }
      // body
      rr(c, 8, 24, w - 16, 190, 6);
      c.fillStyle = lin(c, 0, 24, 0, 214, [[0, shade(col, 30)], [0.6, col], [1, shade(col, -55)]]); c.fill();
      // tailgate planks
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1;
      for (let y = 40; y < 205; y += 14) { c.beginPath(); c.moveTo(12, y); c.lineTo(w - 12, y); c.stroke(); }
      // truck-art border with flowers
      c.strokeStyle = '#1c1c1c'; c.lineWidth = 3; rr(c, 16, 32, w - 32, 174, 4); c.stroke();
      for (let x = 30; x < w - 20; x += 32) {
        for (let p = 0; p < 6; p++) {
          const a = (p / 6) * Math.PI * 2;
          c.fillStyle = p % 2 ? '#ffffff' : '#e63946';
          c.beginPath(); c.ellipse(x + Math.cos(a) * 5, 44 + Math.sin(a) * 5, 4, 2.5, a, 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(x, 44, 2.6, 0, Math.PI * 2); c.fill();
      }
      // painted eyes motif
      [[w / 2 - 40, 92], [w / 2 + 40, 92]].forEach(([x, y]) => {
        c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, y, 22, 12, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#111'; c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#111'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, 22, 12, 0, 0, Math.PI * 2); c.stroke();
      });
      c.textAlign = 'center';
      c.fillStyle = '#16204a';
      c.font = '900 22px Georgia, serif';
      c.fillText('HORN', w / 2, 136);
      c.fillStyle = '#c0392b';
      c.font = 'italic 900 16px Georgia, serif';
      c.fillText('OK', w / 2, 154);
      c.fillStyle = '#16204a';
      c.font = '900 22px Georgia, serif';
      c.fillText('PLEASE', w / 2, 176);
      c.font = '700 10px Arial, sans-serif';
      c.fillText('USE DIPPER AT NIGHT', w / 2, 196);
      // grime
      c.fillStyle = lin(c, 0, 160, 0, 214, [[0, 'rgba(70,50,30,0)'], [1, 'rgba(70,50,30,0.45)']]);
      c.fillRect(8, 160, w - 16, 54);
      // chassis, lights, bumper, dual tyres, mudflaps
      c.fillStyle = '#141414'; c.fillRect(20, 214, w - 40, 18);
      [[14, 200], [w - 44, 200]].forEach(([x, y]) => {
        glow(c, x + 15, y + 6, 18, 'rgba(255,60,40,0.5)');
        rr(c, x, y, 30, 12, 2); c.fillStyle = '#d0201a'; c.fill();
        rr(c, x + 3, y + 2, 10, 8, 1); c.fillStyle = '#ffa31a'; c.fill();
      });
      rr(c, 4, 222, w - 8, 14, 3);
      c.fillStyle = lin(c, 0, 222, 0, 236, [[0, '#d8dde3'], [0.5, '#8b929a'], [1, '#3f454c']]); c.fill();
      plate(c, w / 2 - 34, 238, 68, 15, 'HR 55 T ' + (1000 + Math.floor(r() * 8999)));
      [[16, 236], [44, 236], [w - 74, 236], [w - 46, 236]].forEach(([x, y]) => tyre(c, x, y, 28, 44));
      [[22, 240], [w - 52, 240]].forEach(([x, y]) => {
        rr(c, x, y, 30, 34, 2); c.fillStyle = '#a32020'; c.fill();
        c.fillStyle = '#ffd23f'; c.font = '800 9px Arial'; c.fillText('\u2605', x + 15, y + 20);
      });
    });
  }

  function auto() {
    return make(170, 180, (c, w) => {
      // canopy
      path(c, [[14, 92], [w - 14, 92], [w - 20, 22], [w / 2 + 30, 6], [w / 2 - 30, 6], [20, 22]]);
      c.fillStyle = lin(c, 0, 6, 0, 92, [[0, '#2a2a2a'], [0.3, '#0e0e0e'], [1, '#1a1a1a']]); c.fill();
      path(c, [[20, 30], [w - 20, 30], [w - 22, 18], [w / 2 + 30, 8], [w / 2 - 30, 8], [22, 18]]);
      c.fillStyle = lin(c, 0, 8, 0, 30, [[0, '#ffe066'], [1, '#e0b000']]); c.fill();
      // rear window
      rr(c, 38, 36, w - 76, 40, 8);
      c.fillStyle = lin(c, 0, 36, 0, 76, [[0, '#4a5563'], [1, '#1b2028']]); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.12)';
      path(c, [[44, 40], [70, 40], [52, 72], [42, 72]]); c.fill();
      // body
      rr(c, 12, 84, w - 24, 72, 14);
      c.fillStyle = lin(c, 0, 84, 0, 156, [[0, '#46c06e'], [0.5, '#2a9a50'], [1, '#17663a']]); c.fill();
      c.fillStyle = '#f2c200'; c.fillRect(14, 98, w - 28, 6);
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(16, 88, w - 32, 4);
      glow(c, 26, 120, 12, 'rgba(255,60,40,0.5)');
      glow(c, w - 26, 120, 12, 'rgba(255,60,40,0.5)');
      rr(c, 18, 115, 16, 10, 3); c.fillStyle = '#d0201a'; c.fill();
      rr(c, w - 34, 115, 16, 10, 3); c.fill();
      plate(c, w / 2 - 28, 118, 56, 15, 'DL 1RV 26');
      c.fillStyle = '#111';
      c.font = 'italic 700 10px Georgia, serif';
      c.textAlign = 'center';
      c.fillText('Dekho magar pyaar se', w / 2, 112);
      tyre(c, 18, 148, 26, 32);
      tyre(c, w - 44, 148, 26, 32);
      c.fillStyle = '#222'; c.fillRect(44, 150, w - 88, 8);
    });
  }

  const CAR_COLORS = ['#e9ecef', '#b3261e', '#1e5bc6', '#3d4148', '#c9a227'];
  function car(i) {
    const col = CAR_COLORS[i % CAR_COLORS.length];
    return make(210, 150, (c, w) => {
      // roof + rear glass
      path(c, [[34, 64], [w - 34, 64], [w - 48, 14], [48, 14]]);
      c.fillStyle = lin(c, 0, 10, 0, 64, [[0, shade(col, 10)], [1, shade(col, -30)]]); c.fill();
      path(c, [[42, 60], [w - 42, 60], [w - 54, 20], [54, 20]]);
      c.fillStyle = lin(c, 0, 20, 0, 60, [[0, '#59677a'], [0.5, '#1f2733'], [1, '#121820']]); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.16)';
      path(c, [[60, 22], [92, 22], [70, 58], [48, 58]]); c.fill();
      c.strokeStyle = '#0a0a0a'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(w / 2 - 22, 56); c.lineTo(w / 2 + 14, 46); c.stroke();
      // body
      rr(c, 8, 58, w - 16, 64, 16);
      c.fillStyle = lin(c, 0, 58, 0, 122, [[0, shade(col, 35)], [0.25, col], [0.75, shade(col, -25)], [1, shade(col, -60)]]); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(18, 64, w - 36, 3);
      // tail lamps
      [[12, 70, 1], [w - 50, 70, -1]].forEach(([x, y]) => {
        glow(c, x + 19, y + 7, 18, 'rgba(255,60,40,0.45)');
        path(c, [[x, y], [x + 38, y], [x + 34, y + 14], [x + 2, y + 16]]);
        c.fillStyle = lin(c, 0, y, 0, y + 16, [[0, '#ff6a55'], [1, '#a5150b']]); c.fill();
      });
      c.fillStyle = '#c0c4ca';
      c.beginPath(); c.ellipse(w / 2, 80, 10, 6, 0, 0, Math.PI * 2); c.fill();
      plate(c, w / 2 - 30, 92, 60, 16, 'UP16 AK 2026');
      rr(c, 6, 110, w - 12, 16, 6); c.fillStyle = '#1b1c1f'; c.fill();
      tyre(c, 18, 118, 36, 32);
      tyre(c, w - 54, 118, 36, 32);
    });
  }

  function cow() {
    return make(220, 170, (c) => {
      const body = '#ece6d8';
      const legs = [[54, 98], [74, 102], [146, 102], [168, 98]];
      legs.forEach(([x, y], i) => {
        rr(c, x, y, 13, 60, 5);
        c.fillStyle = lin(c, x, 0, x + 13, 0, [[0, i % 2 ? '#bdb5a5' : '#d7cfbf'], [1, '#a89f8f']]); c.fill();
        rr(c, x - 1, y + 56, 15, 10, 3); c.fillStyle = '#2b231d'; c.fill();
      });
      // body
      c.fillStyle = rad(c, 110, 60, 10, 90, [[0, '#fffdf7'], [0.7, body], [1, '#b9b09f']]);
      c.beginPath(); c.ellipse(115, 80, 72, 36, 0, 0, Math.PI * 2); c.fill();
      // hump + dewlap
      c.beginPath(); c.ellipse(70, 50, 22, 16, -0.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#d8d0c0';
      c.beginPath(); c.moveTo(40, 76); c.quadraticCurveTo(52, 112, 70, 96); c.lineTo(60, 70); c.fill();
      // patches
      c.fillStyle = 'rgba(150,120,90,0.55)';
      c.beginPath(); c.ellipse(130, 70, 22, 14, 0.4, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(158, 88, 13, 9, -0.3, 0, Math.PI * 2); c.fill();
      // neck + head
      c.fillStyle = body;
      path(c, [[60, 54], [72, 80], [44, 84], [34, 62]]); c.fill();
      c.fillStyle = rad(c, 30, 60, 2, 26, [[0, '#fffdf7'], [1, '#c9c0ae']]);
      c.beginPath(); c.ellipse(30, 70, 20, 15, -0.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#d9a99b'; c.beginPath(); c.ellipse(15, 80, 9, 7, -0.3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3b2a24'; c.beginPath(); c.arc(12, 80, 1.6, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(30, 64, 2.6, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#cfc6b4'; c.beginPath(); c.ellipse(44, 58, 9, 4, 0.6, 0, Math.PI * 2); c.fill();
      // painted horns (common on Indian cattle)
      c.lineWidth = 5;
      c.strokeStyle = '#8a5a2b';
      c.beginPath(); c.moveTo(34, 56); c.quadraticCurveTo(40, 36, 30, 28); c.stroke();
      c.beginPath(); c.moveTo(24, 58); c.quadraticCurveTo(18, 40, 10, 36); c.stroke();
      c.strokeStyle = '#e63946'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(34, 46); c.lineTo(38, 44); c.moveTo(20, 46); c.lineTo(17, 44); c.stroke();
      // tail
      c.strokeStyle = '#cfc6b4'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(184, 66); c.quadraticCurveTo(204, 96, 198, 132); c.stroke();
      c.fillStyle = '#3b2a24'; c.beginPath(); c.ellipse(198, 136, 5, 9, 0, 0, Math.PI * 2); c.fill();
      // garland
      c.fillStyle = '#ff9f1a';
      for (let a = 0; a < 7; a++) { c.beginPath(); c.arc(50 + a * 3, 78 + Math.sin(a) * 3, 3, 0, Math.PI * 2); c.fill(); }
    });
  }

  /* ---------- scenery ---------- */
  function tree(seed) {
    const r = rng(seed + 11);
    return make(240, 300, (c) => {
      // trunk with bark
      path(c, [[104, 300], [136, 300], [128, 170], [140, 120], [126, 118], [118, 160], [108, 116], [96, 122], [110, 170]]);
      c.fillStyle = lin(c, 96, 0, 140, 0, [[0, '#3e2a1a'], [0.5, '#6e4e33'], [1, '#2e1f14']]); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1;
      for (let y = 180; y < 296; y += 10) { c.beginPath(); c.moveTo(108 + r() * 6, y); c.lineTo(126 + r() * 6, y + 6); c.stroke(); }
      // canopy: many leaf clusters with top light, bottom shadow
      const blobs = [];
      for (let i = 0; i < 70; i++) {
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(r());
        blobs.push([120 + Math.cos(a) * d * 95, 92 + Math.sin(a) * d * 70, 12 + r() * 16]);
      }
      blobs.sort((a, b) => a[1] - b[1]);
      blobs.forEach(([x, y, rr0]) => {
        const light = 1 - (y - 22) / 140;
        const g = Math.round(70 + light * 70);
        c.fillStyle = rad(c, x - rr0 * 0.3, y - rr0 * 0.4, 1, rr0, [[0, `rgb(${Math.round(g * 0.62)},${g + 30},${Math.round(g * 0.35)})`], [1, `rgb(${Math.round(g * 0.3)},${Math.round(g * 0.6)},${Math.round(g * 0.2)})`]]);
        c.beginPath(); c.arc(x, y, rr0, 0, Math.PI * 2); c.fill();
      });
    });
  }

  function palm(seed) {
    const r = rng(seed + 5);
    return make(230, 330, (c) => {
      const lean = (r() - 0.5) * 30;
      c.lineWidth = 15;
      c.strokeStyle = lin(c, 100, 0, 130, 0, [[0, '#5d4128'], [0.5, '#9a7550'], [1, '#4a321e']]);
      c.beginPath(); c.moveTo(118, 330); c.quadraticCurveTo(100 + lean, 200, 115 + lean, 70); c.stroke();
      c.strokeStyle = 'rgba(40,25,10,0.55)'; c.lineWidth = 2;
      for (let t = 0.05; t < 0.95; t += 0.05) {
        const x = (1 - t) * (1 - t) * 118 + 2 * (1 - t) * t * (100 + lean) + t * t * (115 + lean);
        const y = (1 - t) * (1 - t) * 330 + 2 * (1 - t) * t * 200 + t * t * 70;
        c.beginPath(); c.moveTo(x - 8, y); c.lineTo(x + 8, y - 3); c.stroke();
      }
      const top = [115 + lean, 70];
      for (let f = 0; f < 11; f++) {
        const a = -Math.PI + (f / 10) * Math.PI + (r() - 0.5) * 0.3;
        const len = 100 + r() * 30;
        const ex = top[0] + Math.cos(a) * len;
        const ey = top[1] + Math.sin(a) * len * 0.55 + len * 0.45;
        const mx = top[0] + Math.cos(a) * len * 0.5;
        const my = top[1] + Math.sin(a) * len * 0.5 - 18;
        const green = f % 2 ? '#2f7a2a' : '#3f9437';
        c.strokeStyle = '#2b5e1f'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(top[0], top[1]); c.quadraticCurveTo(mx, my, ex, ey); c.stroke();
        c.strokeStyle = green; c.lineWidth = 2;
        for (let t = 0.15; t < 1; t += 0.07) {
          const x = (1 - t) * (1 - t) * top[0] + 2 * (1 - t) * t * mx + t * t * ex;
          const y = (1 - t) * (1 - t) * top[1] + 2 * (1 - t) * t * my + t * t * ey;
          const l = 16 * (1 - t * 0.6);
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a + 1.2) * l, y + Math.sin(a + 1.2) * l + 6); c.stroke();
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a - 1.2) * l, y + Math.sin(a - 1.2) * l + 6); c.stroke();
        }
      }
      c.fillStyle = '#5b3d1f';
      for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(top[0] - 8 + i * 6, top[1] + 6, 5, 0, Math.PI * 2); c.fill(); }
    });
  }

  function billboard(text, i) {
    const pal = [['#ffd23f', '#16204a'], ['#ffffff', '#c0392b'], ['#1f8a5f', '#ffffff'], ['#16204a', '#ffd23f'], ['#e63946', '#ffffff'], ['#ffffff', '#16204a']][i % 6];
    return make(300, 220, (c, w) => {
      [[44, 110], [w - 58, 110]].forEach(([x, y]) => {
        c.fillStyle = lin(c, x, 0, x + 14, 0, [[0, '#4b5058'], [0.5, '#9aa1a9'], [1, '#3b4046']]);
        c.fillRect(x, y, 14, 110);
      });
      c.fillStyle = '#2d3136'; c.fillRect(30, 128, w - 60, 5);
      rr(c, 6, 6, w - 12, 124, 4); c.fillStyle = '#30343a'; c.fill();
      rr(c, 12, 12, w - 24, 112, 2);
      c.fillStyle = lin(c, 0, 12, 0, 124, [[0, shade(pal[0], 15)], [1, shade(pal[0], -25)]]); c.fill();
      c.fillStyle = pal[1];
      c.textAlign = 'center'; c.textBaseline = 'middle';
      let size = 44;
      c.font = `900 ${size}px Arial, sans-serif`;
      while (c.measureText(text).width > w - 50 && size > 18) { size -= 2; c.font = `900 ${size}px Arial, sans-serif`; }
      c.fillText(text, w / 2, 68);
      c.fillStyle = lin(c, 0, 12, 0, 124, [[0, 'rgba(255,255,255,0.18)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,0.2)']]);
      c.fillRect(12, 12, w - 24, 112);
    });
  }

  function dhaba() {
    return make(320, 230, (c, w) => {
      // brick wall
      c.fillStyle = '#a5532f'; c.fillRect(20, 96, w - 40, 134);
      c.strokeStyle = 'rgba(60,25,10,0.5)'; c.lineWidth = 1;
      for (let y = 100, row = 0; y < 230; y += 9, row++) {
        c.beginPath(); c.moveTo(20, y); c.lineTo(w - 20, y); c.stroke();
        for (let x = 20 + (row % 2) * 10; x < w - 20; x += 20) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 9); c.stroke(); }
      }
      // tin roof
      path(c, [[0, 102], [w, 102], [w - 24, 64], [24, 64]]);
      c.fillStyle = lin(c, 0, 64, 0, 102, [[0, '#9ea6ae'], [1, '#5f666d']]); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.25)';
      for (let x = 10; x < w; x += 8) { c.beginPath(); c.moveTo(x, 102); c.lineTo(x * 0.85 + 24, 64); c.stroke(); }
      // sign
      rr(c, 60, 16, w - 120, 46, 4); c.fillStyle = '#fff2c2'; c.fill();
      c.strokeStyle = '#7a2e12'; c.lineWidth = 3; c.stroke();
      c.fillStyle = '#b5341b'; c.font = '900 21px Georgia, serif'; c.textAlign = 'center';
      c.fillText('SHER-E-PUNJAB', w / 2, 40);
      c.font = '700 13px Arial'; c.fillStyle = '#333'; c.fillText('DHABA \u00B7 24 HRS \u00B7 PURE VEG', w / 2, 56);
      // openings, charpai, chairs
      rr(c, 130, 140, 60, 90, 2); c.fillStyle = '#2a1a10'; c.fill();
      glow(c, 160, 170, 40, 'rgba(255,190,90,0.6)');
      [[36, 128], [w - 100, 128]].forEach(([x, y]) => { rr(c, x, y, 64, 44, 2); c.fillStyle = '#1c2630'; c.fill(); glow(c, x + 32, y + 22, 26, 'rgba(255,200,110,0.45)'); });
      c.fillStyle = '#7a5532'; c.fillRect(40, 206, 70, 6); c.fillRect(42, 212, 4, 16); c.fillRect(104, 212, 4, 16);
      c.strokeStyle = '#d9c39a'; c.lineWidth = 1;
      for (let x = 44; x < 110; x += 5) { c.beginPath(); c.moveTo(x, 206); c.lineTo(x + 3, 212); c.stroke(); }
      c.fillStyle = '#e63946'; rr(c, w - 90, 196, 20, 22, 3); c.fill(); rr(c, w - 62, 196, 20, 22, 3); c.fill();
      // string lights
      for (let x = 28; x < w - 28; x += 18) glow(c, x, 106 + Math.sin(x) * 2, 5, 'rgba(255,210,80,0.95)');
    });
  }

  function milestone(km) {
    return make(80, 112, (c, w) => {
      rr(c, 6, 40, w - 12, 72, 3);
      c.fillStyle = lin(c, 6, 0, w - 6, 0, [[0, '#d8d8d8'], [0.4, '#ffffff'], [1, '#b8b8b8']]); c.fill();
      c.fillStyle = lin(c, 6, 0, w - 6, 0, [[0, '#d9a800'], [0.4, '#ffd23f'], [1, '#b88d00']]);
      c.beginPath(); c.arc(w / 2, 42, (w - 12) / 2, Math.PI, 0); c.fill();
      c.fillStyle = '#16204a'; c.textAlign = 'center';
      c.font = '800 13px Arial, sans-serif'; c.fillText('NH 24', w / 2, 34);
      c.font = '900 26px Arial, sans-serif'; c.fillText(String(km), w / 2, 80);
      c.font = '700 11px Arial, sans-serif'; c.fillText('Km', w / 2, 98);
      c.fillStyle = 'rgba(60,45,25,0.35)'; c.fillRect(6, 104, w - 12, 8);
    });
  }

  function gantry() {
    return make(940, 330, (c, w) => {
      [[0, 60], [w - 30, 60]].forEach(([x, y]) => {
        c.fillStyle = lin(c, x, 0, x + 30, 0, [[0, '#4b5058'], [0.5, '#a9b0b8'], [1, '#3b4046']]);
        c.fillRect(x, y, 30, 270);
      });
      c.strokeStyle = '#6c737c'; c.lineWidth = 3;
      for (let x = 30; x < w - 30; x += 40) { c.beginPath(); c.moveTo(x, 4); c.lineTo(x + 20, 70); c.lineTo(x + 40, 4); c.stroke(); }
      rr(c, 0, 0, w, 76, 4);
      c.fillStyle = lin(c, 0, 0, 0, 76, [[0, '#24305e'], [1, '#121838']]); c.fill();
      const sq = 18;
      for (let y = 0; y < 2; y++) for (let x = 0; x < w / sq; x++) { c.fillStyle = (x + y) % 2 ? '#fff' : '#111'; c.fillRect(x * sq, 76 + y * sq, sq, sq); }
      c.fillStyle = '#ffd23f'; c.font = '900 46px Arial, sans-serif'; c.textAlign = 'center';
      c.fillText('START \u00B7 FINISH', w / 2, 54);
    });
  }

  /* ---------- background layers ---------- */
  function hills(top, bottom, seed, amp, base) {
    return make(1024, 240, (c, w, h) => {
      c.fillStyle = lin(c, 0, base - amp, 0, h, [[0, top], [1, bottom]]);
      c.beginPath(); c.moveTo(0, h);
      for (let x = 0; x <= w; x += 3) {
        const t = (x / w) * Math.PI * 2;
        const y = base - amp * (0.5 * Math.sin(t * 2 + seed) + 0.3 * Math.sin(t * 5 + seed * 2) + 0.15 * Math.sin(t * 13 + seed * 3) + 0.05 * Math.sin(t * 31 + seed));
        c.lineTo(x, y);
      }
      c.lineTo(w, h); c.closePath(); c.fill();
    });
  }
  function treeline() {
    const r = rng(99);
    return make(1024, 120, (c, w, h) => {
      for (let i = 0; i < 260; i++) {
        const x = (i / 260) * w;
        const s = 6 + r() * 16;
        const y = h - 18 - r() * 18;
        c.fillStyle = `rgba(${30 + r() * 20},${55 + r() * 25},${35 + r() * 15},0.95)`;
        c.beginPath(); c.arc(x, y, s, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(w + x, y, s, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(x - w, y, s, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = 'rgba(40,60,35,1)'; c.fillRect(0, h - 20, w, 20);
    });
  }
  function clouds() {
    const r = rng(17);
    return make(1024, 200, (c, w) => {
      for (let k = 0; k < 9; k++) {
        const cx = r() * w, cy = 30 + r() * 120, sc = 0.6 + r() * 1.2;
        for (let i = 0; i < 14; i++) {
          const x = cx + (r() - 0.5) * 140 * sc;
          const y = cy + (r() - 0.5) * 22 * sc;
          const rr0 = (14 + r() * 26) * sc;
          [0, w, -w].forEach((o) => {
            c.fillStyle = rad(c, x + o, y - rr0 * 0.3, 1, rr0, [[0, 'rgba(255,214,190,0.55)'], [1, 'rgba(255,170,150,0)']]);
            c.beginPath(); c.arc(x + o, y, rr0, 0, Math.PI * 2); c.fill();
          });
        }
      }
    });
  }

  const cache = { rider: {} };
  window.Sprites = {
    rider(color, pose) {
      const k = `${color}|${pose}`;
      return cache.rider[k] || (cache.rider[k] = rider(color, pose));
    },
    truck: TRUCK_COLORS.map((_, i) => truck(i)),
    car: CAR_COLORS.map((_, i) => car(i)),
    auto: [auto()],
    cow: [cow()],
    tree: [tree(0), tree(1), tree(2), tree(3)],
    palm: [palm(0), palm(1), palm(2)],
    billboard: (window.Shared ? Shared.BILLBOARDS : []).map((t, i) => billboard(t, i)),
    dhaba: [dhaba()],
    milestones: {},
    milestone(km) { return this.milestones[km] || (this.milestones[km] = milestone(km)); },
    gantry: [gantry()],
    clouds: clouds(),
    hillsFar: hills('#a3638a', '#d98a7c', 1.3, 60, 160),
    hillsNear: hills('#5a3f66', '#7f6070', 2.1, 45, 196),
    treeline: treeline(),
  };
})();
