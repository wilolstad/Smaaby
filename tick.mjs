// Advances the village by the real time that has passed since state.json was written.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Sim = require('./sim.js');
import { consult } from './council.mjs';
const FILE = 'state.json';
const MAX_CATCHUP = 6 * 3600; // never simulate more than six hours in one run
let fileScale = 0; try { fileScale = JSON.parse(fs.readFileSync('speed.json', 'utf8')).scale; } catch (e) {}
const SCALE = Math.min(128, Math.max(0.5, Number(fileScale) || Number(process.env.TIMESCALE) || 24)); // village seconds per real second
let EPOCH = 1; try { EPOCH = JSON.parse(fs.readFileSync('world.json', 'utf8')).epoch || 1; } catch (e) {}
const now = Date.now();
let meta;
let raw = null;
if (fs.existsSync(FILE)) { raw = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (!raw.state || raw.state.v < 3 || (raw.meta && (raw.meta.epoch || 1) !== EPOCH)) { console.log('Old world format or new epoch, starting a new one'); raw = null; } }
if (raw) {
  meta = raw.meta || {};
  Sim.load(raw.state);
  const elapsed = Math.min(MAX_CATCHUP, Math.max(0, ((now - (meta.savedAt || now)) / 1000) * SCALE));
  console.log(`Fast-forwarding ${elapsed.toFixed(0)} s of village life`);
  Sim.trim(260);
  const t0 = Date.now(); let done = 0;
  while (done < elapsed && Date.now() - t0 < 110000) { const d = Math.min(30, elapsed - done); Sim.advance(d); done += d; }
  if (done < elapsed) { console.log(`Behind: ${(elapsed - done).toFixed(0)} s left`); meta.lag = ((elapsed - done) / SCALE) * 1000; } else meta.lag = 0;
  try {
    const H = Sim.helpers, S0 = Sim.S;
    const cand = S0.tribes.filter((c) => c.alive && c.invq.length < 2);
    if (process.env.GITHUB_TOKEN && cand.length) {
      const c = cand[Math.floor(now / 60000) % cand.length];
      const r = await consult(H.withT(c, () => H.summary()), process.env.GITHUB_TOKEN);
      const n = H.withT(c, () => H.applyCouncil(r)); meta.council = c.name + ' ok ' + n + ' @' + new Date().toISOString();
      console.log('Council of', c.name, 'proposed', n, 'inventions');
    }
  } catch (e) { meta.council = 'feil: ' + String(e.message || e).slice(0, 160); console.log('Council unavailable:', meta.council); }
} else {
  Sim.create((now & 0x7fffffff) | 1);
  meta = { bornAt: now };
  console.log('A new island is born');
}
meta.savedAt = now - (meta.lag || 0);
meta.scale = SCALE;
meta.epoch = EPOCH;
meta.bornAt = meta.bornAt || now;
const snap = Sim.snapshot();
fs.writeFileSync(FILE, JSON.stringify({ meta, state: snap }));
console.log(`day ${Math.floor(snap.time / Sim.DAYLEN) + 1} | peoples ${snap.tribes.filter((c) => c.alive).map((c) => c.name + ':' + c.vill.length).join(', ')}`);
