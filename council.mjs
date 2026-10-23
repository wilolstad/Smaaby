// "Rådet": asks a free GitHub Models LLM what the village should invent next.
// The reply is only ever used as data: sim.js validates and clamps everything.
export async function consult(summary, token) {
  if (!token) return null;
  const sys = 'Du er rådet for ett av folkene i en selvgående verden av flytende øyer (flere folkeslag med ulik kultur, handel og noen ganger krig). Du foreslår oppfinnelser, setter et mål og gir korte tanker til innbyggerne. Svar KUN med JSON.';
  const user = `Folkets tilstand (inkludert kultur, krigerskhet og naboer):\n${JSON.stringify(summary)}\n\nSvar med JSON på norsk:\n{"inventions":[{"name":"kort navn (maks 28 tegn)","description":"én setning","effect":{"type":"<en av tillatte_effekter>","value":0.04-0.5},"building":null eller {"name":"navn","cost":{"wood":0-120,"stone":0-120},"color":[r,g,b],"height":1-8,"roof":"flat|pointed|dome|none"}}],"goal":"landsbyens mål i én setning","thoughts":[{"name":"navn på en innbygger fra listen","text":"en kort tanke i første person"}]}\nForeslå 2 oppfinnelser som bygger logisk på det de allerede har funnet og IKKE gjentar noe i 'funnet' eller 'ko'. Vær kreativ og konkret (fiske, handel, båter, kunst, musikk, vær, medisin). Gi 5 tanker.`;
  const body = (model) => JSON.stringify({ model, temperature: 1, max_tokens: 900, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] });
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const eps = [['https://models.github.ai/inference/chat/completions', 'openai/gpt-4.1-mini', { ...H, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }], ['https://models.inference.ai.azure.com/chat/completions', 'gpt-4.1-mini', H]];
  let j, errs = [];
  for (const [url, model, hd] of eps) {
    try {
      const res = await fetch(url, { method: 'POST', headers: hd, body: body(model) });
      const raw = await res.text();
      if (!res.ok) { errs.push(url.split('/')[2] + ' ' + res.status + ' ' + raw.slice(0, 80)); continue; }
      try { j = JSON.parse(raw); break; } catch (e) { errs.push(url.split('/')[2] + ' svar ikke JSON: ' + raw.slice(0, 60)); }
    } catch (e) { errs.push(url.split('/')[2] + ' ' + String(e.message || e).slice(0, 80)); }
  }
  if (!j) throw new Error(errs.join(' | '));
  const content = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  try { return JSON.parse(content); } catch (e) { throw new Error('modellen svarte: ' + String(content).slice(0, 120)); }
}
