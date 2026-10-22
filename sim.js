/* Småby: headless simulation. Runs identically in Node (GitHub Actions) and in the browser. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sim = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const GW = 112, GH = 112, DAYLEN = 600, DT = 0.5;
  const NB4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const NAMES = ['Mira', 'Ola', 'Siv', 'Jon', 'Eli', 'Per', 'Kari', 'Nils', 'Tuva', 'Lars', 'Ida', 'Odd', 'Maja', 'Eirik', 'Sunniva', 'Håkon', 'Live', 'Tor', 'Aud', 'Sander', 'Frida', 'Knut', 'Ragna', 'Even', 'Silje', 'Arne', 'Hedda', 'Stian', 'Vilde', 'Bjørn', 'Thea', 'Gunnar', 'Ingrid', 'Magnus', 'Nora', 'Rune', 'Selma', 'Yngve', 'Åse', 'Trym'];
  const DEF = {
    house: { n: 'Hus', cost: { wood: 8, stone: 2 }, time: 18, size: 1 },
    farm: { n: 'Åker', cost: { wood: 3 }, time: 10, size: 2 },
    well: { n: 'Brønn', cost: { stone: 6 }, time: 14, size: 1 },
    store: { n: 'Lagerhus', cost: { wood: 14, stone: 2 }, time: 20, size: 1 },
    tower: { n: 'Tårn', cost: { wood: 6, stone: 14 }, time: 30, size: 1 },
    plaza: { n: 'Torg med fontene', cost: { stone: 16 }, time: 22, size: 1 },
    library: { n: 'Bibliotek', cost: { wood: 12, stone: 8 }, time: 26, size: 1 },
    mill: { n: 'Vindmølle', cost: { wood: 14, stone: 6 }, time: 28, size: 1 },
    landfill: { n: 'Landfylling', cost: { stone: 3 }, time: 10, size: 1 },
    bridge: { n: 'Bro', cost: { wood: 3 }, time: 7, size: 1 }
  };
  const TECHS = {
    tools: { n: 'Bedre verktøy', cost: 150, req: [], d: 'Alt arbeid går 25 % raskere' },
    wheel: { n: 'Hjulet', cost: 220, req: ['tools'], d: 'Bærer flere ressurser per tur' },
    irrig: { n: 'Vanning', cost: 260, req: ['tools'], d: 'Åkrene gror raskere' },
    masonry: { n: 'Murverk', cost: 300, req: ['tools'], d: 'Hus får plass til tre' },
    bridge: { n: 'Brobygging', cost: 340, req: ['tools'], d: 'Bro over vann med planker' },
    lantern: { n: 'Lykter', cost: 360, req: ['masonry'], d: 'Kortere natt og mer arbeid i mørket' },
    sawmill: { n: 'Sagbruk', cost: 420, req: ['wheel'], d: 'Hvert tre gir flere planker' },
    medicine: { n: 'Urtemedisin', cost: 480, req: ['irrig'], d: 'Mindre matsvinn' },
    windmill: { n: 'Vindmølle', cost: 520, req: ['irrig'], d: 'Åpner for vindmøller som øker avlingen' },
    astro: { n: 'Stjernekunst', cost: 620, req: ['lantern'], d: 'Forskerne jobber 25 % raskere' },
    quarry: { n: 'Steinbrudd', cost: 380, req: ['masonry'], d: 'Hver stein gir dobbelt så mye' },
    timber: { n: 'Tømmerbygg', cost: 450, req: ['sawmill'], d: 'Hus bygges av tre alene' },
    cartog: { n: 'Kartlegging', cost: 800, req: ['astro', 'bridge'], d: 'Utforskerne finner nye landområder raskere' },
    guild: { n: 'Laug', cost: 1000, req: ['timber', 'quarry'], d: 'Byggere jobber 40 % raskere' },
    harvest: { n: 'Høstfest', cost: 1300, req: ['guild', 'medicine'], d: 'Landsbyen vokser raskere' }
  };
  for (const k in TECHS) TECHS[k].cost = Math.round(TECHS[k].cost * 2.5);
  const EFFECTS = { farm_growth: 'Åkrene gror raskere', work_speed: 'Alt arbeid går raskere', carry: 'Bærer mer per tur', walk: 'Går raskere', research: 'Forskning går raskere', build: 'Bygger raskere', food_save: 'Mindre matsvinn', pop_cap: 'Plass til flere innbyggere' };
  const ROOFS = ['flat', 'pointed', 'dome', 'none'];
  let S = null;
  const defOf = (t) => DEF[t] || (S && S.defs && S.defs[t]);
  const techInfo = (k) => TECHS[k] || (S.invInfo && S.invInfo[k]);
  function eff(k) {
    let s = 0;
    for (const key in S.inv) { const i = S.invInfo[key]; if (i && i.effect && i.effect.type === k) s += i.effect.value * (S.defs[key] ? Math.min(6, S.blds.filter((id) => S.objs[id] && S.objs[id].type === key).length) : 1); }
    return 1 + s;
  }

  // ---------- deterministic rng stored in state
  function R() {
    S.rs = (S.rs + 0x6D2B79F5) | 0;
    let t = Math.imul(S.rs ^ (S.rs >>> 15), 1 | S.rs);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ss = (t) => t * t * (3 - 2 * t);
  const G = (x, y) => (x >= 0 && y >= 0 && x < GW && y < GH ? S.grid[y * GW + x] : null);
  const OB = (g) => (g && g.o ? S.objs[g.o] : null);
  const T = (id) => (id ? S.objs[id] || null : null);
  const hasTech = (k) => !!S.tech.done[k];
  const elev = (g) => (g.k === 'water' ? 0.35 : g.k === 'bridge' ? 0.7 : g.h);
  function newObj(o) { o.id = ++S.nid; S.objs[o.id] = o; return o; }
  function setObj(x, y, o) { G(x, y).o = o ? o.id : 0; }
  function dropObj(o) { for (const g of S.grid) if (g.o === o.id) g.o = 0; delete S.objs[o.id]; }
  function log(text) {
    S.log.push({ t: Math.round(S.time), text });
    if (S.log.length > 120) S.log.shift();
  }
  function ev(type, x, y, h, extra) { if (S.ev) S.ev.push(Object.assign({ type, x, y, h }, extra || {})); }

  // ---------- world generation
  function lat(n) { return Array.from({ length: n }, () => Array.from({ length: n }, () => R())); }
  function vn(L, n, x, y) {
    const gx = (x / (GW - 1)) * (n - 2), gy = (y / (GH - 1)) * (n - 2), ix = Math.floor(gx), iy = Math.floor(gy), fx = ss(gx - ix), fy = ss(gy - iy);
    const a = L[iy][ix], b = L[iy][ix + 1], c = L[iy + 1][ix], d = L[iy + 1][ix + 1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function genWorld() {
    const L1 = lat(9), L2 = lat(18), L3 = lat(14);
    const cx = GW / 2, cy = GH / 2, blobs = [[cx, cy, 15]];
    const ang0 = R() * 6.28, count = 8;
    for (let i = 0; i < count; i++) {
      const a = ang0 + (i / count) * 6.28 + (R() - 0.5) * 0.5, dist = 22 + R() * 22, r = 5 + R() * 5;
      blobs.push([cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, r]);
    }
    S.grid = [];
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      let b = 0;
      for (const [bx, by, br] of blobs) { const d = Math.hypot(x - bx, y - by) / br; b = Math.max(b, Math.pow(clamp(1 - d, 0, 1), 0.75)); }
      const n = b * 0.62 + vn(L1, 9, x, y) * 0.2 + vn(L2, 18, x, y) * 0.18 - 0.02;
      let k = 'grass', h = 1;
      if (n < 0.3) { k = 'water'; h = 0; } else if (n < 0.35) { k = 'sand'; h = 1; } else if (n < 0.66) { k = 'grass'; h = 1; } else if (n < 0.78) { k = 'grass'; h = 2; } else { k = 'stone'; h = 3; }
      S.grid.push({ k, h, o: 0, deco: null, tr: 0, d: 0, f: vn(L3, 14, x, y), r: R() });
    }
    const mx = GW >> 1, my = GH >> 1;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const g = G(x, y); if (Math.hypot(x - mx, y - my) < 4.6) { g.k = 'grass'; g.h = 1; } }
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const g = G(x, y); if (Math.hypot(x - mx, y - my) < 3.2) continue;
      if (g.k === 'grass') {
        if ((g.f > 0.55 && R() < 0.5) || R() < 0.03) setObj(x, y, newObj({ type: 'tree', claimed: 0, v: R(), born: -9999 }));
        else if (R() < 0.03) setObj(x, y, newObj({ type: 'bush', berries: true, regrow: 0, claimed: 0 }));
        else if (g.h > 1 && R() < 0.1) setObj(x, y, newObj({ type: 'rock', amt: 2, claimed: 0 }));
      }
      if (g.k === 'stone' && R() < 0.3) setObj(x, y, newObj({ type: 'rock', amt: 2, claimed: 0 }));
      if (g.k === 'sand' && R() < 0.03) setObj(x, y, newObj({ type: 'rock', amt: 2, claimed: 0 }));
    }
    const near = (t) => { let c = 0; for (let y = my - 10; y <= my + 10; y++) for (let x = mx - 10; x <= mx + 10; x++) { const o = OB(G(x, y)); if (o && o.type === t) c++; } return c; };
    const place = (t, k) => {
      let tries = 0;
      while (near(t) < k && tries++ < 400) {
        const x = mx + Math.floor(R() * 21) - 10, y = my + Math.floor(R() * 21) - 10, g = G(x, y);
        if (!g || g.o || g.k === 'water' || Math.hypot(x - mx, y - my) < 4) continue;
        setObj(x, y, newObj(t === 'tree' ? { type: 'tree', claimed: 0, v: R(), born: -9999 } : t === 'rock' ? { type: 'rock', amt: 2, claimed: 0 } : { type: 'bush', berries: true, regrow: 0, claimed: 0 }));
      }
    };
    place('tree', 18); place('rock', 8); place('bush', 6);
  }

  // ---------- init / (de)serialise
  function create(seed) {
    S = { v: 3, rs: seed | 0 || 1234567, time: 0, nid: 0, objs: {}, grid: [], vill: [], sites: [], blds: [], storages: [], res: { wood: 14, stone: 3, food: 12 }, log: [], tech: { done: {}, cur: null, prog: 0 }, islands: 1, vid: 0, growT: 0, eatT: 0, planT: 0, thinkT: 0, lastDay: -1, nightLogged: false, expandT: 0, ev: null, defs: {}, inv: {}, invInfo: {}, invq: [], thoughts: {}, goal: null, nInv: 0, scanT: 0, reach: null, stats: { built: 0, born: 0 } };
    genWorld();
    const cx = GW >> 1, cy = GH >> 1;
    const fire = newObj({ type: 'fire', storage: true, x: cx, y: cy, size: 1 }); setObj(cx, cy, fire); S.storages.push(fire.id);
    [[-2, 1], [2, -1]].forEach(([dx, dy]) => setObj(cx + dx, cy + dy, newObj({ type: 'tent', x: cx + dx, y: cy + dy, size: 1, cap: 2, sleepers: 0 })));
    for (let i = 0; i < 4; i++) addVillager(cx - 1 + (i % 2), cy + 2 + (i >> 1), true);
    log('Fire reisende slår leir på en flytende øy.');
    chooseResearch();
    scan();
    return S;
  }
  function serialize() {
    return JSON.stringify(S);
  }
  function load(json) {
    S = typeof json === 'string' ? JSON.parse(json) : json;
    S.ev = null;
    return S;
  }

  // ---------- helpers
  function pickTrait() {
    const all = ['flittig', 'nysgjerrig', 'rolig', 'modig', 'sosial', 'tankefull'];
    return all[Math.floor(R() * all.length)];
  }
  function brainFor() {
    const w = { build: 0.8 + R() * 0.4, study: 0.8 + R() * 0.4, tree: 0.8 + R() * 0.4, rock: 0.8 + R() * 0.4, bush: 0.8 + R() * 0.4, farm: 0.8 + R() * 0.4 };
    if (S.vill && S.vill.length > 1) { const a = S.vill[Math.floor(R() * S.vill.length)], b = S.vill[Math.floor(R() * S.vill.length)]; if (a.w && b.w) for (const k in w) w[k] = clamp((a.w[k] + b.w[k]) / 2 + (R() - 0.5) * 0.2, 0.5, 2.2); }
    return w;
  }
  function learn(v, k) { if (!v.w) return; v.w[k] = clamp(v.w[k] + 0.025, 0.5, 2.2); for (const j in v.w) v.w[j] += (1 - v.w[j]) * 0.008; }
  function addVillager(x, y, silent) {
    const used = new Set(S.vill.map((v) => v.name));
    const free = NAMES.filter((n) => !used.has(n));
    const name = free.length ? free[Math.floor(R() * free.length)] : 'Gjest ' + (S.vid + 1);
    const trait = pickTrait();
    const v = {
      id: ++S.vid, name, x: x + 0.5, y: y + 0.5, z: 1, path: [], state: 'idle', task: null, timer: 0, carry: null, role: 'idle', hidden: false, sleeping: false, face: 1, bob: R() * 6, idle: R() * 2,
      speed: 1.9 + R() * 0.6, trait, dil: trait === 'flittig' ? 1.15 : trait === 'rolig' ? 0.92 : 1, cur: trait === 'nysgjerrig' ? 0.95 : trait === 'tankefull' ? 0.8 : 0.3 + R() * 0.3,
      sk: { wood: 0, stone: 0, food: 0, build: 0, study: 0 }, age: 0, w: brainFor(),
      hair: [[60, 40, 28], [200, 150, 70], [30, 24, 24], [150, 70, 40], [210, 200, 190]][Math.floor(R() * 5)],
      skin: [[241, 194, 160], [224, 170, 130], [190, 134, 98], [150, 100, 70]][Math.floor(R() * 4)]
    };
    S.vill.push(v);
    if (!silent) { S.stats.born++; log('Ny innbygger: ' + name + ' (' + trait + ').'); }
    return v;
  }
  const lvl = (v, k) => Math.floor(Math.sqrt(v.sk[k]));
  const skillMult = (v, k) => (1 + 0.05 * lvl(v, k)) * v.dil;
  const count = (t) => S.blds.filter((id) => T(id) && T(id).type === t).length + S.sites.filter((id) => T(id) && T(id).type === t && !T(id).done).length;
  function houses() { return S.blds.filter((id) => T(id) && T(id).type === 'house').length; }
  const phase = () => (S.time % DAYLEN) / DAYLEN;
  const lightAt = (p) => (p < 0.55 ? 1 : p < 0.7 ? 1 - (p - 0.55) / 0.15 : p < 0.92 ? 0 : (p - 0.92) / 0.08);
  const light = () => lightAt(phase());
  const sleepLight = () => (hasTech('lantern') ? 0.16 : 0.3);
  const cap = () => Math.floor((4 + houses() * (hasTech('masonry') ? 3 : 2)) * eff('pop_cap'));
  const cost = (type) => {
    const base = Object.assign({}, defOf(type).cost); if (type === 'house' && hasTech('timber')) { base.wood = 10; delete base.stone; }
    const n = Math.max(0, count(type) - 2), f = type === 'landfill' || type === 'bridge' ? 1 : 1 + n * 0.08, out = {};
    for (const k in base) out[k] = Math.ceil(base[k] * f);
    return out;
  };
  const afford = (c) => Object.entries(c).every(([k, v]) => S.res[k] >= v);

  // ---------- reachability + islands
  const walkable = (x, y) => { const g = G(x, y); if (!g || g.k === 'water') return false; const o = OB(g); return !o || o.walk; };
  function scan() {
    // flood fill over land (ignoring objects) from the fire
    const reach = new Uint8Array(GW * GH), fire = T(S.storages[0]);
    const q = [fire.y * GW + fire.x]; reach[q[0]] = 1;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % GW, y = (i / GW) | 0;
      for (const [dx, dy] of NB4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue; const j = ny * GW + nx; if (reach[j] || S.grid[j].k === 'water') continue; reach[j] = 1; q.push(j); }
    }
    S.reach = reach;
    // count islands reached = distinct land components reachable (main plus connected). Track "regions discovered" by unreachable→reachable events
    let landReach = 0; for (let i = 0; i < reach.length; i++) if (reach[i]) landReach++;
    if (S.lastReach && landReach > S.lastReach + 40) { S.islands++; log('Landet har vokst! Nytt område nådd, øy nr. ' + S.islands + '.'); S.tech.prog += 40; }
    S.lastReach = landReach;
    S.landReach = landReach;
  }

  // ---------- pathfinding
  function bfs(sx, sy, goal, limit) {
    limit = limit || 9000;
    const prev = new Int16Array(GW * GH).fill(-2), q = [sy * GW + sx];
    prev[q[0]] = -1; let found = null, fi = -1;
    for (let qi = 0; qi < q.length && qi < limit; qi++) {
      const i = q[qi], x = i % GW, y = (i / GW) | 0, r = goal(x, y);
      if (r) { found = r; fi = i; break; }
      for (const [dx, dy] of NB4) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const j = ny * GW + nx; if (prev[j] !== -2 || !walkable(nx, ny)) continue; prev[j] = i; q.push(j);
      }
    }
    if (fi < 0) return null;
    const path = []; let c = fi; while (prev[c] >= 0) { path.push([c % GW, (c / GW) | 0]); c = prev[c]; } path.reverse();
    return { path, node: found };
  }
  const tile = (v) => [clamp(Math.floor(v.x), 0, GW - 1), clamp(Math.floor(v.y), 0, GH - 1)];
  const adj = (x, y, fn) => { for (const [dx, dy] of NB4) { const o = OB(G(x + dx, y + dy)); if (o) { const r = fn(o); if (r) return r; } } return null; };

  // ---------- economy planning
  function nextType() {
    const h = count('house'), f = count('farm'), p = S.vill.length, c = cap();
    if (h < 1) return 'house';
    if (f < 1) return 'farm';
    if (p >= c - 1) return 'house';
    if (f < Math.ceil(p / 4)) return 'farm';
    if (count('well') < Math.max(1, Math.ceil(h / 8)) && h >= 3) return 'well';
    if (count('library') < Math.max(1, Math.ceil(h / 12)) && h >= 4) return 'library';
    if (count('store') < Math.max(1, Math.ceil(h / 10)) && h >= 4) return 'store';
    if (count('tower') < Math.max(1, Math.ceil(h / 14)) && h >= 6) return 'tower';
    if (count('plaza') < Math.max(1, Math.ceil(h / 16)) && h >= 8) return 'plaza';
    if (hasTech('windmill') && count('mill') < Math.floor(f / 3)) return 'mill';
    if (p >= 8) for (const k in S.defs) if (count(k) < Math.max(S.defs[k].max, Math.ceil(h / 6)) && h >= 5) return k;
    return 'house';
  }
  function center() {
    let sx = GW / 2, sy = GH / 2, n = 1;
    for (const id of S.blds) { const b = T(id); if (b) { sx += b.x; sy += b.y; n++; } }
    return [sx / n, sy / n];
  }
  function fits(x, y, sz, type) {
    const g0 = G(x, y); if (!g0) return false;
    for (let j = 0; j < sz; j++) for (let i = 0; i < sz; i++) {
      const g = G(x + i, y + j);
      if (!g || g.o || (g.k !== 'grass' && g.k !== 'sand') || g.h !== g0.h || !S.reach[(y + j) * GW + x + i]) return false;
    }
    if (sz === 1) { for (const [dx, dy] of NB4) { const o = OB(G(x + dx, y + dy)); if (o && (o.type === 'tent' || o.type === 'fire' || o.type === 'site' || (o.size && o.type !== 'farm'))) return false; } }
    else { for (let j = -1; j <= sz; j++) for (let i = -1; i <= sz; i++) { const o = OB(G(x + i, y + j)); if (o && o.type === 'fire') return false; } }
    return true;
  }
  function findSpot(type) {
    const sz = defOf(type).size, [cx, cy] = center(), c = [];
    const maxR = 12 + Math.sqrt(S.blds.length) * 3;
    for (let y = 2; y < GH - 3; y++) for (let x = 2; x < GW - 3; x++) {
      const d = Math.hypot(x - cx, y - cy); if (d < 2.2 || d > maxR) continue;
      c.push([d + R() * 2.5, x, y]);
    }
    c.sort((a, b) => a[0] - b[0]);
    for (const [, x, y] of c) if (fits(x, y, sz, type)) return [x, y];
    return null;
  }
  function makeSite(type, x, y) {
    const d = defOf(type), c = cost(type);
    for (const k in c) S.res[k] -= c[k];
    const site = newObj({ type: 'site', what: type, x, y, size: d.size, prog: 0, time: d.time, builders: 0, maxB: type === 'tower' ? 3 : 2, done: false });
    for (let j = 0; j < d.size; j++) for (let i = 0; i < d.size; i++) setObj(x + i, y + j, site);
    S.sites.push(site.id);
    return site;
  }
  function openSites() { return S.sites.filter((id) => T(id) && !T(id).done); }
  function planner() {
    const open = openSites().length, pop = S.vill.length;
    if (open >= (pop >= 12 ? 3 : pop >= 8 ? 2 : 1)) return;
    const t = nextType();
    if (afford(cost(t))) {
      const sp = findSpot(t);
      if (sp) { makeSite(t, sp[0], sp[1]); log('Byggeplass: ' + defOf(t).n.toLowerCase() + '.'); return; }
      S.noSpot = (S.noSpot || 0) + 1;
    }
    maybeExpand();
  }
  function maybeExpand() {
    if (S.sites.some((id) => T(id) && (T(id).what === 'landfill' || T(id).what === 'bridge') && !T(id).done)) return;
    const pop = S.vill.length; if (pop < 6) return;
    let trees = 0, rocks = 0; for (let i = 0; i < GW * GH; i++) { if (!S.reach[i]) continue; const o = OB(S.grid[i]); if (o) { if (o.type === 'tree') trees++; else if (o.type === 'rock') rocks++; } }
    const need = (S.noSpot || 0) > 3 || S.res.wood > 60 && S.res.stone > 12 || trees < 8 || rocks < 4 || (S.res.wood > 40 && S.res.stone > 20);
    if (!need) return;
    const bridge = hasTech('bridge') && S.res.wood >= 3, fill = S.res.stone >= 3;
    if (!bridge && !fill) return;
    // BFS across water from reachable coast to the nearest unreached land
    const prev = new Int16Array(GW * GH).fill(-2), q = [];
    for (let i = 0; i < GW * GH; i++) {
      if (S.grid[i].k !== 'water') continue; const x = i % GW, y = (i / GW) | 0;
      for (const [dx, dy] of NB4) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < GW && ny < GH && S.reach[ny * GW + nx] && S.grid[ny * GW + nx].k !== 'water') { prev[i] = -1; q.push(i); break; } }
    }
    let goal = -1;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % GW, y = (i / GW) | 0;
      let hit = false;
      for (const [dx, dy] of NB4) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < GW && ny < GH) { const j = ny * GW + nx; if (S.grid[j].k !== 'water' && !S.reach[j]) { hit = true; break; } } }
      if (hit) { goal = i; break; }
      for (const [dx, dy] of NB4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue; const j = ny * GW + nx; if (prev[j] !== -2 || S.grid[j].k !== 'water') continue; prev[j] = i; q.push(j); }
    }
    if (goal < 0) {
      // no more land to reach: reclaim sea next to the coast, preferring tiles with many land neighbours
      if (!fill) return;
      let best = null, bs = -1;
      for (const i of q) { const x = i % GW, y = (i / GW) | 0; if (x < 2 || y < 2 || x > GW - 3 || y > GH - 3 || G(x, y).o) continue; let n = 0; for (const [dx, dy] of NB4) { const g = G(x + dx, y + dy); if (g && g.k !== 'water' && S.reach[(y + dy) * GW + x + dx]) n++; } const sc = n + R() * 1.5; if (sc > bs) { bs = sc; best = i; } }
      if (best === null || !afford(cost('landfill'))) return;
      makeSite('landfill', best % GW, (best / GW) | 0);
      if (!S.expLogged || S.time - S.expLogged > 1800) { S.expLogged = S.time; log('De legger ut nytt land i havet.'); }
      return;
    }
    let c = goal, path = []; while (c >= 0) { path.push(c); c = prev[c]; } path.reverse();
    const first = path[0]; if (path.length > 14) return;
    const type = bridge ? 'bridge' : 'landfill';
    if (!afford(cost(type))) return;
    if (G(first % GW, (first / GW) | 0).o) return;
    makeSite(type, first % GW, (first / GW) | 0);
    if (!S.expLogged || S.time - S.expLogged > 1800) { S.expLogged = S.time; log(bridge ? 'De bygger bro mot et nytt land.' : 'De fyller ut sjøen for å nå nytt land.'); }
  }
  function finishSite(s) {
    s.done = true; S.sites = S.sites.filter((id) => id !== s.id);
    if (s.what === 'landfill' || s.what === 'bridge') {
      const g = G(s.x, s.y); g.k = s.what === 'bridge' ? 'bridge' : 'sand'; g.h = 1; g.o = 0; delete S.objs[s.id]; S.stats.built++;
      ev('puff', s.x + 0.5, s.y + 0.5, 1, { n: 6 }); scan(); return;
    }
    const b = newObj({ type: s.what, x: s.x, y: s.y, size: s.size, t0: S.time, growth: 0, claimed: 0, sleepers: 0, cap: 2, storage: s.what === 'store' });
    for (let j = 0; j < s.size; j++) for (let i = 0; i < s.size; i++) setObj(s.x + i, s.y + j, b);
    delete S.objs[s.id];
    if (s.what === 'store') S.storages.push(b.id);
    S.blds.push(b.id); S.stats.built++;
    log(defOf(s.what).n + ' er ferdig.');
    ev('puff', s.x + 0.5, s.y + 0.5, 1.5, { n: 10 });
  }

  // ---------- research
  function availableTechs() { return Object.keys(TECHS).filter((k) => !S.tech.done[k] && TECHS[k].req.every((r) => S.tech.done[r])); }
  const SUBJ = ['Fiskeredskap', 'Saltlake', 'Vevstol', 'Kompass', 'Tørkestativ', 'Vannhjul', 'Smie', 'Lysestøperi', 'Tauverk', 'Frøbank', 'Kalender', 'Skriftruller', 'Mosaikk', 'Trommespråk', 'Brenneovn', 'Kartpress', 'Skipsdokk', 'Hagebruk', 'Biavl', 'Glassblåsing', 'Gjæringskunst', 'Nattvakt', 'Teater', 'Observatorium'];
  const RN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];
  function procInvention() {
    const used = new Set(Object.values(S.invInfo).map((i) => i.n));
    let name = null;
    for (let r = 0; r < RN.length && !name; r++) { const fr = SUBJ.filter((x) => !used.has(x + RN[r])); if (fr.length) name = fr[Math.floor(R() * fr.length)] + RN[r]; }
    if (!name) name = 'Mysterium ' + (S.nInv + 1);
    const types = Object.keys(EFFECTS), type = types[Math.floor(R() * types.length)], value = Math.round((0.06 + R() * 0.1) * 100) / 100;
    const p = { n: name, d: EFFECTS[type] + ' (+' + Math.round(value * 100) + ' %)', effect: { type, value }, src: 'folkets egne idéer' };
    if (R() < 0.4) p.bld = { n: name.replace(/ [IVX]+$/, '') + 'hus', cost: { wood: 10 + Math.floor(R() * 10), stone: 4 + Math.floor(R() * 10) }, color: [80 + Math.floor(R() * 150), 80 + Math.floor(R() * 130), 80 + Math.floor(R() * 150)], height: 1.5 + Math.floor(R() * 3), roof: ROOFS[Math.floor(R() * 3)], max: 3 };
    return p;
  }
  function sanitize(p) {
    if (!p || typeof p !== 'object') return null;
    const str = (x, n) => String(x == null ? '' : x).replace(/[<>]/g, '').slice(0, n).trim();
    const e = p.effect || {}; if (!EFFECTS[e.type]) return null;
    const out = { n: str(p.name || p.n, 28), d: str(p.description || p.d || EFFECTS[e.type], 90), effect: { type: e.type, value: clamp(Number(e.value) || 0.08, 0.04, 0.5) }, src: str(p.src || 'rådet', 20) };
    if (!out.n) return null;
    if (p.building && typeof p.building === 'object') {
      const b = p.building, c = b.cost || {}, col = Array.isArray(b.color) ? b.color : [150, 150, 150];
      out.bld = { n: str(b.name, 24) || out.n + 'hus', cost: { wood: clamp(Math.round(Number(c.wood) || 10), 0, 120), stone: clamp(Math.round(Number(c.stone) || 6), 0, 120) }, color: [0, 1, 2].map((i) => clamp(Math.round(Number(col[i]) || 150), 40, 235)), height: clamp(Number(b.height) || 2.5, 1, 8), roof: ROOFS.includes(b.roof) ? b.roof : 'pointed', max: 6 };
    }
    return out;
  }
  function chooseResearch() {
    const a = availableTechs();
    if (a.length && (!S.invq.length || R() < 0.5)) { S.tech.cur = a[Math.floor(R() * a.length)]; S.tech.prog = Math.min(S.tech.prog, 0.5 * TECHS[S.tech.cur].cost); return; }
    const p = S.invq.length ? S.invq.shift() : procInvention();
    const key = 'i' + (++S.nInv);
    S.invInfo[key] = Object.assign({}, p, { cost: Math.round(1500 + S.nInv * 220) });
    S.tech.cur = key; S.tech.prog = Math.min(S.tech.prog, 0.3 * S.invInfo[key].cost);
  }
  function addKnowledge(v, amt) {
    if (!S.tech.cur) return;
    S.tech.prog += amt * eff('research');
    const k = S.tech.cur, info = techInfo(k);
    if (S.tech.prog >= info.cost) {
      S.tech.prog -= info.cost;
      if (TECHS[k]) S.tech.done[k] = S.time; else { S.inv[k] = S.time; if (info.bld) S.defs[k] = { n: info.bld.n, cost: info.bld.cost, time: 24, size: 1, shape: info.bld, max: info.bld.max || 3 }; }
      log(v.name + ' oppfant ' + info.n.toLowerCase() + '! ' + info.d + '.' + (!TECHS[k] && info.bld ? ' Kan nå bygge ' + info.bld.n.toLowerCase() + '.' : ''));
      ev('spark', v.x, v.y, v.z + 3, {});
      chooseResearch();
    }
  }
  function applyCouncil(r) {
    if (!r || typeof r !== 'object') return 0;
    let n = 0;
    for (const p of (Array.isArray(r.inventions) ? r.inventions : []).slice(0, 3)) { const q = sanitize(Object.assign({}, p, { src: 'rådet' })); if (q && S.invq.length < 4) { S.invq.push(q); n++; } }
    if (typeof r.goal === 'string') { S.goal = r.goal.replace(/[<>]/g, '').slice(0, 120); log('Rådet: ' + S.goal); }
    if (Array.isArray(r.thoughts)) for (const t of r.thoughts.slice(0, 8)) if (t && t.name && t.text) S.thoughts[String(t.name).slice(0, 20)] = { text: String(t.text).replace(/[<>]/g, '').slice(0, 140), at: S.time };
    return n;
  }
  function summary() {
    const cnt = {}; for (const id of S.blds) { const b = S.objs[id]; if (b) cnt[b.type] = (cnt[b.type] || 0) + 1; }
    return { dag: Math.floor(S.time / DAYLEN) + 1, innbyggere: S.vill.length, ressurser: S.res, bygninger: cnt, oyer: S.islands, funnet: Object.keys(S.tech.done).map((k) => TECHS[k].n).concat(Object.keys(S.inv).map((k) => S.invInfo[k].n)), forsker_pa: S.tech.cur ? techInfo(S.tech.cur).n : null, ko: S.invq.map((q) => q.n), navn: S.vill.slice(0, 12).map((v) => v.name + ' (' + v.trait + ')'), siste_hendelser: S.log.slice(-8).map((l) => l.text), tillatte_effekter: EFFECTS };
  }

  // ---------- villager AI
  function release(v) {
    const t = v.task;
    if (t) {
      const n = T(t.node); if (n && n.claimed === v.id) n.claimed = 0;
      const f = T(t.farm); if (f && f.claimed === v.id) f.claimed = 0;
      const s = T(t.site); if (s && t.reserved) s.builders = Math.max(0, s.builders - 1);
      const b = T(t.bld); if (b && t.kind === 'sleep' && t.slept) b.sleepers = Math.max(0, b.sleepers - 1);
    }
    v.task = null; v.timer = 0;
  }
  const roleOf = (kind) => (kind === 'tree' ? 'wood' : kind === 'rock' ? 'stone' : 'food');
  function walkTo(v, path) { v.path = path; v.state = 'walk'; }
  function tryGather(v, kind) {
    const [sx, sy] = tile(v);
    const r = bfs(sx, sy, (x, y) => adj(x, y, (o) => (o.type === kind && !o.claimed && (kind !== 'bush' || o.berries) ? o : null)));
    if (!r) return false;
    r.node.claimed = v.id; v.task = { kind: 'gather', res: kind, node: r.node.id, stage: 'go' }; v.role = roleOf(kind); walkTo(v, r.path); return true;
  }
  function tryBuild(v) {
    const [sx, sy] = tile(v);
    const r = bfs(sx, sy, (x, y) => adj(x, y, (o) => (o.type === 'site' && !o.done && o.builders < o.maxB ? o : null)));
    if (!r) return false;
    r.node.builders++; v.task = { kind: 'build', site: r.node.id, reserved: true, stage: 'go' }; v.role = 'build'; walkTo(v, r.path); return true;
  }
  function tryFarm(v) {
    const [sx, sy] = tile(v);
    const r = bfs(sx, sy, (x, y) => adj(x, y, (o) => (o.type === 'farm' && o.growth >= 1 && !o.claimed ? o : null)));
    if (!r) return false;
    r.node.claimed = v.id; v.task = { kind: 'farm', farm: r.node.id, stage: 'go' }; v.role = 'farm'; walkTo(v, r.path); return true;
  }
  function tryStudy(v) {
    if (!S.tech.cur) return false;
    const [sx, sy] = tile(v);
    const r = bfs(sx, sy, (x, y) => adj(x, y, (o) => (o.type === 'library' ? o : null)));
    if (!r) return false;
    v.task = { kind: 'study', bld: r.node.id, stage: 'go' }; v.role = 'study'; walkTo(v, r.path); return true;
  }
  function trySleep(v) {
    const [sx, sy] = tile(v);
    let r = bfs(sx, sy, (x, y) => adj(x, y, (o) => ((o.type === 'house' || o.type === 'tent') && o.sleepers < (o.type === 'house' && hasTech('masonry') ? 3 : o.cap) ? o : null)));
    if (r) { v.task = { kind: 'sleep', bld: r.node.id, stage: 'go' }; v.role = 'idle'; walkTo(v, r.path); return true; }
    r = bfs(sx, sy, (x, y) => adj(x, y, (o) => (o.type === 'fire' ? o : null)));
    if (r) { v.task = { kind: 'sleep', bld: 0, stage: 'go' }; v.role = 'idle'; walkTo(v, r.path); return true; }
    return false;
  }
  function wander(v) {
    v.role = 'idle'; const [sx, sy] = tile(v);
    const tx = clamp(sx + Math.floor(R() * 9) - 4, 1, GW - 2), ty = clamp(sy + Math.floor(R() * 9) - 4, 1, GH - 2);
    const r = bfs(sx, sy, (x, y) => (x === tx && y === ty ? {} : null), 500);
    if (r && r.path.length) { v.task = { kind: 'wander', stage: 'go' }; walkTo(v, r.path); } else v.idle = 1 + R() * 2;
  }
  function think(v) {
    if (light() < sleepLight()) { if (trySleep(v)) return; v.idle = 2; return; }
    const nt = nextType(), need = defOf(nt).cost, pop = S.vill.length;
    const want = { wood: (need.wood || 0) + 10, stone: (need.stone || 0) + 6, food: pop * 3 + 10 };
    const opts = [];
    if (openSites().some((id) => T(id).builders < T(id).maxB)) opts.push(['build', (2.2 + lvl(v, 'build') * 0.1) * v.w.build]);
    const scholars = S.vill.filter((x) => x.task && x.task.kind === 'study').length;
    if (S.tech.cur && S.blds.some((id) => T(id) && T(id).type === 'library') && scholars < Math.max(1, Math.floor(pop / 4))) opts.push(['study', (0.5 + v.cur * 1.6 + lvl(v, 'study') * 0.05) * v.w.study]);
    opts.push(['farm', (S.res.food < want.food + 6 ? 1.8 : 0.7) * v.w.farm]);
    for (const [kind, rs] of [['tree', 'wood'], ['rock', 'stone'], ['bush', 'food']]) {
      const sk = kind === 'tree' ? 'wood' : kind === 'rock' ? 'stone' : 'food';
      opts.push([kind, ((want[rs] - S.res[rs]) / want[rs] + 0.15 + R() * 0.3 + lvl(v, sk) * 0.04) * v.w[kind]]);
    }
    opts.sort((a, b) => b[1] - a[1]);
    for (const [k] of opts) {
      if (k === 'build' && tryBuild(v)) return;
      if (k === 'study' && tryStudy(v)) return;
      if (k === 'farm' && tryFarm(v)) return;
      if ((k === 'tree' || k === 'rock' || k === 'bush') && tryGather(v, k)) return;
    }
    wander(v);
  }
  function deliver(v) {
    const [sx, sy] = tile(v);
    const r = bfs(sx, sy, (x, y) => adj(x, y, (o) => (o.storage ? o : null)));
    if (!r) { v.carry = null; v.state = 'idle'; return; }
    v.task = { kind: 'deliver', stage: 'go' }; walkTo(v, r.path);
  }
  function arrive(v) {
    const t = v.task; if (!t) { v.state = 'idle'; return; }
    switch (t.kind) {
      case 'gather': {
        const n = T(t.node); if (!n || (t.res === 'bush' && !n.berries)) { release(v); v.idle = 0.3; return; }
        v.state = 'work'; v.timer = (t.res === 'bush' ? 1.5 : 2.4) * (hasTech('tools') ? 0.75 : 1) / skillMult(v, roleOf(t.res)) / eff('work_speed'); break;
      }
      case 'farm': v.state = 'work'; v.timer = 2 * (hasTech('tools') ? 0.75 : 1) / skillMult(v, 'food') / eff('work_speed'); break;
      case 'build': { const s = T(t.site); if (!s || s.done) { release(v); v.idle = 0.2; return; } v.state = 'work'; v.timer = 1e9; break; }
      case 'study': v.state = 'work'; v.timer = 8 / skillMult(v, 'study') / (hasTech('astro') ? 1.25 : 1); break;
      case 'sleep': {
        const b = T(t.bld); v.sleeping = true; t.slept = true;
        if (b) { b.sleepers++; v.hidden = b.type === 'house'; }
        v.state = 'idle'; break;
      }
      case 'deliver': {
        if (v.carry) { S.res[v.carry.t] = Math.min(S.res[v.carry.t] + v.carry.n, 400 + 150 * count('store')); ev('float', v.x, v.y, v.z + 2.6, { t: '+' + v.carry.n, c: v.carry.t }); v.carry = null; }
        release(v); v.idle = 0.2; v.state = 'idle'; break;
      }
      default: release(v); v.idle = 1 + R() * 3; v.state = 'idle';
    }
  }
  function finishWork(v) {
    const t = v.task; if (!t) { v.state = 'idle'; return; }
    if (t.kind === 'gather') {
      const n = T(t.node), kind = t.res; let amt;
      if (!n) { release(v); v.state = 'idle'; return; }
      const carryBonus = (hasTech('wheel') ? 2 : 0) + Math.round((eff('carry') - 1) * 10);
      if (kind === 'tree') { amt = 3 + carryBonus + (hasTech('sawmill') ? 2 : 0); dropObj(n); const g = G(Math.floor(v.x), Math.floor(v.y)); }
      else if (kind === 'rock') { amt = 2 + carryBonus + (hasTech('quarry') ? 2 : 0); n.amt--; if (n.amt <= 0) dropObj(n); else n.claimed = 0; }
      else { amt = 2 + (hasTech('wheel') ? 1 : 0); n.berries = false; n.regrow = 90 + R() * 40; n.claimed = 0; }
      v.sk[roleOf(kind)] += 1; learn(v, kind);
      ev('burst', v.x, v.y, v.z + 1, { c: kind });
      v.carry = { t: roleOf(kind), n: amt }; v.task = null; v.state = 'idle'; deliver(v);
    } else if (t.kind === 'farm') {
      const f = T(t.farm); if (f && f.growth >= 1) { f.growth = 0; v.carry = { t: 'food', n: 5 + (hasTech('wheel') ? 1 : 0) }; v.sk.food += 1; learn(v, 'farm'); }
      if (f) f.claimed = 0; v.task = null; v.state = 'idle'; if (v.carry) deliver(v);
    } else if (t.kind === 'study') {
      v.sk.study += 1; learn(v, 'study'); addKnowledge(v, 1 + lvl(v, 'study') * 0.15); v.task = null; v.state = 'idle'; v.idle = 0.3;
    } else { release(v); v.state = 'idle'; }
  }
  function moveV(v, dt) {
    if (!v.path.length) { v.state = 'idle'; arrive(v); return; }
    const [tx, ty] = v.path[0];
    if (!walkable(tx, ty)) { release(v); v.path = []; v.state = 'idle'; v.idle = 0.3; return; }
    const cx = tx + 0.5, cy = ty + 0.5, dx = cx - v.x, dy = cy - v.y, d = Math.hypot(dx, dy), g = G(Math.floor(v.x), Math.floor(v.y));
    const sp = v.speed * v.dil * eff('walk') * (S.res.food <= 0 ? 0.7 : 1) * (g && g.d ? 1.3 : 1) * dt;
    if (d <= sp) {
      v.x = cx; v.y = cy; v.path.shift();
      const t = G(tx, ty); if (t) { t.tr++; if (t.tr > 260 && !t.d && t.k === 'grass' && !t.o) t.d = 1; }
    } else { v.x += (dx / d) * sp; v.y += (dy / d) * sp; }
    v.face = dx - dy >= 0 ? 1 : -1; v.bob += dt * 9;
  }
  function updateV(v, dt) {
    const g = G(Math.floor(v.x), Math.floor(v.y)); if (g) v.z += (elev(g) - v.z) * Math.min(1, dt * 8);
    if (v.sleeping) {
      if (light() > 0.55) { v.sleeping = false; v.hidden = false; const t = v.task; if (t && t.bld) { const b = T(t.bld); if (b) b.sleepers = Math.max(0, b.sleepers - 1); } v.task = null; v.idle = R() * 2; }
      return;
    }
    if (v.state === 'idle') { v.idle -= dt; if (v.idle <= 0) { v.idle = 0.6; think(v); } }
    else if (v.state === 'walk') moveV(v, dt);
    else if (v.state === 'work') {
      v.bob += dt * 14;
      const t = v.task;
      if (t && t.kind === 'build') {
        const s = T(t.site); if (!s || s.done) { release(v); v.state = 'idle'; v.idle = 0.2; return; }
        s.prog += (dt / s.time) * skillMult(v, 'build') * (hasTech('tools') ? 1.25 : 1) * (hasTech('guild') ? 1.4 : 1) * eff('build') * eff('work_speed');
        v.sk.build += dt * 0.25;
        if (s.prog >= 1) { s.prog = 1; learn(v, 'build'); finishSite(s); release(v); v.state = 'idle'; v.idle = 0.2; }
      } else { v.timer -= dt; if (v.timer <= 0) finishWork(v); }
    }
  }

  // ---------- catastrophes, death and new land
  function die(v, why) {
    release(v); S.vill = S.vill.filter((x) => x !== v);
    if (!S.deaths) S.deaths = 0; S.deaths++;
    if (S.vill.length < 4 || S.deaths % 5 === 1) log(v.name + ' ' + why + '.');
    ev('puff', v.x, v.y, v.z + 1, { n: 3 });
  }
  function destroyBld(b) {
    S.blds = S.blds.filter((id) => id !== b.id); S.storages = S.storages.filter((id) => id !== b.id); S.sites = S.sites.filter((id) => id !== b.id);
    for (const v of S.vill) if (v.task && v.task.bld === b.id) { v.hidden = false; v.sleeping = false; v.task = null; v.state = 'idle'; v.path = []; }
    ev('puff', b.x + 0.5, b.y + 0.5, 1.5, { n: 8 }); dropObj(b);
  }
  function fire() {
    const bl = S.blds.map(T).filter((b) => b && b.type !== 'fire'); if (bl.length < 5) return;
    const c = bl[Math.floor(R() * bl.length)]; let lost = 0;
    for (const b of bl) if (Math.hypot(b.x - c.x, b.y - c.y) <= 3.5 && R() < 0.75) { destroyBld(b); lost++; }
    for (const k in S.objs) { const o = S.objs[k]; if (o.type === 'tree') { /* trees burn near the fire */ } }
    for (let y = Math.floor(c.y) - 4; y <= c.y + 4; y++) for (let x = Math.floor(c.x) - 4; x <= c.x + 4; x++) { const g = G(x, y), o = OB(g); if (o && o.type === 'tree' && Math.hypot(x - c.x, y - c.y) < 4.2) dropObj(o); }
    log('Brann! ' + lost + ' bygg brant ned.');
  }
  function flood() {
    const coast = []; for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) { const g = G(x, y); if (S.reach[y * GW + x] && g.k !== 'water' && NB4.some(([dx, dy]) => G(x + dx, y + dy).k === 'water')) coast.push([x, y]); }
    if (!coast.length) return;
    const [cx, cy] = coast[Math.floor(R() * coast.length)], r = 3 + R() * 3; let n = 0, lost = 0;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const g = G(x, y); if (!g || g.k === 'water' || Math.hypot(x - cx, y - cy) > r || g.h > 1) continue;
      const o = OB(g); if (o) { if (S.blds.includes(o.id) || o.type === 'site') { destroyBld(o); lost++; } else dropObj(o); }
      g.k = 'water'; g.h = 0; g.d = 0; n++;
    }
    scan(); log('Havet stiger! ' + n + ' ruter ble til sjø' + (lost ? ' og ' + lost + ' bygg gikk tapt' : '') + '.');
  }
  function riseIsland() {
    for (let tries = 0; tries < 40; tries++) {
      const cx = 8 + Math.floor(R() * (GW - 16)), cy = 8 + Math.floor(R() * (GH - 16)), r = 3 + R() * 4; let clear = true;
      for (let y = cy - 9; y <= cy + 9 && clear; y++) for (let x = cx - 9; x <= cx + 9; x++) { const g = G(x, y); if (!g || g.k !== 'water') { clear = false; break; } }
      if (!clear) continue;
      for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        const d = Math.hypot(x - cx, y - cy) + (R() - 0.5) * 1.6; if (d > r) continue;
        const g = G(x, y); g.k = d > r - 1.2 ? 'sand' : 'grass'; g.h = d < r * 0.35 && R() < 0.6 ? 2 : 1; g.o = 0;
        if (g.k === 'grass') { if (R() < 0.35) setObj(x, y, newObj({ type: 'tree', claimed: 0, v: R(), born: -9999 })); else if (R() < 0.08) setObj(x, y, newObj({ type: 'rock', amt: 2, claimed: 0 })); }
      }
      log('Det stiger en ny øy opp av havet!'); ev('spark', cx + 0.5, cy + 0.5, 3, {}); return;
    }
  }
  // ---------- main step
  function step(dt) {
    S.time += dt;
    const day = Math.floor(S.time / DAYLEN);
    if (day !== S.lastDay) { S.lastDay = day; S.nightLogged = false; if (day > 0) log('Dag ' + (day + 1) + ' begynner.'); }
    if (light() < sleepLight() && !S.nightLogged) { S.nightLogged = true; log('Natten faller. Lysene tennes.'); }
    const growth = eff('farm_growth') * (hasTech('irrig') ? 1.6 : 1) * (hasTech('windmill') ? 1 + 0.3 * Math.min(3, count('mill')) : 1);
    if (light() > 0.3) for (const id of S.blds) { const b = T(id); if (b && b.type === 'farm') b.growth = Math.min(1, b.growth + (dt / 55) * growth); }
    for (const k in S.objs) { const o = S.objs[k]; if (o.type === 'bush' && !o.berries) { o.regrow -= dt; if (o.regrow <= 0) { o.berries = true; o.claimed = 0; } } }
    if (R() < dt * 0.6) {
      const x = Math.floor(R() * GW), y = Math.floor(R() * GH), g = G(x, y);
      if (g && g.k === 'grass' && !g.o && !g.d && S.reach[y * GW + x]) {
        const nb = OB(G(x + 1, y)) || OB(G(x, y + 1)) || OB(G(x - 1, y)) || OB(G(x, y - 1));
        if ((nb && nb.type === 'tree') || R() < 0.06) setObj(x, y, newObj({ type: 'tree', claimed: 0, v: R(), born: S.time }));
      }
    }
    if (R() < dt * 0.12) {
      let rocks = 0; for (const k in S.objs) if (S.objs[k].type === 'rock') rocks++;
      if (rocks < 30) {
        const x = Math.floor(R() * GW), y = Math.floor(R() * GH), g = G(x, y);
        if (g && !g.o && g.k !== 'water' && g.k !== 'bridge' && (g.k === 'stone' || g.h >= 2 || R() < 0.3) && S.reach[y * GW + x]) setObj(x, y, newObj({ type: 'rock', amt: 2, claimed: 0 }));
      }
    }
    S.planT -= dt; if (S.planT <= 0) { S.planT = 2; planner(); }
    S.scanT -= dt; if (S.scanT <= 0) { S.scanT = hasTech('cartog') ? 10 : 20; scan(); }
    S.growT += dt;
    if (S.growT >= (hasTech('harvest') ? 30 : 45)) { S.growT = 0; if (S.res.food >= 8 && S.vill.length < cap() && S.vill.length < 600) { const f = T(S.storages[0]); addVillager(f.x, f.y + 2); if (S.vill.length % 5 === 0) log('Landsbyen har nå ' + S.vill.length + ' innbyggere.'); } }
    S.eatT += dt;
    if (S.eatT >= 60) {
      S.eatT = 0; S.res.food = Math.max(0, S.res.food - Math.ceil(S.vill.length * (hasTech('medicine') ? 0.45 : 0.6) / eff('food_save')));
      if (S.res.food <= 0) { if (S.hungerDay !== S.lastDay) { S.hungerDay = S.lastDay; log('Det er tomt for mat. Folk sulter.'); } const n = Math.max(1, Math.floor(S.vill.length * 0.08)); for (let i = 0; i < n && S.vill.length > 2; i++) die(S.vill[Math.floor(R() * S.vill.length)], 'sultet i hjel'); }
    }
    S.disT = (S.disT === undefined ? 1500 : S.disT) - dt;
    if (S.disT <= 0) { S.disT = 600 + R() * 1400; if (R() < 0.5) fire(); else flood(); }
    S.riseT = (S.riseT === undefined ? 2400 : S.riseT) - dt;
    if (S.riseT <= 0) { S.riseT = 2400 + R() * 3600; riseIsland(); }
    S.drownT = (S.drownT || 0) - dt;
    if (S.drownT <= 0) { S.drownT = 3; for (const v of S.vill.slice()) { const g = G(Math.floor(v.x), Math.floor(v.y)); if (g && g.k === 'water') die(v, 'druknet'); } }
    for (const v of S.vill) { v.age += dt; updateV(v, dt); }
    if (S.ev && S.ev.length > 200) S.ev.length = 200;
  }
  function advance(seconds, onStep) {
    let n = Math.floor(seconds / DT); const total = n;
    while (n-- > 0) { step(DT); if (onStep && n % 200 === 0) onStep(total - n, total); }
  }
  return {
    GW, GH, DAYLEN, DT, DEF, TECHS, NB4, EFFECTS,
    get S() { return S; },
    create, load, serialize, step, advance, scan,
    helpers: { defOf, eff, techInfo, applyCouncil, summary, sanitize, G, OB, T, elev, phase, light, cap, hasTech, lvl, houses, count, nextType, availableTechs, tile, walkable }
  };
});
