import type { UserInfo } from '@vben/types';

import { useAccessStore } from '@vben/stores';

import { getDemoSession, isStaticDemo } from '#/api/demo-auth';
import { requestClient } from '#/api/request';

/**
 * 获取用户信息
 */
export async function getUserInfoApi() {
  if (isStaticDemo) return getDemoSession(useAccessStore().accessToken).user;
  return requestClient.get<UserInfo>('/user/info');
}
