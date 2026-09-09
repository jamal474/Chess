# Chess

Two-player online chess. Three services:

- **client** — React + TypeScript + Tailwind 
  Users create a room, share the code, and play.
- **server** — Node + Express + socket.io. 
- **cppServer** — standalone Asio + nlohmann_json (both header-only, fetched via Conan 2). Holds game state and validates
  moves. Sources are split into `include/` and `src/`, grouped by layer
  (`net/`, `engine/`, `engine/pieces/`, `common/`).


## Local development

Prerequisites: Node 20+, npm, cmake, a C++17 compiler, Python 3, and
**Conan 2** (`pip install "conan>=2.0"`). The C++ engine's Asio and
nlohmann_json dependencies come from Conan Center — no system packages
required.

Build once:
```sh
make build            # or: ./scripts/build.sh
```
Run everything (three services in one shell):
```sh
make run              # or: ./scripts/run.sh
```
Open http://localhost:5173/chess/, create a room, open the same URL in
another tab, paste the code, and play. The `/chess/` prefix is not incidental —
see [Mount path](#mount-path) below.

Individual services:

```sh
# C++ engine
cd cppServer && cmake -S . -B build && cmake --build build -j && ./build/chess_engine

# Node relay
cd server && npm install && npm run dev

# React client
cd client && npm install && npm run dev
```

## VM deployment (Docker)

The whole stack ships as three containers wired together by Compose. Each
service declares `restart: unless-stopped`, so services come back up on
crash or reboot.

```sh
# On a fresh VM with Docker installed:
git clone <this repo> chess && cd chess
./scripts/deploy.sh    # docker compose build && up -d
```

Then browse to `http://<vm-ip>:8080/chess/` (a hit on `/` redirects there).
Nginx inside the client container proxies `/chess/socket.io/` to the node
relay, so **the only port that has to be exposed to the public internet is
8080**.

Container-level configuration (in `docker-compose.yml`):

| Service      | Container port | Host port |
|--------------|----------------|-----------|
| client       | 80             | 8080      |
| node-server  | 3000           | 3000 (for debug) |
| cpp-engine   | 5000           | not exposed |

Useful commands:
```sh
docker compose ps          # what's running
docker compose logs -f     # tail logs from all services
docker compose down        # stop everything
docker compose up -d --build   # rebuild + restart
```

## Ports & env vars

Server (`server/.env`):
```
NODE_HOST=0.0.0.0
NODE_PORT=3000
CPP_HOST=localhost
CPP_PORT=5000
ALLOWED_ORIGINS=*
SOCKET_IO_PATH=/socket.io/   # /chess/socket.io/ behind nginx
```

Client (build time — passed via `VITE_SERVER_URL` in the Dockerfile arg or a
`client/.env` for `npm run dev`):
```
VITE_SERVER_URL=http://localhost:3000   # local dev
# leave empty in production so it uses the origin nginx serves from
```

## Mount path

The app is served from a sub-path, `/chess/`, rather than a domain root,
because it sits behind a Cloudflare worker that fronts several projects on one
short domain: `https://<short-domain>/chess/`. The worker forwards requests
**without rewriting the path**, so the origin has to answer on `/chess/…`
itself.

`APP_BASE` (default `/chess`, no trailing slash) is the single source of truth.
The client Dockerfile threads it into three places that must agree:

| Consumer | What it controls |
|---|---|
| `BASE_PATH` → `vite.config.ts` | asset URLs, `BrowserRouter` basename, socket.io path |
| `COPY … /usr/share/nginx/html${APP_BASE}` | where the bundle lands on disk |
| `nginx.conf.template` locations | which URIs are served and proxied |

Two consequences worth knowing:

- **socket.io does not inherit the base.** Its `path` option is host-absolute,
  so the client asks for `<base>socket.io/` and the node server must be started
  with a matching `SOCKET_IO_PATH=/chess/socket.io/`. nginx passes the URI
  through unchanged, so all three spell the same string.
- **`/healthz` stays at the root**, deliberately: Railway's healthcheck should
  not depend on the mount path, and it must keep answering when the relay is
  down.

Deploying at a different prefix is a single build arg:

```sh
docker compose build --build-arg APP_BASE=/play client
# …and set SOCKET_IO_PATH=/play/socket.io/ on the node service.
```


## Railway deployment

Railway builds each service from its own directory; the repo is a
monorepo so **you need three Railway services**, each pointing at one
of `cppServer/`, `server/`, `client/`. All three ship a `Dockerfile`
and a `railway.json` that tells Railpack to use it.

**1. Create the three services** — same GitHub repo, different root
directories:

| Railway service name       | Root Directory | Public network? |
|----------------------------|----------------|------------------|
| `chess-cpp-engine`         | `cppServer`    | No (private)     |
| `chess-node-server`        | `server`       | Yes              |
| `chess-client`             | `client`       | Yes              |

For each: **New → GitHub Repo → this repo → Settings → Root Directory**
= the value above.

**2. Wire the services together** — Railway exposes each service to
its neighbours at `${service-name}.railway.internal` on `${PORT}`.
Set these variables in the Railway UI:

*On `chess-node-server`:*
```
CPP_HOST = chess-cpp-engine.railway.internal
CPP_PORT = ${{chess-cpp-engine.PORT}}
LOG_LEVEL = INFO
ALLOWED_ORIGINS = *
SOCKET_IO_PATH = /chess/socket.io/
```

*On `chess-client`:*
```
NODE_HOST = chess-node-server.railway.internal
NODE_PORT = ${{chess-node-server.PORT}}
APP_BASE = /chess
```

`APP_BASE` is read at container start by `entrypoint.sh`; the *build* also
needs it, so set it under **Settings → Build → Build Arguments** as well
(or leave both at the `/chess` default baked into the Dockerfile).

*On `chess-cpp-engine`:*
```
CHESS_LOG_LEVEL = INFO
```

The `${{ service.VAR }}` syntax is Railway's reference-variables
feature — the port is auto-populated even when it changes on redeploy.

**3. Expose the client publicly** — on `chess-client`: **Settings →
Networking → Generate Domain**. The generated URL serves the SPA at
`/chess/` and proxies `/chess/socket.io/` traffic to the node service through
Railway's private network. Only that one URL needs to be exposed to the public
internet; the node and cpp services stay private — and it is the URL the
Cloudflare worker proxies to (`cloudflare-worker/src/routes.config.js`).

That's it — pushing to the tracked git branch redeploys all three.

## macOS port 5000

On macOS Monterey and later, AirPlay Receiver listens on port 5000 by
default, so the C++ engine's local default port has been moved to
**5050**. If you'd rather keep 5000, disable AirPlay Receiver under
System Settings → General → AirDrop & Handoff, or pass
`CPP_PORT=5000 make run`. In Docker the engine still binds 5000 inside
the isolated container network — there's no collision there.

## Package management (Conan 2)

The C++ engine uses **Conan 2** for its two dependencies (Asio, nlohmann_json), both header-only.
The recipe is a plain Python class in `cppServer/conanfile.py`, so you can read
and tweak it like any other code:

```python
class ChessEngineConan(ConanFile):
    requires = ("asio/1.30.2", "nlohmann_json/3.11.3")
    generators = "CMakeToolchain", "CMakeDeps"
```

Both packages are header-only, so `conan install` fetches only tiny
archives (a few MB total, no source builds) and the runtime image needs
zero third-party system libraries.

```sh
# One-time on a fresh machine:
pip install "conan>=2.0"
conan profile detect --force

# Then either:
make build            # installs everything and does conan install for you
# or manually:
cd cppServer
conan install . --output-folder=build --build=missing -s build_type=Release
cmake -S . -B build -DCMAKE_TOOLCHAIN_FILE=build/conan_toolchain.cmake -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
```

The Docker build handles Conan itself — `docker compose build cpp-engine`
just works, no host Conan needed.