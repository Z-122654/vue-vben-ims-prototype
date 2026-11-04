<script setup lang="ts">
import type { Activity, ActivityStatus, Publication } from './model';

import { computed, reactive, ref, watch } from 'vue';

import { RotateCw as RefreshCw } from '@vben/icons';

import {
  AutoComplete,
  Button,
  DatePicker,
  Form,
  FormItem,
  Input,
  Modal,
  Select,
  Switch,
  TabPane,
  Tabs,
  Tag,
} from 'ant-design-vue';

import { useAttachmentGuard } from './attachment-guard';
import AttachmentTable from './components/AttachmentTable.vue';
import CompetitionFrame from './components/CompetitionFrame.vue';
import ImsSection from './components/ImsSection.vue';
import ImsTable from './components/ImsTable.vue';
import PublicationHistory from './components/PublicationHistory.vue';
import ScoringTable from './components/ScoringTable.vue';
import { useDetailDialog } from './detail-dialog';
import {
  activityExpertConflicts,
  activityPublisherLabel,
  activityTypeOptions,
  adjustDeadline,
  beginResultCorrection,
  canManageActivity,
  canProcessEntry,
  canSeeActivity,
  canSeeEntry,
  changeActivity,
  copy,
  departments,
  discardResultCorrection,
  entrySubmissionTime,
  expertConflictMessage,
  expertOptions,
  fieldLimits,
  managementDepartments,
  newActivity,
  person,
  projectLeader,
  publishResultCorrection,
  returnReview,
  reviewOverdue,
  saveActivity,
  saveResults,
} from './model';
import { useCompetition } from './store';
import { confirmAction, exportCsv, perform, statusColor } from './ui';

const { data, actor, commit } = useCompetition();
const { recordId, openDetail, replaceId, close, onBeforeClose } =
  useDetailDialog();
const form = ref<Activity>(newActivity(actor.value));
const managing = computed(() => canManageActivity(form.value, actor.value));
const deadlineOpen = ref(false);
const deadlineValue = ref('');
const deadlineReason = ref('');
const original = ref('');
const originalAwards = ref('');
const activeTab = ref('info');
const reviewsTable = ref<InstanceType<typeof ImsTable>>();
const reasonAction = ref<'' | 'cancel' | 'correct'>('');
const actionReason = ref('');
const historyVersion = ref<Publication>();
const cancellation = computed(() =>
  form.value.history.filter((h) => h.action === '活动已取消').at(-1),
);
const awards = reactive<Record<string, { award: string; reason: string }>>({});
const reviewReturn = ref('');
const reviewReason = ref('');
const existing = computed(() =>
  data.value.activities.find((a) => a.id === recordId.value),
);
const isNew = computed(() => recordId.value === 'new');
const found = computed(() =>
  isNew.value
    ? actor.value.role === 'admin'
    : existing.value && canSeeActivity(data.value, existing.value, actor.value),
);
const editable = computed(() => managing.value && form.value.status === '草稿');
const expertsEditable = computed(
  () => managing.value && ['报名中', '草稿'].includes(form.value.status),
);
const resultsEditable = computed(
  () =>
    managing.value &&
    (form.value.status === '待公示' || !!form.value.resultCorrection),
);
const dirty = computed(
  () =>
    (expertsEditable.value || resultsEditable.value) &&
    (JSON.stringify(form.value) !== original.value ||
      JSON.stringify(awards) !== originalAwards.value),
);
const {
  pendingAttachments,
  setAttachmentTable,
  attachmentsReady,
  confirmDiscard,
} = useAttachmentGuard(dirty, load);
const entries = computed(() =>
  data.value.entries
    .filter((e) => e.activityId === form.value.id)
    .map((e) => ({
      ...e,
      submittedAt: entrySubmissionTime(e),
      applicant: projectLeader(e)?.name ?? '—',
      submitter: person(e.ownerId).name,
      department: projectLeader(e)?.department ?? '—',
    })),
);
const submitted = computed(() =>
  entries.value.filter((e) => !['已撤回', '草稿'].includes(e.status)),
);
const approved = computed(() =>
  entries.value.filter((e) => e.status === '审核通过'),
);
const reviews = computed(() =>
  data.value.reviews
    .filter((r) => entries.value.some((e) => e.id === r.entryId))
    .map((r) => ({
      ...r,
      name: entries.value.find((e) => e.id === r.entryId)?.name,
      expert: person(r.expertId).name,
      scoreText:
        r.status === '已提交'
          ? form.value.criteria
              .map((c) => `${c.name} ${r.scores[c.id] ?? '—'}/${c.max}`)
              .join('；')
          : '待正式提交',
      visibleComment: r.status === '已提交' ? r.comment : '—',
    })),
);
const experts = computed(() =>
  expertOptions(data.value, form.value.id, form.value.expertIds),
);
const expertConflict = computed(() =>
  expertConflictMessage(
    activityExpertConflicts(data.value, form.value.id, form.value.expertIds),
  ),
);
const next = computed<undefined | { status: ActivityStatus; label: string }>(
  () => {
    const mapping: Partial<
      Record<ActivityStatus, { status: ActivityStatus; label: string }>
    > = {
      草稿: { status: '报名中', label: '发布活动' },
      报名中: { status: '评审中', label: '开启评审' },
      评审中: { status: '待公示', label: '完成评审' },
      待公示: { status: '已公示', label: '发布公示' },
      已公示: { status: '已结束', label: '结束活动' },
    };
    return mapping[form.value.status];
  },
);
function load() {
  form.value = existing.value ? copy(existing.value) : newActivity(actor.value);
  if (form.value.resultCorrection) {
    form.value.noticeTitle = form.value.resultCorrection.title;
    form.value.noticeBody = form.value.resultCorrection.body;
  }
  original.value = JSON.stringify(form.value);
  for (const id of Object.keys(awards)) delete awards[id];
  for (const e of entries.value)
    awards[e.id] = { award: e.award, reason: e.awardReason };
  for (const item of form.value.resultCorrection?.awards ?? [])
    awards[item.entryId] = { award: item.award, reason: item.reason };
  originalAwards.value = JSON.stringify(awards);
}
watch(recordId, load, { immediate: true });
watch(data, () => {
  if (!isNew.value && existing.value) load();
});
watch(recordId, () => {
  activeTab.value = 'info';
});
function openDeadline() {
  if (dirty.value) {
    perform(() => {
      throw new Error('请先保存活动修改或刷新后再调整期限。');
    });
    return;
  }
  deadlineValue.value =
    form.value.status === '报名中' ? form.value.deadline : form.value.reviewEnd;
  deadlineReason.value = '';
  deadlineOpen.value = true;
}
function updateDeadline() {
  if (
    perform(() =>
      commit((d) =>
        adjustDeadline(
          d,
          actor.value,
          form.value.id,
          deadlineValue.value,
          deadlineReason.value,
        ),
      ),
    )
  )
    deadlineOpen.value = false;
}
function save() {
  if (!attachmentsReady()) return;
  const payload = copy(form.value);
  const wasNew = isNew.value;
  if (perform(() => commit((d) => saveActivity(d, actor.value, payload)))) {
    if (wasNew) replaceId(payload.id);
    load();
  }
}
function transition() {
  if (!attachmentsReady()) return;
  const action = next.value;
  if (!action) return;
  if (action.status === '已公示' && dirty.value) {
    perform(() => {
      throw new Error('存在未保存的获奖名单或公示内容，请先保存再发布。');
    });
    return;
  }
  Modal.confirm({
    title: `${action.label}？`,
    content:
      action.status === '评审中'
        ? '开启后将立即停止报名，未提交及已撤回项目不进入本次评审。专家名单和全部参评材料将锁定，并为每个审核通过的项目生成所有所选专家的评审任务。'
        : action.status === '已公示'
          ? '请确认已保存获奖名单和公示正文。发布后结果锁定并对员工展示。'
          : '此操作只更新本地演示状态。',
    okText: '确定',
    cancelText: '取消',
    onOk: () => {
      if (!attachmentsReady()) return;
      const id = form.value.id;
      if (
        perform(() =>
          commit((d) => {
            if (expertsEditable.value) saveActivity(d, actor.value, form.value);
            changeActivity(d, actor.value, id, action.status);
          }),
        )
      ) {
        original.value = JSON.stringify(form.value);
        if (isNew.value) replaceId(id);
      }
    },
  });
}
function openReason(action: 'cancel' | 'correct') {
  if (!attachmentsReady()) return;
  if (dirty.value) {
    perform(() => {
      throw new Error('请先保存修改或刷新，再执行此操作。');
    });
    return;
  }
  reasonAction.value = action;
  actionReason.value = '';
}
function applyReason() {
  if (!attachmentsReady()) return;
  const action = reasonAction.value;
  if (
    perform(() =>
      commit((d) => {
        if (action === 'cancel')
          changeActivity(
            d,
            actor.value,
            form.value.id,
            '已取消',
            actionReason.value,
          );
        else
          beginResultCorrection(
            d,
            actor.value,
            form.value.id,
            actionReason.value,
          );
      }),
    )
  ) {
    reasonAction.value = '';
    if (action === 'correct') activeTab.value = 'results';
  }
}
function publishCorrection() {
  if (dirty.value) {
    perform(() => {
      throw new Error('存在未保存的更正内容，请先保存再重新发布。');
    });
    return;
  }
  confirmAction(
    '重新发布更正结果？',
    () => commit((d) => publishResultCorrection(d, actor.value, form.value.id)),
    '发布成功后替换对外有效版本，旧公示版本和更正原因保留供管理员查阅。',
  );
}
function results() {
  perform(() =>
    commit((d) =>
      saveResults(
        d,
        actor.value,
        form.value.id,
        approved.value.map((e) => ({
          entryId: e.id,
          award: awards[e.id]?.award ?? '',
          reason: awards[e.id]?.reason ?? '',
        })),
        form.value.noticeTitle,
        form.value.noticeBody,
        form.value.noticeDate,
      ),
    ),
  );
}
onBeforeClose(() => confirmDiscard());
</script>
<template>
  <CompetitionFrame>
    <template v-if="found">
      <div class="detail-toolbar">
        <Button type="primary" @click="close">关闭</Button>
        <Button
          v-if="expertsEditable"
          type="primary"
          :disabled="pendingAttachments > 0"
          @click="save"
        >
          {{ editable ? '保存' : '保存专家名单' }}
        </Button>
        <Button type="primary" @click="confirmDiscard(true)">
          <RefreshCw :size="15" />刷新
        </Button>
        <Button
          v-if="managing && ['报名中', '评审中'].includes(form.status)"
          @click="openDeadline"
        >
          调整计划截止
        </Button>
        <Button
          v-if="managing && next && !form.resultCorrection"
          :disabled="pendingAttachments > 0"
          @click="transition"
        >
          {{ next.label }}
        </Button>
        <Button
          v-if="managing && ['草稿', '报名中', '评审中'].includes(form.status)"
          danger
          :disabled="pendingAttachments > 0"
          @click="openReason('cancel')"
        >
          取消活动
        </Button>
        <Button
          v-if="
            managing &&
            ['已公示', '已结束'].includes(form.status) &&
            !form.resultCorrection
          "
          @click="openReason('correct')"
        >
          更正结果
        </Button>
        <template v-if="managing && form.resultCorrection">
          <Button @click="publishCorrection">重新发布公示</Button>
          <Button
            danger
            @click="
              confirmAction(
                '放弃本次结果更正？',
                () => commit((d) => discardResultCorrection(d, actor, form.id)),
                '放弃更正草稿，保留当前有效公示和历史版本。',
              )
            "
          >
            放弃更正
          </Button>
        </template>

        <Button
          v-if="['已公示', '已结束'].includes(form.status)"
          @click="openDetail({ kind: 'result', id: form.id })"
        >
          查看公示
        </Button>
      </div>
      <div class="ims-body">
        <Tabs v-model:active-key="activeTab">
          <TabPane key="info" tab="活动信息">
            <Form
              :disabled="!editable"
              :label-col="{ style: { width: '112px' } }"
            >
              <ImsSection title="基本信息">
                <div class="ims-form-grid">
                  <FormItem label="活动名称" required>
                    <Input
                      v-model:value="form.name"
                      placeholder="请输入活动名称"
                      :maxlength="fieldLimits.activityName"
                    />
                  </FormItem>
                  <FormItem label="活动编号">
                    <Input :value="form.code" disabled />
                  </FormItem>
                  <FormItem label="活动类型" required>
                    <AutoComplete
                      v-model:value="form.type"
                      :options="activityTypeOptions(data)"
                      placeholder="请选择或输入活动类型"
                    />
                  </FormItem>
                  <FormItem label="组织单位" required>
                    <Select
                      v-model:value="form.department"
                      :options="
                        managementDepartments(actor).map((value) => ({
                          label: value,
                          value,
                        }))
                      "
                    />
                  </FormItem>
                  <FormItem label="联系人" required>
                    <Input v-model:value="form.contact" />
                  </FormItem>
                  <FormItem label="联系方式" required>
                    <Input
                      v-model:value="form.phone"
                      placeholder="电话或内线号码"
                    />
                  </FormItem>
                  <FormItem label="活动说明" required class="wide">
                    <Input.TextArea
                      v-model:value="form.description"
                      :rows="4"
                      placeholder="说明活动背景、目标和参赛主题"
                    />
                  </FormItem>
                  <FormItem
                    v-if="form.status === '已取消'"
                    label="取消原因"
                    class="wide"
                  >
                    <Input.TextArea
                      :value="
                        form.history
                          .filter((h) => h.action === '活动已取消')
                          .at(-1)?.note || '历史未记录'
                      "
                      :rows="2"
                      disabled
                    />
                  </FormItem>
                  <template v-if="form.status === '已取消'">
                    <FormItem label="取消人">
                      <Input
                        :value="cancellation?.actor || '历史未记录'"
                        disabled
                      />
                    </FormItem>
                    <FormItem label="取消时间">
                      <Input
                        :value="cancellation?.at || '历史未记录'"
                        disabled
                      />
                    </FormItem>
                  </template>
                </div>
              </ImsSection>
              <ImsSection title="参赛要求与时间安排">
                <div class="ims-form-grid">
                  <FormItem label="参赛范围" required class="span-two">
                    <Select
                      v-model:value="form.departments"
                      mode="multiple"
                      :options="
                        departments.map((value) => ({ label: value, value }))
                      "
                    />
                  </FormItem>

                  <FormItem label="报名开始时间">
                    <Input
                      :value="
                        form.registeredAt ||
                        (form.status === '草稿' ? '尚未发布' : '历史未记录')
                      "
                      disabled
                    />
                  </FormItem>
                  <FormItem label="报名截止" required>
                    <DatePicker
                      v-model:value="form.deadline"
                      value-format="YYYY-MM-DD"
                    />
                  </FormItem>
                  <FormItem
                    label="参赛作品展示"
                    extra="控制参赛作品浏览，不影响获奖结果公示"
                  >
                    <Switch
                      v-model:checked="form.showcase"
                      checked-children="公开展示"
                      un-checked-children="关闭展示"
                    />
                  </FormItem>
                  <FormItem label="评审开始时间">
                    <Input
                      :value="form.reviewStartedAt || '尚未记录'"
                      disabled
                    />
                  </FormItem>
                  <FormItem label="计划评审截止" required>
                    <DatePicker
                      v-model:value="form.reviewEnd"
                      value-format="YYYY-MM-DD"
                    />
                  </FormItem>
                  <FormItem label="评审完成时间">
                    <Input
                      :value="form.reviewCompletedAt || '尚未记录'"
                      disabled
                    />
                  </FormItem>
                  <FormItem label="活动结束时间">
                    <Input :value="form.endedAt || '尚未记录'" disabled />
                  </FormItem>
                  <FormItem label="当前状态">
                    <Input :value="form.status" disabled />
                  </FormItem>
                  <FormItem label="申报要求" required class="wide">
                    <Input.TextArea
                      v-model:value="form.requirements"
                      :rows="3"
                    />
                  </FormItem>
                </div>
                <div v-if="reviewOverdue(form)" class="rule-caption">
                  已超过计划评审截止，请尽快完成评审；活动仍由管理员手动推进，专家可继续提交。
                </div>
              </ImsSection>
              <ImsSection title="评分指标与奖项">
                <FormItem
                  label="评审专家"
                  required
                  :extra="
                    expertsEditable
                      ? '必填，至少选择一位；可从人员目录跨部门选择，无需预设专家资格。每位专家评审本活动全部审核通过的项目，已有待审核、退回修改或审核通过项目的填报人及负责人不能选为本活动专家；开启后名单锁定。'
                      : !form.expertIds.length &&
                          !['草稿', '报名中'].includes(form.status)
                        ? '历史专家信息缺失；未补造专家、评审任务或评分。'
                        : ['草稿', '报名中'].includes(form.status)
                          ? '由活动管理员配置评审专家；开启评审后名单锁定，每位专家评审本活动全部参评项目。'
                          : '专家名单已锁定；每位专家独立评审本活动全部参评项目。'
                  "
                >
                  <Select
                    v-model:value="form.expertIds"
                    mode="multiple"
                    :options="experts"
                    :disabled="!expertsEditable"
                    placeholder="请选择评审专家"
                    option-filter-prop="label"
                  />
                </FormItem>
                <p
                  v-if="expertConflict && managing"
                  class="rule-caption"
                  role="alert"
                >
                  {{ expertConflict }} 已选冲突人员可移除；不自动改变项目状态。
                </p>
                <div class="rule-caption">
                  专家逐项独立评分，暂不计算总分、平均分或排名。示例指标和分值仅供原型讨论。活动发布后锁定规则。
                </div>
                <ScoringTable
                  v-model:criteria="form.criteria"
                  :readonly="!editable"
                />
                <FormItem
                  label="奖项设置"
                  extra="发布时必填；草稿可暂不填写。"
                  style="margin-top: 22px"
                >
                  <Select
                    v-model:value="form.prizes"
                    mode="tags"
                    placeholder="输入奖项后按回车添加"
                  />
                </FormItem>
              </ImsSection>
            </Form>
            <ImsSection title="活动附件">
              <AttachmentTable
                :ref="setAttachmentTable"
                v-model="form.attachments"
                @pending-change="pendingAttachments = $event"
                :readonly="!editable"
                activity-notice
              />
            </ImsSection>
          </TabPane>
          <TabPane v-if="form.showcase && !isNew" key="showcase" tab="参赛作品">
            <ImsSection title="审核通过的参赛作品">
              <p class="rule-caption">
                项目明细以只读表单展示全部基本信息。普通浏览者仅可查看公开附件，不开放内部附件、流程记录和专家评分。
              </p>
              <ImsTable
                :rows="approved.filter((e) => canSeeEntry(data, e, actor))"
                :columns="[
                  { field: 'code', title: '作品编号', width: 170 },
                  { field: 'name', title: '项目名称', minWidth: 270 },
                  { field: 'category', title: '类别', width: 120 },
                  { field: 'applicant', title: '项目负责人', width: 120 },
                  { field: 'summary', title: '作品简介', minWidth: 280 },
                  {
                    field: 'actions',
                    title: '操作',
                    width: 100,
                    slot: 'actions',
                  },
                ]"
              >
                <template #actions="{ row }">
                  <Button
                    type="link"
                    @click="openDetail({ kind: 'entry', id: row.id })"
                  >
                    明细
                  </Button>
                </template>
              </ImsTable>
            </ImsSection>
          </TabPane>
          <TabPane v-if="managing && !isNew" key="audit" tab="申报审核">
            <ImsSection title="申报材料审核">
              <div class="rule-caption">
                {{
                  activityPublisherLabel(form)
                }}。材料审核与补交处理固定由活动发布人负责，不设部门初审。待审核和退回补充的作品处理完成后，可开启评审。
              </div>
              <ImsTable
                :rows="submitted"
                :columns="[
                  { field: 'code', title: '申报编号', width: 170 },
                  { field: 'submitter', title: '填报人', width: 110 },
                  { field: 'name', title: '项目名称', minWidth: 240 },
                  { field: 'applicant', title: '项目负责人', width: 110 },
                  { field: 'department', title: '部门', width: 120 },
                  { field: 'submittedAt', title: '提交时间', width: 180 },
                  {
                    field: 'status',
                    title: '状态',
                    width: 130,
                    slot: 'status',
                  },
                  {
                    field: 'actions',
                    title: '操作',
                    width: 110,
                    slot: 'actions',
                  },
                ]"
              >
                <template #status="{ row }">
                  <Tag :color="statusColor(row.status)">
                    {{ row.status }}
                  </Tag>
                </template>
                <template #actions="{ row }">
                  <Button
                    type="link"
                    @click="openDetail({ kind: 'entry', id: row.id })"
                  >
                    {{
                      row.status === '待审核' &&
                      form.status === '报名中' &&
                      canProcessEntry(form, actor)
                        ? '审核'
                        : '明细'
                    }}
                  </Button>
                </template>
              </ImsTable>
            </ImsSection>
          </TabPane>
          <TabPane v-if="managing && !isNew" key="reviews" tab="专家评审记录">
            <ImsSection title="专家独立评审记录">
              <div class="rule-caption">
                评审专家在“活动信息”中统一配置；开启评审后，每个参评项目由全部所选专家独立评审。
              </div>
              <div class="ims-toolbar">
                <span
                  >已提交
                  {{ reviews.filter((r) => r.status === '已提交').length }} / 共
                  {{ reviews.length }} 项任务</span
                >
                <Button
                  @click="
                    exportCsv(
                      reviewsTable?.filtered ?? reviews,
                      [
                        { field: 'name', title: '项目名称' },
                        { field: 'expert', title: '专家' },
                        { field: 'status', title: '状态' },
                        { field: 'scoreText', title: '各项评分' },
                        { field: 'visibleComment', title: '评审意见' },
                      ],
                      '专家独立评审记录',
                    )
                  "
                >
                  导出记录
                </Button>
              </div>
              <ImsTable
                ref="reviewsTable"
                :rows="reviews"
                :height="320"
                :columns="[
                  { field: 'name', title: '项目名称', minWidth: 230 },
                  { field: 'expert', title: '评审专家', width: 110 },
                  { field: 'status', title: '状态', width: 120 },
                  {
                    field: 'scoreText',
                    title: '各项评分（未汇总）',
                    minWidth: 320,
                  },
                  { field: 'visibleComment', title: '评审意见', minWidth: 240 },
                  {
                    field: 'actions',
                    title: '操作',
                    width: 160,
                    slot: 'actions',
                  },
                ]"
              >
                <template #actions="{ row }">
                  <Button
                    v-if="row.status === '已提交'"
                    type="link"
                    @click="openDetail({ kind: 'review', id: row.id })"
                  >
                    明细 </Button
                  ><Button
                    v-if="form.status === '评审中' && row.status === '已提交'"
                    type="link"
                    @click="
                      reviewReturn = row.id;
                      reviewReason = '';
                    "
                  >
                    退回
                  </Button>
                </template>
              </ImsTable>
            </ImsSection>
          </TabPane>
          <TabPane v-if="managing && !isNew" key="results" tab="获奖登记与公示">
            <ImsSection v-if="form.resultCorrection" title="结果更正信息">
              <Form :label-col="{ style: { width: '112px' } }" disabled>
                <div class="ims-form-grid">
                  <FormItem label="发起人">
                    <Input :value="form.resultCorrection.startedBy" />
                  </FormItem>
                  <FormItem label="发起时间">
                    <Input :value="form.resultCorrection.startedAt" />
                  </FormItem>
                  <FormItem label="更正原因" class="wide">
                    <Input.TextArea
                      :value="form.resultCorrection.reason"
                      :rows="2"
                    />
                  </FormItem>
                </div>
              </Form>
              <p class="rule-caption">
                更正草稿仅管理员可见，保存不会改变当前公示。保存后点击“重新发布公示”生效；旧版本永久保留在本次演示数据中。
              </p>
            </ImsSection>
            <ImsSection title="手工登记获奖名单">
              <div class="rule-caption">
                依据线下确认结果登记奖项，不根据评分自动排序；一个项目一个奖项，同一奖项可授予多个项目。允许零获奖，须在公示正文说明。
              </div>
              <ImsTable
                :rows="approved"
                :height="300"
                :columns="[
                  { field: 'name', title: '项目名称', minWidth: 230 },
                  { field: 'applicant', title: '项目负责人', width: 100 },
                  {
                    field: 'award',
                    title: '获奖等级',
                    width: 190,
                    slot: 'award',
                    filter: false,
                  },
                  {
                    field: 'awardReason',
                    title: '获奖确认依据',
                    minWidth: 300,
                    slot: 'reason',
                    filter: false,
                  },
                ]"
              >
                <template #award="{ row }">
                  <Select
                    v-if="awards[row.id]"
                    v-model:value="awards[row.id]!.award"
                    allow-clear
                    placeholder="未获奖"
                    :disabled="!resultsEditable"
                    :options="
                      form.prizes.map((value) => ({ label: value, value }))
                    "
                    style="width: 100%"
                  />
                </template>
                <template #reason="{ row }">
                  <Input
                    v-if="awards[row.id]"
                    v-model:value="awards[row.id]!.reason"
                    :disabled="!resultsEditable"
                    placeholder="填写线下确认记录或依据"
                  />
                </template>
              </ImsTable>
            </ImsSection>
            <ImsSection title="公示内容">
              <Form
                :disabled="!resultsEditable"
                :label-col="{ style: { width: '112px' } }"
              >
                <FormItem label="公示标题" required>
                  <Input
                    v-model:value="form.noticeTitle"
                    placeholder="请输入公示标题"
                  />
                </FormItem>
                <FormItem label="公示日期">
                  <Input
                    :value="form.noticeDate || '发布时自动记录'"
                    disabled
                  />
                </FormItem>
                <FormItem label="公示正文" required>
                  <Input.TextArea
                    v-model:value="form.noticeBody"
                    :rows="5"
                    placeholder="填写评选情况、异议反馈方式等公示内容；无获奖项目时请在正文说明"
                  />
                </FormItem>
              </Form>
              <Button
                type="primary"
                :disabled="!resultsEditable"
                @click="results"
              >
                保存获奖名单与公示内容
              </Button>
            </ImsSection>
            <ImsSection v-if="form.publications?.length" title="公示版本记录">
              <ImsTable
                :rows="
                  form.publications.map((p) => ({
                    ...p,
                    id: String(p.version),
                    source: p.legacy ? '旧资料兼容快照' : '发布时快照',
                  }))
                "
                :height="260"
                :columns="[
                  { field: 'version', title: '版本', width: 90 },
                  { field: 'title', title: '公示标题', minWidth: 220 },
                  { field: 'publishedAt', title: '发布时间', width: 180 },
                  { field: 'publishedBy', title: '发布人', width: 110 },
                  { field: 'reason', title: '更正原因', minWidth: 220 },
                  { field: 'source', title: '资料来源', width: 160 },
                  {
                    field: 'actions',
                    title: '操作',
                    slot: 'actions',
                    width: 100,
                  },
                ]"
              >
                <template #actions="{ row }">
                  <Button
                    type="link"
                    @click="
                      historyVersion = form.publications?.find(
                        (p) => p.version === row.version,
                      )
                    "
                  >
                    查看
                  </Button>
                </template>
              </ImsTable>
            </ImsSection>
          </TabPane>
        </Tabs>
      </div>
    </template>
    <div v-else class="empty-panel">
      活动不存在或当前身份无权查看。<Button type="link" @click="close">
        返回活动中心
      </Button>
    </div>
    <Modal
      :open="!!reasonAction"
      class="competition-page competition-dialog-content"
      :title="reasonAction === 'cancel' ? '取消活动' : '更正已发布结果'"
      ok-text="确定"
      cancel-text="取消"
      @cancel="reasonAction = ''"
      @ok="applyReason"
    >
      <ImsSection :title="reasonAction === 'cancel' ? '取消信息' : '更正信息'">
        <Form layout="vertical">
          <FormItem label="原因" required>
            <Input.TextArea v-model:value="actionReason" :rows="3" />
          </FormItem>
        </Form>
        <p class="rule-caption">
          {{
            reasonAction === 'cancel'
              ? '取消后停止申报与评分，保留现有资料和处理历史，本期不提供恢复。'
              : '创建更正草稿，当前公示继续有效；更正内容保存后须重新发布。'
          }}
        </p>
      </ImsSection>
    </Modal>
    <PublicationHistory
      :publication="historyVersion"
      @close="historyVersion = undefined"
    />
    <Modal
      v-model:open="deadlineOpen"
      class="competition-page competition-dialog-content"
      :mask-closable="false"
      title="调整计划截止"
      ok-text="保存"
      cancel-text="取消"
      @ok="updateDeadline"
    >
      <Form layout="vertical">
        <ImsSection title="期限调整">
          <FormItem
            :label="
              form.status === '报名中' ? '报名截止日期' : '计划评审截止日期'
            "
            required
          >
            <DatePicker
              v-model:value="deadlineValue"
              value-format="YYYY-MM-DD"
            />
          </FormItem>
          <FormItem label="调整原因" required>
            <Input.TextArea v-model:value="deadlineReason" :rows="3" />
          </FormItem>
        </ImsSection>
      </Form>
    </Modal>
    <Modal
      :open="!!reviewReturn"
      class="competition-page competition-dialog-content"
      :mask-closable="false"
      title="退回专家重新评审"
      ok-text="确定退回"
      cancel-text="取消"
      @cancel="reviewReturn = ''"
      @ok="
        () => {
          if (
            perform(() =>
              commit((d) => returnReview(d, actor, reviewReturn, reviewReason)),
            )
          )
            reviewReturn = '';
        }
      "
    >
      <ImsSection title="退回信息">
        <Form layout="vertical">
          <FormItem label="退回原因" required>
            <Input.TextArea
              v-model:value="reviewReason"
              :rows="4"
              placeholder="请填写退回原因"
            />
          </FormItem>
        </Form>
      </ImsSection>
    </Modal>
  </CompetitionFrame>
</template>
