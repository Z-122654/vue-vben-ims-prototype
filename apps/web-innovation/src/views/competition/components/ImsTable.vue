<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';

import { Input, Pagination } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';

export interface Column {
  field: string;
  title: string;
  width?: number;
  minWidth?: number;
  slot?: string;
  filter?: boolean;
}
const props = withDefaults(
  defineProps<{
    rows: Record<string, any>[];
    columns: Column[];
    height?: number;
    loading?: boolean;
    pagination?: boolean;
  }>(),
  { height: 420, loading: false, pagination: true },
);
const page = ref(1);
const size = ref(20);
const filters = reactive<Record<string, string>>({});
const sort = reactive({ field: '', order: '' });
const filtered = computed(() => {
  const result = props.rows.filter((row) =>
    Object.entries(filters).every(
      ([field, value]) =>
        !value ||
        String(row[field] ?? '')
          .toLocaleLowerCase()
          .includes(value.toLocaleLowerCase()),
    ),
  );
  if (sort.field && sort.order)
    result.sort(
      (a, b) =>
        String(a[sort.field] ?? '').localeCompare(
          String(b[sort.field] ?? ''),
          'zh-CN',
          { numeric: true },
        ) * (sort.order === 'asc' ? 1 : -1),
    );
  return result;
});
const paged = computed(() =>
  props.pagination
    ? filtered.value.slice(
        (page.value - 1) * size.value,
        page.value * size.value,
      )
    : filtered.value,
);
const [Grid, grid] = useVbenVxeGrid({
  gridOptions: {
    border: true,
    round: false,
    showOverflow: true,
    rowConfig: { keyField: 'id' },
    align: 'left',
    headerAlign: 'center',
    size: 'medium',
    minHeight: 160,
    pagerConfig: { enabled: false },
    toolbarConfig: { enabled: false },
    sortConfig: { remote: true },
    cellConfig: { height: 52 },
    headerCellConfig: { height: 84 },
  },
  gridEvents: {
    sortChange: ({
      field,
      order,
    }: {
      field: string;
      order?: null | string;
    }) => {
      sort.field = field;
      sort.order = order ?? '';
    },
  },
});
watch(
  () => ({ ...filters }),
  () => {
    page.value = 1;
  },
  { deep: true },
);
watch([() => filtered.value.length, size], () => {
  page.value = Math.min(
    page.value,
    Math.max(1, Math.ceil(filtered.value.length / size.value)),
  );
});
watch(
  [paged, () => props.columns, () => props.loading, () => props.height],
  () => {
    grid.setGridOptions({
      data: paged.value,
      height: props.height,
      loading: props.loading,
      columns: props.columns.map((column) => ({
        field: column.field,
        title: column.title,
        width: column.width,
        minWidth: column.minWidth ?? 120,
        sortable: column.field !== 'actions',
        fixed: column.field === 'actions' ? 'right' : undefined,
        slots: {
          ...(column.filter === false || column.field === 'actions'
            ? {}
            : { header: `filter-${column.field}` }),
          ...(column.slot ? { default: column.slot } : {}),
        },
      })),
    });
  },
  { immediate: true, deep: true },
);
defineExpose({
  filtered,
  clear: () => {
    Object.keys(filters).forEach((key) => delete filters[key]);
    page.value = 1;
  },
});
</script>
<template>
  <div class="ims-table">
    <Grid>
      <template
        v-for="column in columns.filter(
          (c) => c.filter !== false && c.field !== 'actions',
        )"
        :key="column.field"
        #[`filter-${column.field}`]
      >
        <div class="ims-column-heading">{{ column.title }}</div>
        <Input
          v-model:value="filters[column.field]"
          size="small"
          allow-clear
          :aria-label="`${column.title}列筛选`"
          placeholder="请输入"
          @click.stop
          @keydown.stop
        />
      </template>
      <template v-for="(_, name) in $slots" :key="name" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps"></slot>
      </template>
    </Grid>
    <div v-if="pagination" class="ims-pagination">
      <Pagination
        v-model:current="page"
        v-model:page-size="size"
        :total="filtered.length"
        show-size-changer
        :page-size-options="['10', '20', '50']"
        :show-total="(total) => `共 ${total} 条数据`"
      />
    </div>
  </div>
</template>
