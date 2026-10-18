#!/usr/bin/env bash
# Prepare a fresh Ubuntu 24.04 host (EC2, GCE or Azure VM) for TraceAML.
# Idempotent: safe to run again. Run as a sudo-capable user:
#
#   sudo bash deploy/scripts/bootstrap-ubuntu.sh
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "run with sudo" >&2
  exit 1
fi
APP_USER="${SUDO_USER:-ubuntu}"

echo "== packages"
apt-get update -y
apt-get install -y ca-certificates curl gnupg unzip sqlite3 jq

echo "== Docker Engine and the compose plugin (official repository)"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
usermod -aG docker "$APP_USER"
systemctl enable --now docker

# Bounded container logs so a chatty service cannot fill the disk.
cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "5" }
}
JSON
systemctl restart docker

echo "== AWS CLI v2 (skipped when present; harmless on other clouds)"
if ! command -v aws >/dev/null; then
  arch="$(uname -m)"
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${arch}.zip" -o /tmp/awscli.zip
  unzip -q -o /tmp/awscli.zip -d /tmp
  /tmp/aws/install --update
fi

echo "== kernel settings recommended for Redis-based servers (FalkorDB)"
cat > /etc/sysctl.d/90-traceaml.conf <<'SYSCTL'
vm.overcommit_memory = 1
net.core.somaxconn = 1024
SYSCTL
sysctl --system >/dev/null
# Transparent huge pages add latency spikes to Redis forks (snapshots).
cat > /etc/systemd/system/disable-thp.service <<'UNIT'
[Unit]
Description=Disable transparent huge pages for FalkorDB
Before=docker.service

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'echo never > /sys/kernel/mm/transparent_hugepage/enabled'

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now disable-thp.service

echo "== swap (protects against a load-time memory spike, not a substitute for RAM)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== data directories"
mkdir -p /srv/traceaml/artifacts /srv/traceaml/graph-input /srv/traceaml/backups
chown -R "$APP_USER:$APP_USER" /srv/traceaml

echo "done. Log out and back in so '$APP_USER' can use docker without sudo."
