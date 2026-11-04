import type { Topic } from './model';

import { computed, createApp, h, nextTick, ref } from 'vue';

import { afterEach, expect, it, vi } from 'vitest';

import TopicList from './list.vue';
import { copy, freshReply, freshTopic, people } from './model';
import ReplyDialog from './ReplyDialog.vue';
import { seedData } from './seed';
import TopicDialog from './TopicDialog.vue';
const state = vi.hoisted(() => ({
  store: {} as any,
  ask: vi.fn(),
  pending: undefined as any,
  cancel: vi.fn(),
  previewing: undefined as any,
}));
vi.mock('./store', () => ({ useExchange: () => state.store }));
vi.mock('vue-router', () => ({ onBeforeRouteLeave: vi.fn() }));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => ({ accessMenus: [], setAccessMenus: vi.fn() }),
}));
vi.mock('#/locales', () => ({ $t: (v: string) => v }));
vi.mock('@vben/icons', () => ({
  ChevronDown: () => null,
  ArrowUp: () => null,
}));
vi.mock('./ui', async (original) => ({
  ...(await original<typeof import('./ui')>()),
  ask: state.ask,
}));
vi.mock('./Attachments.vue', async () => {
  const { defineComponent, h, onBeforeUnmount } = await import('vue');
  return {
    default: defineComponent({
      props: ['modelValue', 'readonly', 'uploader'],
      emits: ['pending', 'update:modelValue', 'previewing'],
      setup(_, { emit, expose }) {
        state.pending = (n: number) => emit('pending', n);
        state.previewing = (v: boolean) => emit('previewing', v);
        onBeforeUnmount(() => emit('previewing', false));
        expose({ cancel: state.cancel });
        return () => h('div', '附件子表');
      },
    }),
  };
});
const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).forEach((f) => f());
  document.body.innerHTML = '';
  vi.clearAllMocks();
});
async function flush() {
  for (let n = 0; n < 12; n++) await nextTick();
}
function store(data = seedData(), id = 'lin') {
  const actorId = ref(id);
  const topics = ref(copy(data));
  state.store = {
    topics,
    actorId,
    actor: computed(() => people.find((p) => p.id === actorId.value)!),
    warning: ref(''),
    refresh: vi.fn(),
    reset: vi.fn(),
    switchActor: (v: string) => {
      actorId.value = v;
    },
    commit: (action: (all: Topic[]) => void) => {
      const all = copy(topics.value);
      action(all);
      topics.value = all;
    },
  };
  state.ask.mockResolvedValue(true);
  return { topics, actorId };
}
async function mount(component: any, props: any) {
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp({ render: () => h(component, props) });
  app.mount(host);
  cleanup.push(() => app.unmount());
  await flush();
}
function button(text: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent?.replaceAll(/\s/g, '') === text,
  )!;
}
async function fill(field: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(
    `[data-field="${field}"] input,[data-field="${field}"] textarea`,
  )!;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
}
async function tab(text: string) {
  [...document.querySelectorAll<HTMLElement>('[role="tab"]')]
    .find((e) => e.textContent === text)!
    .click();
  await flush();
}
it('发布错误切回基本信息、展开面板并保留输入；仅标题可保存草稿', async () => {
  const t = freshTopic(people[1]!);
  const s = store([]);
  await mount(TopicDialog, { initial: t });
  await fill('title', '草稿验收');
  button('基本信息').click();
  await tab('交流回复');
  button('发布').click();
  await flush();
  expect(
    document.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
  ).toBe('主题信息');
  expect(button('基本信息').getAttribute('aria-expanded')).toBe('true');
  expect(document.querySelector('[data-field="type"]')?.textContent).toContain(
    '请选择交流类型',
  );
  button('保存草稿').click();
  await flush();
  expect(s.topics.value[0]!.title).toBe('草稿验收');
  expect(s.topics.value[0]!.status).toBe('草稿');
});
it('读取中禁用保存发布，关闭取消保留，确认放弃调用读取取消', async () => {
  const t = freshTopic(people[1]!);
  store([]);
  const close = vi.fn();
  await mount(TopicDialog, { initial: t, onClose: close });
  state.pending(1);
  await flush();
  expect(button('保存草稿').disabled).toBe(true);
  expect(button('发布').disabled).toBe(true);
  state.ask.mockResolvedValueOnce(false);
  button('关闭').click();
  await flush();
  expect(close).not.toHaveBeenCalled();
  expect(state.cancel).not.toHaveBeenCalled();
  button('关闭').click();
  await flush();
  expect(close).toHaveBeenCalledOnce();
  expect(state.cancel).toHaveBeenCalled();
});
it('已发布原文只读，其他员工看不到下架回复及其原因，父页签保留', async () => {
  const data = seedData();
  store(data, 'xu');
  await mount(TopicDialog, { initial: data[0]! });
  expect(
    document.querySelector<HTMLInputElement>('[data-field="title"] input')!
      .disabled,
  ).toBe(true);
  expect(button('保存草稿')).toBeUndefined();
  await tab('交流回复');
  expect(document.body.textContent).not.toContain('此条为已下架回复');
  expect(button('处理记录')).toBeUndefined();
  button('明细').click();
  await flush();
  expect(document.body.textContent).toContain('回复明细');
  const closes = [
    ...document.querySelectorAll<HTMLButtonElement>('button'),
  ].filter((b) => b.textContent?.replaceAll(/\s/g, '') === '关闭');
  closes.at(-1)!.click();
  await flush();
  expect(
    document.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
  ).toBe('交流回复');
});
it('回复无独立草稿，提交后只读且父记录同步；提交前关闭需提醒', async () => {
  const data = seedData();
  const s = store(data, 'xu');
  const close = vi.fn();
  const saved = vi.fn();
  await mount(ReplyDialog, {
    topicId: data[0]!.id,
    revision: data[0]!.revision,
    initial: freshReply(people[4]!),
    create: true,
    onSaved: saved,
    onClose: close,
  });
  await fill('body', '跨部门补充');
  state.ask.mockResolvedValueOnce(false);
  button('关闭').click();
  await flush();
  expect(close).not.toHaveBeenCalled();
  button('提交回复').click();
  await flush();
  expect(saved).toHaveBeenCalledOnce();
  expect(s.topics.value[0]!.replies.at(-1)!.body).toBe('跨部门补充');
});
it('管理员不能查看私人草稿，管理入口拦截非管理员；筛选关闭后保持', async () => {
  const s = store(seedData(), 'manager');
  await mount(TopicList, { view: 'manage' });
  expect(document.body.textContent).not.toContain('热控测点异常排查（草稿）');
  const input = document.querySelector<HTMLInputElement>(
    'input[placeholder="请输入标题"]',
  )!;
  input.value = '循环水泵';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  button('查询').click();
  await flush();
  expect(document.querySelectorAll('tbody tr[data-row-key]')).toHaveLength(1);
  button('明细').click();
  await flush();
  button('关闭').click();
  await flush();
  expect(input.value).toBe('循环水泵');
  s.actorId.value = 'xu';
  await flush();
  expect(document.body.textContent).toContain('交流管理仅供管理员');
  expect(button('＋新增交流')).toBeUndefined();
});

it('只读主题跟随当前记录更新，不能继续显示已撤换的正文', async () => {
  const data = seedData();
  const s = store(data, 'xu');
  await mount(TopicDialog, { initial: data[1]! });
  s.topics.value[1]!.body = '作者撤回后重新发布的新正文';
  s.topics.value[1]!.revision++;
  await flush();
  expect(
    document.querySelector<HTMLTextAreaElement>('[data-field="body"] textarea')!
      .value,
  ).toBe('作者撤回后重新发布的新正文');
});

it('同时间主题按业务编号排序，不受内部标识顺序影响', async () => {
  const data = seedData().slice(1, 3);
  data[0]!.id = 'z';
  data[1]!.id = 'a';
  data[1]!.firstPublishedAt = data[0]!.firstPublishedAt;
  store(data, 'xu');
  await mount(TopicList, { view: 'center' });
  expect(
    [...document.querySelectorAll<HTMLElement>('tbody tr[data-row-key]')].map(
      (el) => el.dataset.rowKey,
    ),
  ).toEqual(['z', 'a']);
});

it.each(['主题', '回复'])(
  '%s预览未关闭时不能关闭父明细，失去权限后隐藏材料',
  async (kind) => {
    const data = seedData();
    const s = store(data, 'xu');
    const close = vi.fn();
    if (kind === '主题')
      await mount(TopicDialog, { initial: data[0]!, onClose: close });
    else
      await mount(ReplyDialog, {
        topicId: data[0]!.id,
        initial: data[0]!.replies[0]!,
        revision: data[0]!.revision,
        create: false,
        onClose: close,
      });
    state.previewing(true);
    await flush();
    button('关闭').click();
    await flush();
    expect(close).not.toHaveBeenCalled();
    s.topics.value[0]!.status = '已下架';
    await flush();
    expect(document.querySelector('[data-field="body"] textarea')).toBeNull();
    expect(document.body.textContent).not.toContain('附件子表');
    state.previewing(false);
    await flush();
    button('关闭').click();
    await flush();
    expect(close).toHaveBeenCalledOnce();
  },
);

it('回复草稿身份改变后隐藏材料并禁用提交，不转移作者归属', async () => {
  const data = seedData();
  const s = store(data, 'xu');
  await mount(ReplyDialog, {
    topicId: data[0]!.id,
    revision: data[0]!.revision,
    initial: freshReply(people[4]!),
    create: true,
  });
  await fill('body', '不应转移的回复');
  s.actorId.value = 'zhou';
  await flush();
  expect(button('提交回复').disabled).toBe(true);
  expect(document.querySelector('[data-field="body"] textarea')).toBeNull();
  expect(s.topics.value[0]!.replies).toHaveLength(data[0]!.replies.length);
});
