<script setup lang="ts">
import type { Knowledge } from './model';

import { computed, reactive, ref, watch } from 'vue';

import { useAccessStore } from '@vben/stores';

import {
  Alert,
  Button,
  DatePicker,
  Input,
  Select,
  Table,
  TabPane,
  Tabs,
  Tag,
} from 'ant-design-vue';

import { $t } from '#/locales';

import KnowledgeDialog from './KnowledgeDialog.vue';
import {
  categories,
  copy,
  deleteKnowledge,
  emptyFilters,
  freshKnowledge,
  nameOf,
  people,
  searchKnowledge,
  states,
  types,
} from './model';
import { referenceStatus } from './references';
import Section from './Section.vue';
import { useSourceData } from './source-state';
import { sourceNames } from './source-types';
import SourcePicker from './SourcePicker.vue';
import { useKnowledge } from './store';
import { ask, perform } from './ui';

import './ims.css';
const props = defineProps<{ view: 'manage' | 'search' }>();
const picker = ref(false);
const deleting = ref(false);
const sources = useSourceData();
const { items, actor, actorId, switchActor, refresh, reset, warning, commit } =
  useKnowledge();
useKnowledge().audit?.();
const accessStore = useAccessStore();
watch(
  () => [actor.value.admin, accessStore.accessMenus],
  () => {
    const group = accessStore.accessMenus.find((m) => m.path === '/knowledge');
    if (
      !group ||
      !!group.children?.some((m) => m.path === '/knowledge/manage') ===
        !!actor.value.admin
    )
      return;
    const children = (group.children ?? []).filter(
      (m) => m.path !== '/knowledge/manage',
    );
    if (actor.value.admin)
      children.push({
        path: '/knowledge/manage',
        name: $t('knowledge.manage'),
        icon: 'lucide:library',
      });
    accessStore.setAccessMenus(
      accessStore.accessMenus.map((m) =>
        m === group ? { ...m, children } : m,
      ),
    );
  },
  { immediate: true },
);
const applied = ref(emptyFilters());
const filters = reactive(emptyFilters());
const selectedType = ref('');
const detail = ref<Knowledge>();
const page = ref(1);
const pageSize = ref(10);
const rows = computed(() =>
  searchKnowledge(
    items.value,
    actor.value,
    props.view,
    {
      ...applied.value,
      type: selectedType.value,
    },
    sources.data.value,
  ),
);
const options = (v: string[]) => [
  { value: '', label: '全部' },
  ...v.map((s) => ({ value: s, label: s })),
];
const columns = computed(() => [
  { title: '编号', dataIndex: 'code', width: 180 },
  { title: '标题', dataIndex: 'title', width: 260 },
  { title: '知识类型', dataIndex: 'type', width: 100 },
  { title: '专业分类', dataIndex: 'category', width: 110 },
  { title: '摘要', dataIndex: 'summary', width: 300, ellipsis: true },
  { title: '整理人', key: 'curator', width: 110 },
  { title: '最近发布时间', dataIndex: 'publishedAt', width: 180 },
  ...(props.view === 'manage'
    ? [
        { title: '状态', key: 'status', width: 110 },
        { title: '来源复核', key: 'sourceReview', width: 130 },
      ]
    : []),
  {
    title: '操作',
    key: 'actions',
    width: props.view === 'manage' ? 160 : 100,
    fixed: 'right' as const,
  },
]);
function query() {
  applied.value = { ...filters };
  page.value = 1;
}
function clear() {
  Object.assign(filters, emptyFilters());
  selectedType.value = '';
  query();
}
function open(v?: Knowledge) {
  detail.value = v ? copy(v) : freshKnowledge(actor.value);
}
async function remove(v: Knowledge) {
  if (deleting.value || props.view !== 'manage' || !actor.value.admin) return;
  deleting.value = true;
  try {
    if (
      !(await ask(
        `删除草稿知识“${v.title}”？`,
        '将删除本条草稿及其知识附件、关联记录，不影响交流、课题、竞赛的原始资料。',
      ))
    )
      return;
    if (
      perform(
        () =>
          commit((all) => deleteKnowledge(all, actor.value, v.id, v.revision)),
        '草稿知识已删除。',
      )
    ) {
      page.value = Math.min(
        page.value,
        Math.max(1, Math.ceil(rows.value.length / pageSize.value)),
      );
    }
  } finally {
    deleting.value = false;
  }
}
function imported(v: Knowledge) {
  picker.value = false;
  detail.value = v;
}
function reload() {
  refresh();
  sources.refresh();
}
async function restore() {
  if (
    await ask(
      '重置知识库演示数据？',
      '将恢复本模块初始资料并清除本模块新增知识和附件，不影响交流、课题及竞赛。',
    )
  )
    perform(reset);
}
watch(() => props.view, clear);
watch(actorId, clear);
watch(selectedType, () => {
  page.value = 1;
});
</script>
<template>
  <div class="knowledge-page">
    <div class="demo-bar">
      <div>
        <Tag color="blue">原型演示</Tag>创新成果知识库 · 虚构数据，本浏览器保存
      </div>
      <div class="demo-controls">
        <span>演示身份</span
        ><Select
          aria-label="知识库演示身份"
          :value="actorId"
          :disabled="!!detail || picker || deleting"
          style="width: 260px"
          :options="
            people.map((p) => ({
              value: p.id,
              label: `${p.admin ? '知识管理员' : '员工'} · ${p.name} · ${p.department}`,
            }))
          "
          @change="(v) => switchActor(String(v))"
        /><Button
          type="link"
          :disabled="!!detail || picker || deleting"
          @click="restore"
        >
          重置演示
        </Button>
      </div>
    </div>
    <Alert v-if="warning" :message="warning" type="warning" show-icon />
    <main class="ims-surface">
      <div class="ims-body">
        <Alert
          v-if="view === 'manage' && !actor.admin"
          type="info"
          message="知识管理仅供知识管理员使用，请从知识检索查阅已发布资料。"
        />
        <template v-else>
          <Tabs v-model:active-key="selectedType">
            <TabPane key="" tab="全部" /><TabPane
              v-for="type in types"
              :key="type"
              :tab="type"
            />
          </Tabs>
          <Section title="筛选条件">
            <div class="ims-search-grid">
              <div class="search-field">
                <label>编号</label
                ><Input v-model:value="filters.code" placeholder="请输入编号" />
              </div>
              <div class="search-field">
                <label>搜索词</label
                ><Input
                  v-model:value="filters.query"
                  placeholder="标题、摘要、关键词、正文"
                  @press-enter="query"
                />
              </div>
              <div class="search-field">
                <label>专业分类</label
                ><Select
                  v-model:value="filters.category"
                  :options="options(categories)"
                />
              </div>
              <div class="search-field">
                <label>整理人</label
                ><Select
                  v-model:value="filters.curatorId"
                  :options="[
                    { value: '', label: '全部' },
                    ...people
                      .filter((p) => p.admin)
                      .map((p) => ({ value: p.id, label: p.name })),
                  ]"
                />
              </div>
              <div class="search-field">
                <label>发布起日</label
                ><DatePicker
                  v-model:value="filters.from"
                  value-format="YYYY-MM-DD"
                />
              </div>
              <div class="search-field">
                <label>发布止日</label
                ><DatePicker
                  v-model:value="filters.to"
                  value-format="YYYY-MM-DD"
                />
              </div>
              <div v-if="view === 'manage'" class="search-field">
                <label>内容状态</label
                ><Select
                  v-model:value="filters.status"
                  :options="options(states)"
                />
              </div>
              <div v-if="view === 'manage'" class="search-field">
                <label>来源模块</label
                ><Select
                  v-model:value="filters.sourceModule"
                  :options="[
                    { value: '', label: '全部' },
                    { value: 'none', label: '无关联来源' },
                    ...Object.entries(sourceNames).map(([value, label]) => ({
                      value,
                      label,
                    })),
                  ]"
                />
              </div>
              <div v-if="view === 'manage'" class="search-field">
                <label>来源复核</label
                ><Select
                  v-model:value="filters.sourceReview"
                  :options="
                    options(['待复核', '已核对', '暂无法核对', '无关联来源'])
                  "
                />
              </div>
            </div>
            <div class="query-actions">
              <Button type="primary" @click="query">查询</Button
              ><Button @click="clear">重置</Button>
            </div>
          </Section>
          <div class="ims-toolbar">
            <Button
              v-if="view === 'manage' && actor.admin"
              type="primary"
              @click="open()"
            >
              ＋ 新增知识 </Button
            ><Button
              v-if="view === 'manage' && actor.admin"
              type="primary"
              @click="picker = true"
            >
              从已有资料整理 </Button
            ><Button type="primary" @click="reload">刷新</Button
            ><span class="knowledge-muted"
              >检索已录入内容，不检索附件正文。</span
            >
          </div>
          <Table
            class="ims-child-table"
            bordered
            row-key="id"
            :columns="columns"
            :data-source="rows"
            :scroll="{ x: view === 'manage' ? 1450 : 1340 }"
            :pagination="{
              current: page,
              pageSize,
              showSizeChanger: true,
              showTotal: (n: number) => `共 ${n} 条数据`,
              onChange: (p: number, s: number) => {
                page = p;
                pageSize = s;
              },
            }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'sourceReview'">
                {{
                  referenceStatus(
                    record as Knowledge,
                    actor,
                    sources.data.value,
                  )
                }} </template
              ><template v-if="column.key === 'curator'">
                {{ nameOf(record.curatorId) }} </template
              ><template v-if="column.key === 'status'">
                <Tag
                  :color="
                    record.status === '已发布'
                      ? 'blue'
                      : record.status === '已下架'
                        ? 'red'
                        : undefined
                  "
                >
                  {{ record.status }}
                </Tag> </template
              ><template v-if="column.key === 'actions'">
                <Button type="link" @click="open(record as Knowledge)">
                  明细 </Button
                ><Button
                  v-if="
                    view === 'manage' && actor.admin && record.status === '草稿'
                  "
                  type="link"
                  danger
                  :disabled="deleting"
                  @click="remove(record as Knowledge)"
                >
                  删除
                </Button>
              </template>
            </template>
          </Table>
        </template>
      </div>
    </main>
    <KnowledgeDialog
      v-if="detail"
      :initial="detail"
      @close="detail = undefined"
    />
    <SourcePicker
      v-if="picker"
      :actor="actor"
      @close="picker = false"
      @apply="imported"
      @open="imported"
    />
  </div>
</template>
