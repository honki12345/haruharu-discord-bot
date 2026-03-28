import { describe, expect, it } from 'vitest';
import { DAILY_MESSAGE_QUESTIONS, pickDailyMessageQuestion } from '../daily-message.js';

describe('daily message question helper', () => {
  it('질문 풀은 100개를 유지한다', () => {
    expect(DAILY_MESSAGE_QUESTIONS).toHaveLength(100);
  });

  it('랜덤 값에 따라 같은 질문을 결정적으로 선택한다', () => {
    expect(pickDailyMessageQuestion(0)).toBe(DAILY_MESSAGE_QUESTIONS[0]);
    expect(pickDailyMessageQuestion(0.9999)).toBe(DAILY_MESSAGE_QUESTIONS[99]);
    expect(pickDailyMessageQuestion(0.42)).toBe(DAILY_MESSAGE_QUESTIONS[42]);
  });
});
