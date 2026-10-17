#!/usr/bin/env bash
# Write secrets from AWS SSM Parameter Store into deploy/.env.production,
# so they never live in the repository or in shell history.
#
#   bash deploy/scripts/fetch-secrets.sh /traceaml/prod
#
# Expects SecureString parameters under the prefix:
#   <prefix>/LLM_API_KEY        optional Gemini key
#   <prefix>/BASIC_AUTH_HASH    bcrypt hash from `caddy hash-password`
# The instance role needs ssm:GetParameter and kms:Decrypt on them.
set -euo pipefail

PREFIX="${1:?usage: fetch-secrets.sh /traceaml/prod}"
ENV_FILE="$(dirname "$0")/../.env.production"
[[ -f "$ENV_FILE" ]] || { echo "create $ENV_FILE from .env.production.example first" >&2; exit 1; }

get() {
  aws ssm get-parameter --with-decryption --name "$PREFIX/$1" \
    --query Parameter.Value --output text 2>/dev/null || true
}

set_var() {
  local name="$1" value="$2"
  # Compose interpolates $ in env files; escape it.
  value="${value//\$/\$\$}"
  if grep -q "^${name}=" "$ENV_FILE"; then
    python3 - "$ENV_FILE" "$name" "$value" <<'PY'
import sys
path, name, value = sys.argv[1:4]
lines = open(path, encoding="utf-8").read().splitlines()
lines = [f"{name}={value}" if line.startswith(f"{name}=") else line for line in lines]
open(path, "w", encoding="utf-8").write("\n".join(lines) + "\n")
PY
  else
    printf '%s=%s\n' "$name" "$value" >> "$ENV_FILE"
  fi
}

for name in LLM_API_KEY BASIC_AUTH_HASH; do
  value="$(get "$name")"
  if [[ -n "$value" ]]; then
    set_var "$name" "$value"
    echo "set $name"
  else
    echo "skipped $name (not found under $PREFIX)"
  fi
done
chmod 600 "$ENV_FILE"
