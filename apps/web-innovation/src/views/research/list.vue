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
  canReview,
  canView,
  categories,
  copy,
  freshTopic,
  hasSubmitted,
  nameOf,
  overdue,
  participant,
  people,
  person,
  removeTopic,
  states,
} from './model';
import Section from './Section.vue';
import { useResearch } from './store';
import TopicDialog from './TopicDialog.vue';
import { ask, exportCsv, perform } from './ui';

import './ims.css';
const props = defineProps<{ view: 'manage' | 'mine' }>();
const { topics, actor, actorId, switchActor, commit, reset, refresh, warning } =
  useResearch();
const accessStore = useAccessStore();
watch(
  () => [actor.value.admin, accessStore.accessMenus],
  () => {
    const group = accessStore.accessMenus.find((m) => m.path === '/research');
    if (!group) return;
    const has = group.children?.some((m) => m.path === '/research/manage');
    if (!!has === !!actor.value.admin) return;
    const children = (group.children ?? []).filter(
      (m) => m.path !== '/research/manage',
    );
    if (actor.value.admin)
      children.unshift({
        path: '/research/manage',
        name: $t('research.manage'),
        icon: 'lucide:folder-kanban',
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
  name: '',
  category: '',
  department: '',
  leader: '',
  status: '',
  from: '',
  to: '',
  relation: '',
});
const filters = reactive(empty());
const applied = ref(empty());
const page = ref(1);
const pageSize = ref(10);
const detail = ref<Topic>();
const initialTab = ref('info');
const access = computed(() => props.view === 'mine' || !!actor.value.admin);
const rows = computed(() =>
  topics.value
    .filter(
      (t) =>
        canView(t, actor.value) &&
        (props.view === 'manage'
          ? !!actor.value.admin
          : t.ownerId === actor.value.id || participant(t, actor.value)),
    )
    .filter((t) => {
      const f = applied.value;
      return (
        t.code.includes(f.code.trim()) &&
        t.name.includes(f.name.trim()) &&
        (!f.category || t.category === f.category) &&
        (!f.department || person(t.leaderId)?.department === f.department) &&
        (!f.leader || t.leaderId === f.leader) &&
        (!f.status || t.status === f.status) &&
        (!f.from || t.end >= f.from) &&
        (!f.to || t.end <= f.to) &&
        (!f.relation ||
          (f.relation === 'leader'
            ? t.leaderId === actor.value.id
            : f.relation === 'owner'
              ? t.ownerId === actor.value.id
              : t.members.some((m) => m.personId === actor.value.id)))
      );
    })
    .sort(
      (a, b) =>
        b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id),
    ),
);
const cols = [
  { title: '课题编号', dataIndex: 'code', width: 190 },
  { title: '课题名称', dataIndex: 'name', width: 270 },
  { title: '课题类别', dataIndex: 'category', width: 120 },
  { title: '负责人', key: 'leader', width: 100 },
  { title: '负责部门', key: 'department', width: 120 },
  { title: '计划完成', key: 'end', width: 145 },
  { title: '完成任务／总数', key: 'tasks', width: 130 },
  { title: '状态', key: 'status', width: 110 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 210 },
];
function open(t?: Topic, tab = 'info') {
  initialTab.value = tab;
  detail.value = t ? copy(t) : freshTopic(actor.value);
}
async function remove(t: Topic) {
  if (
    await ask(
      '删除课题草稿？',
      '仅删除此课题草稿及其未提交资料，不影响其他模块。',
    )
  )
    perform(() =>
      commit((all) => removeTopic(all, actor.value, t.id, t.revision)),
    );
}
async function restore() {
  if (
    await ask(
      '重置课题演示数据？',
      '将清除本模块新增数据和附件，恢复七种状态示例；不影响竞赛模块。',
    )
  )
    perform(reset);
}
function query() {
  applied.value = { ...filters };
  page.value = 1;
}
function clear() {
  Object.assign(filters, empty());
  query();
}
function exportRows() {
  exportCsv(
    rows.value.map((t) => ({
      ...t,
      leader: nameOf(t.leaderId),
      department: person(t.leaderId)?.department,
      done: t.tasks.filter((v) => v.status === '已完成').length,
      total: t.tasks.length,
    })),
    [
      { field: 'code', title: '课题编号' },
      { field: 'name', title: '课题名称' },
      { field: 'category', title: '课题类别' },
      { field: 'leader', title: '负责人' },
      { field: 'department', title: '负责部门' },
      { field: 'status', title: '状态' },
      { field: 'start', title: '计划开始' },
      { field: 'end', title: '计划完成' },
      { field: 'approvedAt', title: '实际立项' },
      { field: 'closedAt', title: '实际结题' },
      { field: 'done', title: '完成任务数' },
      { field: 'total', title: '任务总数' },
    ],
    '创新课题攻关',
  );
}
watch(() => props.view, clear);
watch(actorId, clear);
</script>
<template>
  <div class="research-page">
    <div class="demo-bar">
      <div>
        <Tag color="blue">原型演示</Tag>创新课题攻关 · 虚构数据，本浏览器保存
      </div>
      <div class="demo-controls">
        <span>演示身份</span
        ><Select
          aria-label="课题演示身份"
          :value="actorId"
          :disabled="!!detail"
          style="width: 230px"
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
          v-if="!access"
          type="info"
          message="课题管理与审核仅供业务管理员使用。请从“我的课题”查看本人相关课题，或切换演示身份。"
        /><template v-else>
          <Section title="筛选条件">
            <div class="ims-search-grid">
              <div class="search-field">
                <label>编号</label
                ><Input v-model:value="filters.code" placeholder="请输入" />
              </div>
              <div class="search-field">
                <label>课题名称</label
                ><Input v-model:value="filters.name" placeholder="请输入" />
              </div>
              <div class="search-field">
                <label>课题类别</label
                ><Select
                  v-model:value="filters.category"
                  :options="[
                    { value: '', label: '全部' },
                    ...categories.map((v) => ({ value: v, label: v })),
                  ]"
                />
              </div>
              <div class="search-field">
                <label>状态</label
                ><Select
                  v-model:value="filters.status"
                  :options="[
                    { value: '', label: '全部' },
                    ...states.map((v) => ({ value: v, label: v })),
                  ]"
                />
              </div>
              <div class="search-field">
                <label>负责人</label
                ><Select
                  v-model:value="filters.leader"
                  :options="[
                    { value: '', label: '全部' },
                    ...people.map((v) => ({ value: v.id, label: v.name })),
                  ]"
                />
              </div>
              <div class="search-field">
                <label>负责部门</label
                ><Select
                  v-model:value="filters.department"
                  :options="[
                    { value: '', label: '全部' },
                    ...Array.from(new Set(people.map((p) => p.department))).map(
                      (v) => ({ value: v, label: v }),
                    ),
                  ]"
                />
              </div>
              <div class="search-field">
                <label>计划完成起</label
                ><DatePicker
                  v-model:value="filters.from"
                  value-format="YYYY-MM-DD"
                />
              </div>
              <div class="search-field">
                <label>计划完成止</label
                ><DatePicker
                  v-model:value="filters.to"
                  value-format="YYYY-MM-DD"
                />
              </div>
              <div v-if="view === 'mine'" class="search-field">
                <label>参与关系</label
                ><Select
                  v-model:value="filters.relation"
                  :options="[
                    { value: '', label: '全部' },
                    { value: 'leader', label: '我负责' },
                    { value: 'member', label: '我参与' },
                    { value: 'owner', label: '我填报' },
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
              ＋ 新增课题 </Button
            ><Button type="primary" @click="exportRows">导出</Button
            ><Button type="primary" @click="refresh">刷新</Button>
          </div>
          <Table
            class="ims-child-table"
            bordered
            row-key="id"
            :columns="cols"
            :data-source="rows"
            :scroll="{ x: 1400 }"
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
              <template v-if="column.key === 'leader'">
                {{ nameOf(record.leaderId) }} </template
              ><template v-if="column.key === 'department'">
                {{ person(record.leaderId)?.department }} </template
              ><template v-if="column.key === 'end'">
                {{ record.end || '—'
                }}<Tag
                  v-if="
                    overdue(
                      record.end,
                      ['已结题', '已终止'].includes(record.status),
                    )
                  "
                  color="orange"
                >
                  逾期
                </Tag> </template
              ><template v-if="column.key === 'tasks'">
                {{
                  record.tasks.length
                    ? `${record.tasks.filter((v: any) => v.status === '已完成').length} / ${record.tasks.length}`
                    : '尚未制定计划'
                }} </template
              ><template v-if="column.key === 'status'">
                <Tag
                  :color="
                    record.status === '已结题'
                      ? 'green'
                      : record.status === '已终止'
                        ? 'red'
                        : record.status === '立项退回'
                          ? 'orange'
                          : 'blue'
                  "
                >
                  {{ record.status }}
                </Tag> </template
              ><template v-if="column.key === 'actions'">
                <Button type="link" @click="open(record as Topic)">明细</Button
                ><Button
                  v-if="canReview(record as Topic, actor)"
                  type="link"
                  @click="
                    open(
                      record as Topic,
                      record.status === '待结题' ? 'closure' : 'info',
                    )
                  "
                >
                  {{
                    record.status === '待立项' ? '立项处理' : '结题处理'
                  }} </Button
                ><Button
                  v-if="
                    record.status === '草稿' &&
                    record.ownerId === actor.id &&
                    !hasSubmitted(record as Topic)
                  "
                  type="link"
                  danger
                  @click="remove(record as Topic)"
                >
                  删除
                </Button>
              </template>
            </template>
          </Table>
        </template>
      </div>
    </main>
    <TopicDialog
      v-if="detail"
      :initial="detail"
      :initial-tab="initialTab"
      @close="detail = undefined"
    />
  </div>
</template>
