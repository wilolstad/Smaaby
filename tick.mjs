// Advances the village by the real time that has passed since state.json was written.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Sim = require('./sim.js');
const FILE = 'state.json';
const MAX_CATCHUP = 3 * 3600; // never simulate more than three hours in one run
const now = Date.now();
let meta;
if (fs.existsSync(FILE)) {
  const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  meta = raw.meta || {};
  Sim.load(raw.state);
  const elapsed = Math.min(MAX_CATCHUP, Math.max(0, (now - (meta.savedAt || now)) / 1000));
  console.log(`Fast-forwarding ${elapsed.toFixed(0)} s of village life`);
  Sim.advance(elapsed);
} else {
  Sim.create((now & 0x7fffffff) | 1);
  meta = { bornAt: now };
  console.log('A new island is born');
}
meta.savedAt = now;
meta.bornAt = meta.bornAt || now;
fs.writeFileSync(FILE, JSON.stringify({ meta, state: Sim.S }));
const S = Sim.S;
console.log(`day ${Math.floor(S.time / Sim.DAYLEN) + 1} | pop ${S.vill.length} | buildings ${S.blds.length} | techs ${Object.keys(S.tech.done).length} | islands ${S.islands}`);
