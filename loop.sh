#!/usr/bin/env bash
# Keeps the village alive: tick every 60 s for ~5h45m, then the workflow re-dispatches itself.
set -u
END=$(( $(date +%s) + 345*60 ))
publish() {
  rm -rf ../out && mkdir ../out && cp state.json ../out/ && (
    cd ../out && git init -q -b state && git config user.name smaaby-bot && git config user.email smaaby-bot@users.noreply.github.com &&
    git add state.json && git commit -qm "state $(date -u +%FT%TZ)" &&
    git push -qf "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" state )
}
while [ "$(date +%s)" -lt "$END" ]; do
  git fetch -q origin state --depth=1 2>/dev/null && git show FETCH_HEAD:state.json > state.json 2>/dev/null || true
  git fetch -q origin main --depth=1 2>/dev/null && git show FETCH_HEAD:speed.json > speed.json 2>/dev/null || true
  for f in sim.js tick.mjs council.mjs world.json; do git show FETCH_HEAD:$f > $f.new 2>/dev/null && [ -s $f.new ] && mv $f.new $f || rm -f $f.new; done
  node tick.mjs || echo "tick failed"
  publish || echo "publish failed"
  sleep 60
done
gh workflow run tick.yml --ref main || true
