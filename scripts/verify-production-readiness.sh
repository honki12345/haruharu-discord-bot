#!/usr/bin/env bash
set -euo pipefail

required_env_vars=(
  PRODUCTION_SSH_HOST
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
ready_wait_seconds="${PRODUCTION_READY_WAIT_SECONDS:-60}"
ready_log_pattern='Ready! Logged in as'

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
  "bash -s" -- "${PRODUCTION_APP_DIR}" "${pm2_app_name}" "${ready_wait_seconds}" "${ready_log_pattern}" <<'EOF'
set -euo pipefail

app_dir="$1"
pm2_app_name="$2"
ready_wait_seconds="$3"
ready_log_pattern="$4"

cd "${app_dir}"

online_count=0
deadline=$((SECONDS + ready_wait_seconds))

while (( SECONDS < deadline )); do
  online_count="$(pm2 jlist | node -e '
    const fs = require("fs");
    const appName = process.argv[1];
    const payload = fs.readFileSync(0, "utf8");
    const processes = JSON.parse(payload);
    const online = processes.filter(
      process => process.name === appName && process.pm2_env && process.pm2_env.status === "online",
    ).length;
    process.stdout.write(String(online));
  ' "${pm2_app_name}")"

  if [[ "${online_count}" == "1" ]]; then
    break
  fi

  sleep 2
done

if [[ "${online_count}" != "1" ]]; then
  echo "Expected exactly one online PM2 process for ${pm2_app_name}, found ${online_count}" >&2
  pm2 status "${pm2_app_name}" || true
  exit 1
fi

latest_log_file=''
deadline=$((SECONDS + ready_wait_seconds))

while (( SECONDS < deadline )); do
  latest_log_file="$(find logs -maxdepth 1 -type f -name '*.log' -print | xargs ls -t 2>/dev/null | head -n 1 || true)"

  if [[ -n "${latest_log_file}" ]] && tail -n 200 "${latest_log_file}" | grep -F "${ready_log_pattern}" >/dev/null; then
    pm2 status "${pm2_app_name}"
    tail -n 50 "${latest_log_file}"
    exit 0
  fi

  sleep 2
done

echo "Could not find a recent ready log entry for ${pm2_app_name}" >&2
pm2 status "${pm2_app_name}" || true
if [[ -n "${latest_log_file}" ]]; then
  tail -n 100 "${latest_log_file}" || true
fi
exit 1
EOF
