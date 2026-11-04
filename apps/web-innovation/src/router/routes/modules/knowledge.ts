import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';
const routes: RouteRecordRaw[] = [
  {
    name: 'Knowledge',
    path: '/knowledge',
    redirect: '/knowledge/search',
    meta: { title: $t('knowledge.title'), icon: 'lucide:book-open', order: 11 },
    children: [
      {
        name: 'KnowledgeSearch',
        path: '/knowledge/search',
        component: () => import('#/views/knowledge/list.vue'),
        props: { view: 'search' },
        meta: { title: $t('knowledge.search'), icon: 'lucide:search' },
      },
      {
        name: 'KnowledgeManage',
        path: '/knowledge/manage',
        component: () => import('#/views/knowledge/list.vue'),
        props: { view: 'manage' },
        meta: { title: $t('knowledge.manage'), icon: 'lucide:library' },
      },
    ],
  },
];
export default routes;
