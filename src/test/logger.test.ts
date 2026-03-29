import { describe, expect, it } from 'vitest';
import { logger } from '../logger.js';

describe('logger', () => {
  it('unhandled rejection 수집을 위한 rejectionHandlers를 등록한다', () => {
    const handlerCount =
      logger.rejections?.handlers?.size ??
      logger.rejections?.handlers?.length ??
      logger.rejectionHandlers?.handlers?.size ??
      logger.rejectionHandlers?.handlers?.length ??
      0;

    expect(handlerCount).toBeGreaterThan(0);
  });

  it('Error 객체를 로그 포맷에 통과시키면 stack 정보를 보존한다', () => {
    const error = new Error('boom');
    const transformed = logger.format.transform({ level: 'error', message: error }) as {
      message: string | Error;
      stack?: string;
    };

    expect(typeof transformed.message).toBe('string');
    expect(transformed.message).toBe('boom');
    expect(transformed.stack).toContain('Error: boom');
  });
});
