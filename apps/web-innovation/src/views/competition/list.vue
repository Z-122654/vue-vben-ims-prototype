<script setup lang="ts">
import type { Column } from './components/ImsTable.vue';

import { computed, reactive, ref, watch } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router';

import {
  ChevronDown,
  ArrowUp as ChevronUp,
  Download,
  Plus,
  RotateCw as RefreshCw,
  Undo2 as RotateCcw,
  Search,
} from '@vben/icons';

import { Button, Input, Select, Space, Tag } from 'ant-design-vue';

import { $t } from '#/locales';

import CompetitionFrame from './components/CompetitionFrame.vue';
import DetailDialog from './components/DetailDialog.vue';
import ImsSection from './components/ImsSection.vue';
import ImsTable from './components/ImsTable.vue';
import { createDetailStack } from './detail-dialog';
import {
  activityStates,
  canApply,
  canDeleteEntry,
  canManageActivity,
  canSeeActivity,
  countedEntry,
  currentPublication,
  deleteDraft,
  departments,
  entryStates,
  entrySubmissionTime,
  isActivityExpert,
  projectLeader,
  reviewOverdue,
} from './model';
import { useCompetition } from './store';
import { confirmAction, exportCsv, statusColor } from './ui';

const props = defineProps<{
  view: 'activities' | 'entries' | 'results' | 'reviews';
}>();
const { data, actor } = useCompetition();
const route = useRoute();
const dialogs = createDetailStack();
const { panels } = dialogs;
onBeforeRouteLeave(() => dialogs.closeAll());
onBeforeRouteUpdate(() => dialogs.closeAll());
watch(
  () => [route.query.detail, route.query.id, route.query.activity],
  ([kind, id, activityId]) => {
    if (
      (kind === 'activity' ||
        kind === 'entry' ||
        kind === 'review' ||
        kind === 'result') &&
      typeof id === 'string'
    ) {
      void dialogs.open({
        kind,
        id,
        activityId: typeof activityId === 'string' ? activityId : undefined,
      });
    }
  },
  { immediate: true },
);
const collapsed = ref(false);
const loading = ref(false);
const filters = reactive({
  code: '',
  name: '',
  activity: '',
  status: '',
  department: '',
});
const applied = ref({ ...filters });
const table = ref<InstanceType<typeof ImsTable>>();
const title = computed(() => $t(`competition.${props.view}`));
const states = computed(() =>
  props.view === 'activities'
    ? activityStates
    : props.view === 'entries'
      ? entryStates
      : props.view === 'reviews'
        ? ['待评审', '评分暂存', '已提交']
        : ['已公示', '已结束'],
);
const activityOptions = computed(() =>
  data.value.activities
    .filter((a) => canSeeActivity(data.value, a, actor.value))
    .map((a) => ({ label: a.name, value: a.id })),
);
const rows = computed(() => {
  let result: Record<string, any>[];
  if (props.view === 'activities')
    result = data.value.activities
      .filter((a) => canSeeActivity(data.value, a, actor.value))
      .map((a) => ({
        ...a,
        entryCount: data.value.entries.filter(
          (e) => e.activityId === a.id && countedEntry(e),
        ).length,
        approvedCount: data.value.entries.filter(
          (e) => e.activityId === a.id && e.status === '审核通过',
        ).length,
        canDelete:
          canManageActivity(a, actor.value) &&
          a.status === '草稿' &&
          !data.value.entries.some((e) => e.activityId === a.id),
      }));
  else if (props.view === 'entries')
    result = data.value.entries
      .filter((e) => e.ownerId === actor.value.id)
      .map((e) => ({
        ...e,
        activityName: data.value.activities.find((a) => a.id === e.activityId)
          ?.name,
        applicant: projectLeader(e)?.name ?? '—',
        department: projectLeader(e)?.department ?? '—',
        submittedAt: entrySubmissionTime(e),
        canDelete: canDeleteEntry(
          e,
          actor.value,
          data.value.activities.find((a) => a.id === e.activityId)!,
        ),
      }));
  else if (props.view === 'reviews')
    result = data.value.reviews
      .filter((r) => r.expertId === actor.value.id)
      .map((r) => {
        const entry = data.value.entries.find((e) => e.id === r.entryId)!;
        const activity = data.value.activities.find(
          (a) => a.id === entry.activityId,
        )!;
        return {
          ...r,
          code: entry.code,
          name: entry.name,
          activityId: activity.id,
          activityName: activity.name,
          deadline: activity.reviewEnd,
          overdue:
            reviewOverdue(activity) && r.status !== '已提交' ? '已逾期' : '—',
          applicant: projectLeader(entry)?.name ?? '—',
        };
      });
  else
    result = data.value.activities
      .filter((a) => ['已公示', '已结束'].includes(a.status))
      .map((a) => ({
        ...a,
        name: currentPublication(a)?.title ?? a.noticeTitle,
        activityName: a.name,
        noticeDate: currentPublication(a)?.noticeDate ?? a.noticeDate,
        awardCount: currentPublication(a)?.winners.length ?? 0,
      }));
  return result.filter(
    (row) =>
      (!applied.value.code || row.code.includes(applied.value.code)) &&
      (!applied.value.name || row.name.includes(applied.value.name)) &&
      (!applied.value.activity || row.activityId === applied.value.activity) &&
      (!applied.value.department ||
        row.department === applied.value.department) &&
      (!applied.value.status || row.status === applied.value.status),
  );
});
const columns = computed<Column[]>(() => {
  const start: Column[] = [
    { field: 'code', title: '编号', width: 165 },
    {
      field: 'name',
      title:
        props.view === 'activities'
          ? '活动名称'
          : props.view === 'results'
            ? '公示标题'
            : '项目名称',
      minWidth: 270,
    },
  ];
  if (props.view === 'activities')
    start.push(
      { field: 'type', title: '活动类型', width: 145 },
      { field: 'department', title: '组织单位', width: 140 },
      { field: 'deadline', title: '报名截止日期', width: 155 },
      { field: 'entryCount', title: '申报数量', width: 110 },
      { field: 'approvedCount', title: '审核通过数', width: 120 },
    );
  else if (props.view === 'entries')
    start.push(
      { field: 'activityName', title: '所属活动', minWidth: 240 },
      { field: 'category', title: '项目类别', width: 180 },
      { field: 'applicant', title: '项目负责人', width: 120 },
      { field: 'department', title: '部门', width: 120 },
      { field: 'submittedAt', title: '最近提交时间', width: 180 },
    );
  else if (props.view === 'reviews')
    start.push(
      { field: 'activityName', title: '所属活动', minWidth: 240 },
      { field: 'applicant', title: '项目负责人', width: 110 },
      { field: 'deadline', title: '计划评审截止', width: 155 },
      { field: 'overdue', title: '进度提醒', width: 110 },
    );
  else
    start.push(
      { field: 'activityName', title: '活动名称', minWidth: 270 },
      { field: 'department', title: '组织单位', width: 140 },
      { field: 'noticeDate', title: '公示日期', width: 140 },
      { field: 'awardCount', title: '获奖作品数', width: 120 },
    );
  start.push(
    { field: 'status', title: '状态', width: 130, slot: 'status' },
    {
      field: 'actions',
      title: '操作',
      width: props.view === 'activities' ? 230 : 180,
      slot: 'actions',
    },
  );
  return start;
});
function details(id: string) {
  const type =
    props.view === 'activities'
      ? 'activity'
      : props.view === 'entries'
        ? 'entry'
        : props.view === 'reviews'
          ? 'review'
          : 'result';
  void dialogs.open({ kind: type, id });
}
function query() {
  applied.value = { ...filters };
}
function expertBlocksApplication(id: string) {
  const activity = data.value.activities.find((item) => item.id === id);
  return !!activity && isActivityExpert(activity, actor.value);
}
function applyEnabled(id: string) {
  const activity = data.value.activities.find((a) => a.id === id);
  return activity && canApply(activity, actor.value);
}
function reset() {
  Object.assign(filters, {
    code: '',
    name: '',
    activity: '',
    status: '',
    department: '',
  });
  query();
  table.value?.clear();
}
async function refresh() {
  loading.value = true;
  await new Promise((resolve) => setTimeout(resolve, 250));
  query();
  loading.value = false;
}
watch(() => props.view, reset);
watch(() => actor.value.id, reset);
</script>
<template>
  <CompetitionFrame>
    <div class="ims-body">
      <ImsSection v-show="!collapsed" title="筛选条件">
        <div class="ims-search-grid">
          <div class="search-field">
            <label>编号：</label
            ><Input
              v-model:value="filters.code"
              placeholder="请输入"
              allow-clear
              @press-enter="query"
            />
          </div>
          <div class="search-field">
            <label
              >{{
                view === 'activities'
                  ? '活动名称'
                  : view === 'results'
                    ? '公示标题'
                    : '项目名称'
              }}：</label
            ><Input
              v-model:value="filters.name"
              placeholder="请输入"
              allow-clear
              @press-enter="query"
            />
          </div>
          <div
            v-if="view === 'entries' || view === 'reviews'"
            class="search-field"
          >
            <label>所属活动：</label
            ><Select
              v-model:value="filters.activity"
              :options="activityOptions"
              placeholder="请选择"
              allow-clear
            />
          </div>
          <div v-else class="search-field">
            <label>组织单位：</label
            ><Select
              v-model:value="filters.department"
              :options="
                departments.map((name) => ({ label: name, value: name }))
              "
              placeholder="请选择"
              allow-clear
            />
          </div>
          <div class="search-field">
            <label>状态：</label
            ><Select
              v-model:value="filters.status"
              :options="states.map((value) => ({ label: value, value }))"
              placeholder="请选择"
              allow-clear
            />
          </div>
        </div>
        <div class="query-actions">
          <Button type="primary" @click="query">
            <Search :size="16" />查询 </Button
          ><Button @click="reset"><RotateCcw :size="15" />重置</Button>
        </div>
      </ImsSection>
      <div class="ims-toolbar">
        <Button
          v-if="view === 'activities' && actor.role === 'admin'"
          type="primary"
          @click="dialogs.open({ kind: 'activity', id: 'new' })"
        >
          <Plus :size="17" />新增活动
        </Button>

        <Button
          type="primary"
          @click="
            exportCsv(
              table?.filtered ?? rows,
              [
                ...columns.filter((c) => c.field !== 'actions'),
                ...(view === 'entries'
                  ? [
                      { field: 'summary', title: '项目简介' },
                      { field: 'achievements', title: '获得成果／专利' },
                      { field: 'firstSubmittedAt', title: '首次提交时间' },
                      { field: 'supplementDeadline', title: '补交截止' },
                    ]
                  : []),
              ],
              title,
            )
          "
        >
          <Download :size="16" />导出
        </Button>
        <Button type="primary" @click="refresh">
          <RefreshCw :size="15" />刷新
        </Button>
        <Button type="primary" @click="collapsed = !collapsed">
          <ChevronDown v-if="collapsed" :size="17" /><ChevronUp
            v-else
            :size="17"
          />{{ collapsed ? '展开' : '收起' }}
        </Button>
        <span class="status-caption" style="margin-left: auto">{{
          title
        }}</span>
      </div>
      <div v-if="view === 'entries'" class="rule-caption">
        本页管理本人已填报记录。新申报请从“活动中心”列表的“申报”按钮进入；兼任管理员或专家不改变记录归属。
      </div>
      <div v-if="view === 'reviews'" class="rule-caption">
        仅显示分配给当前专家的任务。各专家独立评分，不汇总分数、不计算排名。
      </div>
      <ImsTable
        ref="table"
        :rows="rows"
        :columns="columns"
        :loading="loading"
        :height="460"
      >
        <template #status="{ row }">
          <Tag :color="statusColor(row.status)">
            {{ row.status }}
          </Tag>
        </template>
        <template #actions="{ row }">
          <Space>
            <Button type="link" @click="details(row.id)">
              {{
                view === 'reviews' && row.status !== '已提交' ? '评审' : '明细'
              }}
            </Button>
            <Button
              v-if="view === 'activities' && applyEnabled(row.id)"
              type="link"
              :disabled="expertBlocksApplication(row.id)"
              :title="
                expertBlocksApplication(row.id)
                  ? '您是本活动评审专家，不能同时作为填报人参赛；请联系管理员调整专家名单。'
                  : undefined
              "
              @click="
                dialogs.open({ kind: 'entry', id: 'new', activityId: row.id })
              "
            >
              申报
            </Button>
            <Button
              v-if="view === 'activities' && row.canDelete"
              type="link"
              danger
              @click="
                confirmAction('删除草稿活动？', () =>
                  useCompetition().commit((d) =>
                    deleteDraft(d, actor, 'activity', row.id),
                  ),
                )
              "
            >
              删除
            </Button>
            <Button
              v-if="view === 'entries' && row.canDelete"
              type="link"
              danger
              @click="
                confirmAction('删除此申报？', () =>
                  useCompetition().commit((d) =>
                    deleteDraft(d, actor, 'entry', row.id),
                  ),
                )
              "
            >
              删除
            </Button>
          </Space>
        </template>
      </ImsTable>
    </div>
  </CompetitionFrame>
  <DetailDialog
    v-for="(panel, index) in panels"
    :key="panel.key"
    :panel="panel"
    :active="index === panels.length - 1"
    :open-detail="dialogs.open"
    :close="dialogs.close"
    :replace-id="dialogs.replaceId"
    :register-guard="(key, guard) => dialogs.guards.set(key, guard)"
  />
</template>
