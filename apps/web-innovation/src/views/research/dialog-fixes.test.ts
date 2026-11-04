import type { Topic } from './model';

import { createApp, h, nextTick, ref } from 'vue';

import { afterEach, expect, it, vi } from 'vitest';

import {
  copy,
  deleteProgress,
  freshProgress,
  freshTopic,
  people,
  saveProgress,
} from './model';
import ProgressDialog from './ProgressDialog.vue';
import { seedData } from './seed';
import TopicDialog from './TopicDialog.vue';

const state = vi.hoisted(() => ({ store: {} as any, confirm: vi.fn() }));
vi.mock('./store', () => ({ useResearch: () => state.store }));
vi.mock('vue-router', () => ({ onBeforeRouteLeave: vi.fn() }));
vi.mock('@vben/icons', () => ({
  ChevronDown: () => null,
  ArrowUp: () => null,
}));
vi.mock('./ui', async (original) => {
  const actual = await original<typeof import('./ui')>();
  return { ...actual, ask: state.confirm };
});
vi.mock('./Attachments.vue', () => ({
  default: { methods: { cancel: vi.fn() }, render: () => null },
}));

const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).forEach((fn) => fn());
  document.body.innerHTML = '';
  vi.clearAllMocks();
});
async function flush() {
  for (let n = 0; n < 10; n++) await nextTick();
}
function store(t: Topic, actor = people[2]!) {
  const topics = ref([copy(t)]);
  state.store = {
    topics,
    actor: ref(actor),
    refresh: vi.fn(),
    commit: (action: (all: Topic[]) => void) => {
      const all = copy(topics.value);
      action(all);
      topics.value = all;
    },
  };
  state.confirm.mockResolvedValue(true);
  return topics;
}
async function mount(component: any, props: any) {
  const el = document.createElement('div');
  document.body.append(el);
  const app = createApp({ render: () => h(component, props) });
  app.mount(el);
  cleanup.push(() => app.unmount());
  await flush();
}
function button(text: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent?.replaceAll(/\s/g, '') === text,
  )!;
}
async function fill(path: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(
    `[data-field="${path}"] input,[data-field="${path}"] textarea`,
  )!;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
}
async function tab(text: string) {
  [...document.querySelectorAll<HTMLElement>('[role="tab"]')]
    .find((v) => v.textContent === text)!
    .click();
  await flush();
}

it('只读任务表展示已记录的实际开始与完成时间', async () => {
  const t = seedData().find((v) => v.status === '攻关中')!;
  store(t, people[0]!);
  await mount(TopicDialog, { initial: t, initialTab: 'tasks' });
  const row = [...document.querySelectorAll('tr')].find(
    (r) =>
      r.querySelector<HTMLInputElement>('input')?.value === t.tasks[0]!.name,
  )!;
  expect(row.textContent).toContain(t.tasks[0]!.startedAt);
  expect(row.textContent).toContain(t.tasks[0]!.completedAt);
});

it('从任务页提交缺主表字段时切回信息页、展开折叠面板并保留输入', async () => {
  const t = freshTopic(people[2]!);
  store(t);
  await mount(TopicDialog, { initial: t });
  await fill('name', '未保存名称');
  button('基本信息').click();
  await flush();
  await tab('任务计划');
  button('提交立项').click();
  await flush();
  expect(
    document.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
  ).toBe('课题信息');
  expect(button('基本信息').getAttribute('aria-expanded')).toBe('true');
  expect(
    document.querySelector('[data-field="category"]')?.textContent,
  ).toContain('请填写课题类别');
  expect(
    document.querySelector<HTMLInputElement>('[data-field="name"] input')
      ?.value,
  ).toBe('未保存名称');
});

it('保存团队计划的任务错误关闭确认弹窗并定位子表行', async () => {
  const t = seedData().find((v) => v.status === '攻关中')!;
  store(t);
  await mount(TopicDialog, { initial: t });
  await tab('任务计划');
  await fill('tasks.1.name', '');
  button('保存团队与计划').click();
  await flush();
  button('确定').click();
  await flush();
  expect(
    document.querySelector('[data-field="tasks.1.name"]')?.textContent,
  ).toContain('第2行：请填写任务名称');
  expect(document.activeElement).toBe(
    document.querySelector('[data-field="tasks.1.name"] input'),
  );
  expect(state.store.topics.value[0].tasks[1].name).not.toBe('');
});

it('删除本人进展草稿后，结题页未保存总结仍在且关闭仍提示', async () => {
  const t = seedData().find((v) => v.status === '攻关中')!;
  const p = { ...freshProgress(people[2]!), title: '用于删除的草稿' };
  saveProgress(t, people[2]!, t.revision, p);
  const topics = store(t);
  await mount(TopicDialog, { initial: t, initialTab: 'closure' });
  await fill('closure.summary', '跨页签未保存的总结');
  await tab('进展记录');
  const row = [...document.querySelectorAll('tr')].find((r) =>
    r.textContent?.includes(p.title),
  )!;
  [...row.querySelectorAll('button')]
    .find((b) => b.textContent === '删除')!
    .click();
  await flush();
  expect(topics.value[0]!.progress.some((v) => v.id === p.id)).toBe(false);
  await tab('结题资料');
  expect(
    document.querySelector<HTMLTextAreaElement>(
      '[data-field="closure.summary"] textarea',
    )?.value,
  ).toBe('跨页签未保存的总结');
  button('关闭').click();
  await flush();
  expect(state.confirm).toHaveBeenLastCalledWith('放弃未保存的课题修改？');
});

it.each([people[0]!, people[4]!])(
  '只读进展为 $name 显示其他成员任务名称',
  async (actor) => {
    const t = seedData().find((v) => v.status === '攻关中')!;
    store(t, actor);
    await mount(ProgressDialog, { topicId: t.id, initial: t.progress[0] });
    const task = document.querySelector('[data-field="taskId"]')!;
    expect(task.textContent).toContain(t.tasks[1]!.name);
    expect(task.textContent).not.toContain(t.tasks[1]!.id);
    expect(task.querySelector('input')?.disabled).toBe(true);
  },
);

it('进展提交定位本次内容并展开面板，不丢失标题', async () => {
  const t = seedData().find((v) => v.status === '攻关中')!;
  store(t);
  await mount(ProgressDialog, {
    topicId: t.id,
    initial: freshProgress(people[2]!),
  });
  await fill('title', '保留标题');
  button('进展内容').click();
  await flush();
  button('提交').click();
  await flush();
  expect(button('进展内容').getAttribute('aria-expanded')).toBe('true');
  expect(
    document.querySelector('[data-field="content"]')?.textContent,
  ).toContain('请填写本次内容');
  expect(
    document.querySelector<HTMLInputElement>('[data-field="title"] input')
      ?.value,
  ).toBe('保留标题');
});

it('已有进展被另一窗口删除后，刷新关闭子弹窗而不恢复草稿', async () => {
  const t = seedData().find((v) => v.status === '攻关中')!;
  const p = { ...freshProgress(people[2]!), title: '待删除进展' };
  saveProgress(t, people[2]!, t.revision, p);
  const topics = store(t);
  const onClose = vi.fn();
  await mount(ProgressDialog, { topicId: t.id, initial: p, onClose });
  state.store.refresh.mockImplementation(() => {
    const latest = copy(topics.value[0]!);
    deleteProgress(latest, people[2]!, latest.revision, p.id);
    topics.value = [latest];
  });
  button('刷新').click();
  await flush();
  expect(onClose).toHaveBeenCalledOnce();
  expect(topics.value[0]!.progress.some((v) => v.id === p.id)).toBe(false);
});

it('新进展刷新后仍可保存，首次保存后删除再刷新按已有记录处理', async () => {
  const t = seedData().find((v) => v.status === '攻关中')!;
  const p = freshProgress(people[2]!);
  const topics = store(t);
  const onClose = vi.fn();
  await mount(ProgressDialog, { topicId: t.id, initial: p, onClose });
  button('刷新').click();
  await flush();
  expect(onClose).not.toHaveBeenCalled();
  await fill('title', '首次保存进展');
  button('保存草稿').click();
  await flush();
  expect(topics.value[0]!.progress.some((v) => v.id === p.id)).toBe(true);
  state.store.refresh.mockImplementation(() => {
    const latest = copy(topics.value[0]!);
    deleteProgress(latest, people[2]!, latest.revision, p.id);
    topics.value = [latest];
  });
  button('刷新').click();
  await flush();
  expect(onClose).toHaveBeenCalledOnce();
});

it('总计划与任务冲突保留调整弹窗、日期和原因，修正后可继续保存', async () => {
  const t = seedData().find((v) => v.status === '攻关中')!;
  t.start = '2026-10-01';
  t.end = '2026-10-31';
  t.tasks[0]!.start = t.start;
  t.tasks[0]!.end = '2026-10-07';
  t.tasks[1]!.start = '2026-10-08';
  t.tasks[1]!.end = t.end;
  const topics = store(t, people[0]!);
  await mount(TopicDialog, { initial: t });
  button('调整总体计划').click();
  await flush();
  await fill('action.reason', '保留本次调整原因');
  const setDate = async (value: string) => {
    const input = document.querySelector<HTMLInputElement>(
      '[data-field="action.start"] input',
    )!;
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await flush();
    await fill('action.start', value);
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
      }),
    );
    await flush();
  };
  await setDate(t.tasks[1]!.start);
  button('确定').click();
  await flush();
  expect(
    document.querySelector('[data-field="action.start"]')?.textContent,
  ).toContain(t.tasks[0]!.name);
  expect(
    document.querySelector<HTMLInputElement>(
      '[data-field="action.start"] input',
    )?.value,
  ).toBe(t.tasks[1]!.start);
  expect(
    document.querySelector<HTMLTextAreaElement>(
      '[data-field="action.reason"] textarea',
    )?.value,
  ).toBe('保留本次调整原因');
  expect(topics.value[0]!.revision).toBe(t.revision);
  await setDate(t.start);
  button('确定').click();
  await flush();
  expect(topics.value[0]!.revision).toBe(t.revision + 1);
  expect(topics.value[0]!.history.at(-1)?.note).toContain('保留本次调整原因');
});
