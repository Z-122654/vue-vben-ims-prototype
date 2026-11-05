<script setup lang="ts">
import type { Activity, Person } from '../model';
import { computed, ref, watch } from 'vue';
import { Form, FormItem, Input, Modal, Select } from 'ant-design-vue';
import { canManageActivity } from '../model';
import ImsSection from './ImsSection.vue';
import ImsTable from './ImsTable.vue';
const props = defineProps<{
  open: boolean;
  activity: Activity;
  actor: Person;
}>();
const emit = defineEmits<{ 'update:open': [value: boolean] }>();
const selected = ref('');
const rounds = computed(() =>
  (props.activity.publicationApprovals ?? []).filter(
    (r) =>
      canManageActivity(props.activity, props.actor) ||
      r.decisions.some((d) => d.personId === props.actor.id),
  ),
);
const round = computed(
  () =>
    rounds.value.find((r) => r.id === selected.value) ?? rounds.value.at(-1),
);
watch(
  () => props.open,
  (open) => {
    if (open) selected.value = rounds.value.at(-1)?.id ?? '';
  },
);
</script>
<template>
  <Modal
    centered
    :open="open"
    title="流程图"
    :footer="null"
    width="min(1120px, calc(100vw - 48px))"
    class="competition-page competition-dialog-content"
    :body-style="{ maxHeight: 'calc(100dvh - 160px)', overflowY: 'auto' }"
    @cancel="emit('update:open', false)"
  >
    <template v-if="round">
      <ImsSection title="基本信息">
        <Form :label-col="{ style: { width: '112px' } }">
          <div class="ims-form-grid">
            <FormItem label="活动名称" class="span-two"
              ><Input :value="activity.name" disabled
            /></FormItem>
            <FormItem label="审批轮次"
              ><Select
                v-model:value="selected"
                :options="
                  rounds.map((r, i) => ({
                    value: r.id,
                    label: `第 ${i + 1} 轮 · ${r.kind} · ${r.status}`,
                  }))
                "
            /></FormItem>
            <FormItem label="提交人"
              ><Input :value="round.submittedName" disabled
            /></FormItem>
            <FormItem label="提交时间"
              ><Input :value="round.submittedAt" disabled
            /></FormItem>
            <FormItem label="结束时间"
              ><Input :value="round.endedAt || '—'" disabled
            /></FormItem>
            <FormItem v-if="round.withdrawnBy" label="撤回人"
              ><Input :value="round.withdrawnBy" disabled
            /></FormItem>
          </div>
        </Form>
      </ImsSection>
      <ImsSection title="公示审批流程（并行会签）">
        <div class="approval-flow">
          <div class="flow-node complete">
            提交审批<small>{{ round.submittedName }}</small>
          </div>
          <div class="flow-arrow">⟶</div>
          <div class="approval-leaders">
            <div
              v-for="d in round.decisions"
              :key="d.personId"
              class="flow-node"
              :class="{
                complete: d.status === '同意',
                current: d.status === '待审批' && round.status === '审批中',
              }"
            >
              {{ d.name
              }}<small>{{
                d.status === '待审批' && round.status !== '审批中'
                  ? '本轮已结束'
                  : d.status
              }}</small>
            </div>
          </div>
          <div class="flow-arrow">⟶</div>
          <div
            class="flow-node"
            :class="{ complete: round.status === '已通过' }"
          >
            {{ round.status === '已通过' ? '自动公示' : round.status }}
          </div>
        </div>
      </ImsSection>
      <ImsSection title="处理记录">
        <ImsTable
          :rows="
            round.decisions.map((d) => ({
              ...d,
              id: d.personId,
              state:
                d.status === '待审批' && round?.status !== '审批中'
                  ? '本轮结束，未处理'
                  : d.status,
            }))
          "
          :height="260"
          :columns="[
            { field: 'name', title: '审批人', width: 120 },
            { field: 'department', title: '部门', width: 140 },
            { field: 'state', title: '处理结果', width: 150 },
            { field: 'opinion', title: '审批意见', minWidth: 240 },
            { field: 'at', title: '处理时间', width: 180 },
          ]"
        />
      </ImsSection>
      <ImsSection title="本轮提交内容">
        <Form :label-col="{ style: { width: '112px' } }" disabled>
          <FormItem label="公示标题"
            ><Input :value="round.snapshot.title"
          /></FormItem>
          <FormItem label="公示正文"
            ><Input.TextArea :value="round.snapshot.body" :rows="4"
          /></FormItem>
        </Form>
        <ImsTable
          :rows="round.snapshot.publication.winners"
          :height="240"
          :columns="[
            { field: 'name', title: '项目名称', minWidth: 250 },
            { field: 'category', title: '项目类别', width: 140 },
            { field: 'award', title: '奖项', width: 130 },
            { field: 'awardReason', title: '获奖确认依据', minWidth: 240 },
          ]"
        />
      </ImsSection>
    </template>
  </Modal>
</template>
<style scoped>
.approval-flow {
  display: flex;
  gap: 18px;
  align-items: center;
  overflow-x: auto;
  padding: 24px 0;
}
.approval-leaders {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.flow-node {
  flex-shrink: 0;
  min-width: 170px;
}
</style>
