import { describe, expect, it } from 'vitest';

describe('US-07: 레거시 관리자 명령 제거', () => {
  it('TC-LA01: /register-cam과 /delete-cam 모듈은 더 이상 존재하지 않는다', async () => {
    await expect(import('../commands/haruharu/register-cam.js')).rejects.toThrow();
    await expect(import('../commands/haruharu/delete-cam.js')).rejects.toThrow();
  });

  it('TC-LA02: /approve-application과 /reject-application 모듈은 더 이상 존재하지 않는다', async () => {
    await expect(import('../commands/haruharu/approve-application.js')).rejects.toThrow();
    await expect(import('../commands/haruharu/reject-application.js')).rejects.toThrow();
  });
});
