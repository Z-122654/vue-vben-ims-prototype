import type { UserInfo } from '@vben/types';

/** Static prototype identities only; these are not real authentication credentials. */
const accounts = [
  {
    username: 'vben',
    realName: 'Vben',
    role: 'super',
    codes: ['AC_100100', 'AC_100110', 'AC_100120', 'AC_100010'],
  },
  {
    username: 'admin',
    realName: 'Admin',
    role: 'admin',
    codes: ['AC_100010', 'AC_100020', 'AC_100030'],
  },
  {
    username: 'jack',
    realName: 'Jack',
    role: 'user',
    codes: ['AC_1000001', 'AC_1000002'],
  },
];

export const isStaticDemo = import.meta.env.VITE_STATIC_DEMO === 'true';

export function loginDemo(data: { password?: string; username?: string }) {
  const account = accounts.find((item) => item.username === data.username);
  if (!account || data.password !== '123456') {
    throw new Error('演示账号或密码错误，请选择演示账号，密码为 123456');
  }
  return { accessToken: `ims-static-demo:${account.username}` };
}

export function getDemoSession(token: null | string) {
  const account = accounts.find(
    (item) => token === `ims-static-demo:${item.username}`,
  );
  if (!account) throw new Error('演示登录已失效，请重新登录');
  const user: UserInfo = {
    avatar: '',
    desc: '技术创新管理演示账号',
    homePath: '/competition/activities',
    realName: account.realName,
    roles: [account.role],
    token: `ims-static-demo:${account.username}`,
    userId: account.username,
    username: account.username,
  };
  return { codes: [...account.codes], user };
}
