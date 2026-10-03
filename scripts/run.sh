#!/usr/bin/env bash
# Run all three services locally, in the foreground, with each service's
# output prefixed by [Cpp]/[Node]/[Client] (colored) so the interleaved
# stream is readable. Ctrl-C stops everything.
#
# Env vars (with defaults):
#   LOG_LEVEL      -- log level shared by all three services
#                     (cpp: CHESS_LOG_LEVEL, node: LOG_LEVEL,
#                      client: VITE_LOG_LEVEL). Default INFO.
#   NODE_PORT      -- node relay port                    (default 3000)
#   CPP_PORT       -- C++ engine port                    (default 5000)
#   CLIENT_PORT    -- vite dev port                      (default 5173)
#
# Usage:
#   ./scripts/run.sh
#   LOG_LEVEL=DEBUG ./scripts/run.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_LEVEL="${LOG_LEVEL:-INFO}"
NODE_PORT="${NODE_PORT:-3000}"
CPP_PORT="${CPP_PORT:-5050}"    # macOS AirPlay Receiver takes 5000
CLIENT_PORT="${CLIENT_PORT:-5173}"
# The client is built and served under a sub-path (see "Mount path" in
# docs/deployment.md); vite's dev server honours it too, so the URL below carries it.
APP_BASE="${APP_BASE:-/chess}"

# Prefix helper: line-buffers stdin and writes `[<name>] <line>` in a color.
# Uses stdbuf to keep the child pipeline unbuffered so lines flush promptly.
prefix() {
    local color="$1"; local tag="$2"
    # sed -u is unbuffered on GNU sed; on macOS BSD sed use `-l`. Fall back
    # gracefully if neither is present.
    if sed --version >/dev/null 2>&1; then
        exec sed -u "s/^/$(printf '\033')[${color}m[${tag}]$(printf '\033')[0m /"
    else
        exec sed -l "s/^/$(printf '\033')[${color}m[${tag}]$(printf '\033')[0m /" 2>/dev/null \
            || awk -v c="$color" -v t="$tag" '{printf "\033[%sm[%s]\033[0m %s\n", c, t, $0; fflush()}'
    fi
}

cleanup() {
    echo ""
    echo "==> Shutting down..."
    kill 0 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> LOG_LEVEL=$LOG_LEVEL, cpp:$CPP_PORT node:$NODE_PORT client:$CLIENT_PORT"

# ---- C++ engine ---- (magenta prefix)
(
    exec env CHESS_ENGINE_PORT="$CPP_PORT" CHESS_LOG_LEVEL="$LOG_LEVEL" \
        "$ROOT/cppServer/build/chess_engine"
) 2>&1 | prefix "35" "Cpp   " &

sleep 0.5

# ---- Node relay ---- (cyan prefix)
(
    cd "$ROOT/server"
    # DEV_TOOLS=1 enables loading saved positions (dev/games/*.pgn) and solo
    # games; see docs/development.md. Override with DEV_TOOLS=0 make run.
    exec env CPP_HOST=localhost CPP_PORT="$CPP_PORT" NODE_PORT="$NODE_PORT" \
        LOG_LEVEL="$LOG_LEVEL" DEV_TOOLS="${DEV_TOOLS:-1}" \
        npm start --silent
) 2>&1 | prefix "36" "Node  " &

sleep 0.5

# ---- React client ---- (yellow prefix)
(
    cd "$ROOT/client"
    exec env VITE_SERVER_URL="http://localhost:$NODE_PORT" \
        VITE_LOG_LEVEL="$LOG_LEVEL" \
        BASE_PATH="$APP_BASE/" \
        npm run dev --silent -- --port "$CLIENT_PORT"
) 2>&1 | prefix "33" "Client" &

echo ""
echo "Services:"
echo "  Client:  http://localhost:$CLIENT_PORT${APP_BASE:-/chess}/"
echo "  Node:    http://localhost:$NODE_PORT"
echo "  Cpp:     tcp://localhost:$CPP_PORT"
echo ""
echo "  Dev:     http://localhost:$CLIENT_PORT${APP_BASE:-/chess}/?dev=solo   (one-tab game)"
echo "           http://localhost:$CLIENT_PORT${APP_BASE:-/chess}/?dev=<game>&ply=<n>  (see dev/games/)"
echo ""
echo "  Tip: macOS reserves port 5000 for AirPlay Receiver. If you see"
echo "       \"Address already in use\", pass CPP_PORT=<other port> to make run."
echo ""
echo "Ctrl-C to stop."
wait
