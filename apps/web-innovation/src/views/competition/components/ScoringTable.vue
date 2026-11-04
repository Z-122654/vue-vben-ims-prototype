<script setup lang="ts">
import type { Criterion, Review } from '../model';

import { computed, ref, watch } from 'vue';

import { Plus, X as Trash2 } from '@vben/icons';

import { Button, Input, InputNumber, Table } from 'ant-design-vue';

import { uid } from '../model';

const props = withDefaults(
  defineProps<{
    criteria: Criterion[];
    scores?: Review['scores'];
    mode?: 'criteria' | 'scores';
    readonly?: boolean;
  }>(),
  { mode: 'criteria', readonly: false, scores: () => ({}) },
);
const emit = defineEmits<{
  'update:criteria': [value: Criterion[]];
  'update:scores': [value: Review['scores']];
}>();
const selected = ref<(number | string)[]>([]);
const configuring = computed(() => props.mode === 'criteria');
const columns = computed(() => [
  { key: 'sequence', title: '序号', width: 80, align: 'center' as const },
  { key: 'name', title: configuring.value ? '指标名称' : '评分指标' },
  { key: 'max', title: '满分（分）', width: 180 },
  ...(configuring.value
    ? []
    : [{ key: 'score', title: '专家评分（分）', width: 240 }]),
]);
const rowSelection = computed(() =>
  configuring.value && !props.readonly
    ? {
        selectedRowKeys: selected.value,
        onChange: (keys: (number | string)[]) => {
          selected.value = keys;
        },
        columnWidth: 48,
      }
    : undefined,
);
watch(
  () => props.criteria,
  (rows) => {
    selected.value = selected.value.filter((id) =>
      rows.some((row) => row.id === id),
    );
  },
);
function updateCriterion(id: string, patch: Partial<Criterion>) {
  if (props.readonly || !configuring.value) return;
  emit(
    'update:criteria',
    props.criteria.map((row) => (row.id === id ? { ...row, ...patch } : row)),
  );
}
function add() {
  emit('update:criteria', [
    ...props.criteria,
    { id: uid(), name: '', max: 20 },
  ]);
}
function remove() {
  emit(
    'update:criteria',
    props.criteria.filter((row) => !selected.value.includes(row.id)),
  );
  selected.value = [];
}
function updateScore(id: string, value: null | number | string) {
  if (props.readonly) return;
  emit('update:scores', {
    ...props.scores,
    [id]: typeof value === 'number' ? value : null,
  });
}
</script>

<template>
  <div class="ims-child-table">
    <div v-if="configuring && !readonly" class="ims-toolbar">
      <Button type="primary" @click="add"><Plus :size="15" />新增指标</Button>
      <Button type="primary" :disabled="!selected.length" @click="remove">
        <Trash2 :size="15" />删除指标
      </Button>
      <span class="muted">已选 {{ selected.length }} 项</span>
    </div>
    <Table
      :aria-label="configuring ? '评分指标子表' : '专家评分子表'"
      :columns="columns"
      :data-source="criteria"
      :row-selection="rowSelection"
      :pagination="false"
      :scroll="{ x: configuring ? 600 : 720 }"
      :locale="{ emptyText: '暂无评分指标' }"
      row-key="id"
      bordered
    >
      <template #bodyCell="{ column, record, index }">
        <template v-if="column.key === 'sequence'">{{ index + 1 }}</template>
        <template v-else-if="column.key === 'name'">
          <Input
            v-if="configuring && !readonly"
            :value="record.name"
            :aria-label="`指标${index + 1}名称`"
            placeholder="请输入指标名称"
            @update:value="
              (value) => updateCriterion(record.id, { name: value })
            "
          />
          <span v-else>{{ record.name }}</span>
        </template>
        <template v-else-if="column.key === 'max'">
          <InputNumber
            v-if="configuring && !readonly"
            :value="record.max"
            :min="1"
            :max="100"
            :precision="0"
            :step="1"
            :aria-label="`指标${index + 1}分值上限`"
            @update:value="
              (value) =>
                updateCriterion(record.id, {
                  max: typeof value === 'number' ? value : 0,
                })
            "
          />
          <span v-else>{{ record.max }}</span>
        </template>
        <template v-else-if="column.key === 'score'">
          <span v-if="readonly">{{ scores[record.id] ?? '—' }}</span>
          <InputNumber
            v-else
            :value="scores[record.id] ?? undefined"
            :min="0"
            :max="record.max"
            :precision="1"
            :step="0.1"
            :aria-label="`${record.name}评分`"
            placeholder="请输入"
            @update:value="(value) => updateScore(record.id, value)"
          />
        </template>
      </template>
    </Table>
    <div class="ims-child-count">共 {{ criteria.length }} 条数据</div>
  </div>
</template>
