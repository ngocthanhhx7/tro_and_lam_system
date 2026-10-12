#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo 'Run: sudo /opt/tro-lam/current/ops/vps/activate-backend.sh' >&2
  exit 1
fi
cd /opt/tro-lam/current/backend
runuser -u trolam -- /usr/bin/node ../ops/vps/env-ready.js
runuser -u trolam -- /usr/bin/node ../ops/vps/init-indexes.js
systemctl reset-failed tro-lam-api
systemctl restart tro-lam-api
for attempt in {1..30}; do
  if curl --silent --fail http://127.0.0.1:5000/api/v1/health/ready > /dev/null; then
    echo 'TRO & LAM API is ready.'
    exit 0
  fi
  sleep 1
done
echo 'API did not become ready. Check: sudo journalctl -u tro-lam-api -n 30 --no-pager' >&2
exit 1
