#!/usr/bin/env bash
# Boot the whole stack on a VM with docker.
# Usage: ./scripts/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

docker compose build
docker compose up -d
docker compose ps

echo ""
echo "Client:      http://<vm-ip>:8080"
echo "Node relay:  http://<vm-ip>:3000/healthz"
echo ""
echo "Logs:        docker compose logs -f"
echo "Stop:        docker compose down"
