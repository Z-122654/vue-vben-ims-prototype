import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';
const routes: RouteRecordRaw[] = [
  {
    name: 'Research',
    path: '/research',
    redirect: '/research/mine',
    meta: {
      title: $t('research.title'),
      icon: 'lucide:flask-conical',
      order: 9,
    },
    children: [
      {
        name: 'ResearchManage',
        path: '/research/manage',
        component: () => import('#/views/research/list.vue'),
        props: { view: 'manage' },
        meta: { title: $t('research.manage'), icon: 'lucide:folder-kanban' },
      },
      {
        name: 'ResearchMine',
        path: '/research/mine',
        component: () => import('#/views/research/list.vue'),
        props: { view: 'mine' },
        meta: { title: $t('research.mine'), icon: 'lucide:clipboard-list' },
      },
    ],
  },
];
export default routes;
