#!/usr/bin/env bash
# Build every service for local development.
# Usage: ./scripts/build.sh [LOG_LEVEL]
#   LOG_LEVEL is the compile-time minimum log level for the C++ engine.
#   Anything strictly below it is elided at compile time (zero runtime cost).
#   Default: INFO.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_LEVEL="${1:-${LOG_LEVEL:-INFO}}"

case "$LOG_LEVEL" in
    TRACE) LEVEL_NUM=0 ;;
    DEBUG) LEVEL_NUM=1 ;;
    INFO)  LEVEL_NUM=2 ;;
    WARN)  LEVEL_NUM=3 ;;
    ERROR) LEVEL_NUM=4 ;;
    FATAL) LEVEL_NUM=5 ;;
    *)     echo "Unknown LOG_LEVEL: $LOG_LEVEL"; exit 1 ;;
esac

echo "==> Building node server"
cd "$ROOT/server"
npm install

echo "==> Building React client"
cd "$ROOT/client"
npm install
npm run build

echo "==> Building C++ engine (compile-time log floor = $LOG_LEVEL / $LEVEL_NUM)"
cd "$ROOT/cppServer"
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DCHESS_MIN_LOG_LEVEL="$LEVEL_NUM"
cmake --build build -j"$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 2)"

echo ""
echo "Done. Next: ./scripts/run.sh    (add LOG_LEVEL=DEBUG for more)"
