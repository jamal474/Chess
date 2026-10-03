# Deployment guide

Chess ships as three containers: the C++ engine, the Node relay and the
nginx-served client. This guide covers running them on a VM with Docker
Compose or on Railway, and how the `/chess/` mount path works.

- [Docker Compose on a VM](#docker-compose-on-a-vm)
- [Railway](#railway)
- [Mount path](#mount-path)

## Docker Compose on a VM

Each service declares `restart: unless-stopped`, so containers come back up
after a crash or reboot.

```sh
# On a fresh VM with Docker installed:
git clone https://github.com/jamal474/Chess.git chess && cd chess
./scripts/deploy.sh    # docker compose build && up -d
```

Then open `http://<vm-ip>:8080/chess/` (requests to `/` redirect there).
nginx inside the client container proxies `/chess/socket.io/` to the Node
relay, so **8080 is the only port that needs to be public**.

Ports, as set in `docker-compose.yml`:

| Service | Container port | Host port |
|---|---|---|
| client | 80 | 8080 |
| node-server | 3000 | 3000 (for debugging) |
| cpp-engine | 5000 | not exposed |

Useful commands:

```sh
docker compose ps              # what's running
docker compose logs -f         # tail logs from all services
docker compose down            # stop everything
docker compose up -d --build   # rebuild and restart
```

## Railway

Railway builds each service from its own directory. This repo is a monorepo,
so **you need three Railway services**, one for each of `cppServer/`,
`server/` and `client/`. Each folder has a `Dockerfile` and a `railway.json`
that tells Railway to build from it.

### 1. Create the services

Use the same GitHub repo for all three, with different root directories:

| Railway service name | Root directory | Public network? |
|---|---|---|
| `chess-cpp-engine` | `cppServer` | No (private) |
| `chess-node-server` | `server` | Yes |
| `chess-client` | `client` | Yes |

For each one: **New → GitHub Repo → this repo → Settings → Root Directory**,
set to the value above.

### 2. Connect the services

Railway exposes each service to the others at
`${service-name}.railway.internal` on `${PORT}`. Set these variables in the
Railway UI.

**`chess-node-server`**

```
CPP_HOST = chess-cpp-engine.railway.internal
CPP_PORT = ${{chess-cpp-engine.PORT}}
LOG_LEVEL = INFO
ALLOWED_ORIGINS = *
SOCKET_IO_PATH = /chess/socket.io/
```

**`chess-client`**

```
NODE_HOST = chess-node-server.railway.internal
NODE_PORT = ${{chess-node-server.PORT}}
APP_BASE = /chess
```

`entrypoint.sh` reads `APP_BASE` when the container starts, but the build
needs it too. Set it under **Settings → Build → Build Arguments** as well, or
leave both at the `/chess` default in the Dockerfile.

**`chess-cpp-engine`**

```
CHESS_LOG_LEVEL = INFO
```

`${{ service.VAR }}` is Railway's reference-variable syntax, so the port is
filled in automatically even if it changes on redeploy.

### 3. Expose the client

On `chess-client`, go to **Settings → Networking → Generate Domain**. The
generated URL serves the app at `/chess/` and proxies `/chess/socket.io/` to
the Node service over Railway's private network. This is the only URL that
needs to be public, and it's the one the Cloudflare worker proxies to
(configured in the worker's `src/routes.config.js`, which lives outside this
repo).

Pushing to the tracked branch redeploys all three services.

### Health checks

The client and Node services' `railway.json` files point Railway's health
check at `/healthz`. All three restart on failure (up to 10 retries).
`/healthz` is served at the root, outside the mount path; see below.

## Mount path

The app is served from a sub-path, `/chess/`, instead of the domain root. It
sits behind a Cloudflare worker that serves several projects from one short
domain (`https://<short-domain>/chess/`), and the worker forwards requests
**without rewriting the path**, so the origin has to answer on `/chess/…`
itself.

`APP_BASE` (default `/chess`, no trailing slash) is the single source of
truth. The client Dockerfile passes it to three places that must agree:

| Consumer | What it controls |
|---|---|
| `BASE_PATH` → `vite.config.ts` | Asset URLs, `BrowserRouter` basename, socket.io path |
| `COPY … /usr/share/nginx/html${APP_BASE}` | Where the bundle is placed on disk |
| `nginx.conf.template` locations | Which URIs are served and proxied |

Two things to know:

- **socket.io does not inherit the base path.** Its `path` option is
  host-absolute, so the client requests `<base>socket.io/` and the Node server
  must be started with a matching `SOCKET_IO_PATH=/chess/socket.io/`. nginx
  passes the URI through unchanged, so all three use the same string.
- **`/healthz` stays at the root** on purpose. Railway's health check
  shouldn't depend on the mount path, and it has to keep answering when the
  relay is down.

To deploy under a different prefix, change one build arg:

```sh
docker compose build --build-arg APP_BASE=/play client
# …and set SOCKET_IO_PATH=/play/socket.io/ on the node service.
```
