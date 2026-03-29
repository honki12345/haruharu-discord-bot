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

  it('production deploy workflow는 verify에서 확인한 정확한 commit sha와 known_hosts를 deploy에 전달해야 한다', () => {
    const workflow = readRepositoryFile('.github/workflows/deploy-production.yml');

    expect(workflow).toContain('id: resolve-sha');
    expect(workflow).toContain('git rev-parse HEAD');
    expect(workflow).toContain('outputs:');
    expect(workflow).toContain('verified_sha');
    expect(workflow).toContain('needs.verify.outputs.verified_sha');
    expect(workflow).toContain('PRODUCTION_GIT_SHA');
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

    expect(workflow).toMatch(/smoke/i);
    expect(workflow).toContain('npm run test:smoke');
  });

  it('deploy script는 mutable ref pull 대신 verified sha를 checkout 해야 한다', () => {
    const script = readRepositoryFile('scripts/deploy-production.sh');

    expect(script).toContain('PRODUCTION_GIT_SHA');
    expect(script).toContain('git fetch origin --tags');
    expect(script).toContain('git checkout --detach');
    expect(script).not.toContain('git pull --ff-only origin');
  });

  it('readiness script는 known_hosts를 고정하고 이번 배포에서 추가된 ready 로그만 확인해야 한다', () => {
    const script = readRepositoryFile('scripts/verify-production-readiness.sh');

    expect(script).toContain('PRODUCTION_SSH_KNOWN_HOSTS');
    expect(script).toContain('StrictHostKeyChecking=yes');
    expect(script).toContain('UserKnownHostsFile');
    expect(script).toContain('deployment-metadata');
    expect(script).toContain('[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].log');
    expect(script).not.toContain("find logs -maxdepth 1 -type f -name '*.log'");
    expect(script).not.toContain('xargs ls -t');
  });

  it('runbook은 known_hosts와 verified sha 기반 배포 흐름을 설명해야 한다', () => {
    const runbook = readRepositoryFile('docs/PRODUCTION_RUNBOOK.md');

    expect(runbook).toContain('PRODUCTION_SSH_KNOWN_HOSTS');
    expect(runbook).toContain('검증된 commit SHA');
    expect(runbook).toContain('branch, tag, commit SHA');
  });
});
