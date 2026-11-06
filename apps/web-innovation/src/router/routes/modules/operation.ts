import type { RouteRecordRaw } from 'vue-router';

import { IFrameView } from '#/layouts';
import { $t } from '#/locales';

// Use Vite's base so development and the GitHub Pages subdirectory share one entry.
const dashboardUrl = `${import.meta.env.BASE_URL}dashboards/operation/index.html`;
// Menu generation uses the link as its path; an absolute URL avoids SPA navigation.
const dashboardLink = new URL(dashboardUrl, window.location.origin).href;

const routes: RouteRecordRaw[] = [
  {
    name: 'OperationDashboard',
    path: '/operation-dashboard',
    component: IFrameView,
    meta: {
      icon: 'lucide:monitor',
      iframeSrc: dashboardUrl,
      link: dashboardLink,
      order: 12,
      title: $t('operation.title'),
    },
  },
];

export default routes;
