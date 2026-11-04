import { useAccessStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import { getDemoSession, isStaticDemo, loginDemo } from '#/api/demo-auth';
import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    password?: string;
    username?: string;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    accessToken: string;
  }

  export interface RefreshTokenResult {
    data: string;
    status: number;
  }
}

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  if (isStaticDemo) {
    try {
      return loginDemo(data);
    } catch (error) {
      message.error((error as Error).message);
      throw error;
    }
  }
  return requestClient.post<AuthApi.LoginResult>('/auth/login', data);
}

/**
 * 刷新accessToken
 */
export async function refreshTokenApi() {
  if (isStaticDemo) {
    return {
      data: getDemoSession(useAccessStore().accessToken).user.token,
      status: 200,
    };
  }
  return baseRequestClient.post<AuthApi.RefreshTokenResult>(
    '/auth/refresh',
    undefined,
    {
      withCredentials: true,
    },
  );
}

/**
 * 退出登录
 */
export async function logoutApi() {
  if (isStaticDemo) return;
  return baseRequestClient.post('/auth/logout', undefined, {
    withCredentials: true,
  });
}

/**
 * 获取用户权限码
 */
export async function getAccessCodesApi() {
  if (isStaticDemo) return getDemoSession(useAccessStore().accessToken).codes;
  return requestClient.get<string[]>('/auth/codes');
}
