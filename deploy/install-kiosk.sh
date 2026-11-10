#!/usr/bin/env bash
set -euo pipefail
if [[ $EUID -eq 0 ]]; then echo "Run as the desktop user, without sudo"; exit 1; fi
BROWSER="$(command -v chromium || command -v chromium-browser || true)"
if [[ -z "$BROWSER" ]]; then echo "Install Chromium first"; exit 1; fi
mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/repka-auto.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Repka Auto
Exec=/opt/repka-auto/service/kiosk.sh $BROWSER
X-GNOME-Autostart-enabled=true
EOF
echo "Kiosk enabled for next desktop login. Enable desktop auto-login in your OS settings."
