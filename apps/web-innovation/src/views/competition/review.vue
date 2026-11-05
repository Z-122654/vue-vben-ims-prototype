<script setup lang="ts">
import type { Review } from './model';

import { computed, ref, watch } from 'vue';

import { Button, Form, FormItem, Input, Modal } from 'ant-design-vue';

import AttachmentTable from './components/AttachmentTable.vue';
import CompetitionFrame from './components/CompetitionFrame.vue';
import EntryInformation from './components/EntryInformation.vue';
import ImsSection from './components/ImsSection.vue';
import ScoringTable from './components/ScoringTable.vue';
import { useDetailDialog } from './detail-dialog';
import {
  canManageActivity,
  canReadPublicationApproval,
  copy,
  person,
  reviewOverdue,
  reviewSubmissionTime,
  saveReview,
} from './model';
import { useCompetition } from './store';
import { perform } from './ui';
const { data, actor, commit } = useCompetition();
const { recordId, close, onBeforeClose } = useDetailDialog();
const review = computed(() =>
  data.value.reviews.find((r) => r.id === recordId.value),
);
const entry = computed(() =>
  data.value.entries.find((e) => e.id === review.value?.entryId),
);
const activity = computed(() =>
  data.value.activities.find((a) => a.id === entry.value?.activityId),
);
const allowed = computed(
  () =>
    review.value &&
    (review.value.expertId === actor.value.id ||
      (activity.value &&
        (canManageActivity(activity.value, actor.value) ||
          canReadPublicationApproval(activity.value, actor.value)) &&
        review.value.status === '已提交')),
);
const editable = computed(
  () =>
    review.value?.expertId === actor.value.id &&
    review.value.status !== '已提交' &&
    activity.value?.status === '评审中',
);
const scores = ref<Review['scores']>({});
const comment = ref('');
const original = ref('');
const returned = computed(() =>
  review.value?.history.filter((h) => h.action === '退回评审').at(-1),
);
const dirty = computed(
  () =>
    editable.value &&
    JSON.stringify([scores.value, comment.value]) !== original.value,
);
watch(
  [review, recordId],
  () => {
    scores.value = copy(review.value?.scores ?? {});
    comment.value = review.value?.comment ?? '';
    original.value = JSON.stringify([scores.value, comment.value]);
  },
  { immediate: true },
);
function save(submit: boolean) {
  if (!review.value) return;
  if (
    perform(
      () =>
        commit((d) =>
          saveReview(
            d,
            actor.value,
            review.value!.id,
            scores.value,
            comment.value,
            submit,
          ),
        ),
      submit
        ? '评审已提交。各项评分独立保存，不计算总分或排名。'
        : '评分已暂存。',
    )
  ) {
    original.value = JSON.stringify([scores.value, comment.value]);
  }
}
onBeforeClose(() => {
  if (!dirty.value) return true;
  return new Promise<boolean>((resolve) =>
    Modal.confirm({
      title: '评分尚未保存，确定离开？',
      okText: '离开',
      cancelText: '继续评审',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    }),
  );
});
</script>
<template>
  <CompetitionFrame>
    <template v-if="allowed && review && entry && activity">
      <div class="detail-toolbar">
        <Button type="primary" @click="close">关闭</Button>
        <Button v-if="editable" type="primary" @click="save(false)">
          暂存
        </Button>
        <Button v-if="editable" @click="save(true)">提交评审</Button>
      </div>
      <div class="ims-body">
        <EntryInformation
          :model-value="entry"
          :activity="activity"
          readonly
          status-label="申报状态"
          show-submitter
        />
        <ImsSection title="附件">
          <AttachmentTable :model-value="entry.attachments" readonly />
        </ImsSection>
        <ImsSection title="专家评分">
          <Form :label-col="{ style: { width: '125px' } }">
            <div class="ims-form-grid">
              <FormItem label="评审专家">
                <Input :value="person(review.expertId).name" disabled />
              </FormItem>
              <FormItem label="计划评审截止">
                <Input :value="activity.reviewEnd" disabled />
              </FormItem>
              <FormItem label="评审状态">
                <Input :value="review.status" disabled />
              </FormItem>
              <FormItem label="最近提交时间">
                <Input :value="reviewSubmissionTime(review)" disabled />
              </FormItem>
              <FormItem label="首次提交时间">
                <Input
                  :value="review.firstSubmittedAt || '尚未记录'"
                  disabled
                />
              </FormItem>
            </div>
          </Form>
          <div
            v-if="reviewOverdue(activity) && review.status !== '已提交'"
            class="rule-caption"
          >
            已超过计划评审截止，请尽快完成；仍可暂存和提交，状态由管理员手动推进。
          </div>
          <div class="rule-caption">
            独立评分，不展示其他专家的评分。分值按本活动指标分别记录，正式提交后需管理员退回才能修改。
          </div>
          <ScoringTable
            v-model:scores="scores"
            :criteria="activity.criteria"
            mode="scores"
            :readonly="!editable"
          />
          <Form
            :label-col="{ style: { width: '125px' } }"
            style="margin-top: 24px"
          >
            <FormItem label="评审意见" required>
              <Input.TextArea
                v-model:value="comment"
                :rows="4"
                :disabled="!editable"
                placeholder="请结合创新性、应用价值和改进建议填写专业点评"
              />
            </FormItem>
          </Form>
        </ImsSection>
        <ImsSection v-if="returned" title="最近退回信息">
          <Form :label-col="{ style: { width: '125px' } }" disabled>
            <div class="ims-form-grid">
              <FormItem label="退回人">
                <Input :value="returned.actor" />
              </FormItem>
              <FormItem label="退回时间">
                <Input :value="returned.at" />
              </FormItem>
              <FormItem label="退回原因" class="wide">
                <Input.TextArea
                  :value="returned.note"
                  :auto-size="{ minRows: 2, maxRows: 6 }"
                />
              </FormItem>
            </div>
          </Form>
        </ImsSection>
      </div>
    </template>
    <div v-else class="empty-panel">
      任务不存在或未分配给当前专家。<Button type="link" @click="close">
        返回评审工作台
      </Button>
    </div>
  </CompetitionFrame>
</template>
