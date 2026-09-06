#!/bin/sh
# Substitute PORT / NODE_HOST / NODE_PORT into nginx.conf and start nginx.
#
# We do the substitution ourselves (rather than letting nginx's own
# docker-entrypoint auto-substitute) so nginx runtime vars like $uri and
# $http_upgrade — which envsubst would otherwise blank out — stay intact.

set -eu

: "${PORT:=80}"
: "${NODE_HOST:=node-server}"
: "${NODE_PORT:=3000}"

export PORT NODE_HOST NODE_PORT

envsubst '${PORT} ${NODE_HOST} ${NODE_PORT}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

echo "[entrypoint] nginx listening on :${PORT}, proxying /socket.io/ → http://${NODE_HOST}:${NODE_PORT}"
exec nginx -g 'daemon off;'
