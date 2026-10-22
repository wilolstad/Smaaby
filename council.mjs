// "Rådet": asks a free GitHub Models LLM what the village should invent next.
// The reply is only ever used as data: sim.js validates and clamps everything.
export async function consult(summary, token) {
  if (!token) return null;
  const sys = 'Du er rådet i en liten selvgående landsby på flytende øyer. Du foreslår oppfinnelser, setter et mål og gir korte tanker til innbyggerne. Svar KUN med JSON.';
  const user = `Landsbyens tilstand:\n${JSON.stringify(summary)}\n\nSvar med JSON på norsk:\n{"inventions":[{"name":"kort navn (maks 28 tegn)","description":"én setning","effect":{"type":"<en av tillatte_effekter>","value":0.04-0.5},"building":null eller {"name":"navn","cost":{"wood":0-120,"stone":0-120},"color":[r,g,b],"height":1-8,"roof":"flat|pointed|dome|none"}}],"goal":"landsbyens mål i én setning","thoughts":[{"name":"navn på en innbygger fra listen","text":"en kort tanke i første person"}]}\nForeslå 2 oppfinnelser som bygger logisk på det de allerede har funnet og IKKE gjentar noe i 'funnet' eller 'ko'. Vær kreativ og konkret (fiske, handel, båter, kunst, musikk, vær, medisin). Gi 5 tanker.`;
  const res = await fetch('https://models.github.ai/inference/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'openai/gpt-4.1-mini', temperature: 1, max_tokens: 900, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] })
  });
  if (!res.ok) throw new Error('models api ' + res.status + ' ' + (await res.text()).slice(0, 200));
  const j = await res.json();
  return JSON.parse(j.choices[0].message.content);
}
