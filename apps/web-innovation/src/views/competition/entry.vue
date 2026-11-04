<script setup lang="ts">
import type { Entry } from './model';

import { computed, ref, watch } from 'vue';

import { List as GitBranch, RotateCw as RefreshCw } from '@vben/icons';

import {
  Button,
  DatePicker,
  Form,
  FormItem,
  Input,
  Modal,
} from 'ant-design-vue';

import { useAttachmentGuard } from './attachment-guard';
import AttachmentTable from './components/AttachmentTable.vue';
import CompetitionFrame from './components/CompetitionFrame.vue';
import EntryInformation from './components/EntryInformation.vue';
import FlowModal from './components/FlowModal.vue';
import ImsSection from './components/ImsSection.vue';
import { useDetailDialog } from './detail-dialog';
import {
  auditEntry,
  canApply,
  canEditEntry,
  canProcessEntry,
  canSeeEntry,
  canStartEntry,
  copy,
  entryExpertConflicts,
  expertConflictMessage,
  isInternalReader,
  newEntry,
  nowText,
  publishedEntry,
  resolveSupplement,
  saveEntry,
  withdrawEntry,
} from './model';
import { useCompetition } from './store';
import { confirmAction, perform } from './ui';

const { recordId, activityId, openDetail, replaceId, close, onBeforeClose } =
  useDetailDialog();
const { data, actor, commit } = useCompetition();
const isNew = computed(() => recordId.value === 'new');
const existing = computed(() =>
  data.value.entries.find((e) => e.id === recordId.value),
);
const form = ref<Entry>(newEntry('', actor.value.id));
const original = ref('');
const flowOpen = ref(false);
const auditOpen = ref(false);
const supplementAction = ref<'' | 'extend' | 'terminate'>('');
const supplementReason = ref('');
const supplementDate = ref('');
const auditPass = ref(true);
const auditNote = ref('');
const auditDeadline = ref('');
const activity = computed(() =>
  data.value.activities.find((a) => a.id === form.value.activityId),
);
const found = computed(() =>
  isNew.value
    ? !!activity.value && canStartEntry(activity.value, actor.value)
    : existing.value && canSeeEntry(data.value, existing.value, actor.value),
);
const internal = computed(
  () =>
    isNew.value ||
    (existing.value &&
      isInternalReader(data.value, existing.value, actor.value)),
);
const editable = computed(() =>
  isNew.value
    ? !!activity.value && canApply(activity.value, actor.value)
    : activity.value && canEditEntry(activity.value, form.value, actor.value),
);
const expertConflict = computed(() =>
  activity.value
    ? expertConflictMessage(
        entryExpertConflicts(form.value, activity.value.expertIds),
      )
    : '',
);
const dirty = computed(
  () => editable.value && JSON.stringify(form.value) !== original.value,
);
const {
  pendingAttachments,
  setAttachmentTable,
  attachmentsReady,
  confirmDiscard,
} = useAttachmentGuard(dirty, load);
function load() {
  form.value = existing.value
    ? copy(publishedEntry(data.value, existing.value))
    : newEntry(activityId.value, actor.value.id);
  original.value = JSON.stringify(form.value);
}
watch([recordId, activityId], load, {
  immediate: true,
});
watch(data, () => {
  if (!isNew.value && existing.value) load();
});
watch(
  () => actor.value.id,
  () => {
    if (isNew.value) load();
  },
);
function save(submit: boolean) {
  if (!attachmentsReady()) return;
  const id = form.value.id;
  if (
    perform(
      () => commit((d) => saveEntry(d, actor.value, form.value, submit)),
      submit ? '申报已提交，等待活动管理员审核。' : '草稿已保存。',
    )
  ) {
    original.value = JSON.stringify(form.value);
    if (isNew.value) replaceId(id);
  }
}
function openSupplement(action: 'extend' | 'terminate') {
  supplementAction.value = action;
  supplementReason.value = '';
  supplementDate.value = form.value.supplementDeadline;
}
function handleSupplement() {
  if (!supplementAction.value) return;
  const action = supplementAction.value;
  if (
    perform(() =>
      commit((d) =>
        resolveSupplement(
          d,
          actor.value,
          form.value.id,
          action,
          supplementReason.value,
          supplementDate.value,
        ),
      ),
    )
  )
    supplementAction.value = '';
}
function audit(pass: boolean) {
  auditPass.value = pass;
  auditNote.value = '';
  auditDeadline.value =
    activity.value?.deadline &&
    activity.value.deadline >= nowText().slice(0, 10)
      ? activity.value.deadline
      : nowText().slice(0, 10);
  auditOpen.value = true;
}
function submitAudit() {
  if (
    perform(() =>
      commit((d) =>
        auditEntry(
          d,
          actor.value,
          form.value.id,
          auditPass.value,
          auditNote.value,
          auditDeadline.value,
        ),
      ),
    )
  )
    auditOpen.value = false;
}
onBeforeClose(() => confirmDiscard());
</script>
<template>
  <CompetitionFrame>
    <template v-if="found">
      <div class="detail-toolbar">
        <Button type="primary" @click="close">关闭</Button>
        <Button
          v-if="editable"
          type="primary"
          :disabled="pendingAttachments > 0"
          @click="save(false)"
        >
          保存
        </Button>
        <Button type="primary" @click="confirmDiscard(true)">
          <RefreshCw :size="15" />刷新
        </Button>
        <Button
          v-if="editable"
          :disabled="pendingAttachments > 0"
          @click="save(true)"
        >
          提交
        </Button>
        <Button
          v-if="
            existing &&
            actor.id === form.ownerId &&
            activity &&
            canApply(activity, actor) &&
            ['待审核', '审核通过', '退回修改'].includes(form.status)
          "
          :disabled="pendingAttachments > 0"
          @click="
            confirmAction(
              '撤回本次申报？',
              () =>
                attachmentsReady() &&
                commit((d) => withdrawEntry(d, actor, form.id)),
            )
          "
        >
          撤回
        </Button>
        <Button v-if="existing && internal" @click="flowOpen = true">
          <GitBranch :size="16" />流程图
        </Button>
        <template
          v-if="
            activity &&
            canProcessEntry(activity, actor) &&
            ['待审核', '审核通过'].includes(form.status) &&
            activity?.status === '报名中'
          "
        >
          <Button v-if="form.status === '待审核'" @click="audit(true)">
            审核通过 </Button
          ><Button danger @click="audit(false)">退回补充</Button>
        </template>
        <template
          v-if="
            activity &&
            canProcessEntry(activity, actor) &&
            activity.status === '报名中' &&
            form.status === '退回修改'
          "
        >
          <Button @click="openSupplement('extend')">延长补交期限</Button>
          <Button danger @click="openSupplement('terminate')">终止申报</Button>
        </template>
      </div>
      <div class="ims-body">
        <template v-if="internal">
          <div
            v-if="
              activity &&
              ['评审中', '待公示', '已公示', '已结束'].includes(activity.status)
            "
            class="rule-caption"
          >
            活动已进入评审或后续阶段，申报材料已锁定。
          </div>
        </template>
        <p v-if="editable && expertConflict" class="rule-caption" role="alert">
          {{ expertConflict }} 可以保存草稿，解决冲突后才能提交。
        </p>
        <EntryInformation
          v-model="form"
          :activity="activity"
          :leader-department="actor.department"
          :readonly="!editable"
          show-submitter
        />
        <ImsSection :title="internal ? '附件' : '公开附件'">
          <p v-if="editable" class="rule-caption">
            附件为选填，不上传也可提交。已上传附件默认仅供申报与评审；勾选“公开展示”并保存后，具有该项目浏览权限的用户即可查看，无需管理员确认。
          </p>
          <AttachmentTable
            :ref="setAttachmentTable"
            v-model="form.attachments"
            @pending-change="pendingAttachments = $event"
            :readonly="!editable"
            :public-only="!internal"
          />
        </ImsSection>
        <ImsSection
          v-if="
            internal &&
            form.award &&
            activity &&
            ['已公示', '已结束'].includes(activity.status)
          "
          title="获奖结果"
        >
          <Form :label-col="{ style: { width: '125px' } }">
            <div class="ims-form-grid">
              <FormItem label="获奖等级">
                <Input :value="form.award" disabled />
              </FormItem>
              <FormItem label="公示日期">
                <Input :value="activity.noticeDate" disabled />
              </FormItem>
            </div>
          </Form>
          <Button
            type="link"
            @click="openDetail({ kind: 'result', id: activity.id })"
          >
            查看公示及证书
          </Button>
        </ImsSection>
      </div>
      <FlowModal v-model:open="flowOpen" :entry="form" :activity="activity" />
    </template>
    <div v-else class="empty-panel">
      {{
        isNew && expertConflict
          ? '您是本活动评审专家，不能同时作为填报人参赛；请联系管理员调整专家名单。'
          : '作品不存在或当前身份无权查看。'
      }}<Button type="link" @click="close">返回活动中心</Button>
    </div>
    <Modal
      :open="!!supplementAction"
      class="competition-page competition-dialog-content"
      :mask-closable="false"
      :title="supplementAction === 'extend' ? '延长补交期限' : '终止申报'"
      ok-text="确定"
      cancel-text="取消"
      @cancel="supplementAction = ''"
      @ok="handleSupplement"
    >
      <Form layout="vertical">
        <ImsSection title="材料处理">
          <FormItem
            v-if="supplementAction === 'extend'"
            label="新补交截止日期"
            required
          >
            <DatePicker
              v-model:value="supplementDate"
              value-format="YYYY-MM-DD"
            />
          </FormItem>
          <FormItem label="处理原因" required>
            <Input.TextArea v-model:value="supplementReason" :rows="3" />
          </FormItem>
        </ImsSection>
      </Form>
    </Modal>
    <Modal
      v-model:open="auditOpen"
      class="competition-page competition-dialog-content"
      :title="auditPass ? '材料审核通过' : '退回补充材料'"
      ok-text="确定"
      cancel-text="取消"
      @ok="submitAudit"
    >
      <ImsSection title="材料审核">
        <Form layout="vertical">
          <FormItem label="审核意见" required>
            <Input.TextArea
              v-model:value="auditNote"
              :rows="4"
              placeholder="请输入审核意见"
            />
          </FormItem>
          <FormItem v-if="!auditPass" label="补交截止日期" required>
            <DatePicker
              v-model:value="auditDeadline"
              value-format="YYYY-MM-DD"
            />
          </FormItem>
        </Form>
      </ImsSection>
    </Modal>
  </CompetitionFrame>
</template>
