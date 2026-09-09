#!/bin/sh
# Substitute PORT / APP_BASE / NODE_HOST / NODE_PORT into nginx.conf and start
# nginx.
#
# We do the substitution ourselves (rather than letting nginx's own
# docker-entrypoint auto-substitute) so nginx runtime vars like $uri and
# $http_upgrade — which envsubst would otherwise blank out — stay intact.

set -eu

: "${PORT:=80}"
: "${APP_BASE:=/chess}"
: "${NODE_HOST:=node-server}"
: "${NODE_PORT:=3000}"

# The nginx template builds paths as "${APP_BASE}/…", so a trailing slash here
# would produce "//" and a leading-slash-less value would produce a relative
# location. Normalise both.
APP_BASE="/$(echo "$APP_BASE" | sed 's:^/*::; s:/*$::')"

# A root mount would render "//socket.io/" and a catch-all that redirects to
# itself. This image is built for a sub-path deployment; fail loudly rather
# than starting an nginx that loops.
if [ "$APP_BASE" = "/" ]; then
  echo "[entrypoint] APP_BASE must be a non-empty sub-path (e.g. /chess), not /" >&2
  exit 1
fi

export PORT APP_BASE NODE_HOST NODE_PORT

envsubst '${PORT} ${APP_BASE} ${NODE_HOST} ${NODE_PORT}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

echo "[entrypoint] nginx listening on :${PORT}, serving ${APP_BASE}/ and proxying ${APP_BASE}/socket.io/ → http://${NODE_HOST}:${NODE_PORT}"
exec nginx -g 'daemon off;'
