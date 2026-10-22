// Advances the village by the real time that has passed since state.json was written.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Sim = require('./sim.js');
import { consult } from './council.mjs';
const FILE = 'state.json';
const MAX_CATCHUP = 6 * 3600; // never simulate more than six hours in one run
const SCALE = Number(process.env.TIMESCALE) || 32; // village seconds per real second
const now = Date.now();
let meta;
let raw = null;
if (fs.existsSync(FILE)) { raw = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (!raw.state || raw.state.v !== 3) { console.log('Old world format, starting a new one'); raw = null; } }
if (raw) {
  meta = raw.meta || {};
  Sim.load(raw.state);
  const elapsed = Math.min(MAX_CATCHUP, Math.max(0, ((now - (meta.savedAt || now)) / 1000) * SCALE));
  console.log(`Fast-forwarding ${elapsed.toFixed(0)} s of village life`);
  Sim.advance(elapsed);
  try {
    const S0 = Sim.S;
    if (process.env.GITHUB_TOKEN && S0.invq.length < 2) {
      const r = await consult(Sim.helpers.summary(), process.env.GITHUB_TOKEN);
      console.log('Council proposed', Sim.helpers.applyCouncil(r), 'inventions');
    }
  } catch (e) { console.log('Council unavailable:', String(e.message || e).slice(0, 200)); }
} else {
  Sim.create((now & 0x7fffffff) | 1);
  meta = { bornAt: now };
  console.log('A new island is born');
}
meta.savedAt = now;
meta.scale = SCALE;
meta.bornAt = meta.bornAt || now;
fs.writeFileSync(FILE, JSON.stringify({ meta, state: Sim.S }));
const S = Sim.S;
console.log(`day ${Math.floor(S.time / Sim.DAYLEN) + 1} | pop ${S.vill.length} | buildings ${S.blds.length} | techs ${Object.keys(S.tech.done).length} | islands ${S.islands}`);
