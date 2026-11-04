import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';
const routes: RouteRecordRaw[] = [
  {
    name: 'Exchange',
    path: '/exchange',
    redirect: '/exchange/center',
    meta: {
      title: $t('exchange.title'),
      icon: 'lucide:messages-square',
      order: 8,
    },
    children: [
      {
        name: 'ExchangeCenter',
        path: '/exchange/center',
        component: () => import('#/views/exchange/list.vue'),
        props: { view: 'center' },
        meta: { title: $t('exchange.center'), icon: 'lucide:messages-square' },
      },
      {
        name: 'ExchangeMine',
        path: '/exchange/mine',
        component: () => import('#/views/exchange/list.vue'),
        props: { view: 'mine' },
        meta: { title: $t('exchange.mine'), icon: 'lucide:message-circle' },
      },
      {
        name: 'ExchangeManage',
        path: '/exchange/manage',
        component: () => import('#/views/exchange/list.vue'),
        props: { view: 'manage' },
        meta: { title: $t('exchange.manage'), icon: 'lucide:shield-check' },
      },
    ],
  },
];
export default routes;
