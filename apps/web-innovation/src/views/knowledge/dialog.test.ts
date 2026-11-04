import { computed, createApp, h, nextTick, reactive, ref } from 'vue';

import { message } from 'ant-design-vue';
import { afterEach, expect, it, vi } from 'vitest';

import { seedData as competitionSeeds } from '../competition/seed';
import { seedData as exchangeSeeds } from '../exchange/seed';
import { seedData as researchSeeds } from '../research/seed';
import KnowledgeDialog from './KnowledgeDialog.vue';
import KnowledgeList from './list.vue';
import {
  copy,
  freshKnowledge,
  type Knowledge,
  people,
  takeDown,
} from './model';
import { applyImport, auditSources, removeReference } from './references';
import { seedData } from './seed';
import SourceLaunch from './SourceLaunch.vue';
import SourcePicker from './SourcePicker.vue';
import { candidates, readSources, resolveSource, selection } from './sources';
import SourcesPanel from './SourcesPanel.vue';
import SourceViewer from './SourceViewer.vue';
const state = vi.hoisted(() => ({
  store: {} as any,
  ask: vi.fn(),
  pending: undefined as any,
  cancel: vi.fn(),
}));
vi.mock('./store', () => ({ useKnowledge: () => state.store }));
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
  const { defineComponent, h } = await import('vue');
  return {
    default: defineComponent({
      props: ['modelValue', 'readonly', 'uploader'],
      emits: ['pending', 'update:modelValue'],
      setup(props, { emit, expose }) {
        state.pending = (n: number) => emit('pending', n);
        expose({ cancel: state.cancel });
        return () =>
          h('div', props.readonly ? '只读附件子表' : '可编辑附件子表');
      },
    }),
  };
});
const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).forEach((f) => f());
  document.body.innerHTML = '';
  vi.clearAllMocks();
  localStorage.clear();
});

function linkedForm(module: 'exchange' | 'research' = 'exchange') {
  const topics = module === 'exchange' ? exchangeSeeds() : researchSeeds();
  localStorage.setItem(
    `vben-web-innovation:${module}:v1`,
    JSON.stringify({ version: 1, topics }),
  );
  const source =
    module === 'exchange'
      ? topics[0]!
      : topics.find((t) => t.status === '已结题')!;
  const r = resolveSource(
    selection(module, source.id),
    people[0]!,
    readSources(),
  );
  if (r.state !== 'ok') throw new Error('fixture');
  return applyImport(
    { ...freshKnowledge(people[0]!), title: '来源知识' },
    people[0]!,
    { record: r.record, actions: {}, copyFiles: false, confirmedFiles: false },
  );
}
it('来源选择取消不改变目标编辑，未选附件不自动复制', async () => {
  const target = linkedForm();
  store([]);
  const apply = vi.fn();
  const before = copy(target);
  const close = vi.fn();
  await mount(SourcePicker, {
    actor: people[0],
    target,
    initialSelection: target.sources![0]!.selection,
    onApply: apply,
    onClose: close,
  });
  button('关闭').click();
  await flush();
  expect(close).toHaveBeenCalledOnce();
  expect(apply).not.toHaveBeenCalled();
  expect(target).toEqual(before);
});

it('kB-A02 已清理失效回复后，页面重新选择同一主题不会恢复旧回复', async () => {
  const topics = exchangeSeeds();
  localStorage.setItem(
    'vben-web-innovation:exchange:v1',
    JSON.stringify({ version: 1, topics }),
  );
  const choice = selection('exchange', topics[0]!.id);
  choice.replyIds = ['exchange-demo-answer'];
  choice.parts = ['exchange-demo-answer'];
  const r = resolveSource(choice, people[0]!, readSources());
  if (r.state !== 'ok') throw new Error('fixture');
  const target = applyImport(
    { ...freshKnowledge(people[0]!), title: '重新关联' },
    people[0]!,
    {
      record: r.record,
      actions: { body: 'replace' },
      copyFiles: false,
      confirmedFiles: false,
    },
  );
  const cleaned = removeReference(
    target,
    people[0]!,
    target.sources![0]!.key,
    true,
  );
  topics[0]!.replies = [];
  localStorage.setItem(
    'vben-web-innovation:exchange:v1',
    JSON.stringify({ version: 1, topics }),
  );
  store([]);
  const apply = vi.fn();
  await mount(SourcePicker, {
    actor: people[0],
    target: cleaned,
    onApply: apply,
  });
  button('选择').click();
  await flush();
  expect(button('确认到知识表单').disabled).toBe(false);
  button('确认到知识表单').click();
  await flush();
  expect(apply).toHaveBeenCalledOnce();
  expect(apply.mock.calls[0]![0].sources[0].selection.replyIds).toEqual([]);
});

it('kB-A10 打开已发布知识时自动发现来源变化，不应误报未保存或阻止复核', async () => {
  const v = linkedForm();
  v.status = '已发布';
  v.revision = 1;
  v.sources![0]!.published = true;
  const s = store([v]);
  const data = JSON.parse(
    localStorage.getItem('vben-web-innovation:exchange:v1')!,
  );
  data.topics[0].title = '来源已更新';
  localStorage.setItem('vben-web-innovation:exchange:v1', JSON.stringify(data));
  state.store.audit = () => {
    const next = copy(s.items.value);
    auditSources(next, people[0]!);
    s.items.value = next;
  };
  const close = vi.fn();
  await mount(KnowledgeDialog, { initial: copy(v), onClose: close });
  await tab('关联来源');
  expect(button('复核').disabled).toBe(false);
  button('关闭').click();
  await flush();
  expect(state.ask).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledOnce();
});
it('kB-A11 取消本次选中的回复，同时清理其隐藏附件选择，仍可确认主题关联', async () => {
  const topics = exchangeSeeds();
  const topic = topics[0]!;
  const reply = topic.replies[0]!;
  reply.attachments = [
    {
      id: 'reply-pdf',
      name: '回复说明.pdf',
      size: 3,
      content: 'data:application/pdf;base64,YWJj',
      uploader: '周亦安',
      time: '',
    },
  ];
  localStorage.setItem(
    'vben-web-innovation:exchange:v1',
    JSON.stringify({ version: 1, topics }),
  );
  const choice = selection('exchange', topic.id);
  choice.replyIds = [reply.id];
  choice.parts = [reply.id];
  choice.fileIds = ['reply-pdf'];
  store([]);
  const apply = vi.fn();
  await mount(SourcePicker, {
    actor: people[0],
    target: freshKnowledge(people[0]!),
    initialSelection: choice,
    onApply: apply,
  });
  const row = [...document.querySelectorAll('tr')].find((r) =>
    r.textContent?.includes(reply.body),
  )!;
  row.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
  await flush();
  button('确认到知识表单').click();
  await flush();
  expect(apply).toHaveBeenCalledOnce();
  expect(apply.mock.calls[0]![0].sources[0].selection.fileIds).toEqual([]);
});
it('kB-A12 已清空材料且移除的失效关系只保留追溯，不再提示待复核', async () => {
  let v = linkedForm();
  v = removeReference(v, people[0]!, v.sources![0]!.key, true);
  v.title = '已清理后的手工内容';
  v.revision = 1;
  localStorage.setItem(
    'vben-web-innovation:exchange:v1',
    JSON.stringify({ version: 1, topics: [] }),
  );
  store([v]);
  await mount(KnowledgeDialog, { initial: v });
  await tab('关联来源');
  const panel = document.querySelector(
    '[role="tabpanel"][id$="panel-sources"]',
  )!;
  expect(panel.querySelector('.ant-table-row-expand-icon')).toBeNull();
  button('查看关联记录').click();
  await flush();
  document
    .querySelector<HTMLButtonElement>('.ant-table-row-expand-icon')!
    .click();
  await flush();
  expect(
    [...document.querySelectorAll<HTMLInputElement>('input')].some(
      (i) => i.value === '已清理，无需复核',
    ),
  ).toBe(true);
  expect(panel.textContent).not.toContain('待复核');
  expect(button('复核')).toBeUndefined();
});
it('kB-A09 复核保存失败保留意见与复核弹窗，供重试', async () => {
  const v = linkedForm();
  v.status = '已发布';
  v.revision = 1;
  v.sources![0]!.published = true;
  const source = JSON.parse(
    localStorage.getItem('vben-web-innovation:exchange:v1')!,
  );
  source.topics[0].title = '更新标题';
  localStorage.setItem(
    'vben-web-innovation:exchange:v1',
    JSON.stringify(source),
  );
  store([v]);
  state.store.commit = () => {
    throw new Error('本地空间不足');
  };
  await mount(KnowledgeDialog, { initial: v });
  await tab('关联来源');
  button('复核').click();
  await flush();
  const modal = [
    ...document.querySelectorAll<HTMLElement>('[role="dialog"]'),
  ].find((e) => e.textContent?.includes('复核意见'))!;
  const input = modal.querySelector<HTMLTextAreaElement>('textarea')!;
  input.value = '已经人工核对，保留';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  button('确认保留').click();
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 400));
  expect(button('确认保留')).toBeDefined();
  expect(modal.closest<HTMLElement>('.ant-modal-wrap')!.style.display).not.toBe(
    'none',
  );
  expect(input.isConnected).toBe(true);
  expect(input.value).toBe('已经人工核对，保留');
});
it('来源选择确认仅发出编辑态结果，不自动保存或发布', async () => {
  const apply = vi.fn();
  const s = store([]);
  const target = linkedForm();
  await mount(SourcePicker, {
    actor: people[0],
    target,
    initialSelection: target.sources![0]!.selection,
    onApply: apply,
  });
  button('确认到知识表单').click();
  await flush();
  expect(apply).toHaveBeenCalledOnce();
  expect(s.items.value).toEqual([]);
  expect(apply.mock.calls[0]![0].sources).toHaveLength(1);
  expect(apply.mock.calls[0]![0].attachments).toEqual([]);
});
it('从来源带入的新表单关闭仍提醒，不因初始值已有内容而丢失保护', async () => {
  const target = linkedForm();
  store([]);
  const close = vi.fn();
  state.ask.mockResolvedValueOnce(false);
  await mount(KnowledgeDialog, { initial: target, onClose: close });
  button('关闭').click();
  await flush();
  expect(state.ask).toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});
it('无课题权限员工只看到来源模块和不可访问提示，不泄漏标题、作者和时间', async () => {
  const v = linkedForm('research');
  v.status = '已发布';
  v.revision = 1;
  const source = v.sources![0]!;
  source.title = '内部课题秘密名称';
  source.author = '内部来源作者';
  source.linkedAt = '2020-01-01';
  // An unmapped employee cannot borrow either source or knowledge administrator privileges.
  store([v], 'lin');
  await mount(KnowledgeDialog, {
    initial: v,
    actorOverride: { id: 'no-map', name: '普通员工', department: '其他部门' },
  });
  await tab('关联来源');
  const panel = document.querySelector(
    '[role="tabpanel"][id$="panel-sources"]',
  )!;
  await tab('课题攻关');
  expect(panel.textContent).toContain('课题攻关');
  expect(panel.textContent).toContain('来源不可访问');
  expect(panel.textContent).not.toContain('内部课题秘密名称');
  expect(panel.textContent).not.toContain('内部来源作者');
  expect(panel.textContent).not.toContain('2020-01-01');
  expect(button('查看来源')).toBeUndefined();
  expect(button('复核')).toBeUndefined();
  sourceButton('查看关联记录', 'research').click();
  await flush();
  expect(document.body.textContent).not.toContain('内部课题秘密名称');
  expect(document.body.textContent).not.toContain('内部来源作者');
  expect(document.body.textContent).not.toContain('2020-01-01');
  expect(button('清理遗留材料')).toBeUndefined();
});
it('附件正在读取时禁止打开来源选择，避免替换表单丢失迟到文件', async () => {
  store([]);
  await mount(KnowledgeDialog, { initial: freshKnowledge(people[0]!) });
  state.pending(1);
  await tab('关联来源');
  expect(button('新增').disabled).toBe(true);
});
it('源模块快捷入口使用源页面同人，不借用知识库当前管理员身份', async () => {
  const target = linkedForm();
  store([], 'manager');
  await mount(SourceLaunch, {
    module: 'exchange',
    parentId: target.sources![0]!.selection.parentId,
    sourceActorId: 'lin',
  });
  expect(button('整理为知识')).toBeUndefined();
});
it('源管理员快捷入口预选对象并保护父级关闭，不改变知识库缓存身份', async () => {
  const busy = vi.fn();
  const s = store([], 'curator');
  const target = linkedForm();
  await mount(SourceLaunch, {
    module: 'exchange',
    parentId: target.sources![0]!.selection.parentId,
    sourceActorId: 'manager',
    onBusy: busy,
  });
  button('整理为知识').click();
  await flush();
  expect(button('确认到知识表单').disabled).toBe(false);
  expect(busy).toHaveBeenCalledWith(true);
  expect(s.actorId.value).toBe('curator');
});
it('原文件下载时重新校验，文件移除后不下载旧缓存副本', async () => {
  const topics = exchangeSeeds();
  const t = topics[0]!;
  t.attachments = [
    {
      id: 'pdf',
      name: '原资料.pdf',
      size: 3,
      content: 'data:application/pdf;base64,YWJj',
      uploader: '原上传人',
      time: '',
    },
  ];
  localStorage.setItem(
    'vben-web-innovation:exchange:v1',
    JSON.stringify({ version: 1, topics }),
  );
  store([]);
  await mount(SourceViewer, {
    selection: selection('exchange', t.id),
    actor: people[0],
  });
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
  t.attachments = [];
  localStorage.setItem(
    'vben-web-innovation:exchange:v1',
    JSON.stringify({ version: 1, topics }),
  );
  button('下载原文件').click();
  await flush();
  expect(click).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain('原附件已不可访问');
  click.mockRestore();
});
async function flush() {
  for (let n = 0; n < 12; n++) await nextTick();
}
function store(data = seedData(), id = 'manager') {
  const actorId = ref(id);
  const items = ref(copy(data));
  state.store = {
    items,
    actorId,
    actor: computed(() => people.find((p) => p.id === actorId.value)!),
    warning: ref(''),
    refresh: vi.fn(),
    reset: vi.fn(),
    switchActor: (v: string) => {
      actorId.value = v;
    },
    commit: (action: (all: Knowledge[]) => void) => {
      const all = copy(items.value);
      action(all);
      items.value = all;
    },
  };
  state.ask.mockResolvedValue(true);
  return { items, actorId };
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
it('仅标题可保存，发布缺项从附件页定位展开基本信息且保留输入', async () => {
  const s = store([]);
  await mount(KnowledgeDialog, { initial: freshKnowledge(people[0]!) });
  await fill('title', '文档验收');
  button('保存草稿').click();
  await flush();
  expect(s.items.value[0]!.title).toBe('文档验收');
  button('基本信息').click();
  await tab('附件资料');
  button('发布').click();
  await flush();
  expect(
    document.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
  ).toBe('知识信息');
  expect(button('基本信息').getAttribute('aria-expanded')).toBe('true');
  expect(document.querySelector('[data-field="type"]')?.textContent).toContain(
    '请选择知识类型',
  );
});
it('附件读取期间禁用保存发布，关闭取消保留输入，确认放弃停止读取', async () => {
  store([]);
  const close = vi.fn();
  await mount(KnowledgeDialog, {
    initial: freshKnowledge(people[0]!),
    onClose: close,
  });
  await tab('附件资料');
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
it('员工只读且没有管理历史入口；外部下架后原明细和附件不再可见', async () => {
  const data = seedData();
  const s = store(data, 'lin');
  await mount(KnowledgeDialog, { initial: data[0]! });
  expect(
    document.querySelector<HTMLInputElement>('[data-field="title"] input')!
      .disabled,
  ).toBe(true);
  expect(button('下架')).toBeUndefined();
  expect(button('处理记录')).toBeUndefined();
  expect(button('发布')).toBeUndefined();
  const all = copy(s.items.value);
  takeDown(all, people[0]!, all[0]!.id, all[0]!.revision, '权限变化');
  s.items.value = all;
  await flush();
  expect(document.body.textContent).toContain('知识已下架或不可访问');
  expect(document.querySelector('[data-field="title"] input')).toBeNull();
});
it('管理员先下架才能修改，空原因拒绝，重新发布后回到只读', async () => {
  const data = seedData();
  const s = store(data);
  await mount(KnowledgeDialog, { initial: data[0]! });
  expect(button('保存')).toBeUndefined();
  button('下架').click();
  await flush();
  button('确认下架').click();
  await flush();
  expect(s.items.value[0]!.status).toBe('已发布');
  await fill('reason', '更新资料');
  button('确认下架').click();
  await flush();
  expect(s.items.value[0]!.status).toBe('已下架');
  await fill('title', '修订标题');
  button('保存').click();
  await flush();
  expect(s.items.value[0]!.status).toBe('已下架');
  expect(s.items.value[0]!.title).toBe('修订标题');
  button('重新发布').click();
  await flush();
  expect(s.items.value[0]!.status).toBe('已发布');
  expect(
    document.querySelector<HTMLInputElement>('[data-field="title"] input')!
      .disabled,
  ).toBe(true);
});
it('管理列表状态范围与员工权限正确，筛选明细关闭保留，类型页签即时筛选', async () => {
  const s = store();
  await mount(KnowledgeList, { view: 'manage' });
  expect(document.querySelectorAll('tbody tr[data-row-key]')).toHaveLength(6);
  await tab('案例');
  expect(document.querySelectorAll('tbody tr[data-row-key]')).toHaveLength(2);
  const input = document.querySelector<HTMLInputElement>(
    'input[placeholder="标题、摘要、关键词、正文"]',
  )!;
  input.value = '风机振动';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  button('查询').click();
  await flush();
  expect(document.querySelectorAll('tbody tr[data-row-key]')).toHaveLength(1);
  button('明细').click();
  await flush();
  button('关闭').click();
  await flush();
  expect(input.value).toBe('风机振动');
  s.actorId.value = 'lin';
  await flush();
  expect(document.body.textContent).toContain('知识管理仅供知识管理员');
  expect(button('＋新增知识')).toBeUndefined();
});
it('员工检索列表仅已发布，无新增、来源选择或来源复核假入口', async () => {
  store(seedData(), 'lin');
  await mount(KnowledgeList, { view: 'search' });
  expect(document.querySelectorAll('tbody tr[data-row-key]')).toHaveLength(4);
  expect(document.body.textContent).not.toContain('温度测点维护经验（草稿）');
  expect(document.body.textContent).not.toContain('从已有资料整理');
  expect(button('＋新增知识')).toBeUndefined();
});

for (const module of ['exchange', 'research', 'competition'] as const) {
  it(`独立选择器 ${module} 选择即关联，不复制正文附件、不保存且固定模块`, async () => {
    localStorage.setItem(
      'vben-web-innovation:exchange:v1',
      JSON.stringify({ version: 1, topics: exchangeSeeds() }),
    );
    localStorage.setItem(
      'vben-web-innovation:research:v1',
      JSON.stringify({ version: 1, topics: researchSeeds() }),
    );
    localStorage.setItem(
      'vben-web-innovation:competition:v1',
      JSON.stringify(competitionSeeds()),
    );
    const target = {
      ...freshKnowledge(people[0]!),
      title: '手工标题',
      body: '手工正文',
    };
    const apply = vi.fn();
    const before = copy(target);
    const s = store([]);
    await mount(SourcePicker, {
      actor: people[0],
      target,
      fixedModule: module,
      directLink: true,
      onApply: apply,
    });
    expect(document.querySelectorAll('[role="tab"]')).toHaveLength(0);
    expect(button('确认到知识表单')).toBeUndefined();
    button('选择').click();
    await flush();
    expect(apply).toHaveBeenCalledOnce();
    const result = apply.mock.calls[0]![0];
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].selection.module).toBe(module);
    expect(result.sources[0].selection.parts).toEqual([]);
    expect(result.title).toBe('手工标题');
    expect(result.body).toBe('手工正文');
    expect(result.attachments).toEqual([]);
    expect(target).toEqual(before);
    expect(s.items.value).toEqual([]);
  });
}
it('直接关联拦截重复有效关系，保留已有范围及正文', async () => {
  const apply = vi.fn();
  const target = linkedForm();
  const before = copy(target);
  store([]);
  await mount(SourcePicker, {
    actor: people[0],
    target,
    fixedModule: 'exchange',
    directLink: true,
    onApply: apply,
  });
  button('选择').click();
  await flush();
  expect(document.body.textContent).toContain('该来源已关联');
  expect(apply).not.toHaveBeenCalled();
  expect(target).toEqual(before);
});
it('独立子表按模块分组，显示实时字段，切换后添加保持当前模块', async () => {
  const form = linkedForm();
  const research = linkedForm('research');
  form.sources!.push(...research.sources!);
  const data = readSources();
  data.exchange[0]!.title = '实时交流标题';
  localStorage.setItem(
    'vben-web-innovation:exchange:v1',
    JSON.stringify({ version: 1, topics: data.exchange }),
  );
  store([]);
  const update = vi.fn();
  await mount(SourcesPanel, {
    modelValue: form,
    actor: people[0],
    editable: true,
    dirty: false,
    blocked: false,
    'onUpdate:modelValue': update,
  });
  expect(document.querySelector('tbody')!.textContent).toContain(
    '实时交流标题',
  );
  expect(document.querySelector('tbody')!.textContent).not.toContain(
    research.sources![0]!.title,
  );
  await tab('课题攻关');
  const panel = document.querySelector(
    '[role="tabpanel"][id$="panel-research"]',
  )!;
  expect(panel.textContent).toContain('整体结题资料');
  expect(panel.textContent).toContain(research.sources![0]!.title);
  [...panel.querySelectorAll<HTMLButtonElement>('button')]
    .find((b) => b.textContent?.replaceAll(/\s/g, '') === '新增')!
    .click();
  await flush();
  const modal = document.querySelector('[role="dialog"]')!;
  expect(modal.textContent).toContain('添加课题攻关关联');
  expect(modal.querySelectorAll('[role="tab"]')).toHaveLength(0);
  button('关闭').click();
  await flush();
  expect(
    document.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
  ).toBe('课题攻关');
  expect(update).not.toHaveBeenCalled();
  expect(
    candidates('research', people[0]!, readSources()).length,
  ).toBeGreaterThan(0);
});

function sourcePanel(module = 'exchange') {
  return document.querySelector<HTMLElement>(
    `[role="tabpanel"][id$="panel-${module}"]`,
  )!;
}
function sourceButton(text: string, module = 'exchange') {
  return [
    ...sourcePanel(module).querySelectorAll<HTMLButtonElement>('button'),
  ].find((b) => b.textContent?.replaceAll(/\s/g, '') === text)!;
}
function sourceChecks() {
  return [
    ...sourcePanel().querySelectorAll<HTMLInputElement>(
      'tbody input[type="checkbox"]',
    ),
  ];
}
it('关联子表当前页全选、半选及取消，翻页和换模块清空勾选', async () => {
  const form = linkedForm();
  const original = form.sources![0]!;
  form.sources = Array.from({ length: 7 }, (_, i) => ({
    ...copy(original),
    key: `row-${i}`,
  }));
  store([]);
  await mount(SourcesPanel, {
    modelValue: form,
    actor: people[0],
    editable: true,
    dirty: false,
    blocked: false,
  });
  const header = () =>
    sourcePanel().querySelector<HTMLInputElement>(
      'thead input[type="checkbox"]',
    )!;
  expect(sourceChecks()).toHaveLength(5);
  expect(sourceButton('删除').disabled).toBe(true);
  sourceChecks()[0]!.click();
  await flush();
  expect(header().checked).toBe(false);
  expect(
    header().closest('label')!.querySelector('.ant-checkbox-indeterminate'),
  ).not.toBeNull();
  header().click();
  await flush();
  expect(sourceChecks().filter((v) => v.checked)).toHaveLength(5);
  header().click();
  await flush();
  expect(sourceChecks().every((v) => !v.checked)).toBe(true);
  header().click();
  await flush();
  sourcePanel().querySelector<HTMLElement>('.ant-pagination-item-2')!.click();
  await flush();
  expect(sourceChecks()).toHaveLength(2);
  expect(sourceChecks().every((v) => !v.checked)).toBe(true);
  expect(sourceButton('删除').disabled).toBe(true);
  sourceChecks()[0]!.click();
  await flush();
  await tab('课题攻关');
  expect(sourceButton('删除', 'research').disabled).toBe(true);
  await tab('交流研讨');
  expect(sourceChecks().every((v) => !v.checked)).toBe(true);
});
it('批量删除仅改变编辑态，刷新不恢复行，材料与历史保留，读取和只读禁止修改', async () => {
  const form = linkedForm();
  form.body = '已经整理的正文';
  const original = copy(form);
  store([]);
  const props = reactive({
    modelValue: form,
    actor: people[0]!,
    editable: true,
    dirty: false,
    blocked: false,
    'onUpdate:modelValue': (v: Knowledge) => {
      props.modelValue = v;
      props.dirty = true;
    },
  });
  await mount(SourcesPanel, props);
  sourceChecks()[0]!.click();
  await flush();
  sourceButton('删除').click();
  await flush();
  expect(sourcePanel().querySelectorAll('tbody tr[data-row-key]')).toHaveLength(
    0,
  );
  expect(props.modelValue.sources![0]!.removed).toBe(true);
  expect(props.modelValue.body).toBe(original.body);
  expect(props.modelValue.attachments).toEqual(original.attachments);
  expect(form.sources![0]!.removed).toBeFalsy();
  sourceButton('刷新').click();
  await flush();
  expect(sourcePanel().querySelectorAll('tbody tr[data-row-key]')).toHaveLength(
    0,
  );
  sourceButton('查看关联记录').click();
  await flush();
  expect(document.querySelector('[role="dialog"]')!.textContent).toContain(
    original.sources![0]!.title,
  );
  expect(document.querySelector('[role="dialog"]')!.textContent).toContain(
    '追溯',
  );
  document.querySelector<HTMLButtonElement>('.ant-modal-close')!.click();
  await flush();
  props.modelValue = copy(original);
  props.blocked = true;
  await flush();
  expect(sourceButton('新增').disabled).toBe(true);
  expect(sourceButton('删除').disabled).toBe(true);
  expect(sourceChecks()[0]!.disabled).toBe(true);
  props.blocked = false;
  props.editable = false;
  await flush();
  expect(sourceButton('新增')).toBeUndefined();
  expect(sourceButton('删除')).toBeUndefined();
  expect(sourceChecks()).toHaveLength(0);
});
it('关联删除保存失败保留编辑供重试，成功保存后重开只有追溯记录', async () => {
  const form = linkedForm();
  form.revision = 1;
  const s = store([form]);
  const commit = state.store.commit;
  let fail = true;
  state.store.commit = (...args: any[]) => {
    if (fail) throw new Error('保存失败');
    commit(...args);
  };
  await mount(KnowledgeDialog, { initial: copy(form) });
  await tab('关联来源');
  sourceChecks()[0]!.click();
  await flush();
  sourceButton('删除').click();
  await flush();
  button('保存草稿').click();
  await flush();
  expect(s.items.value[0]!.sources![0]!.removed).toBeFalsy();
  expect(sourceChecks()).toHaveLength(0);
  fail = false;
  button('保存草稿').click();
  await flush();
  expect(s.items.value[0]!.sources![0]!.removed).toBe(true);
  cleanup.pop()!();
  await mount(KnowledgeDialog, { initial: copy(s.items.value[0]!) });
  await tab('关联来源');
  expect(sourceChecks()).toHaveLength(0);
  sourceButton('查看关联记录').click();
  await flush();
  expect(document.body.textContent).toContain('追溯');
});
it('未保存删除关闭需确认，放弃后重开恢复已保存关联', async () => {
  const form = linkedForm();
  form.revision = 1;
  const close = vi.fn();
  const s = store([form]);
  await mount(KnowledgeDialog, { initial: copy(form), onClose: close });
  await tab('关联来源');
  sourceChecks()[0]!.click();
  await flush();
  sourceButton('删除').click();
  await flush();
  state.ask.mockResolvedValueOnce(false);
  button('关闭').click();
  await flush();
  expect(close).not.toHaveBeenCalled();
  button('关闭').click();
  await flush();
  expect(close).toHaveBeenCalledOnce();
  expect(state.ask).toHaveBeenCalledWith('放弃未保存的知识内容？');
  cleanup.pop()!();
  await mount(KnowledgeDialog, { initial: copy(s.items.value[0]!) });
  await tab('关联来源');
  expect(sourceChecks()).toHaveLength(1);
});

it('删除保留带入正文，关联记录单独清理并随父表单编辑保存', async () => {
  const form = linkedForm();
  form.body = '来源带入后人工整理的正文';
  form.sources![0]!.fields = ['body'];
  store([]);
  const props = reactive({
    modelValue: form,
    actor: people[0]!,
    editable: true,
    dirty: false,
    blocked: false,
    'onUpdate:modelValue': (v: Knowledge) => {
      props.modelValue = v;
      props.dirty = true;
    },
  });
  await mount(SourcesPanel, props);
  sourceChecks()[0]!.click();
  await flush();
  sourceButton('删除').click();
  await flush();
  expect(props.modelValue.body).toBe(form.body);
  sourceButton('查看关联记录').click();
  await flush();
  expect(document.body.textContent).toContain('已移除（追溯）');
  button('清理遗留材料').click();
  await flush();
  expect(document.body.textContent).toContain('涉及字段：body');
  button('取消').click();
  await flush();
  expect(props.modelValue.body).toBe(form.body);
  button('清理遗留材料').click();
  await flush();
  button('确认清理材料').click();
  await flush();
  expect(props.modelValue.body).toBe('');
  expect(props.modelValue.sources![0]!.removed).toBe(true);
  expect(form.body).toBe('来源带入后人工整理的正文');
});

it('知识管理仅草稿有删除按钮，取消不删除，确认后当前筛选保留', async () => {
  const s = store();
  await mount(KnowledgeList, { view: 'manage' });
  const row = (title: string) =>
    [...document.querySelectorAll('tbody tr[data-row-key]')].find((r) =>
      r.textContent?.includes(title),
    )!;
  expect(
    [...row('温度测点维护经验').querySelectorAll('button')].some((b) =>
      b.textContent?.includes('删除'),
    ),
  ).toBe(true);
  expect(row('风机振动异常').textContent).not.toContain('删除');
  expect(row('检修工装使用说明').textContent).not.toContain('删除');
  const input = document.querySelector<HTMLInputElement>(
    'input[placeholder="标题、摘要、关键词、正文"]',
  )!;
  input.value = '温度测点';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  button('查询').click();
  await flush();
  const before = copy(s.items.value);
  state.ask.mockResolvedValueOnce(false);
  button('删除').click();
  await flush();
  expect(s.items.value).toEqual(before);
  button('删除').click();
  await flush();
  expect(s.items.value).toHaveLength(before.length - 1);
  expect(input.value).toBe('温度测点');
  expect(document.querySelectorAll('tbody tr[data-row-key]')).toHaveLength(0);
});
it('知识管理删除确认期间数据已发布时拒绝删除，员工和检索页无删除入口', async () => {
  const error = vi.spyOn(message, 'error');
  const s = store();
  await mount(KnowledgeList, { view: 'manage' });
  state.ask.mockImplementationOnce(async () => {
    s.items.value.find((v) => v.status === '草稿')!.status = '已发布';
    return true;
  });
  const before = s.items.value.length;
  button('删除').click();
  await flush();
  expect(s.items.value).toHaveLength(before);
  expect(error).toHaveBeenCalledWith('仅草稿知识可删除');
  error.mockRestore();
  s.actorId.value = 'lin';
  await flush();
  expect(button('删除')).toBeUndefined();
  cleanup.pop()!();
  store();
  await mount(KnowledgeList, { view: 'search' });
  expect(button('删除')).toBeUndefined();
});
