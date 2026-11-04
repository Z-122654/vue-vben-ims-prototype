<script setup lang="ts">
import type { Topic } from './model';

import { computed, reactive, ref, watch } from 'vue';

import { useAccessStore } from '@vben/stores';

import {
  Alert,
  Button,
  DatePicker,
  Input,
  Select,
  Table,
  Tag,
} from 'ant-design-vue';

import { $t } from '#/locales';

import {
  categories,
  copy,
  freshTopic,
  listTopics,
  nameOf,
  people,
  questionState,
  states,
  types,
} from './model';
import Section from './Section.vue';
import { useExchange } from './store';
import TopicDialog from './TopicDialog.vue';
import { ask, perform } from './ui';

import './ims.css';
const props = defineProps<{ view: 'center' | 'manage' | 'mine' }>();
const { topics, actor, actorId, switchActor, refresh, reset, warning } =
  useExchange();
const accessStore = useAccessStore();
watch(
  () => [actor.value.admin, accessStore.accessMenus],
  () => {
    const group = accessStore.accessMenus.find((m) => m.path === '/exchange');
    if (
      !group ||
      !!group.children?.some((m) => m.path === '/exchange/manage') ===
        !!actor.value.admin
    )
      return;
    const children = (group.children ?? []).filter(
      (m) => m.path !== '/exchange/manage',
    );
    if (actor.value.admin)
      children.push({
        path: '/exchange/manage',
        name: $t('exchange.manage'),
        icon: 'lucide:shield-check',
      });
    accessStore.setAccessMenus(
      accessStore.accessMenus.map((m) =>
        m === group ? { ...m, children } : m,
      ),
    );
  },
  { immediate: true },
);
const empty = () => ({
  code: '',
  title: '',
  type: '',
  category: '',
  author: '',
  department: '',
  from: '',
  to: '',
  status: '',
  question: '',
  relation: '',
});
const applied = ref(empty());
const filters = reactive(empty());
const page = ref(1);
const size = ref(10);
const detail = ref<Topic>();
const options = (items: string[]) => [
  { value: '', label: '全部' },
  ...items.map((v) => ({ value: v, label: v })),
];
const rows = computed(() =>
  listTopics(topics.value, actor.value, props.view, applied.value.relation)
    .filter((t) => {
      const f = applied.value;
      return (
        t.code.includes(f.code.trim()) &&
        t.title.includes(f.title.trim()) &&
        (!f.type || t.type === f.type) &&
        (!f.category || t.category === f.category) &&
        (!f.author || t.authorId === f.author) &&
        (!f.department || t.department === f.department) &&
        (!f.status || t.status === f.status) &&
        (!f.question || questionState(t) === f.question) &&
        (!f.from || t.firstPublishedAt.slice(0, 10) >= f.from) &&
        (!f.to ||
          (!!t.firstPublishedAt && t.firstPublishedAt.slice(0, 10) <= f.to))
      );
    })
    .sort(
      (a, b) =>
        lastTime(b).localeCompare(lastTime(a)) || a.code.localeCompare(b.code),
    ),
);
function lastTime(t: Topic) {
  return (
    t.replies.filter((r) => r.status === '有效').at(-1)?.time ||
    t.firstPublishedAt ||
    t.updatedAt
  );
}
const columns = [
  { title: '编号', dataIndex: 'code', width: 170 },
  { title: '标题', dataIndex: 'title', width: 280 },
  { title: '交流类型', dataIndex: 'type', width: 120 },
  { title: '专业分类', dataIndex: 'category', width: 110 },
  { title: '发布人', key: 'author', width: 100 },
  { title: '部门', dataIndex: 'department', width: 120 },
  { title: '首次发布时间', dataIndex: 'firstPublishedAt', width: 180 },
  { title: '状态', key: 'status', width: 110 },
  { title: '问题状态', key: 'question', width: 110 },
  { title: '回复数', key: 'count', width: 90 },
  { title: '最近回复时间', key: 'last', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 100 },
];
function query() {
  applied.value = { ...filters };
  page.value = 1;
}
function clear() {
  Object.assign(filters, empty());
  query();
}
function open(t?: Topic) {
  detail.value = t ? copy(t) : freshTopic(actor.value);
}
async function restore() {
  if (
    await ask(
      '重置交流演示数据？',
      '仅恢复本模块示例，将清除本模块新增主题、回复和附件；不影响课题及竞赛。',
    )
  )
    perform(reset);
}
watch(() => props.view, clear);
watch(actorId, clear);
</script>
<template>
  <div class="exchange-page">
    <div class="demo-bar">
      <div>
        <Tag color="blue">原型演示</Tag>技术交流研讨 · 虚构数据，本浏览器保存
      </div>
      <div class="demo-controls">
        <span>演示身份</span
        ><Select
          aria-label="交流演示身份"
          :value="actorId"
          :disabled="!!detail"
          style="width: 240px"
          :options="
            people.map((p) => ({
              value: p.id,
              label: `${p.admin ? '管理员' : '员工'} · ${p.name} · ${p.department}`,
            }))
          "
          @change="(v) => switchActor(String(v))"
        /><Button type="link" :disabled="!!detail" @click="restore">
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
          message="交流管理仅供管理员使用，请进入交流中心或我的交流。"
        />
        <template v-else>
          <Section title="筛选条件">
            <div class="ims-search-grid">
              <div class="search-field">
                <label>编号</label
                ><Input v-model:value="filters.code" placeholder="请输入编号" />
              </div>
              <div class="search-field">
                <label>标题</label
                ><Input
                  v-model:value="filters.title"
                  placeholder="请输入标题"
                />
              </div>
              <div class="search-field">
                <label>交流类型</label
                ><Select
                  v-model:value="filters.type"
                  :options="options(types)"
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
                <label>发布人</label
                ><Select
                  v-model:value="filters.author"
                  :options="[
                    { value: '', label: '全部' },
                    ...people.map((p) => ({ value: p.id, label: p.name })),
                  ]"
                />
              </div>
              <div class="search-field">
                <label>部门</label
                ><Select
                  v-model:value="filters.department"
                  :options="
                    options([...new Set(people.map((p) => p.department))])
                  "
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
              <div class="search-field">
                <label>问题状态</label
                ><Select
                  v-model:value="filters.question"
                  :options="options(['待解决', '已解决'])"
                />
              </div>
              <div v-if="view !== 'center'" class="search-field">
                <label>内容状态</label
                ><Select
                  v-model:value="filters.status"
                  :options="options(states)"
                />
              </div>
              <div v-if="view === 'mine'" class="search-field">
                <label>我的关系</label
                ><Select
                  v-model:value="filters.relation"
                  :options="[
                    { value: '', label: '全部' },
                    { value: 'own', label: '我发布的' },
                    { value: 'joined', label: '我参与的' },
                  ]"
                />
              </div>
            </div>
            <div class="query-actions">
              <Button type="primary" @click="query">查询</Button
              ><Button @click="clear">重置</Button>
            </div>
          </Section>
          <div class="ims-toolbar">
            <Button v-if="view === 'mine'" type="primary" @click="open()">
              ＋ 新增交流 </Button
            ><Button type="primary" @click="refresh">刷新</Button>
          </div>
          <Table
            class="ims-child-table"
            bordered
            row-key="id"
            :columns="columns"
            :data-source="rows"
            :scroll="{ x: 1650 }"
            :pagination="{
              current: page,
              pageSize: size,
              showSizeChanger: true,
              showTotal: (n: number) => `共 ${n} 条数据`,
              onChange: (p: number, s: number) => {
                page = p;
                size = s;
              },
            }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'author'">
                {{ nameOf(record.authorId) }} </template
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
              ><template v-if="column.key === 'question'">
                {{ questionState(record as Topic) }} </template
              ><template v-if="column.key === 'count'">
                {{
                  record.replies.filter((r: any) => r.status === '有效').length
                }} </template
              ><template v-if="column.key === 'last'">
                {{
                  record.replies.filter((r: any) => r.status === '有效').at(-1)
                    ?.time || '—'
                }} </template
              ><template v-if="column.key === 'actions'">
                <Button type="link" @click="open(record as Topic)">
                  明细
                </Button>
              </template>
            </template>
          </Table>
        </template>
      </div>
    </main>
    <TopicDialog v-if="detail" :initial="detail" @close="detail = undefined" />
  </div>
</template>
