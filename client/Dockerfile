# --- React client image ---
# Vite build → nginx runtime. nginx.conf is templated at container start
# so PORT / APP_BASE / NODE_HOST / NODE_PORT come from env vars (Railway sets
# PORT automatically; docker-compose sets NODE_HOST=node-server, NODE_PORT=3000).
#
# APP_BASE is the one source of truth for the mount path. It feeds the Vite
# build (asset URLs, router basename, socket.io path), the directory the bundle
# is copied into, and the nginx locations — so the three can't drift apart.

ARG APP_BASE=/chess

FROM node:20-alpine AS build
ARG APP_BASE
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json tsconfig.node.json vite.config.ts postcss.config.js tailwind.config.js index.html ./
COPY src ./src
COPY public ./public
# Vite build-time defaults. Empty VITE_SERVER_URL = same-origin (nginx below
# proxies <base>/socket.io/ to the node relay), which is the deployment mode we
# want on Railway.
ARG VITE_SERVER_URL=
ARG VITE_LOG_LEVEL=INFO
ENV VITE_SERVER_URL=$VITE_SERVER_URL
ENV VITE_LOG_LEVEL=$VITE_LOG_LEVEL
# vite.config.ts wants a trailing slash; APP_BASE is stored without one.
ENV BASE_PATH=$APP_BASE/
RUN npm run build

FROM nginx:1.27-alpine
ARG APP_BASE
# gettext ships envsubst. Alpine's nginx image doesn't include it by default.
RUN apk add --no-cache gettext
# The bundle lands at the same path it is served from, so nginx needs no
# alias/rewrite games and a file listed in the HTML can be found on disk by
# stripping the scheme and host.
COPY --from=build /app/dist /usr/share/nginx/html${APP_BASE}
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Compose defaults — Railway overrides PORT automatically and lets you set
# NODE_HOST / NODE_PORT to reference the sibling service.
ENV PORT=80 \
    APP_BASE=$APP_BASE \
    NODE_HOST=node-server \
    NODE_PORT=3000

EXPOSE 80
# Probe the root health endpoint, not "/", which now redirects to the mount.
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1

CMD ["/entrypoint.sh"]
