#!/usr/bin/env bash
# Build every service for local development.
# Usage: ./scripts/build.sh [LOG_LEVEL]
#   LOG_LEVEL is the compile-time minimum log level for the C++ engine.
#   Anything strictly below it is elided at compile time (zero runtime cost).
#   Default: INFO.
#
# Requirements:
#   - Node 20+
#   - Conan 2 (`pip install conan`) — the C++ engine pulls Boost + nlohmann_json
#     from Conan Center; no system libraries are needed.
#   - CMake 3.16+ and a C++17 compiler
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

echo "==> Building C++ engine (log floor = $LOG_LEVEL / $LEVEL_NUM)"
cd "$ROOT/cppServer"

# Conan 2: first run needs a profile; detect it if missing.
if ! conan profile show >/dev/null 2>&1; then
    conan profile detect --force
fi

# Fetch/build deps into ./build then hand cmake the toolchain conan generates.
conan install . \
    --output-folder=build \
    --build=missing \
    -s build_type=Release

cmake -S . -B build \
    -DCMAKE_TOOLCHAIN_FILE=build/conan_toolchain.cmake \
    -DCMAKE_BUILD_TYPE=Release \
    -DCHESS_MIN_LOG_LEVEL="$LEVEL_NUM"

cmake --build build -j"$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 2)"

echo ""
echo "Done. Next: ./scripts/run.sh   (add LOG_LEVEL=DEBUG for more)"
