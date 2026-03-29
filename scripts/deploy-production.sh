#!/usr/bin/env bash
set -euo pipefail

required_env_vars=(
  PRODUCTION_SSH_HOST
  PRODUCTION_SSH_USER
  PRODUCTION_SSH_KEY
  PRODUCTION_APP_DIR
  PRODUCTION_REF
)

for variable_name in "${required_env_vars[@]}"; do
  if [[ -z "${!variable_name:-}" ]]; then
    echo "Missing required environment variable: ${variable_name}" >&2
    exit 1
  fi
done

ssh_port="${PRODUCTION_SSH_PORT:-22}"
pm2_app_name="${PRODUCTION_PM2_APP_NAME:-haruharu-bot}"

ssh_key_file="$(mktemp)"
cleanup() {
  rm -f "${ssh_key_file}"
}
trap cleanup EXIT

printf '%s\n' "${PRODUCTION_SSH_KEY}" > "${ssh_key_file}"
chmod 600 "${ssh_key_file}"

ssh \
  -i "${ssh_key_file}" \
  -o StrictHostKeyChecking=accept-new \
  -p "${ssh_port}" \
  "${PRODUCTION_SSH_USER}@${PRODUCTION_SSH_HOST}" \
  "bash -s" -- "${PRODUCTION_APP_DIR}" "${PRODUCTION_REF}" "${pm2_app_name}" <<'EOF'
set -euo pipefail

app_dir="$1"
deploy_ref="$2"
pm2_app_name="$3"

cd "${app_dir}"

git fetch origin
git checkout "${deploy_ref}"
git pull --ff-only origin "${deploy_ref}"
npm ci
npm run build

if pm2 describe "${pm2_app_name}" >/dev/null 2>&1; then
  pm2 reload "${pm2_app_name}" --update-env
else
  NODE_ENV=production pm2 start dist/index.js --name "${pm2_app_name}" --update-env
fi

pm2 save
EOF
