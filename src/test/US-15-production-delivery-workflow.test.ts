import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readRepositoryFile = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('US-15 production delivery workflow', () => {
  it('production deploy workflow는 workflow_dispatch로 시작하고 verify 성공 후 deploy를 실행해야 한다', () => {
    const workflow = readRepositoryFile('.github/workflows/deploy-production.yml');

    expect(workflow).toContain('workflow_dispatch');
    expect(workflow).toMatch(/verify:/);
    expect(workflow).toMatch(/deploy:/);
    expect(workflow).toMatch(/needs:\s*verify|needs:\s*\[\s*verify\s*\]/);
    expect(workflow).toContain('environment:');
    expect(workflow).toContain('name: production');
    expect(workflow).toContain('./scripts/deploy-production.sh');
  });

  it('production deploy workflow는 verify에서 확인한 정확한 commit sha 기준 artifact를 만들고 deploy가 이를 사용해야 한다', () => {
    const workflow = readRepositoryFile('.github/workflows/deploy-production.yml');

    expect(workflow).toContain('runs-on: ubuntu-22.04');
    expect(workflow).toContain('id: resolve-sha');
    expect(workflow).toContain('git rev-parse HEAD');
    expect(workflow).toContain('outputs:');
    expect(workflow).toContain('verified_sha');
    expect(workflow).toContain('artifact_name');
    expect(workflow).toContain('artifact_filename');
    expect(workflow).toContain('needs.verify.outputs.verified_sha');
    expect(workflow).toContain('needs.verify.outputs.artifact_name');
    expect(workflow).toContain('needs.verify.outputs.artifact_filename');
    expect(workflow).toContain('actions/upload-artifact');
    expect(workflow).toContain('actions/download-artifact');
    expect(workflow).toContain('ref: ${{ needs.verify.outputs.verified_sha }}');
    expect(workflow).toContain("node-version: '24'");
    expect(workflow).toContain('tar -czf');
    expect(workflow).toContain('npm prune --omit=dev');
    expect(workflow).toContain('artifact-metadata.json');
    expect(workflow).toContain('process.platform');
    expect(workflow).toContain('process.arch');
    expect(workflow).toContain('process.versions.modules');
    expect(workflow).toContain('PRODUCTION_GIT_SHA');
    expect(workflow).toContain(
      'PRODUCTION_ARTIFACT_PATH: production-artifacts/${{ needs.verify.outputs.artifact_filename }}',
    );
    expect(workflow).toContain('PRODUCTION_SSH_KNOWN_HOSTS');
  });

  it('dependency review workflow는 package manifest 변경 PR에서 실행되어야 한다', () => {
    const workflow = readRepositoryFile('.github/workflows/dependency-review.yml');

    expect(workflow).toContain('pull_request:');
    expect(workflow).toContain('package.json');
    expect(workflow).toContain('package-lock.json');
    expect(workflow).toContain('dependency-review-action');
  });

  it('CI workflow는 bot boot smoke test job을 포함해야 한다', () => {
    const workflow = readRepositoryFile('.github/workflows/ci.yml');

    expect(workflow).toContain('runs-on: ubuntu-22.04');
    expect(workflow).toContain("node-version: '24'");
    expect(workflow).toMatch(/smoke/i);
    expect(workflow).toContain('npm run test:smoke');
  });

  it('deploy script는 verified artifact만 서버에 반영하고 서버에서 npm ci나 build를 수행하지 않아야 한다', () => {
    const script = readRepositoryFile('scripts/deploy-production.sh');

    expect(script).toContain('PRODUCTION_GIT_SHA');
    expect(script).toContain('PRODUCTION_ARTIFACT_PATH');
    expect(script).toContain('scp');
    expect(script).toContain('export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"');
    expect(script).toContain('source "${NVM_DIR}/nvm.sh"');
    expect(script).toContain('command -v node >/dev/null');
    expect(script).toContain('command -v pm2 >/dev/null');
    expect(script).toContain('tar -xzf');
    expect(script).toContain('artifact-metadata.json');
    expect(script).toContain('process.versions.modules');
    expect(script).toContain('mktemp -d');
    expect(script).toContain('artifact-staging');
    expect(script).toContain("<<'NODE_METADATA_EOF'");
    expect(script).not.toContain('node - "${staging_root}/artifact-metadata.json" <<\'EOF\'');
    expect(script).toContain('mv "${staging_root}/dist" "${app_dir}/dist"');
    expect(script).toContain('resolved_app_dir="$(cd "${app_dir}" && pwd -P)"');
    expect(script).toContain('"${resolved_app_dir}" == "/"');
    expect(script).toContain('PRODUCTION_APP_DIR must be an absolute path');
    expect(script).toContain('"${app_dir}" == "/"');
    expect(script).toContain('"${staging_root}/node_modules"');
    expect(script).toContain(
      'Artifact validation failed: dist, node_modules, package.json, or artifact-metadata.json missing',
    );
    expect(script).toContain('const compareVersions = (left, right) => {');
    expect(script).toContain(
      'compareVersions(runtimeMetadata.glibcVersionRuntime, buildMetadata.glibcVersionRuntime) < 0',
    );
    expect(script).not.toContain('command -v npm >/dev/null');
    expect(script).not.toContain('git fetch origin --tags');
    expect(script).not.toContain('git checkout --detach');
    expect(script).not.toContain('npm ci');
    expect(script).not.toContain('npm run build');
    expect(script).not.toContain('git pull --ff-only origin');
  });

  it('readiness script는 known_hosts를 고정하고 이번 배포에서 추가된 ready 로그만 확인해야 한다', () => {
    const script = readRepositoryFile('scripts/verify-production-readiness.sh');

    expect(script).toContain('PRODUCTION_SSH_KNOWN_HOSTS');
    expect(script).toContain('StrictHostKeyChecking=yes');
    expect(script).toContain('UserKnownHostsFile');
    expect(script).toContain('export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"');
    expect(script).toContain('source "${NVM_DIR}/nvm.sh"');
    expect(script).toContain('command -v node >/dev/null');
    expect(script).toContain('command -v pm2 >/dev/null');
    expect(script).toContain('deployment-metadata');
    expect(script).toContain('current_info_log_file="$(latest_info_log_file)"');
    expect(script).toContain('grep -F "${ready_log_pattern}" "${current_info_log_file}"');
    expect(script).toContain('[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].log');
    expect(script).not.toContain('while IFS= read -r candidate; do');
    expect(script).not.toContain('grep -F "${ready_log_pattern}" "${candidate}"');
    expect(script).not.toContain("find logs -maxdepth 1 -type f -name '*.log'");
    expect(script).not.toContain('xargs ls -t');
  });

  it('runbook은 known_hosts와 verified sha 기반 배포 흐름을 설명해야 한다', () => {
    const runbook = readRepositoryFile('docs/PRODUCTION_RUNBOOK.md');

    expect(runbook).toContain('PRODUCTION_SSH_KNOWN_HOSTS');
    expect(runbook).toContain('검증된 commit SHA');
    expect(runbook).toContain('artifact');
    expect(runbook).toContain('Node');
    expect(runbook).toContain('platform');
    expect(runbook).toContain('realpath');
    expect(runbook).toContain('glibc');
    expect(runbook).toContain('node_modules');
    expect(runbook).toContain('branch, tag, commit SHA');
  });
});
