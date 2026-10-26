'use strict';
const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');
const Shared = require('./public/shared.js');

const PORT = process.env.PORT || 3000;
const TRACK = Shared.buildTrack();
const L = TRACK.length;
const MAX = Shared.MAX_SPEED;
const MAX_RIDERS = 8;
const MAX_HUMANS = 6;
const TICK_MS = 50;
const PUNCH_DMG = 20;
const BOT_PUNCH_DMG = 12;
const TRAFFIC_DMG = 20;
const KO_MS = 3000;
const AFTER_FIRST_FINISH_MS = 45000;
const ROOM_IDLE_MS = 5 * 60 * 1000;
const LOBBY_DROP_MS = 60 * 1000;

const COLORS = ['#e63946', '#1d7cf2', '#20a37a', '#ff8c1a', '#9b5de5', '#f2c200', '#ff5d8f', '#00b4d8'];
const BOT_NAMES = ['Bunty', 'Pinky', 'Tiger', 'Rocky', 'Sultan', 'Rani', 'Chotu', 'Bijli'];

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 15000 });
const rooms = new Map();

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.get('/health', (req, res) => res.json({ ok: true, rooms: rooms.size }));

/* ---------- helpers ---------- */
const clamp = Shared.clamp;
const rand = () => Math.random();

function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do c = Array.from({ length: 4 }, () => A[crypto.randomInt(A.length)]).join('');
  while (rooms.has(c));
  return c;
}

function cleanName(name) {
  const n = String(name || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
  return n.length >= 1 && n.length <= 14 ? n : null;
}

function newRoom(quick) {
  return {
    code: makeCode(), quick: !!quick, phase: 'lobby', hostId: null, players: [],
    settings: { laps: 2, bots: quick ? 5 : 3 },
    riders: new Map(), seed: 0, startAt: 0, firstFinishAt: 0, results: null, race: 0,
    cleanupTimer: null,
  };
}
const newPlayer = (name) => ({ id: crypto.randomUUID(), name, socketId: null, connected: false, dropTimer: null });
const getPlayer = (room, id) => room.players.find((p) => p.id === id);
const connected = (room) => room.players.filter((p) => p.connected);

function transferHostIfNeeded(room) {
  const host = getPlayer(room, room.hostId);
  if (host && host.connected) return;
  const next = connected(room)[0];
  if (next) room.hostId = next.id;
}

function deleteRoom(room) {
  clearTimeout(room.cleanupTimer);
  room.players.forEach((p) => clearTimeout(p.dropTimer));
  rooms.delete(room.code);
}

function scheduleCleanup(room) {
  if (connected(room).length) return;
  clearTimeout(room.cleanupTimer);
  room.cleanupTimer = setTimeout(() => deleteRoom(room), ROOM_IDLE_MS);
}

/* ---------- views ---------- */
function lobbyView(room, pid) {
  return {
    code: room.code, phase: room.phase, quick: room.quick, hostId: room.hostId, me: pid,
    settings: room.settings, maxHumans: MAX_HUMANS, maxRiders: MAX_RIDERS,
    players: room.players.map((p) => ({ id: p.id, name: p.name, connected: p.connected })),
    results: room.results,
  };
}
function sendLobby(room) {
  room.players.forEach((p) => p.connected && p.socketId && io.to(p.socketId).emit('lobby', lobbyView(room, p.id)));
}
function racePayload(room, pid) {
  const me = room.riders.get(pid);
  return {
    race: room.race, seed: room.seed, laps: room.settings.laps, startAt: room.startAt, now: Date.now(),
    riders: [...room.riders.values()].map((r) => ({ id: r.id, name: r.name, color: r.color, bot: r.bot })),
    you: me ? { d: me.d, x: me.x, h: me.h, finished: !!me.finish } : null,
  };
}

/* ---------- race ---------- */
function startRace(room) {
  const humans = connected(room);
  if (!humans.length) return;
  const nBots = clamp(room.settings.bots, 0, MAX_RIDERS - humans.length);
  const botNames = BOT_NAMES.slice().sort(() => rand() - 0.5);
  const lineup = humans.map((p) => ({ id: p.id, name: p.name, bot: false }));
  for (let i = 0; i < nBots; i++) lineup.push({ id: `bot-${i}-${crypto.randomUUID().slice(0, 6)}`, name: botNames[i], bot: true });
  lineup.sort(() => rand() - 0.5);

  room.race += 1;
  room.seed = crypto.randomInt(1, 2 ** 31 - 1);
  room.results = null;
  room.firstFinishAt = 0;
  room.riders = new Map();
  room.startAt = Date.now() + 4000;
  const lanes = [-0.6, 0, 0.6];
  lineup.forEach((r, i) => {
    const x = lanes[i % 3];
    room.riders.set(r.id, {
      ...r, color: COLORS[i % COLORS.length],
      d: -Math.floor(i / 3) * 450, x, tx: x, s: 0, h: 100,
      crashedUntil: 0, c: false, punch: null, nextPunch: 0, nextLane: 0,
      kos: 0, finish: null, lastSeen: Date.now(), skill: 0.76 + rand() * 0.1,
    });
  });
  room.phase = 'racing';
  room.players.forEach((p) => p.connected && p.socketId && io.to(p.socketId).emit('race', racePayload(room, p.id)));
}

function hit(room, attacker, target, dmg, side) {
  const now = Date.now();
  if (!target || now < target.crashedUntil || now < room.startAt) return;
  target.h -= dmg;
  let ko = false;
  if (target.h <= 0) {
    ko = true;
    target.h = 100;
    target.crashedUntil = now + KO_MS;
    target.s = 0;
    if (attacker) attacker.kos += 1;
  }
  if (target.bot) {
    target.s *= 0.8;
    target.x = clamp(target.x + (side === 'l' ? -0.18 : 0.18), -1.1, 1.1);
    target.tx = clamp(target.x, -0.7, 0.7);
  }
  io.to(room.code).emit('hit', { from: attacker ? attacker.id : null, to: target.id, dmg, ko, side, h: target.h });
}

function updateBots(room, dt, now) {
  const riders = [...room.riders.values()];
  const humans = riders.filter((r) => !r.bot && getPlayer(room, r.id)?.connected);
  const leadHuman = humans.length ? Math.max(...humans.map((r) => r.d)) : null;
  riders.forEach((b) => {
    if (!b.bot) return;
    if (now < b.crashedUntil) { b.s = 0; b.c = true; return; }
    b.c = false;
    let target = MAX * b.skill;
    if (leadHuman !== null) {
      const gap = b.d - leadHuman;
      if (gap > 8000) target = MAX * 0.6;
      else if (gap < -6000) target = MAX * 0.93;
    }
    if (b.finish) target = MAX * 0.5;
    b.s += (target - b.s) * Math.min(1, dt * 0.9);
    b.d += b.s * dt;
    if (now > b.nextLane) {
      b.tx = [-0.6, 0, 0.6][Math.floor(rand() * 3)] + (rand() - 0.5) * 0.2;
      b.nextLane = now + 2000 + rand() * 2500;
    }
    b.x += (b.tx - b.x) * Math.min(1, dt * 1.5);
    if (!b.finish && b.d >= room.settings.laps * L) {
      b.finish = now - room.startAt;
      if (!room.firstFinishAt) room.firstFinishAt = now;
    }
    if (now > b.nextPunch) {
      const victim = humans.find((r) => now >= r.crashedUntil && !r.c && Math.abs(r.d - b.d) < 260 && Math.abs(r.x - b.x) < 0.5);
      if (victim) {
        b.nextPunch = now + 1100 + rand() * 1600;
        if (rand() < 0.55) {
          const side = victim.x < b.x ? 'l' : 'r';
          b.punch = { side, at: now };
          hit(room, b, victim, BOT_PUNCH_DMG, side);
        }
      }
    }
  });
}

function endRace(room) {
  const list = [...room.riders.values()];
  const finished = list.filter((r) => r.finish).sort((a, b) => a.finish - b.finish);
  const rest = list.filter((r) => !r.finish).sort((a, b) => b.d - a.d);
  room.results = finished.concat(rest).map((r, i) => ({
    id: r.id, name: r.name, bot: r.bot, color: r.color, place: i + 1,
    time: r.finish || null, kos: r.kos, dnf: !r.finish && !r.bot,
  }));
  room.phase = 'results';
  io.to(room.code).emit('results', { results: room.results, laps: room.settings.laps });
  sendLobby(room);
}

function tickRoom(room, dt) {
  const now = Date.now();
  if (now >= room.startAt) {
    updateBots(room, dt, now);
    const humans = [...room.riders.values()].filter((r) => !r.bot && getPlayer(room, r.id)?.connected);
    const hardCap = (room.settings.laps * L) / (MAX * 0.22) * 1000 + 15000;
    if (
      !humans.length ||
      humans.every((r) => r.finish) ||
      (room.firstFinishAt && now - room.firstFinishAt > AFTER_FIRST_FINISH_MS) ||
      now - room.startAt > hardCap
    ) return endRace(room);
  }
  const r = [];
  room.riders.forEach((x) => {
    if (!x.bot && !getPlayer(room, x.id)?.connected) return;
    const crashed = x.c || now < x.crashedUntil;
    const p = x.punch && now - x.punch.at < 280 ? x.punch.side : 0;
    r.push([x.id, Math.round(x.d), Math.round(x.x * 100) / 100, Math.round(x.s), x.h, crashed ? 1 : 0, p]);
  });
  io.to(room.code).emit('snap', { t: now, firstFinishAt: room.firstFinishAt || 0, r });
}

let lastTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = Math.min(0.2, (now - lastTick) / 1000);
  lastTick = now;
  rooms.forEach((room) => room.phase === 'racing' && tickRoom(room, dt));
}, TICK_MS);

/* ---------- sockets ---------- */
io.on('connection', (socket) => {
  let ctx = null;
  const err = (m) => socket.emit('errorMsg', m);
  const curRoom = () => (ctx ? rooms.get(ctx.code) : null);
  const isHost = (room) => room && ctx && room.hostId === ctx.pid;
  const myRider = (room) => room && room.riders.get(ctx.pid);

  function attach(room, p) {
    ctx = { code: room.code, pid: p.id };
    p.socketId = socket.id;
    p.connected = true;
    clearTimeout(p.dropTimer);
    clearTimeout(room.cleanupTimer);
    socket.join(room.code);
    transferHostIfNeeded(room);
    socket.emit('joined', { code: room.code, playerId: p.id });
    sendLobby(room);
    if (room.phase === 'racing' && room.riders.has(p.id)) socket.emit('race', racePayload(room, p.id));
  }

  function detach(leaving) {
    const room = curRoom();
    if (!room) return;
    const p = getPlayer(room, ctx.pid);
    socket.leave(room.code);
    ctx = null;
    if (!p || p.socketId !== socket.id) return;
    p.connected = false;
    p.socketId = null;
    if (leaving && room.phase !== 'racing') room.players = room.players.filter((x) => x !== p);
    else if (room.phase === 'lobby') {
      p.dropTimer = setTimeout(() => {
        if (p.connected || room.phase !== 'lobby') return;
        room.players = room.players.filter((x) => x !== p);
        transferHostIfNeeded(room);
        sendLobby(room);
      }, LOBBY_DROP_MS);
    }
    if (!room.players.length) return deleteRoom(room);
    transferHostIfNeeded(room);
    scheduleCleanup(room);
    sendLobby(room);
  }

  socket.on('quick', ({ name } = {}) => {
    const n = cleanName(name);
    if (!n) return err('Enter a name between 1 and 14 characters.');
    detach(true);
    const room = newRoom(true);
    const p = newPlayer(n);
    room.players.push(p);
    room.hostId = p.id;
    rooms.set(room.code, room);
    attach(room, p);
    startRace(room);
  });

  socket.on('create', ({ name } = {}) => {
    const n = cleanName(name);
    if (!n) return err('Enter a name between 1 and 14 characters.');
    detach(true);
    const room = newRoom(false);
    const p = newPlayer(n);
    room.players.push(p);
    room.hostId = p.id;
    rooms.set(room.code, room);
    attach(room, p);
  });

  socket.on('join', ({ code, name } = {}) => {
    const n = cleanName(name);
    if (!n) return err('Enter a name between 1 and 14 characters.');
    const room = rooms.get(String(code || '').trim().toUpperCase());
    if (!room || room.quick) return err('No room with that code. Check the 4 letters with your host.');
    if (room.phase === 'racing') return err('A race is on in that room. Join when it finishes.');
    if (room.players.length >= MAX_HUMANS) return err(`That room is full (${MAX_HUMANS} riders).`);
    if (room.players.some((p) => p.name.toLowerCase() === n.toLowerCase())) return err('Someone in that room already uses that name.');
    detach(true);
    const p = newPlayer(n);
    room.players.push(p);
    attach(room, p);
  });

  socket.on('rejoin', ({ code, playerId } = {}) => {
    const room = rooms.get(String(code || '').toUpperCase());
    const p = room && getPlayer(room, playerId);
    if (!p) return socket.emit('rejoinFailed');
    if (p.socketId && p.socketId !== socket.id) io.to(p.socketId).emit('replaced');
    attach(room, p);
  });

  socket.on('settings', (patch = {}) => {
    const room = curRoom();
    if (!isHost(room) || room.phase === 'racing') return;
    if ([1, 2, 3, 5].includes(patch.laps)) room.settings.laps = patch.laps;
    if (Number.isInteger(patch.bots) && patch.bots >= 0 && patch.bots <= 7) room.settings.bots = patch.bots;
    sendLobby(room);
  });

  socket.on('start', () => {
    const room = curRoom();
    if (!isHost(room) || room.phase === 'racing') return;
    startRace(room);
  });

  socket.on('again', () => {
    const room = curRoom();
    if (!isHost(room) || room.phase !== 'results') return;
    if (room.quick) startRace(room);
    else {
      room.phase = 'lobby';
      sendLobby(room);
    }
  });

  socket.on('state', (m = {}) => {
    const room = curRoom();
    const r = myRider(room);
    if (!r || room.phase !== 'racing') return;
    const now = Date.now();
    const dt = (now - r.lastSeen) / 1000;
    r.lastSeen = now;
    const d = Number(m.d);
    if (Number.isFinite(d)) {
      const maxD = now < room.startAt ? r.d : r.d + MAX * 1.2 * dt + 400;
      r.d = clamp(d, r.d - 3000, maxD);
    }
    if (Number.isFinite(Number(m.x))) r.x = clamp(Number(m.x), -2.5, 2.5);
    if (Number.isFinite(Number(m.s))) r.s = clamp(Number(m.s), 0, MAX);
    r.c = !!m.c;
  });

  socket.on('punch', (side) => {
    const room = curRoom();
    const a = myRider(room);
    const now = Date.now();
    if (!a || room.phase !== 'racing' || now < room.startAt || now < a.nextPunch || now < a.crashedUntil) return;
    if (side !== 'l' && side !== 'r') return;
    a.nextPunch = now + 380;
    a.punch = { side, at: now };
    let best = null;
    room.riders.forEach((t) => {
      if (t === a || (!t.bot && !getPlayer(room, t.id)?.connected)) return;
      const dd = Math.abs(t.d - a.d);
      const dx = side === 'l' ? a.x - t.x : t.x - a.x;
      if (dd < 320 && dx > 0.05 && dx < 0.6 && (!best || dd < best.dd)) best = { t, dd };
    });
    if (best) hit(room, a, best.t, PUNCH_DMG, side);
  });

  socket.on('crash', () => {
    const room = curRoom();
    const r = myRider(room);
    if (r && room.phase === 'racing') hit(room, null, r, TRAFFIC_DMG, 'l');
  });

  socket.on('finish', () => {
    const room = curRoom();
    const r = myRider(room);
    if (!r || room.phase !== 'racing' || r.finish) return;
    if (r.d < room.settings.laps * L - 1500) return;
    r.finish = Date.now() - room.startAt;
    if (!room.firstFinishAt) room.firstFinishAt = Date.now();
  });

  socket.on('leave', () => {
    detach(true);
    socket.emit('left');
  });

  socket.on('disconnect', () => detach(false));
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`Highway Hustle running on http://localhost:${PORT}`));
}

module.exports = { server, rooms, TRACK };
