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
});
