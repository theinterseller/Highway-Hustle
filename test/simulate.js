// Runs a 1-lap race with one simulated human and 3 bots, checks results.
process.env.PORT = process.env.PORT || 3997;
const { server, TRACK } = require('../server');
const { io } = require('socket.io-client');
const L = TRACK.length;
const MAX = require('../public/shared.js').MAX_SPEED;
const fail = (m) => { console.error('FAIL:', m); process.exit(1); };
server.listen(process.env.PORT, () => {
  const c = io(`http://localhost:${process.env.PORT}`, { transports: ['websocket'] });
  let race, results, hits = 0, lobby, d = 0, x = 0;
  c.on('errorMsg', (m) => console.log('error:', m));
  c.on('lobby', (l) => (lobby = l));
  c.on('race', (r) => { race = r; d = r.you.d; x = r.you.x; });
  c.on('hit', () => hits++);
  c.on('results', (r) => (results = r.results));
  c.on('snap', (s) => {
    if (!race || Date.now() < race.startAt) return;
    const bot = s.r.find((r) => r[0].startsWith('bot') && Math.abs(r[1] - d) < 250);
    if (bot) { x = bot[2] + 0.3; c.emit('punch', 'l'); }
  });
  c.emit('create', { name: 'Tester' });
  setTimeout(() => {
    c.emit('settings', { laps: 1, bots: 3 });
    setTimeout(() => c.emit('start'), 100);
  }, 200);
  let last = Date.now();
  const iv = setInterval(() => {
    if (!race) return;
    const now = Date.now();
    const dt = (now - last) / 1000; last = now;
    if (now > race.startAt) d += MAX * 0.95 * dt;
    c.emit('state', { d, x, s: MAX * 0.95, c: 0 });
    if (d >= L) c.emit('finish');
    if (results) {
      clearInterval(iv);
      console.log('riders', race.riders.length, 'hits seen', hits);
      console.table(results.map((r) => ({ place: r.place, name: r.name, bot: r.bot, time: r.time, kos: r.kos, dnf: r.dnf })));
      if (results.length !== 4) fail('4 riders');
      if (results[0].bot) fail('human at max speed should win');
      if (lobby.phase !== 'results') fail('lobby phase results');
      c.emit('again');
      setTimeout(() => { if (lobby.phase !== 'lobby') fail('again -> lobby'); console.log('ALL TESTS PASSED'); process.exit(0); }, 300);
    }
  }, 66);
});
