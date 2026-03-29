import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('package scripts', () => {
  it('build 전에 dist를 정리하고 실행 스크립트가 build를 재사용한다', () => {
    const packageJson = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts.build).toContain("rmSync('dist'");
    expect(packageJson.scripts.start).toBe('npm run build && node "dist/index.js"');
    expect(packageJson.scripts.pm2).toBe(
      'npm run build && NODE_ENV=production pm2 start dist/index.js --name haruharu-bot',
    );
    expect(packageJson.scripts.deploy).toBe('git pull && npm run build && pm2 reload haruharu-bot');
  });
});
