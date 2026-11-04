import { describe, expect, it } from 'vitest';

import { getDemoSession, loginDemo } from './demo-auth';

describe('static prototype login', () => {
  it.each(['vben', 'admin', 'jack'])(
    'restores %s from its persisted demo token',
    (username) => {
      const { accessToken } = loginDemo({ username, password: '123456' });
      const restored = getDemoSession(accessToken);
      expect(restored.user.username).toBe(username);
      expect(restored.user.homePath).toBe('/competition/activities');
      expect(restored.codes.length).toBeGreaterThan(0);
      expect(restored.user).not.toHaveProperty('password');
    },
  );

  it('rejects unknown accounts and wrong passwords', () => {
    expect(() => loginDemo({ username: 'vben', password: 'wrong' })).toThrow(
      '密码错误',
    );
    expect(() =>
      loginDemo({ username: 'unknown', password: '123456' }),
    ).toThrow('密码错误');
    expect(() => loginDemo({})).toThrow('密码错误');
  });

  it('rejects absent and unrelated tokens', () => {
    expect(() => getDemoSession(null)).toThrow('重新登录');
    expect(() => getDemoSession('old-server-token')).toThrow('重新登录');
  });

  it('does not share mutable roles or permission arrays across sessions', () => {
    const token = loginDemo({
      username: 'admin',
      password: '123456',
    }).accessToken;
    const session = getDemoSession(token);
    session.codes.length = 0;
    session.user.roles?.push('super');
    expect(getDemoSession(token).codes.length).toBeGreaterThan(0);
    expect(getDemoSession(token).user.roles).toEqual(['admin']);
  });
});
