#!/usr/bin/env bash
set -euo pipefail

required_env_vars=(
  PRODUCTION_GIT_SHA
  PRODUCTION_SSH_HOST
  PRODUCTION_SSH_KNOWN_HOSTS
  PRODUCTION_SSH_USER
  PRODUCTION_SSH_KEY
  PRODUCTION_APP_DIR
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
ssh_known_hosts_file="$(mktemp)"
cleanup() {
  rm -f "${ssh_key_file}"
  rm -f "${ssh_known_hosts_file}"
}
trap cleanup EXIT

printf '%s\n' "${PRODUCTION_SSH_KEY}" > "${ssh_key_file}"
printf '%s\n' "${PRODUCTION_SSH_KNOWN_HOSTS}" > "${ssh_known_hosts_file}"
chmod 600 "${ssh_key_file}"
chmod 600 "${ssh_known_hosts_file}"

ssh \
  -i "${ssh_key_file}" \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="${ssh_known_hosts_file}" \
  -p "${ssh_port}" \
  "${PRODUCTION_SSH_USER}@${PRODUCTION_SSH_HOST}" \
  "bash -s" -- "${PRODUCTION_APP_DIR}" "${PRODUCTION_GIT_SHA}" "${pm2_app_name}" <<'EOF'
set -euo pipefail

app_dir="$1"
deploy_git_sha="$2"
pm2_app_name="$3"
metadata_dir="${app_dir}/runtime"
metadata_path="${metadata_dir}/production-deployment-metadata.env"
info_log_pattern='[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].log'

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "${NVM_DIR}/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  source "${NVM_DIR}/nvm.sh"
fi

command -v node >/dev/null || { echo "node not found in remote deployment shell" >&2; exit 1; }
command -v npm >/dev/null || { echo "npm not found in remote deployment shell" >&2; exit 1; }
command -v pm2 >/dev/null || { echo "pm2 not found in remote deployment shell" >&2; exit 1; }

cd "${app_dir}"
mkdir -p "${metadata_dir}" logs

previous_info_log_file="$(find logs -maxdepth 1 -type f -name "${info_log_pattern}" -print | sort | tail -n 1)"
previous_info_log_size=0
if [[ -n "${previous_info_log_file}" ]]; then
  previous_info_log_size="$(wc -c < "${previous_info_log_file}")"
fi

git fetch origin --tags
git checkout --detach --force "${deploy_git_sha}"
npm ci
npm run build

cat > "${metadata_path}" <<METADATA
DEPLOY_GIT_SHA=${deploy_git_sha}
DEPLOY_STARTED_AT_EPOCH=$(date +%s)
PREVIOUS_INFO_LOG_FILE=${previous_info_log_file}
PREVIOUS_INFO_LOG_SIZE=${previous_info_log_size}
METADATA

if pm2 describe "${pm2_app_name}" >/dev/null 2>&1; then
  pm2 reload "${pm2_app_name}" --update-env
else
  NODE_ENV=production pm2 start dist/index.js --name "${pm2_app_name}" --update-env
fi

pm2 save
EOF
