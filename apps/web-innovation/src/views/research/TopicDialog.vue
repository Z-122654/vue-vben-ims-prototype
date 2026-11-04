<script setup lang="ts">
import type { Progress, Topic } from './model';

import { computed, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';

import {
  Alert,
  Button,
  DatePicker,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
  Table,
  TabPane,
  Tabs,
  Tag,
} from 'ant-design-vue';

import SourceLaunch from '../knowledge/SourceLaunch.vue';
import Attachments from './Attachments.vue';
import { syncProgress } from './editor';
import {
  adjustDates,
  canEdit,
  canPlan,
  canReview,
  canSeeClosure,
  canView,
  categories,
  copy,
  deleteProgress,
  freshProgress,
  freshTask,
  nameOf,
  overdue,
  participant,
  people,
  person,
  processTopic,
  saveClosure,
  savePlan,
  saveTopic,
  taskAction,
  topicForViewer,
  uid,
  visibleHistory,
  visibleProgress,
} from './model';
import ProgressDialog from './ProgressDialog.vue';
import Section from './Section.vue';
import { useResearch } from './store';
import { ask, perform } from './ui';
import { useValidation } from './validation';
const props = defineProps<{ initial: Topic; initialTab?: string }>();
const emit = defineEmits<{ close: [] }>();
const knowledgeBusy = ref(false);
const { topics, actor, commit, refresh: reloadData } = useResearch();
const form = ref(topicForViewer(props.initial, actor.value));
const baseline = ref(JSON.stringify(form.value));
const tab = ref(props.initialTab || 'info');
const current = computed(
  () => topics.value.find((t) => t.id === form.value.id) ?? props.initial,
);
const exists = computed(() => topics.value.some((t) => t.id === form.value.id));
const allowed = computed(() => canView(current.value, actor.value));
const editable = computed(
  () => allowed.value && canEdit(current.value, actor.value),
);
const planning = computed(() => canPlan(current.value, actor.value));
const privateClosure = computed(() =>
  canSeeClosure(current.value, actor.value),
);
const progress = ref<Progress>();
const flow = ref(false);
const pending = ref({ main: 0, closure: 0 });
const mainFiles = ref<InstanceType<typeof Attachments>>();
const closureFiles = ref<InstanceType<typeof Attachments>>();
const busy = computed(() => pending.value.main + pending.value.closure > 0);
const dirty = computed(
  () => JSON.stringify(form.value) !== baseline.value || busy.value,
);
const memberOptions = computed(() =>
  form.value.members.map((m) => ({
    value: m.personId,
    label: `${nameOf(m.personId)} · ${person(m.personId)?.department}`,
  })),
);
const personOptions = people.map((p) => ({
  value: p.id,
  label: `${p.name} · ${p.department}`,
}));
const action = ref('');
const reason = ref('');
const newStart = ref('');
const newEnd = ref('');
const body = ref<HTMLElement>();
const actionBody = ref<HTMLElement>();
const validation = useValidation(
  (field) => (field.startsWith('action.') ? actionBody.value : body.value),
  (field) => {
    if (field.startsWith('action.')) return;
    action.value = '';
    tab.value = field.startsWith('tasks')
      ? 'tasks'
      : field.startsWith('closure')
        ? 'closure'
        : 'info';
  },
);
const { field } = validation;
const historyCols = [
  { title: '操作', dataIndex: 'action', width: 150 },
  { title: '处理人', key: 'person', width: 120 },
  { title: '时间', dataIndex: 'time', width: 180 },
  { title: '说明', dataIndex: 'note' },
];
const memberCols = [
  { title: '人员', key: 'person', width: 250 },
  { title: '部门', key: 'department', width: 160 },
  { title: '团队角色', key: 'role', width: 110 },
  { title: '职责说明', key: 'duty' },
  { title: '操作', key: 'actions', width: 100 },
];
const taskCols = [
  { title: '任务名称', key: 'name', width: 200 },
  { title: '责任人', key: 'person', width: 180 },
  { title: '计划开始', key: 'start', width: 155 },
  { title: '计划完成', key: 'end', width: 155 },
  { title: '任务说明', key: 'description', width: 240 },
  { title: '状态', key: 'status', width: 120 },
  { title: '实际开始', dataIndex: 'startedAt', width: 180 },
  { title: '实际完成', dataIndex: 'completedAt', width: 180 },
  { title: '操作', key: 'actions', width: 150 },
];
const progressCols = [
  { title: '记录类型', dataIndex: 'kind', width: 120 },
  { title: '标题', dataIndex: 'title' },
  { title: '关联任务', key: 'task', width: 180 },
  { title: '填报人', key: 'owner', width: 100 },
  { title: '反馈日期', dataIndex: 'date', width: 120 },
  { title: '提交时间', key: 'time', width: 180 },
  { title: '操作', key: 'actions', width: 210 },
];
const resultCols = [
  { title: '成果名称', key: 'name', width: 240 },
  { title: '成果类型', key: 'kind', width: 160 },
  { title: '成果编号／专利号', key: 'code', width: 200 },
  { title: '成果说明', key: 'description' },
  { title: '操作', key: 'actions', width: 90 },
];
function sync() {
  form.value = topicForViewer(current.value, actor.value);
  validation.clear();
  baseline.value = JSON.stringify(form.value);
}
function syncSaved(scope: 'closure' | 'plan') {
  const before = JSON.parse(baseline.value) as Topic;
  const keepClosure =
    scope === 'plan' &&
    JSON.stringify(form.value.closure) !== JSON.stringify(before.closure);
  const keepPlan =
    scope === 'closure' &&
    (JSON.stringify(form.value.tasks) !== JSON.stringify(before.tasks) ||
      JSON.stringify(form.value.members) !== JSON.stringify(before.members));
  const local = copy(form.value);
  sync();
  if (keepClosure) form.value.closure = local.closure;
  if (keepPlan) {
    form.value.tasks = local.tasks;
    form.value.members = local.members;
  }
}
async function guard() {
  if (knowledgeBusy.value) return false;
  if (dirty.value && !(await ask('放弃未保存的课题修改？'))) return false;
  mainFiles.value?.cancel();
  closureFiles.value?.cancel();
  return true;
}
async function close() {
  if (await guard()) emit('close');
}
onBeforeRouteLeave(guard);
async function refresh() {
  if (await guard()) {
    reloadData();
    sync();
  }
}
function run(fn: (t: Topic) => void) {
  validation.clear();
  return perform(
    () =>
      commit((all) => {
        const t = all.find((v) => v.id === form.value.id);
        if (!t) throw new Error('请先保存课题');
        fn(t);
      }),
    undefined,
    validation.report,
  );
}
function save(submit = false) {
  if (busy.value) return;
  validation.clear();
  if (
    perform(
      () => commit((all) => saveTopic(all, actor.value, form.value, submit)),
      undefined,
      validation.report,
    )
  )
    sync();
}
function updateLeader(id: string) {
  form.value.leaderId = id;
  if (!form.value.members.some((m) => m.personId === id))
    form.value.members.push({ personId: id, duty: '课题负责人' });
}
async function startAction(kind: string) {
  if (
    dirty.value &&
    !(await ask('此操作前需要放弃未保存的表单修改，是否继续？'))
  )
    return;
  if (dirty.value) {
    mainFiles.value?.cancel();
    closureFiles.value?.cancel();
    sync();
  }
  action.value = kind;
  reason.value = '';
  newStart.value = current.value.start;
  newEnd.value = current.value.end;
}
const actionTitle = computed(
  () =>
    ({
      approve: current.value.status === '待立项' ? '立项通过' : '结题通过',
      return: '退回修改',
      withdraw: '撤回申请',
      terminate: '终止课题',
      dates: '调整总体计划',
      plan: '保存团队与任务计划',
    })[action.value] ?? '',
);
function confirmProcess() {
  let ok = false;
  if (action.value === 'plan')
    ok = run((t) => savePlan(t, actor.value, form.value, reason.value));
  else if (action.value === 'dates')
    ok = run((t) =>
      adjustDates(
        t,
        actor.value,
        form.value.revision,
        newStart.value,
        newEnd.value,
        reason.value,
      ),
    );
  else if (
    ['approve', 'return', 'terminate', 'withdraw'].includes(action.value)
  )
    ok = run((t) =>
      processTopic(
        t,
        actor.value,
        form.value.revision,
        action.value as 'approve' | 'return' | 'terminate' | 'withdraw',
        reason.value,
      ),
    );
  if (ok) {
    const plan = action.value === 'plan';
    action.value = '';
    if (plan) syncSaved('plan');
    else sync();
  }
}
function planSave() {
  if (busy.value) return;
  reason.value = '';
  action.value = 'plan';
}
function closureSave(submit = false) {
  if (busy.value) return;
  const b = JSON.parse(baseline.value) as Topic;
  if (
    submit &&
    (JSON.stringify(form.value.tasks) !== JSON.stringify(b.tasks) ||
      JSON.stringify(form.value.members) !== JSON.stringify(b.members))
  ) {
    message.error('请先保存团队与任务计划，再申请结题。');
    return;
  }
  if (
    run((t) =>
      saveClosure(
        t,
        actor.value,
        form.value.revision,
        form.value.closure,
        submit,
      ),
    )
  )
    syncSaved('closure');
}
async function openProgress(p?: Progress, correct = false) {
  if (!(await guard())) return;
  sync();
  const next = p ? copy(p) : freshProgress(actor.value);
  if (correct) {
    next.correctionId = next.id;
    next.id = uid();
    next.submittedAt = '';
    next.title = `更正：${next.title}`;
  }
  progress.value = next;
}
function closeProgress() {
  progress.value = undefined;
  sync();
}
async function deleteFeedback(id: string) {
  if (await ask('删除本人进展草稿？', '删除后无法恢复此草稿。')) {
    if (run((t) => deleteProgress(t, actor.value, form.value.revision, id))) {
      const before = JSON.parse(baseline.value) as Topic;
      syncProgress(form.value, before, current.value);
      baseline.value = JSON.stringify(before);
    }
  }
}
async function executeTask(id: string) {
  if (!(await guard())) return;
  sync();
  if (run((t) => taskAction(t, actor.value, form.value.revision, id))) sync();
}
const rows = computed(() => visibleProgress(current.value, actor.value));
const canWithdraw = computed(() =>
  current.value.status === '待结题'
    ? current.value.leaderId === actor.value.id
    : current.value.status === '待立项' &&
      current.value.history.filter((h) => h.action === '提交立项').at(-1)
        ?.personId === actor.value.id,
);
const stage = computed(() =>
  ['立项退回', '草稿'].includes(current.value.status)
    ? 0
    : current.value.status === '待立项'
      ? 1
      : current.value.status === '攻关中'
        ? 2
        : current.value.status === '待结题'
          ? 3
          : current.value.status === '已结题'
            ? 4
            : -1,
);
</script>
<template>
  <Modal
    :open="!progress"
    title="课题明细"
    width="min(1440px,calc(100vw - 48px))"
    wrap-class-name="research-detail-modal"
    :style="{ top: '24px', paddingBottom: 0 }"
    :body-style="{
      padding: 0,
      maxHeight: 'calc(100dvh - 110px)',
      overflowY: 'auto',
    }"
    :mask-closable="false"
    :keyboard="!knowledgeBusy"
    :footer="null"
    @cancel="close"
  >
    <div ref="body" class="research-page research-dialog-content">
      <div class="detail-toolbar">
        <Button type="primary" @click="close">关闭</Button
        ><Button
          v-if="editable"
          type="primary"
          :disabled="busy"
          @click="save()"
        >
          保存 </Button
        ><Button type="primary" @click="refresh">刷新</Button
        ><Button v-if="editable" :disabled="busy" @click="save(true)">
          提交立项
        </Button>
        <Button
          v-if="canReview(current, actor)"
          @click="startAction('approve')"
        >
          {{ current.status === '待立项' ? '立项通过' : '结题通过' }} </Button
        ><Button
          v-if="canReview(current, actor)"
          @click="startAction('return')"
        >
          退回 </Button
        ><Button v-if="canWithdraw" @click="startAction('withdraw')">
          撤回
        </Button>
        <Button
          v-if="actor.admin && current.status === '攻关中'"
          @click="startAction('dates')"
        >
          调整总体计划 </Button
        ><Button
          v-if="
            actor.admin &&
            ['待立项', '立项退回', '攻关中', '待结题'].includes(current.status)
          "
          danger
          @click="startAction('terminate')"
        >
          终止课题 </Button
        ><Button v-if="exists && allowed" @click="flow = true">流程图</Button>
      </div>
      <div class="ims-body">
        <Alert v-if="!allowed" type="warning" message="无权访问该课题" /><Tabs
          v-else
          v-model:active-key="tab"
        >
          <TabPane key="info" tab="课题信息">
            <Section title="基本信息">
              <Form :label-col="{ style: { width: '120px' } }">
                <div class="ims-form-grid">
                  <FormItem
                    v-bind="field('name')"
                    label="课题名称"
                    required
                    class="span-two"
                  >
                    <Input
                      v-model:value="form.name"
                      :disabled="!editable"
                    /> </FormItem
                  ><FormItem label="课题编号">
                    <Input :value="form.code || '保存后生成'" disabled />
                  </FormItem>
                  <FormItem
                    v-bind="field('category')"
                    label="课题类别"
                    required
                  >
                    <Select
                      v-model:value="form.category"
                      :disabled="!editable"
                      :options="categories.map((v) => ({ value: v, label: v }))"
                    /> </FormItem
                  ><FormItem
                    v-bind="field('leaderId')"
                    label="课题负责人"
                    required
                  >
                    <Select
                      :value="form.leaderId"
                      :disabled="!editable || !actor.admin"
                      :options="personOptions"
                      @change="(v) => updateLeader(String(v))"
                    /> </FormItem
                  ><FormItem label="负责部门" required>
                    <Input
                      :value="person(form.leaderId)?.department"
                      disabled
                    />
                  </FormItem>
                  <FormItem label="填报人">
                    <Input :value="nameOf(form.ownerId)" disabled /> </FormItem
                  ><FormItem label="当前状态">
                    <Input :value="current.status" disabled /> </FormItem
                  ><FormItem v-bind="field('start')" label="计划开始" required>
                    <DatePicker
                      :value="form.start"
                      @update:value="(v) => (form.start = String(v ?? ''))"
                      value-format="YYYY-MM-DD"
                      :disabled="!editable"
                    /> </FormItem
                  ><FormItem v-bind="field('end')" label="计划完成" required>
                    <DatePicker
                      :value="form.end"
                      @update:value="(v) => (form.end = String(v ?? ''))"
                      value-format="YYYY-MM-DD"
                      :disabled="!editable"
                    />
                  </FormItem>
                  <FormItem label="首次提交">
                    <Input
                      :value="form.firstSubmittedAt || '尚未提交'"
                      disabled
                    /> </FormItem
                  ><FormItem label="最近提交">
                    <Input
                      :value="form.submittedAt || '尚未提交'"
                      disabled
                    /> </FormItem
                  ><FormItem label="实际立项">
                    <Input
                      :value="form.approvedAt || '尚未立项'"
                      disabled
                    /> </FormItem
                  ><FormItem label="实际结题">
                    <Input :value="form.closedAt || '尚未结题'" disabled />
                  </FormItem>
                </div>
              </Form>
              <p v-if="editable" class="research-muted">
                保存草稿仅要求课题名称；提交立项须填写所有标记必填的字段。附件选填。
              </p>
            </Section>
            <Section title="攻关方案">
              <Form :label-col="{ style: { width: '120px' } }">
                <FormItem
                  v-bind="field('background')"
                  label="问题与背景"
                  required
                >
                  <Input.TextArea
                    v-model:value="form.background"
                    :rows="4"
                    :disabled="!editable"
                  /> </FormItem
                ><FormItem v-bind="field('goal')" label="攻关目标" required>
                  <Input.TextArea
                    v-model:value="form.goal"
                    :rows="4"
                    :disabled="!editable"
                  /> </FormItem
                ><FormItem v-bind="field('solution')" label="实施方案" required>
                  <Input.TextArea
                    v-model:value="form.solution"
                    :rows="4"
                    :disabled="!editable"
                  /> </FormItem
                ><FormItem label="预期成果">
                  <Input.TextArea
                    v-model:value="form.expected"
                    :rows="3"
                    :disabled="!editable"
                  />
                </FormItem>
              </Form>
            </Section>
            <Section title="团队成员">
              <div v-if="editable || planning" class="ims-toolbar">
                <Button
                  type="primary"
                  @click="form.members.push({ personId: '', duty: '' })"
                >
                  ＋ 新增成员 </Button
                ><Button
                  v-if="planning"
                  type="primary"
                  :disabled="busy"
                  @click="planSave"
                >
                  保存团队与计划
                </Button>
              </div>
              <div data-field="members">
                <Alert
                  v-if="validation.target.value === 'members'"
                  type="error"
                  :message="validation.error.value"
                /><Table
                  class="ims-child-table"
                  bordered
                  row-key="personId"
                  :columns="memberCols"
                  :data-source="form.members"
                  :pagination="false"
                >
                  <template #bodyCell="{ column, record, index }">
                    <template v-if="column.key === 'person'">
                      <FormItem v-bind="field(`members.${index}.personId`)">
                        <Select
                          v-if="editable || planning"
                          v-model:value="record.personId"
                          :disabled="record.personId === form.leaderId"
                          :options="personOptions"
                        /><span v-else>{{ nameOf(record.personId) }}</span>
                      </FormItem> </template
                    ><template v-if="column.key === 'department'">
                      {{ person(record.personId)?.department }} </template
                    ><template v-if="column.key === 'role'">
                      {{
                        record.personId === form.leaderId ? '负责人' : '成员'
                      }} </template
                    ><template v-if="column.key === 'duty'">
                      <Input
                        v-model:value="record.duty"
                        :disabled="!editable && !planning"
                      /> </template
                    ><template v-if="column.key === 'actions'">
                      <Button
                        v-if="editable || planning"
                        type="link"
                        danger
                        :disabled="record.personId === form.leaderId"
                        @click="form.members.splice(index, 1)"
                      >
                        删除
                      </Button>
                    </template>
                  </template>
                </Table>
              </div> </Section
            ><Section title="申报附件" data-field="files">
              <Attachments
                ref="mainFiles"
                v-model="form.files"
                :readonly="!editable"
                :uploader="actor.name"
                @pending="pending.main = $event"
              />
            </Section>
          </TabPane>
          <TabPane key="tasks" tab="任务计划">
            <Section title="任务计划">
              <div class="ims-toolbar" v-if="editable || planning">
                <Button type="primary" @click="form.tasks.push(freshTask())">
                  ＋ 新增任务 </Button
                ><Button
                  v-if="planning"
                  type="primary"
                  :disabled="busy"
                  @click="planSave"
                >
                  保存团队与计划
                </Button>
              </div>
              <p class="rule-caption">
                单层任务；责任人来自团队。计划日期到期仅提示，不自动推进状态。完成任务
                {{ form.tasks.filter((t) => t.status === '已完成').length }} /
                {{ form.tasks.length }} 项。
              </p>
              <div data-field="tasks">
                <Alert
                  v-if="validation.target.value === 'tasks'"
                  type="error"
                  :message="validation.error.value"
                /><Table
                  class="ims-child-table"
                  bordered
                  row-key="id"
                  :columns="taskCols"
                  :data-source="form.tasks"
                  :pagination="false"
                  :scroll="{ x: 1660 }"
                >
                  <template #bodyCell="{ column, record, index }">
                    <FormItem
                      v-bind="
                        field(
                          `tasks.${index}.${column.key === 'person' ? 'personId' : column.key}`,
                        )
                      "
                    >
                      <template v-if="column.key === 'name'">
                        <Input
                          v-model:value="record.name"
                          :disabled="
                            (!editable && !planning) ||
                            record.status === '已完成'
                          "
                        /> </template
                      ><template v-if="column.key === 'person'">
                        <Select
                          v-model:value="record.personId"
                          :options="memberOptions"
                          :disabled="
                            (!editable && !planning) ||
                            record.status === '已完成'
                          "
                        /> </template
                      ><template v-if="column.key === 'start'">
                        <DatePicker
                          :value="record.start"
                          @update:value="
                            (v) => (record.start = String(v ?? ''))
                          "
                          value-format="YYYY-MM-DD"
                          :disabled="
                            (!editable && !planning) ||
                            record.status === '已完成'
                          "
                        /> </template
                      ><template v-if="column.key === 'end'">
                        <DatePicker
                          :value="record.end"
                          @update:value="(v) => (record.end = String(v ?? ''))"
                          value-format="YYYY-MM-DD"
                          :disabled="
                            (!editable && !planning) ||
                            record.status === '已完成'
                          "
                        /> </template
                      ><template v-if="column.key === 'description'">
                        <Input.TextArea
                          v-model:value="record.description"
                          :rows="2"
                          :disabled="
                            (!editable && !planning) ||
                            record.status === '已完成'
                          "
                        /> </template
                      ><template v-if="column.key === 'status'">
                        <Tag>{{ record.status }}</Tag
                        ><Tag
                          v-if="overdue(record.end, record.status === '已完成')"
                          color="orange"
                        >
                          已逾期
                        </Tag> </template
                      ><template v-if="column.dataIndex === 'startedAt'">
                        {{ record.startedAt || '—' }} </template
                      ><template v-if="column.dataIndex === 'completedAt'">
                        {{ record.completedAt || '—' }} </template
                      ><template v-if="column.key === 'actions'">
                        <Button
                          v-if="
                            current.status === '攻关中' &&
                            record.personId === actor.id &&
                            record.status !== '已完成'
                          "
                          type="link"
                          @click="executeTask(record.id)"
                        >
                          {{
                            record.status === '未开始' ? '开始' : '完成'
                          }} </Button
                        ><Button
                          v-if="editable || planning"
                          type="link"
                          danger
                          :disabled="record.status !== '未开始'"
                          @click="form.tasks.splice(index, 1)"
                        >
                          删除
                        </Button>
                      </template>
                    </FormItem>
                  </template>
                </Table>
              </div>
            </Section>
          </TabPane>
          <TabPane key="progress" tab="进展记录">
            <Section title="进展记录">
              <div class="ims-toolbar">
                <Button
                  v-if="
                    current.status === '攻关中' && participant(current, actor)
                  "
                  type="primary"
                  @click="openProgress()"
                >
                  ＋ 新增进展
                </Button>
              </div>
              <Table
                class="ims-child-table"
                bordered
                row-key="id"
                :columns="progressCols"
                :data-source="rows"
                :pagination="{ pageSize: 10 }"
                :scroll="{ x: 1000 }"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'task'">
                    {{
                      current.tasks.find((t) => t.id === record.taskId)?.name ||
                      '—'
                    }} </template
                  ><template v-if="column.key === 'owner'">
                    {{ nameOf(record.ownerId) }} </template
                  ><template v-if="column.key === 'time'">
                    {{ record.submittedAt || '草稿（仅本人可见）' }} </template
                  ><template v-if="column.key === 'actions'">
                    <Button
                      type="link"
                      @click="openProgress(record as Progress)"
                    >
                      明细 </Button
                    ><Button
                      v-if="
                        record.ownerId === actor.id &&
                        record.submittedAt &&
                        current.status === '攻关中'
                      "
                      type="link"
                      @click="openProgress(record as Progress, true)"
                    >
                      追加更正 </Button
                    ><Button
                      v-if="
                        record.ownerId === actor.id &&
                        !record.submittedAt &&
                        current.status === '攻关中'
                      "
                      type="link"
                      danger
                      @click="deleteFeedback(record.id)"
                    >
                      删除
                    </Button>
                  </template>
                </template>
              </Table>
            </Section>
          </TabPane>
          <TabPane v-if="current.approvedAt" key="closure" tab="结题资料">
            <Alert
              v-if="!privateClosure"
              type="info"
              :message="
                current.closureSubmittedAt
                  ? '历史正式结题版本未保留，当前草稿仅负责人可见，重新提交后可查看。'
                  : '结题草稿仅负责人可见，提交后可查看。'
              "
            /><template v-else>
              <Section title="结题基本信息">
                <p v-if="current.leaderId !== actor.id" class="research-muted">
                  以下为最近一次正式提交的结题资料，负责人的未提交修改不在此展示。
                </p>
                <SourceLaunch
                  v-if="current.status === '已结题'"
                  module="research"
                  :parent-id="current.id"
                  :source-actor-id="actor.id"
                  @busy="knowledgeBusy = $event"
                />
                <div v-if="planning" class="ims-toolbar">
                  <Button
                    type="primary"
                    :disabled="busy"
                    @click="closureSave()"
                  >
                    保存结题 </Button
                  ><Button :disabled="busy" @click="closureSave(true)">
                    申请结题
                  </Button>
                </div>
                <Form :label-col="{ style: { width: '140px' } }">
                  <div class="ims-form-grid">
                    <FormItem label="课题名称" class="span-two">
                      <Input :value="form.name" disabled /> </FormItem
                    ><FormItem label="当前状态">
                      <Input :value="current.status" disabled /> </FormItem
                    ><FormItem label="负责人">
                      <Input
                        :value="nameOf(form.leaderId)"
                        disabled
                      /> </FormItem
                    ><FormItem label="最近申请时间">
                      <Input
                        :value="current.closureSubmittedAt || '尚未申请'"
                        disabled
                      /> </FormItem
                    ><FormItem label="实际结题时间">
                      <Input :value="current.closedAt || '尚未结题'" disabled />
                    </FormItem>
                  </div>
                  <FormItem
                    v-bind="field('closure.goal')"
                    label="目标完成情况"
                    required
                  >
                    <Input.TextArea
                      v-model:value="form.closure.goal"
                      :rows="4"
                      :disabled="!planning"
                    /> </FormItem
                  ><FormItem
                    v-bind="field('closure.summary')"
                    label="结题总结"
                    required
                  >
                    <Input.TextArea
                      v-model:value="form.closure.summary"
                      :rows="4"
                      :disabled="!planning"
                    /> </FormItem
                  ><FormItem
                    v-bind="field('closure.outcome')"
                    label="成果与应用说明"
                    required
                  >
                    <Input.TextArea
                      v-model:value="form.closure.outcome"
                      :rows="4"
                      :disabled="!planning"
                    /> </FormItem
                  ><FormItem label="遗留问题及建议">
                    <Input.TextArea
                      v-model:value="form.closure.issues"
                      :rows="3"
                      :disabled="!planning"
                    />
                  </FormItem>
                </Form>
              </Section>
              <Section title="成果清单">
                <div v-if="planning" class="ims-toolbar">
                  <Button
                    type="primary"
                    @click="
                      form.closure.results.push({
                        id: uid(),
                        name: '',
                        kind: '方案',
                        code: '',
                        description: '',
                      })
                    "
                  >
                    ＋ 新增成果
                  </Button>
                </div>
                <Table
                  class="ims-child-table"
                  bordered
                  row-key="id"
                  :columns="resultCols"
                  :data-source="form.closure.results"
                  :pagination="false"
                >
                  <template #bodyCell="{ column, record, index }">
                    <FormItem
                      v-bind="field(`closure.results.${index}.${column.key}`)"
                    >
                      <template v-if="column.key === 'kind'">
                        <Select
                          v-model:value="record.kind"
                          :disabled="!planning"
                          :options="
                            [
                              '方案',
                              '装置／工具',
                              '制度／标准',
                              '专利',
                              '论文',
                              '其他',
                            ].map((v) => ({ value: v, label: v }))
                          "
                        /> </template
                      ><template v-else-if="column.key === 'actions'">
                        <Button
                          v-if="planning"
                          type="link"
                          danger
                          @click="form.closure.results.splice(index, 1)"
                        >
                          删除
                        </Button> </template
                      ><template v-else>
                        <Input
                          v-model:value="record[String(column.key)]"
                          :disabled="!planning"
                        />
                      </template>
                    </FormItem>
                  </template>
                </Table> </Section
              ><Section title="结题附件" data-field="closure.files">
                <Attachments
                  ref="closureFiles"
                  v-model="form.closure.files"
                  :readonly="!planning"
                  :uploader="actor.name"
                  @pending="pending.closure = $event"
                />
              </Section>
            </template>
          </TabPane>
        </Tabs>
      </div>
    </div>
  </Modal>
  <ProgressDialog
    v-if="progress"
    :topic-id="form.id"
    :initial="progress"
    @close="closeProgress"
  />
  <Modal
    :open="!!action"
    :title="actionTitle"
    :mask-closable="false"
    ok-text="确定"
    cancel-text="取消"
    @cancel="action = ''"
    @ok="confirmProcess"
  >
    <div ref="actionBody" class="research-page research-dialog-content">
      <Section :title="actionTitle">
        <Form layout="vertical">
          <template v-if="action === 'dates'">
            <FormItem v-bind="field('action.start')" label="计划开始" required>
              <DatePicker
                :value="newStart"
                @update:value="(v) => (newStart = String(v ?? ''))"
                value-format="YYYY-MM-DD"
              /> </FormItem
            ><FormItem v-bind="field('action.end')" label="计划完成" required>
              <DatePicker
                :value="newEnd"
                @update:value="(v) => (newEnd = String(v ?? ''))"
                value-format="YYYY-MM-DD"
              />
            </FormItem> </template
          ><FormItem
            v-bind="field('action.reason')"
            v-if="['return', 'terminate', 'dates', 'plan'].includes(action)"
            :label="
              action === 'plan'
                ? '变更原因（调整已有责任人或日期时必填）'
                : '处理原因'
            "
            :required="action !== 'plan'"
          >
            <Input.TextArea v-model:value="reason" :rows="4" />
          </FormItem>
          <p v-else>确认{{ actionTitle }}？操作成功后记录实际处理时间。</p>
        </Form>
      </Section>
    </div>
  </Modal>
  <Modal
    v-model:open="flow"
    title="流程图"
    width="min(1200px,90vw)"
    :footer="null"
  >
    <div class="research-page research-dialog-content">
      <Section title="基本信息">
        <Form :label-col="{ style: { width: '100px' } }">
          <FormItem label="课题名称">
            <Input :value="current.name" disabled /> </FormItem
          ><FormItem label="当前状态">
            <Input :value="current.status" disabled />
          </FormItem>
        </Form> </Section
      ><Section title="课题流程">
        <div class="research-flow">
          <div
            v-for="(label, i) in [
              '填写申报',
              '立项处理',
              '团队攻关',
              '结题处理',
              '完成',
            ]"
            :key="label"
            :class="{ current: stage === i }"
          >
            {{ label }}
            <p class="research-muted">
              {{
                [
                  '填报人／负责人',
                  '业务管理员',
                  '负责人／成员',
                  '业务管理员',
                  '已结题',
                ][i]
              }}
            </p>
          </div>
        </div>
        <p v-if="current.status === '已终止'">
          课题已终止，历史资料保留。
        </p> </Section
      ><Section title="处理记录">
        <Table
          class="ims-child-table"
          bordered
          row-key="id"
          :columns="historyCols"
          :data-source="visibleHistory(current)"
          :pagination="{ pageSize: 6 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'person'">
              {{ nameOf(record.personId) }}
            </template>
          </template>
        </Table>
      </Section>
    </div>
  </Modal>
</template>
