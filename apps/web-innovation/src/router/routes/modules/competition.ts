import type { RouteLocation, RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    name: 'Competition',
    path: '/competition',
    redirect: '/competition/activities',
    meta: { title: $t('competition.title'), icon: 'lucide:trophy', order: 10 },
    children: [
      ...(['activities', 'entries', 'reviews', 'results'] as const).map(
        (view, index) => ({
          name: `Competition-${view}`,
          path: `/competition/${view}`,
          component: () => import('#/views/competition/list.vue'),
          props: { view },
          meta: {
            title: $t(`competition.${view}`),
            icon: [
              'lucide:calendar-days',
              'lucide:files',
              'lucide:clipboard-check',
              'lucide:award',
            ][index],
          },
        }),
      ),
      ...(['activity', 'entry', 'review', 'result'] as const).map((view) => ({
        name: `Competition-${view}-detail`,
        path: `/competition/${view}/:id`,
        redirect: (to: RouteLocation) => ({
          path: `/competition/${view === 'activity' ? 'activities' : view === 'entry' ? 'entries' : view === 'review' ? 'reviews' : 'results'}`,
          query: { ...to.query, detail: view, id: String(to.params.id) },
        }),
        meta: {
          title: $t(`competition.${view}Detail`),
          hideInMenu: true,
          hideInTab: true,
          activePath: `/competition/${view === 'activity' ? 'activities' : view === 'entry' ? 'entries' : view === 'review' ? 'reviews' : 'results'}`,
        },
      })),
    ],
  },
];
export default routes;
