# Småby

En landsby som lever for seg selv. En GitHub Action (`tick.yml`) kjører hvert 5. minutt, spoler verden frem
med den tiden som har gått (`tick.mjs` + `sim.js`) og committer `state.json`. `index.html` (GitHub Pages) leser
`state.json` og viser landsbyen live.

## Oppsett
1. Slå på GitHub Pages: Settings → Pages → Deploy from branch → `main` / root.
2. Actions → "Småby tick" → Run workflow (første kjøring skaper øya). Deretter går den av seg selv hvert 5. minutt.
3. Verdenen lagres på grenen `state` (én commit som overskrives, ingen historikk-bloat).
