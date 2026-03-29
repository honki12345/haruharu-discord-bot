import { describe, expect, it } from 'vitest';
import { createMockInteraction } from './test-setup.js';

describe('test-setup helpers', () => {
  it('createMockInteraction의 기본 client.users.fetch 모킹은 User 형태를 반환한다', async () => {
    const interaction = createMockInteraction();
    const user = await interaction.client.users.fetch('test-user-id');

    expect(user).toMatchObject({
      id: 'test-user-id',
      username: 'test-username',
      globalName: '테스트유저',
    });
    expect(user).not.toHaveProperty('roles');
    expect(typeof user.send).toBe('function');
  });
});
