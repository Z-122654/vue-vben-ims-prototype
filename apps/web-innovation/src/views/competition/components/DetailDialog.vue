<script setup lang="ts">
import type { CloseGuard, DetailPanel, DetailTarget } from '../detail-dialog';

import { computed, defineAsyncComponent, provide } from 'vue';

import { Modal } from 'ant-design-vue';

import { $t } from '#/locales';

import { detailContextKey } from '../detail-dialog';

const props = defineProps<{
  panel: DetailPanel;
  active: boolean;
  openDetail: (target: DetailTarget) => Promise<void>;
  close: () => Promise<void>;
  replaceId: (key: number, id: string) => void;
  registerGuard: (key: number, guard: CloseGuard) => void;
}>();
const views = {
  activity: defineAsyncComponent(() => import('../activity.vue')),
  entry: defineAsyncComponent(() => import('../entry.vue')),
  review: defineAsyncComponent(() => import('../review.vue')),
  result: defineAsyncComponent(() => import('../result.vue')),
};
provide(detailContextKey, {
  recordId: computed(() => props.panel.id),
  activityId: computed(() => props.panel.activityId ?? ''),
  openDetail: (target) => props.openDetail(target),
  replaceId: (id) => props.replaceId(props.panel.key, id),
  close: () => props.close(),
  onBeforeClose: (guard) => props.registerGuard(props.panel.key, guard),
});
</script>

<template>
  <Modal
    :open="active"
    :title="$t(`competition.${panel.kind}Detail`)"
    width="min(1440px, calc(100vw - 48px))"
    wrap-class-name="competition-detail-modal"
    :style="{ top: '24px', paddingBottom: 0 }"
    :body-style="{
      padding: 0,
      maxHeight: 'calc(100dvh - 110px)',
      overflowY: 'auto',
    }"
    :mask-closable="false"
    :footer="null"
    :focus-trigger-after-close="false"
    @cancel="close"
  >
    <component :is="views[panel.kind]" />
  </Modal>
</template>
