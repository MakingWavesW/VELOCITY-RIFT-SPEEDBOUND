#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
printf '\n=== VELOCITY RIFT: SPEEDBOUND ===\n'
if [[ ! -f package.json ]]; then echo 'Extract the full game ZIP first.' >&2; exit 1; fi
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then echo 'Install Node.js 22.12+ from https://nodejs.org/' >&2; exit 1; fi
node -e "const v=process.versions.node.split('.').map(Number); process.exit(v[0]>22||(v[0]===22&&v[1]>=12)?0:1)" || { echo 'Node.js 22.12+ required.' >&2; exit 1; }
if [[ ! -x node_modules/.bin/vite || ! -x node_modules/.bin/tsx ]]; then npm ci; fi
server_pid=''
client_pid=''
cleanup() {
  trap - EXIT INT TERM
  [[ -z "$server_pid" ]] || kill "$server_pid" 2>/dev/null || true
  [[ -z "$client_pid" ]] || kill "$client_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
npm run server & server_pid=$!
npm run dev -- --port 5173 --strictPort & client_pid=$!
ready=0
if command -v curl >/dev/null; then
  for ((i=0;i<50;i++)); do
    if curl -fsS --max-time 2 http://127.0.0.1:2567/health >/dev/null 2>&1 && curl -fsS --max-time 2 http://127.0.0.1:5173/ >/dev/null 2>&1; then ready=1; break; fi
    if ! kill -0 "$server_pid" 2>/dev/null || ! kill -0 "$client_pid" 2>/dev/null; then break; fi
    sleep 1
  done
else
  echo 'curl unavailable: readiness checks skipped.'
  ready=1
fi
if [[ "$ready" -ne 1 ]]; then echo 'Game failed to start. Check logs and ports 2567/5173.' >&2; exit 1; fi
printf 'READY: http://127.0.0.1:5173/\nKeep terminal open; Ctrl+C stops the game.\n'
if [[ "$(uname -s)" == 'Darwin' ]]; then open http://127.0.0.1:5173/ >/dev/null 2>&1 || true
elif command -v xdg-open >/dev/null; then xdg-open http://127.0.0.1:5173/ >/dev/null 2>&1 || true; fi
wait "$server_pid" "$client_pid"
