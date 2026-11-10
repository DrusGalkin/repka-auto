#!/usr/bin/env bash
set -euo pipefail
until python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/',timeout=2).read()" >/dev/null 2>&1; do sleep 2; done
exec "$1" --kiosk --no-first-run http://127.0.0.1:8765/
