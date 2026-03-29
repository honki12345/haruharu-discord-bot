import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readRepositoryFile = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getWorkflowJobBlock = (workflow: string, jobName: string) => {
  const lines = workflow.split('\n');
  const jobStartIndex = lines.findIndex(line => new RegExp(`^ {2}${escapeRegExp(jobName)}:\\s*$`).test(line));

  expect(jobStartIndex).toBeGreaterThanOrEqual(0);

  let jobEndIndex = lines.length;
  for (let index = jobStartIndex + 1; index < lines.length; index += 1) {
    if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(lines[index])) {
      jobEndIndex = index;
      break;
    }
  }

  return lines.slice(jobStartIndex, jobEndIndex).join('\n');
};

const expectWorkflowJobRuntime = (
  workflow: string,
  jobName: string,
  options?: {
    nodeVersion?: string;
  },
) => {
  const jobBlock = getWorkflowJobBlock(workflow, jobName);

  expect(jobBlock).toContain('runs-on: ubuntu-22.04');

  if (options?.nodeVersion) {
    expect(jobBlock).toContain(`node-version: '${options.nodeVersion}'`);
  }
};

const extractShellFunction = (script: string, functionName: string) => {
  const match = script.match(new RegExp(`^${escapeRegExp(functionName)}\\(\\) \\{[\\s\\S]*?^\\}`, 'm'));

  expect(match, `Failed to extract ${functionName} from readiness script`).not.toBeNull();

  return match![0];
};

const runReadinessDetectionScenario = (options: {
  currentLogFileName: string;
  currentLogContent: string;
  previousLogFileName?: string;
  previousLogContent?: string;
  previousInfoLogFile?: string;
  previousInfoLogSize?: number;
}) => {
  const script = readRepositoryFile('scripts/verify-production-readiness.sh');
  const harness = [
    'set -euo pipefail',
    extractShellFunction(script, 'find_new_ready_log_entry'),
    extractShellFunction(script, 'latest_info_log_file'),
    'if find_new_ready_log_entry; then',
    '  exit 0',
    'fi',
    'exit 1',
  ].join('\n\n');

  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'haruharu-readiness-'));
  const logsDirectory = path.join(tempDirectory, 'logs');

  try {
    fs.mkdirSync(logsDirectory);

    if (options.previousLogFileName && options.previousLogContent !== undefined) {
      fs.writeFileSync(path.join(logsDirectory, options.previousLogFileName), options.previousLogContent);
    }

    fs.writeFileSync(path.join(logsDirectory, options.currentLogFileName), options.currentLogContent);

    return spawnSync('bash', ['-lc', harness], {
      cwd: tempDirectory,
      encoding: 'utf8',
      env: {
        ...process.env,
        info_log_pattern: '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].log',
        ready_log_pattern: 'Ready! Logged in as',
        ...(options.previousInfoLogFile ? { PREVIOUS_INFO_LOG_FILE: options.previousInfoLogFile } : {}),
        ...(options.previousInfoLogSize !== undefined
          ? { PREVIOUS_INFO_LOG_SIZE: String(options.previousInfoLogSize) }
          : {}),
      },
    });
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
};

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

    expectWorkflowJobRuntime(workflow, 'verify', { nodeVersion: '24' });
    expectWorkflowJobRuntime(workflow, 'deploy');
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

    expectWorkflowJobRuntime(workflow, 'lint-and-format', { nodeVersion: '24' });
    expectWorkflowJobRuntime(workflow, 'test', { nodeVersion: '24' });
    expectWorkflowJobRuntime(workflow, 'bot-smoke-test', { nodeVersion: '24' });
    expectWorkflowJobRuntime(workflow, 'integration-test', { nodeVersion: '24' });
    expect(workflow).toMatch(/smoke/i);
    expect(workflow).toContain('npm run test:smoke');
  });

  it('CI workflow는 same-repo PR과 main push에서 integration test 전에 slash command를 동기화해야 한다', () => {
    const workflow = readRepositoryFile('.github/workflows/ci.yml');
    const integrationJobBlock = getWorkflowJobBlock(workflow, 'integration-test');

    expect(integrationJobBlock).toContain("github.event_name == 'pull_request'");
    expect(integrationJobBlock).toContain('github.event.pull_request.head.repo.full_name == github.repository');
    expect(integrationJobBlock).toContain("github.event_name == 'push'");
    expect(integrationJobBlock).toContain("github.ref == 'refs/heads/main'");
    expect(integrationJobBlock).toContain('workflow_dispatch');
    expect(integrationJobBlock).toContain('config.json');
    expect(integrationJobBlock).toContain('npm run deploy:commands');
    expect(integrationJobBlock).toContain('npm run test:integration');
    expect(integrationJobBlock.indexOf('npm run deploy:commands')).toBeLessThan(
      integrationJobBlock.indexOf('npm run test:integration'),
    );
  });

  it('integration test는 deprecated ready 대신 clientReady 이벤트를 사용해야 한다', () => {
    const integrationTest = readRepositoryFile('src/test/integration/discord.integration.test.ts');

    expect(integrationTest).toContain("client.once('clientReady'");
    expect(integrationTest).not.toContain("client.once('ready'");
  });

  it('workflow runtime pin 검증은 다른 job에 남은 설정 때문에 false positive를 내면 안 된다', () => {
    const driftedDeployWorkflow = `jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
  deploy:
    runs-on: ubuntu-22.04
`;

    expect(() => expectWorkflowJobRuntime(driftedDeployWorkflow, 'verify', { nodeVersion: '24' })).toThrow();

    const driftedCiWorkflow = `jobs:
  lint-and-format:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
  test:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
`;

    expect(() => expectWorkflowJobRuntime(driftedCiWorkflow, 'lint-and-format', { nodeVersion: '24' })).toThrow();
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

  it('readiness helper는 새 info 로그 파일에서 ready 로그를 찾으면 성공해야 한다', () => {
    const result = runReadinessDetectionScenario({
      previousLogFileName: '2026-03-28.log',
      previousLogContent: '{"message":"older deployment"}\n',
      previousInfoLogFile: 'logs/2026-03-28.log',
      previousInfoLogSize: Buffer.byteLength('{"message":"older deployment"}\n'),
      currentLogFileName: '2026-03-29.log',
      currentLogContent: '{"message":"Ready! Logged in as HaruHaru"}\n',
    });

    expect(result.status, result.stderr).toBe(0);
  });

  it('readiness helper는 같은 info 로그 파일 재사용 시 이전 바이트 오프셋 이전의 ready 로그를 무시해야 한다', () => {
    const previousSegment = '{"message":"Ready! Logged in as old deployment"}\n';
    const result = runReadinessDetectionScenario({
      previousInfoLogFile: 'logs/2026-03-29.log',
      previousInfoLogSize: Buffer.byteLength(previousSegment),
      currentLogFileName: '2026-03-29.log',
      currentLogContent: `${previousSegment}{"message":"after deploy but not ready"}\n`,
    });

    expect(result.status, result.stderr).toBe(1);
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
