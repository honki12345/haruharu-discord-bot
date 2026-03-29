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
});
