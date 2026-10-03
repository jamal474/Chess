# Development guide

Everything you need to build, run and debug Chess on your own machine.
For hosting it somewhere, see the [deployment guide](deployment.md).

- [Prerequisites](#prerequisites)
- [Build and run](#build-and-run)
- [Running services individually](#running-services-individually)
- [Make targets](#make-targets)
- [Environment variables](#environment-variables)
- [C++ dependencies (Conan 2)](#c-dependencies-conan-2)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Node 20+ and npm
- CMake and a C++17 compiler
- Python 3
- **Conan 2**: `pip install "conan>=2.0"`

The C++ engine's dependencies (Asio and nlohmann_json) come from Conan
Center, so no system packages are needed.

## Build and run

Build once:

```sh
make build            # or: ./scripts/build.sh
```

Run all three services in one shell:

```sh
make run              # or: ./scripts/run.sh
```

Output from each service is prefixed with `[Cpp]`, `[Node]` or `[Client]`.
Press Ctrl-C to stop everything.

Open http://localhost:5173/chess/, create a room, open the same URL in another
tab, paste the code and play. The `/chess/` prefix is intentional; see
[Mount path](deployment.md#mount-path).

`scripts/run.sh` reads these variables:

| Variable | Default | Purpose |
|---|---|---|
| `LOG_LEVEL` | `INFO` | Log level shared by all three services |
| `NODE_PORT` | `3000` | Node relay port |
| `CPP_PORT` | `5050` | C++ engine port (see [macOS port 5000](#macos-port-5000)) |
| `CLIENT_PORT` | `5173` | Vite dev server port |
| `APP_BASE` | `/chess` | Mount path for the client |

## Running services individually

```sh
# C++ engine
cd cppServer && cmake -S . -B build && cmake --build build -j && ./build/chess_engine

# Node relay
cd server && npm install && npm run dev

# React client
cd client && npm install && npm run dev
```

## Make targets

| Target | What it does |
|---|---|
| `make build` | Installs dependencies and builds everything |
| `make build-cpp` | Rebuilds only the C++ engine |
| `make run` | Runs all three services locally |
| `make deploy` | `docker compose build` and `up -d` |
| `make stop` | `docker compose down` |
| `make logs` | Tails logs from all containers |
| `make clean` | Removes build outputs and `node_modules` |

`LOG_LEVEL` (`TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`) is passed to
the engine at runtime. For `build-cpp` it also sets a compile-time floor:
log calls below it are removed from the binary entirely.

```sh
make run LOG_LEVEL=DEBUG
make build-cpp LOG_LEVEL=INFO
```

## Environment variables

### Server (`server/.env`)

Copy `server/.env.example` to `server/.env`.

```
NODE_HOST=0.0.0.0
NODE_PORT=3000
CPP_HOST=localhost
CPP_PORT=5000
ALLOWED_ORIGINS=*
SOCKET_IO_PATH=/socket.io/   # /chess/socket.io/ behind nginx
```

### Client (`client/.env`)

These are read at build time. In Docker they come from Dockerfile build args;
for `npm run dev`, copy `client/.env.example` to `client/.env`.

```
VITE_SERVER_URL=http://localhost:3000   # local dev
# leave empty in production so it uses the origin nginx serves from
```

## C++ dependencies (Conan 2)

The engine uses **Conan 2** for its two dependencies, Asio and nlohmann_json.
Both are header-only. The recipe is a plain Python class in
`cppServer/conanfile.py`:

```python
class ChessEngineConan(ConanFile):
    requires = ("asio/1.30.2", "nlohmann_json/3.11.3")
    generators = "CMakeToolchain", "CMakeDeps"
```

Because both packages are header-only, `conan install` downloads only a few MB
and builds nothing from source, and the runtime image needs no third-party
system libraries.

```sh
# One-time on a fresh machine:
pip install "conan>=2.0"
conan profile detect --force

# Then either:
make build            # runs conan install for you
# or manually:
cd cppServer
conan install . --output-folder=build --build=missing -s build_type=Release
cmake -S . -B build -DCMAKE_TOOLCHAIN_FILE=build/conan_toolchain.cmake -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
```

The Docker build runs Conan itself, so `docker compose build cpp-engine` works
without Conan installed on the host.

### Engine source layout

Sources are split into `include/` and `src/`, grouped by layer:

| Folder | Contents |
|---|---|
| `net/` | HTTP server and connection handling (Asio) |
| `engine/` | Board, game, player and piece base class |
| `engine/pieces/` | One class per piece type |
| `common/` | Logger and shared definitions |

## Troubleshooting

### macOS port 5000

On macOS Monterey and later, AirPlay Receiver listens on port 5000, so the
engine's local default port is **5050**. To use 5000 anyway, turn off AirPlay
Receiver under System Settings → General → AirDrop & Handoff, or run
`CPP_PORT=5000 make run`.

In Docker the engine still binds 5000 inside the isolated container network,
so there's no conflict there.
