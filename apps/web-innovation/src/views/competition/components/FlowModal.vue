<script setup lang="ts">
import type { Activity, Entry, History } from '../model';

import { computed } from 'vue';

import { Form, FormItem, Input, Modal, Popover } from 'ant-design-vue';

import {
  activityPublisherLabel,
  entrySubmissionTime,
  hasSubmitted,
} from '../model';
import ImsSection from './ImsSection.vue';
defineProps<{ open: boolean; entry: Entry; activity?: Activity }>();
const emit = defineEmits<{ 'update:open': [value: boolean] }>();
function processingTime(history: History[], index: number) {
  const before = history[index - 1];
  const current = history[index];
  if (!before || !current) return '—';
  const minutes = Math.max(
    0,
    Math.floor(
      (new Date(current.at).getTime() - new Date(before.at).getTime()) / 60_000,
    ),
  );
  return minutes < 60
    ? `${minutes} 分钟`
    : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}
const steps = computed(() => [
  '新建申报',
  '提交申报',
  '管理员材料审核',
  '审核完成',
]);
</script>
<template>
  <Modal
    class="competition-page competition-dialog-content"
    :body-style="{ maxHeight: 'calc(100dvh - 160px)', overflowY: 'auto' }"
    :open="open"
    title="流程图"
    width="min(1040px, calc(100vw - 48px))"
    :footer="null"
    @cancel="emit('update:open', false)"
  >
    <ImsSection title="基本信息">
      <Form :label-col="{ style: { width: '110px' } }" disabled>
        <div class="ims-form-grid">
          <FormItem label="项目名称" class="span-two">
            <Input :value="entry.name" />
          </FormItem>
          <FormItem label="当前状态"><Input :value="entry.status" /></FormItem>
        </div>
      </Form>
    </ImsSection>
    <ImsSection title="材料审核流程">
      <div class="flow-canvas">
        <template v-for="(step, index) in steps" :key="step">
          <div
            class="flow-node"
            :class="{
              complete:
                index === 0 ||
                (index === 1 && hasSubmitted(entry)) ||
                (index >= 2 && entry.status === '审核通过'),
              current:
                (index === 1 && entry.status === '退回修改') ||
                (index === 2 && entry.status === '待审核'),
            }"
          >
            <span class="flow-person">♙</span><span>{{ step }}</span>
            <small>{{
              index === 0
                ? '填报人'
                : index === 1
                  ? '填报人提交'
                  : index === 2
                    ? activityPublisherLabel(activity)
                    : '进入参评范围'
            }}</small>
          </div>
          <div v-if="index < steps.length - 1" class="flow-arrow">⟶</div>
        </template>
      </div>
      <p v-if="entrySubmissionTime(entry) === '历史未记录'" class="muted">
        该申报已提交过，提交时间历史未记录；节点依据当前状态及已有历史展示，不补造时间。
      </p>
      <p v-if="entry.status === '退回修改'" class="return-note">
        ↶ 等待填报人补充材料／重新提交，重新提交后回到管理员材料审核。
      </p>
      <p v-if="entry.status === '已终止'" class="return-note">
        本申报已终止，材料与处理记录保留，不进入专家评审。
      </p>
      <p class="muted">本流程仅用于材料审核，无部门初审或上级领导审批节点。</p>
    </ImsSection>
    <ImsSection title="处理记录">
      <p class="muted">点击记录查看处理人、意见及操作时间。</p>
      <div class="flow-history">
        <Popover
          v-for="(item, index) in entry.history"
          :key="item.id"
          trigger="click"
          placement="top"
        >
          <template #content>
            <div class="history-popover">
              <b>{{ item.actor }} · {{ item.action }}</b>
              <p>处理意见：{{ item.note || '—' }}</p>
              <p>操作时间：{{ item.at }}</p>
              <p>距上次操作：{{ processingTime(entry.history, index) }}</p>
            </div>
          </template>
          <button class="history-event">
            <span class="history-dot"></span><b>{{ item.action }}</b
            ><span>{{ item.actor }}</span
            ><small>{{ item.at }}</small>
          </button>
        </Popover>
      </div>
    </ImsSection>
  </Modal>
</template>
