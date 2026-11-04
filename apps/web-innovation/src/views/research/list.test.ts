import type { Topic } from './model';

import { computed, createApp, h, nextTick, ref } from 'vue';

import { afterEach, expect, it, vi } from 'vitest';

import TopicList from './list.vue';
import { copy, people } from './model';
import { seedData } from './seed';

const mocks = vi.hoisted(() => ({ store: {} as any, export: vi.fn() }));
vi.mock('./store', () => ({ useResearch: () => mocks.store }));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => ({ accessMenus: [], setAccessMenus: vi.fn() }),
}));
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/icons', () => ({
  ChevronDown: () => null,
  ArrowUp: () => null,
}));
vi.mock('./ui', () => ({
  ask: vi.fn(),
  exportCsv: mocks.export,
  perform: vi.fn(),
}));
vi.mock('./TopicDialog.vue', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    default: defineComponent({
      emits: ['close'],
      setup:
        (_, { emit }) =>
        () =>
          h('button', { onClick: () => emit('close') }, '返回列表'),
    }),
  };
});
const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).forEach((fn) => fn());
  document.body.innerHTML = '';
  vi.clearAllMocks();
});
async function flush() {
  for (let i = 0; i < 10; i++) await nextTick();
}
function button(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent?.replaceAll(/\s/g, '') === label,
  )!;
}
async function setup(
  topics: Topic[],
  view: 'manage' | 'mine' = 'mine',
  id = 'lin',
) {
  const actorId = ref(id);
  const data = ref(copy(topics));
  mocks.store = {
    topics: data,
    actorId,
    actor: computed(() => people.find((v) => v.id === actorId.value)!),
    switchActor: (value: string) => {
      actorId.value = value;
    },
    warning: ref(''),
    refresh: vi.fn(),
    commit: vi.fn(),
    reset: vi.fn(),
  };
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp({ render: () => h(TopicList, { view }) });
  app.mount(host);
  cleanup.push(() => app.unmount());
  await flush();
  return { actorId, data };
}
it('筛选全部结果导出不受分页限制，关闭明细保留筛选，角色切换重新限定范围', async () => {
  const original = seedData().find((t) => t.status === '攻关中')!;
  const topics = Array.from({ length: 12 }, (_, i) => ({
    ...copy(original),
    id: `audit-${i}`,
    code: `AUDIT-${i}`,
    name: `导出核对${i}`,
  }));
  const s = await setup(topics);
  const search = [
    ...document.querySelectorAll<HTMLInputElement>('input'),
  ].filter((el) => el.placeholder === '请输入')[1]!;
  search.value = '导出核对';
  search.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  button('查询').click();
  await flush();
  expect(document.querySelectorAll('tbody tr[data-row-key]')).toHaveLength(10);
  button('导出').click();
  expect(mocks.export.mock.lastCall![0]).toHaveLength(12);
  expect(
    mocks.export.mock.lastCall![1].map((c: { field: string }) => c.field),
  ).toEqual([
    'code',
    'name',
    'category',
    'leader',
    'department',
    'status',
    'start',
    'end',
    'approvedAt',
    'closedAt',
    'done',
    'total',
  ]);
  button('明细').click();
  await flush();
  button('返回列表').click();
  await flush();
  expect(search.value).toBe('导出核对');
  s.actorId.value = 'xu';
  await flush();
  button('导出').click();
  expect(mocks.export.mock.lastCall![0]).toEqual([]);
  expect(search.value).toBe('');
});
it('旧撤回草稿不显示删除入口，新建私人草稿仍可删除', async () => {
  const data = seedData();
  const old = data.find((t) => t.status === '待立项')!;
  old.status = '草稿';
  old.firstSubmittedAt = '';
  old.submittedAt = '';
  await setup([old, data.find((t) => t.status === '草稿')!]);
  const rows = [
    ...document.querySelectorAll<HTMLTableRowElement>('tbody tr[data-row-key]'),
  ];
  expect(
    rows.find((r) => r.dataset.rowKey === old.id)!.textContent,
  ).not.toContain('删除');
  expect(rows.filter((r) => r.textContent?.includes('删除'))).toHaveLength(1);
});
it('非管理员不能使用管理入口；管理员可管理正式课题但不能看到他人私人草稿', async () => {
  const s = await setup(seedData(), 'manage', 'xu');
  expect(document.body.textContent).toContain('仅供');
  expect(button('导出')).toBeUndefined();
  s.actorId.value = 'manager';
  await flush();
  button('导出').click();
  const exported = mocks.export.mock.lastCall![0] as Topic[];
  expect(exported).toHaveLength(6);
  expect(exported.every((t) => t.status !== '草稿')).toBe(true);
});
