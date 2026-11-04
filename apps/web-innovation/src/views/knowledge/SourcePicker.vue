<script setup lang="ts">
import type { Knowledge, Person } from './model';
import type { FieldAction } from './references';
import type { SourceModule, SourceSelection } from './source-types';
import type { CaseParts, SourceRecord } from './sources';

import { computed, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Checkbox,
  Form,
  FormItem,
  Input,
  Modal,
  Select,
  Table,
  TabPane,
  Tabs,
} from 'ant-design-vue';

import { categories, copy, freshKnowledge } from './model';
import { applyImport, isClearedReference } from './references';
import Section from './Section.vue';
import { sourceColumns } from './source-columns';
import { useSourceData } from './source-state';
import { sourceNames } from './source-types';
import {
  candidates,
  identityMap,
  resolveSource,
  selectedFields,
  sourceKey,
} from './sources';
import SourceViewer from './SourceViewer.vue';
import { useKnowledge } from './store';
import { ask } from './ui';
const props = defineProps<{
  actor: Person;
  target?: Knowledge;
  initialSelection?: SourceSelection;
  fixedModule?: SourceModule;
  directLink?: boolean;
}>();
const emit = defineEmits<{
  close: [];
  apply: [Knowledge];
  open: [Knowledge];
}>();
const viewing = ref(false);
const { items } = useKnowledge();
const { data, refresh } = useSourceData();
const module = ref<SourceModule>(
  props.fixedModule || props.initialSelection?.module || 'exchange',
);
const chosen = ref<SourceSelection | undefined>(
  props.initialSelection ? copy(props.initialSelection) : undefined,
);
const applied = ref('');
const error = ref('');
const mode = ref('link');
const query = ref('');
const targetId = ref(props.target?.id || '');
const actions = ref<Record<string, FieldAction>>({});
const checkedFiles = ref(false);
const caseParts = ref<CaseParts>({});
const fresh = ref(freshKnowledge(props.actor));
const target = computed(
  () =>
    props.target ||
    items.value.find((v) => v.id === targetId.value) ||
    fresh.value,
);
const record = computed(() => {
  if (!chosen.value) return;
  const r = resolveSource(chosen.value, props.actor, data.value);
  return r.state === 'ok' ? r.record : undefined;
});
const rows = computed(() =>
  candidates(module.value, props.actor, data.value)
    .map((r) => ({
      ...r,
      objectTitle: r.selection.objectId ? r.title : '整体结题资料',
    }))
    .filter((r) =>
      [r.title, r.parentTitle, r.code, r.author, r.department]
        .join(' ')
        .includes(applied.value.trim()),
    ),
);
const duplicates = computed(() =>
  chosen.value
    ? items.value.filter((v) =>
        v.sources?.some(
          (s) =>
            !s.removed &&
            (s.key === sourceKey(chosen.value!) ||
              (s.selection.module === 'research' &&
                chosen.value?.module === 'research' &&
                s.selection.parentId === chosen.value.parentId)),
        ),
      )
    : [],
);
const sameTitles = computed(() =>
  record.value
    ? items.value.filter((v) => v.title.trim() === record.value!.title.trim())
    : [],
);
const fieldLabels: Record<string, string> = {
  title: '标题',
  category: '专业分类',
  summary: '摘要',
  body: '正文',
  originalAuthor: '原作者／负责人',
  originalDepartment: '原作者部门',
  resultName: '成果名称',
  resultType: '成果类型',
  resultNumber: '编号／专利号',
  problem: '问题描述',
  method: '处理方法',
  effect: '实施效果',
};
const previews = computed(() =>
  record.value
    ? Object.entries(
        selectedFields(
          record.value,
          target.value.type === '案例' ? caseParts.value : {},
        ),
      )
        .filter(
          ([key, value]) =>
            value &&
            (key !== 'category' || categories.includes(value)) &&
            (!key.startsWith('result') || target.value.type === '成果'),
        )
        .map(([key, value]) => ({
          key,
          label: fieldLabels[key],
          value,
          current:
            (target.value as unknown as Record<string, string>)[key] || '',
        }))
    : [],
);
watch([targetId, mode], () => {
  actions.value = {};
  caseParts.value = {};
});
async function changeModule(key: number | string) {
  if (chosen.value && !(await ask('切换来源将清除本次尚未带入的选择，继续？')))
    return;
  module.value = key as SourceModule;
  chosen.value = undefined;
  actions.value = {};
  caseParts.value = {};
  checkedFiles.value = false;
  query.value = '';
  applied.value = '';
  error.value = '';
}
function choose(r: SourceRecord) {
  if (props.directLink) {
    try {
      if (!props.target || r.selection.module !== props.fixedModule)
        throw new Error('请选择当前模块来源');
      const existing = props.target.sources?.find(
        (s) => s.key === sourceKey(r.selection),
      );
      if (existing && !existing.removed)
        throw new Error('该来源已关联，请勿重复添加');
      if (existing && !isClearedReference(props.target, existing))
        throw new Error('该来源仍有遗留材料，请先清理或通过补充带入处理');
      emit(
        'apply',
        applyImport(props.target, props.actor, {
          record: copy(r),
          actions: {},
          copyFiles: false,
          confirmedFiles: false,
        }),
      );
    } catch (caughtError) {
      error.value = (caughtError as Error).message;
    }
    return;
  }
  const previous = target.value.sources?.find(
    (s) => s.key === sourceKey(r.selection),
  );
  chosen.value = copy(
    previous && !isClearedReference(target.value, previous)
      ? previous.selection
      : r.selection,
  );
  actions.value = {};
  caseParts.value = {};
  checkedFiles.value = false;
  error.value = '';
}
function checkReply(id: string, value: boolean) {
  if (!chosen.value) return;
  const previousFiles = record.value?.files.map((file) => file.id) || [];
  chosen.value.replyIds = value
    ? [...new Set([...chosen.value.replyIds, id])]
    : chosen.value.replyIds.filter((v) => v !== id);
  if (!value) {
    checkPart(id, false);
    const availableFiles = record.value?.files.map((file) => file.id) || [];
    chosen.value.fileIds = chosen.value.fileIds.filter(
      (fileId) =>
        !previousFiles.includes(fileId) || availableFiles.includes(fileId),
    );
  }
}
function checkPart(id: string, value: boolean) {
  if (chosen.value)
    chosen.value.parts = value
      ? [...new Set([...chosen.value.parts, id])]
      : chosen.value.parts.filter((v) => v !== id);
  if (!value)
    for (const field of ['problem', 'method', 'effect'] as const)
      caseParts.value[field] = caseParts.value[field]?.filter((v) => v !== id);
}
function checkFile(id: string, value: boolean) {
  if (chosen.value)
    chosen.value.fileIds = value
      ? [...new Set([...chosen.value.fileIds, id])]
      : chosen.value.fileIds.filter((v) => v !== id);
}
async function close() {
  if (viewing.value) return;
  if (
    !chosen.value ||
    (await ask('放弃本次尚未带入的选择？', '父表单原有内容保持不变。'))
  )
    emit('close');
}
function confirm() {
  try {
    if (
      !props.target &&
      targetId.value &&
      !items.value.some((v) => v.id === targetId.value)
    )
      throw new Error('目标知识已不存在，请重新选择');
    if (!record.value) throw new Error('请选择当前可访问的来源');
    const result = applyImport(target.value, props.actor, {
      record: copy(record.value),
      actions: mode.value === 'import' ? actions.value : {},
      copyFiles: mode.value === 'import',
      confirmedFiles: checkedFiles.value,
      caseParts:
        mode.value === 'import' && target.value.type === '案例'
          ? caseParts.value
          : undefined,
    });
    emit('apply', result);
  } catch (caughtError) {
    error.value = (caughtError as Error).message;
  }
}
const cols = [
  { title: '编号', dataIndex: 'code', width: 150 },
  { title: '来源名称', dataIndex: 'title' },
  { title: '所属主题／课题／活动', dataIndex: 'parentTitle' },
  { title: '作者／负责人', dataIndex: 'author', width: 120 },
  { title: '部门', dataIndex: 'department', width: 110 },
  { title: '状态', dataIndex: 'status', width: 95 },
  { title: '操作', key: 'action', width: 85 },
];
const pickerColumns = computed(() =>
  props.fixedModule
    ? [
        ...sourceColumns(props.fixedModule),
        { title: '操作', key: 'action', width: 85 },
      ]
    : cols,
);
</script>
<template>
  <Modal
    open
    :title="directLink ? `添加${sourceNames[module]}关联` : '从已有资料整理'"
    width="94vw"
    class="knowledge-page knowledge-dialog-content"
    :style="{ top: '3vh' }"
    :body-style="{ maxHeight: '86vh', overflowY: 'auto' }"
    :footer="null"
    :mask-closable="false"
    :keyboard="!viewing"
    @cancel="close"
  >
    <div class="detail-toolbar">
      <Button type="primary" @click="close">关闭</Button
      ><Button type="primary" @click="refresh">刷新来源</Button
      ><Button
        v-if="!directLink"
        :disabled="!record || target.status === '已发布'"
        @click="confirm"
      >
        确认到知识表单
      </Button>
    </div>
    <div class="ims-body">
      <Alert v-if="error" type="error" :message="error" />
      <Section title="选择来源">
        <Alert
          v-if="!identityMap[actor.id]?.[module]"
          type="info"
          message="当前人员暂无此来源访问资格，可切换有权限的演示身份查看。"
        />
        <Tabs v-if="!fixedModule" :active-key="module" @change="changeModule">
          <TabPane v-for="(name, key) in sourceNames" :key="key" :tab="name" />
        </Tabs>
        <Alert
          v-if="data.errors[module]"
          type="warning"
          :message="data.errors[module]"
        />
        <div class="ims-toolbar">
          <Input
            v-model:value="query"
            placeholder="编号、名称、作者或部门"
            style="max-width: 420px"
            @press-enter="applied = query"
          /><Button type="primary" @click="applied = query">查询</Button
          ><Button
            @click="
              query = '';
              applied = '';
            "
          >
            重置
          </Button>
        </div>
        <Table
          class="ims-child-table"
          bordered
          :columns="pickerColumns"
          :data-source="rows"
          :row-key="(r) => sourceKey(r.selection)"
          :pagination="{ pageSize: 5 }"
          :scroll="{ x: 1000 }"
        >
          <template #bodyCell="{ column, record: r }">
            <Button
              v-if="column.key === 'action'"
              type="link"
              @click="choose(r as SourceRecord)"
            >
              选择
            </Button>
          </template>
        </Table>
      </Section>
      <Section v-if="record" title="选择内容">
        <div class="ims-toolbar">
          <Button @click="viewing = true">查看来源及原附件</Button>
        </div>
        <Form :label-col="{ style: { width: '125px' } }">
          <div class="ims-form-grid">
            <FormItem label="来源名称" class="span-two">
              <Input :value="record.title" disabled /> </FormItem
            ><FormItem label="作者／负责人">
              <Input :value="record.author" disabled /> </FormItem
            ><FormItem label="部门">
              <Input :value="record.department" disabled /> </FormItem
            ><FormItem label="来源实际时间">
              <Input :value="record.time || '历史未记录'" disabled /> </FormItem
            ><FormItem label="来源版本">
              <Input :value="record.version || '按选定内容核对'" disabled />
            </FormItem>
          </div>
        </Form>
        <Table
          v-if="record.replies.length"
          bordered
          class="ims-child-table"
          :data-source="record.replies"
          row-key="id"
          :columns="[
            { title: '选择回复', key: 'select', width: 100 },
            { title: '作者', dataIndex: 'author', width: 100 },
            { title: '回复正文', dataIndex: 'body' },
            { title: '采纳', key: 'adopted', width: 100 },
          ]"
          :pagination="false"
        >
          <template #bodyCell="{ column, record: r }">
            <Checkbox
              v-if="column.key === 'select'"
              :checked="chosen?.replyIds.includes(r.id)"
              @change="(e) => checkReply(r.id, e.target.checked)"
            /><span v-if="column.key === 'adopted'">{{
              r.adopted ? '已采纳' : '未采纳'
            }}</span>
          </template>
        </Table>
        <Form layout="vertical">
          <FormItem
            v-for="part in record.parts"
            :key="part.id"
            :label="part.label"
          >
            <Checkbox
              :checked="chosen?.parts.includes(part.id)"
              @change="(e) => checkPart(part.id, e.target.checked)"
            >
              选定此部分正文 </Checkbox
            ><Input.TextArea :value="part.text" :rows="3" disabled />
          </FormItem>
        </Form>
        <Table
          class="ims-child-table"
          bordered
          row-key="id"
          :data-source="record.files"
          :pagination="false"
          :columns="[
            { title: '选择', key: 'select', width: 90 },
            { title: '附件名称', dataIndex: 'name' },
            { title: '大小（字节）', dataIndex: 'size', width: 105 },
            { title: '所属资料', dataIndex: 'sourceLabel', width: 175 },
            { title: '原上传人', dataIndex: 'uploader', width: 110 },
            { title: '原上传时间', dataIndex: 'time', width: 180 },
            { title: '可带入说明', key: 'support', width: 200 },
          ]"
        >
          <template #bodyCell="{ column, record: f }">
            <Checkbox
              v-if="column.key === 'select'"
              :checked="chosen?.fileIds.includes(f.id)"
              :disabled="
                !(
                  /\.(docx?|pdf|png|jpe?g)$/i.test(f.name) &&
                  f.size > 0 &&
                  f.size <= 1048576
                )
              "
              @change="(e) => checkFile(f.id, e.target.checked)"
            /><span v-if="column.key === 'support'">{{
              /\.(docx?|pdf|png|jpe?g)$/i.test(f.name) &&
              f.size > 0 &&
              f.size <= 1048576
                ? '可选，不默认带入'
                : '原型暂不支持该格式或大小'
            }}</span>
          </template>
        </Table>
      </Section>
      <Section v-if="record" title="目标与带入预览">
        <Alert
          v-if="duplicates.length"
          type="info"
          :message="`该来源已有知识关联：${duplicates.map((v) => `${v.title}（${v.status}）`).join('、')}。优先关联已有知识；不同用途仍可新建。`"
        />
        <div v-if="!props.target" class="ims-toolbar">
          <Button
            v-for="v in duplicates"
            :key="v.id"
            type="link"
            @click="emit('open', copy(v))"
          >
            打开已有知识：{{ v.title }}
          </Button>
        </div>
        <Alert
          v-if="sameTitles.length"
          type="info"
          message="存在同名知识，请核对是否已有资料；系统不会按标题合并。"
        /><Form layout="vertical">
          <FormItem label="目标知识">
            <Select
              v-if="!props.target"
              v-model:value="targetId"
              show-search
              option-filter-prop="label"
              style="width: 100%"
              :options="[
                { value: '', label: '新建不同用途知识' },
                ...items.map((v) => ({
                  value: v.id,
                  label: `${v.code} · ${v.title} · ${v.type || '未分类'}（${v.status}）`,
                })),
              ]"
            /><Input
              v-else
              :value="target.title || '当前新建知识'"
              disabled
            /> </FormItem
          ><FormItem v-if="!target.revision && !props.target" label="知识类型">
            <Select
              v-model:value="fresh.type"
              :options="
                ['成果', '案例', '文档'].map((v) => ({ value: v, label: v }))
              "
            /> </FormItem
          ><FormItem label="处理方式">
            <Select
              v-model:value="mode"
              :options="[
                { value: 'link', label: '仅关联，不改字段和附件' },
                { value: 'import', label: '关联并带入选定资料' },
              ]"
            />
          </FormItem>
        </Form>
        <Alert
          v-if="target.status === '已发布'"
          type="warning"
          message="目标知识已发布，请先到知识管理下架后再修改。此操作不会自动下架。"
        />
        <Form
          v-if="mode === 'import' && target.type === '案例'"
          layout="vertical"
        >
          <p class="rule-caption">
            案例字段按需对应已选正文，默认不带入。回答内容不代表方法或效果已经验证；请人工核对后选择下方字段动作。
          </p>
          <FormItem
            v-for="fieldName in ['problem', 'method', 'effect'] as const"
            :key="fieldName"
            :label="`${fieldLabels[fieldName]}对应内容`"
          >
            <Select
              v-model:value="caseParts[fieldName]"
              mode="multiple"
              allow-clear
              :options="
                record.parts
                  .filter((part) => chosen?.parts.includes(part.id))
                  .map((part) => ({ value: part.id, label: part.label }))
              "
            />
          </FormItem>
        </Form>
        <Table
          v-if="mode === 'import'"
          class="ims-child-table"
          bordered
          row-key="key"
          :data-source="previews"
          :pagination="false"
          :columns="[
            { title: '字段', dataIndex: 'label', width: 130 },
            { title: '目标当前内容', dataIndex: 'current' },
            { title: '来源候选内容', dataIndex: 'value' },
            { title: '带入动作', key: 'action', width: 150 },
          ]"
        >
          <template #bodyCell="{ column, record: r }">
            <Select
              v-if="column.key === 'action'"
              :value="actions[r.key] || 'keep'"
              :options="[
                { value: 'keep', label: '保留现有内容' },
                { value: 'replace', label: '替换为来源值' },
                ...(r.key === 'body'
                  ? [{ value: 'append', label: '追加正文' }]
                  : []),
              ]"
              @change="(v) => (actions[r.key] = v as FieldAction)"
            />
          </template>
        </Table>
        <Checkbox
          v-if="mode === 'import' && chosen?.fileIds.length"
          v-model:checked="checkedFiles"
        >
          确认选定附件作为独立副本，随知识发布向登录员工展示
        </Checkbox>
        <p class="rule-caption">
          确认只带入编辑表单，之后仍需保存或发布。原业务记录保持不变；来源时间不作为知识发布时间。
        </p>
      </Section>
    </div>
  </Modal>
  <SourceViewer
    v-if="viewing && chosen"
    :selection="chosen"
    :actor="actor"
    @close="viewing = false"
  />
</template>
