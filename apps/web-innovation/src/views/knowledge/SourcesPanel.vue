<script setup lang="ts">
import type { Knowledge, Person } from './model';
import type { SourceLink, SourceModule, SourceSelection } from './source-types';

import { computed, ref, watch } from 'vue';

import {
  Button,
  Form,
  FormItem,
  Input,
  Modal,
  Table,
  TabPane,
  Tabs,
} from 'ant-design-vue';

import { nameOf } from './model';
import {
  isClearedReference,
  removeReference,
  removeReferences,
  sourceState,
} from './references';
import Section from './Section.vue';
import { sourceColumns } from './source-columns';
import { useSourceData } from './source-state';
import { sourceNames } from './source-types';
import SourcePicker from './SourcePicker.vue';
import SourceViewer from './SourceViewer.vue';
import { useKnowledge } from './store';
import { ask, perform } from './ui';
const props = defineProps<{
  modelValue: Knowledge;
  actor: Person;
  editable: boolean;
  dirty: boolean;
  blocked: boolean;
}>();
const emit = defineEmits<{
  'update:modelValue': [Knowledge];
  busy: [boolean];
  review: [string, string, string, () => void];
}>();
const sourceData = useSourceData();
const { data } = sourceData;
const store = useKnowledge();
function refresh() {
  store.audit?.(props.actor);
  sourceData.refresh();
}
const activeModule = ref<SourceModule>('exchange');
const pickerModule = ref<SourceModule>();
const recordsOpen = ref(false);
const selectedKeys = ref<(number | string)[]>([]);
function clearSelection() {
  selectedKeys.value = [];
}
watch(
  [
    activeModule,
    () => props.editable,
    () => props.blocked,
    () => props.modelValue.id,
  ],
  clearSelection,
);
const rowSelection = computed(() => ({
  selectedRowKeys: selectedKeys.value,
  onChange: (keys: (number | string)[]) => {
    selectedKeys.value = keys;
  },
  getCheckboxProps: () => ({ disabled: !props.editable || props.blocked }),
  columnWidth: 48,
}));
function removeSelected() {
  if (!props.editable || props.blocked) return;
  perform(() => {
    const next = removeReferences(
      props.modelValue,
      props.actor,
      selectedKeys.value.map(String),
      activeModule.value,
    );
    emit('update:modelValue', next);
    clearSelection();
  }, '已从当前表单移除关联，保存后生效。');
}

const initial = ref<SourceSelection>();
const note = ref('');
const picker = ref(false);
const removing = ref<SourceLink>();
const reviewing = ref<SourceLink>();
const token = ref('');
const viewer = ref<SourceSelection>();
watch(
  () =>
    !!(
      recordsOpen.value ||
      picker.value ||
      viewer.value ||
      removing.value ||
      reviewing.value
    ),
  (v) => emit('busy', v),
);
const rows = computed(() =>
  (props.modelValue.sources || []).map((link) => {
    const state = sourceState(link, props.actor, data.value);
    const visible = props.actor.admin || state.result.state === 'ok';
    return {
      ...link,
      business:
        state.result.state === 'ok'
          ? {
              ...state.result.record,
              objectTitle: link.selection.objectId
                ? state.result.record.title
                : '整体结题资料',
            }
          : {
              code: visible ? link.code || '—' : '—',
              title: visible ? link.title : '来源不可访问',
              parentTitle: visible ? link.parentTitle || '—' : '来源不可访问',
              objectTitle: visible
                ? link.selection.objectId
                  ? link.title
                  : '整体结题资料'
                : '—',
              author: visible ? link.author : '—',
              department: visible ? link.department : '—',
              category: '—',
              time: '—',
              status: state.result.message,
            },
      cleared: isClearedReference(props.modelValue, link),
      sourceName: sourceNames[link.selection.module],
      safeTitle: visible ? link.title : '来源不可访问',
      visible,
      safeLinkedAt: visible
        ? `${link.linkedAt || '尚未保存'}${link.linkedBy ? ` · ${nameOf(link.linkedBy)}` : ''}`
        : '—',
      safeAuthor: visible
        ? [
            `${link.author} · ${link.department}`,
            ...(link.contributors || []).map(
              (c) => `回复：${c.name} · ${c.department}`,
            ),
          ].join('；')
        : '—',
      state,
    };
  }),
);
function columns(module: SourceModule) {
  return [
    ...sourceColumns(module).map((c) => ({
      ...c,
      dataIndex: ['business', c.dataIndex],
    })),
    { title: '操作', key: 'actions', width: 280 },
  ];
}
function pick(link?: SourceLink) {
  initial.value = link?.selection;
  pickerModule.value = link ? undefined : activeModule.value;
  picker.value = true;
}
function apply(v: Knowledge) {
  emit('update:modelValue', v);
  picker.value = false;
  refresh();
}
function remove(clear: boolean) {
  if (!removing.value || !props.editable || props.blocked) return;
  emit(
    'update:modelValue',
    removeReference(props.modelValue, props.actor, removing.value.key, clear),
  );
  removing.value = undefined;
}
function review(link: SourceLink) {
  refresh();
  token.value = sourceState(link, props.actor, data.value).token;
  reviewing.value = link;
  note.value = '';
}
function confirmReview() {
  if (!reviewing.value || !note.value.trim()) return;
  emit('review', reviewing.value.key, note.value, token.value, () => {
    reviewing.value = undefined;
    refresh();
  });
}
async function closeReview() {
  if (!note.value.trim() || (await ask('放弃尚未保存的复核意见？')))
    reviewing.value = undefined;
}
</script>
<template>
  <Tabs v-model:active-key="activeModule">
    <TabPane v-for="(name, module) in sourceNames" :key="module" :tab="name">
      <Section :title="name" data-field="sources">
        <div class="ims-toolbar">
          <Button
            v-if="editable"
            type="primary"
            :disabled="blocked"
            @click="pick()"
          >
            新增
          </Button>
          <Button
            v-if="editable"
            type="primary"
            :disabled="blocked || !selectedKeys.length"
            @click="removeSelected"
          >
            删除
          </Button>
          <Button type="primary" @click="refresh">刷新</Button>
        </div>
        <Table
          class="ims-child-table"
          bordered
          row-key="key"
          :columns="columns(module)"
          :data-source="
            rows.filter(
              (row) => !row.removed && row.selection.module === module,
            )
          "
          :row-selection="editable ? rowSelection : undefined"
          @change="clearSelection"
          :scroll="{ x: module === 'exchange' ? 1400 : 1600 }"
          :pagination="{
            pageSize: 5,
            showTotal: (total: number) => `共 ${total} 条数据`,
          }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'actions'">
              <Button
                v-if="record.state.result.state === 'ok'"
                type="link"
                @click="viewer = record.selection"
              >
                查看来源 </Button
              ><span v-else-if="!actor.admin">来源不可访问</span
              ><template v-if="editable">
                <Button
                  v-if="record.state.result.state === 'ok'"
                  type="link"
                  :disabled="blocked"
                  @click="pick(record as SourceLink)"
                >
                  补充带入
                </Button> </template
              ><Button
                v-if="actor.admin && !record.cleared && record.state.pending"
                type="link"
                :disabled="
                  dirty ||
                  !modelValue.revision ||
                  record.state.result.state === 'unknown'
                "
                @click="review(record as SourceLink)"
              >
                复核
              </Button>
            </template>
          </template>
        </Table>
        <Button type="link" @click="recordsOpen = true">查看关联记录</Button>
        <p v-if="dirty && actor.admin" class="rule-caption">
          先保存当前表单，再进行来源复核。移除关系后，尚保留的材料仍需追溯和复核。
        </p>
      </Section>
    </TabPane>
  </Tabs>
  <Modal
    :open="recordsOpen"
    :title="`${sourceNames[activeModule]}关联记录`"
    width="90vw"
    :style="{ top: '5vh' }"
    :body-style="{ maxHeight: '80vh', overflowY: 'auto' }"
    class="knowledge-page"
    :footer="null"
    :mask-closable="false"
    :keyboard="!(picker || viewer || removing || reviewing)"
    @cancel="
      !(picker || viewer || removing || reviewing) && (recordsOpen = false)
    "
  >
    <Section title="关联记录">
      <Table
        class="ims-child-table"
        bordered
        row-key="key"
        :columns="[
          { title: '来源名称', dataIndex: 'safeTitle', width: 240 },
          { title: '关系', key: 'relation', width: 160 },
          { title: '操作', key: 'actions', width: 300 },
        ]"
        :data-source="
          rows.filter((row) => row.selection.module === activeModule)
        "
        :pagination="{ pageSize: 5 }"
      >
        <template #expandedRowRender="{ record }">
          <Form v-if="record.visible" layout="vertical" class="ims-form-grid">
            <FormItem label="关联时间／关联人">
              <Input :value="record.safeLinkedAt" disabled />
            </FormItem>
            <FormItem label="选定范围">
              <Input
                :value="
                  record.scope?.join('、') ||
                  (record.selection.parts.length
                    ? '已选正文（历史名称未记录）'
                    : '仅关联对象')
                "
                disabled
              />
            </FormItem>
            <FormItem label="来源版本">
              <Input :value="record.version || '历史未记录'" disabled />
            </FormItem>
            <FormItem label="原作者／负责人及回复作者">
              <Input.TextArea :value="record.safeAuthor" disabled />
            </FormItem>
            <FormItem label="关系">
              <Input
                :value="record.removed ? '已移除（追溯）' : '有效关联'"
                disabled
              />
            </FormItem>
            <template v-if="actor.admin">
              <FormItem label="复核状态">
                <Input
                  :value="
                    record.cleared ? '已清理，无需复核' : record.state.label
                  "
                  disabled
                />
              </FormItem>
              <FormItem label="最近复核">
                <Input.TextArea
                  :value="
                    [
                      record.reviewNote || '尚未复核',
                      record.reviewedAt
                        ? `${nameOf(record.reviewerId)} · ${record.reviewedAt}`
                        : '',
                    ]
                      .filter(Boolean)
                      .join('\n')
                  "
                  disabled
                />
              </FormItem>
            </template>
          </Form>
          <span v-else>来源不可访问</span>
        </template>
        <template #bodyCell="{ column, record }">
          <span v-if="column.key === 'relation' && record.visible">{{
            record.cleared
              ? '已清理（追溯）'
              : record.removed
                ? '已移除（追溯）'
                : '有效关联'
          }}</span>
          <template v-if="column.key === 'actions'">
            <Button
              v-if="record.state.result.state === 'ok'"
              type="link"
              @click="viewer = record.selection"
            >
              查看来源 </Button
            ><span v-else-if="!actor.admin">来源不可访问</span
            ><template v-if="editable">
              <Button
                v-if="record.state.result.state === 'ok'"
                type="link"
                :disabled="blocked"
                @click="pick(record as SourceLink)"
              >
                补充带入
              </Button> </template
            ><Button
              v-if="editable && record.removed && !record.cleared"
              type="link"
              danger
              :disabled="blocked"
              @click="removing = record as SourceLink"
            >
              清理遗留材料
            </Button>
            <Button
              v-if="actor.admin && !record.cleared && record.state.pending"
              type="link"
              :disabled="
                dirty ||
                !modelValue.revision ||
                record.state.result.state === 'unknown'
              "
              @click="review(record as SourceLink)"
            >
              复核
            </Button>
          </template>
        </template>
      </Table>
    </Section>
  </Modal>
  <SourcePicker
    v-if="picker"
    :actor="actor"
    :target="modelValue"
    :initial-selection="initial"
    :fixed-module="pickerModule"
    :direct-link="!!pickerModule"
    @close="picker = false"
    @apply="apply"
  />
  <SourceViewer
    v-if="viewer"
    :selection="viewer"
    :actor="actor"
    @close="viewer = undefined"
  />
  <Modal
    :open="!!removing"
    title="清理遗留材料"
    :footer="null"
    :mask-closable="false"
    @cancel="removing = undefined"
  >
    <Section title="材料处理">
      <p>
        移除关系不会自动删除带入资料。清理会清空该来源曾带入的整个字段（含后续人工修改）和附件副本，请先核对。
      </p>
      <p>
        涉及字段：{{ removing?.fields.join('、') || '无' }}；附件：{{
          modelValue.attachments
            .filter((f) => f.origin?.key === removing?.key)
            .map((f) => f.name)
            .join('、') || '无'
        }}。
      </p>
      <div class="ims-toolbar">
        <Button @click="removing = undefined">取消</Button
        ><Button danger @click="remove(true)">确认清理材料</Button>
      </div>
    </Section>
  </Modal>
  <Modal
    :open="!!reviewing"
    title="来源复核"
    :footer="null"
    :mask-closable="false"
    @cancel="closeReview"
  >
    <Section title="复核信息">
      <Form layout="vertical">
        <FormItem label="来源名称">
          <Input :value="reviewing?.title" disabled /> </FormItem
        ><FormItem label="处理方式">
          <Input value="确认继续保留当前知识内容及副本" disabled /> </FormItem
        ><FormItem label="当前来源情况">
          <Input
            :value="
              reviewing
                ? sourceState(reviewing, actor, data).result.state === 'ok'
                  ? '来源当前可访问，请核对变化后填写意见'
                  : '当前不可访问原文，仅确认保留已发布的独立知识内容'
                : ''
            "
            disabled
          /> </FormItem
        ><FormItem label="复核意见" required>
          <Input.TextArea v-model:value="note" :rows="4" />
        </FormItem>
      </Form>
      <p>
        若需修改知识，请取消复核，先下架后修改。暂时无法核对的来源不能确认；未首次发布的失效来源不能通过复核绕过发布检查。
      </p>
      <Button type="primary" :disabled="!note.trim()" @click="confirmReview">
        确认保留
      </Button>
    </Section>
  </Modal>
</template>
