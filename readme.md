# Chess

Two-player online chess. Three services:

- **client** — React + TypeScript + Tailwind 
  Users create a room, share the code, and play.
- **server** — Node + Express + socket.io. 
- **cppServer** — Boost.Asio + nlohmann_json. Holds game state and validates
  moves. Sources are split into `include/` and `src/`, grouped by layer
  (`net/`, `engine/`, `engine/pieces/`, `common/`).


## Local development

Prerequisites: Node 20+, npm, cmake, a C++17 compiler, Boost (`libboost-system-dev`
or Boost on macOS/Windows), nlohmann/json.

Build once:
```sh
make build            # or: ./scripts/build.sh
```
Run everything (three services in one shell):
```sh
make run              # or: ./scripts/run.sh
```
Open http://localhost:5173, create a room, open the same URL in another tab,
paste the code, and play.

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

Then browse to `http://<vm-ip>:8080`. Nginx inside the client container
proxies `/socket.io/` to the node relay, so **the only port that has to
be exposed to the public internet is 8080**.

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
```

Client (build time — passed via `VITE_SERVER_URL` in the Dockerfile arg or a
`client/.env` for `npm run dev`):
```
VITE_SERVER_URL=http://localhost:3000   # local dev
# leave empty in production so it uses the origin nginx serves from
```
