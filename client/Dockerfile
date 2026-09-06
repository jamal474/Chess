# --- React client image ---
# Vite build → nginx runtime. nginx.conf is templated at container start
# so PORT / NODE_HOST / NODE_PORT come from env vars (Railway sets PORT
# automatically; docker-compose sets NODE_HOST=node-server, NODE_PORT=3000).

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json tsconfig.node.json vite.config.ts postcss.config.js tailwind.config.js index.html ./
COPY src ./src
COPY public ./public
# Vite build-time defaults. Empty VITE_SERVER_URL = same-origin (nginx below
# proxies /socket.io/ to the node relay), which is the deployment mode we
# want on Railway.
ARG VITE_SERVER_URL=
ARG VITE_LOG_LEVEL=INFO
ENV VITE_SERVER_URL=$VITE_SERVER_URL
ENV VITE_LOG_LEVEL=$VITE_LOG_LEVEL
RUN npm run build

FROM nginx:1.27-alpine
# gettext ships envsubst. Alpine's nginx image doesn't include it by default.
RUN apk add --no-cache gettext
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Compose defaults — Railway overrides PORT automatically and lets you set
# NODE_HOST / NODE_PORT to reference the sibling service.
ENV PORT=80 \
    NODE_HOST=node-server \
    NODE_PORT=3000

EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" >/dev/null || exit 1

CMD ["/entrypoint.sh"]
