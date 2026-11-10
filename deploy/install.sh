#!/usr/bin/env bash
set -euo pipefail
if [[ $EUID -ne 0 ]]; then echo "Run: sudo bash deploy/install.sh"; exit 1; fi
SOURCE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
apt-get update
apt-get install -y python3 python3-venv bluez
id repka-auto &>/dev/null || useradd --system --home-dir /opt/repka-auto --shell /usr/sbin/nologin repka-auto
usermod -aG dialout repka-auto
install -d /opt/repka-auto/service
cp "$SOURCE/service/"*.py "$SOURCE/service/dashboard.html" "$SOURCE/service/requirements.txt" /opt/repka-auto/service/
install -m 755 "$SOURCE/service/kiosk.sh" /opt/repka-auto/service/kiosk.sh
python3 -m venv /opt/repka-auto/.venv
/opt/repka-auto/.venv/bin/pip install -r /opt/repka-auto/service/requirements.txt
install -m 644 "$SOURCE/deploy/repka-auto.conf" /etc/dbus-1/system.d/repka-auto.conf
install -m 644 "$SOURCE/deploy/repka-auto.service" /etc/systemd/system/repka-auto.service
if [[ ! -f /etc/repka-auto.env ]]; then install -m 640 "$SOURCE/deploy/repka-auto.env.example" /etc/repka-auto.env; fi
systemctl reload dbus
systemctl enable --now bluetooth
bluetoothctl power on
systemctl daemon-reload
systemctl enable repka-auto
echo "Set OBD_PORT in /etc/repka-auto.env, then: sudo systemctl restart repka-auto"
