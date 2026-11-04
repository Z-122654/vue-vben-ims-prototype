import type { CompetitionData } from './model';

import { createApp, h, nextTick, ref } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import ActivityForm from './activity.vue';
import EntryForm from './entry.vue';
import { copy, newActivity, newEntry, person } from './model';

const state = vi.hoisted(() => ({
  store: {} as any,
  detail: {} as any,
  upload: undefined as any,
  confirm: vi.fn(),
}));
vi.mock('./store', () => ({ useCompetition: () => state.store }));
vi.mock('./detail-dialog', () => ({ useDetailDialog: () => state.detail }));
vi.mock('ant-design-vue', async () => {
  const { defineComponent, h } = await import('vue');
  const container = defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  });
  const Button = defineComponent({
    props: ['disabled'],
    setup:
      (props, { slots }) =>
      () =>
        h('button', { disabled: props.disabled }, slots.default?.()),
  });
  const Upload = Object.assign(
    defineComponent({
      props: ['beforeUpload'],
      setup(props) {
        state.upload = props.beforeUpload;
        return () => h('div');
      },
    }),
    { LIST_IGNORE: 'ignore' },
  );
  return {
    Button,
    Upload,
    Modal: Object.assign(container, { confirm: state.confirm }),
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
    AutoComplete: container,
    Checkbox: container,
    DatePicker: container,
    Form: container,
    FormItem: container,
    Input: Object.assign(container, { TextArea: container }),
    Select: container,
    Switch: container,
    TabPane: container,
    Tabs: container,
    Tag: container,
    Space: container,
  };
});
vi.mock('./components/CompetitionFrame.vue', () => ({
  default: {
    render() {
      return h('div', (this as any).$slots.default?.());
    },
  },
}));
vi.mock('./components/EntryInformation.vue', () => ({
  default: { render: () => null },
}));
vi.mock('./components/FlowModal.vue', () => ({
  default: { render: () => null },
}));
vi.mock('./components/ImsTable.vue', () => ({
  default: { render: () => null },
}));
vi.mock('./components/ScoringTable.vue', () => ({
  default: { render: () => null },
}));
vi.mock('./components/PublicationHistory.vue', () => ({
  default: { render: () => null },
}));

class Reader {
  static current: Reader;
  abort = vi.fn();
  onload?: () => void;
  result = 'data:text/plain;base64,YQ==';
  readAsDataURL() {
    Reader.current = this;
  }
}
const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((f) => f());
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function mountForm(kind: 'activity' | 'entry') {
  vi.stubGlobal('FileReader', Reader);
  const actor = person(kind === 'activity' ? 'manager' : 'employee-a');
  const activity = newActivity(person('manager'));
  Object.assign(activity, {
    name: '附件验证活动',
    status: kind === 'activity' ? '草稿' : '报名中',
    expertIds: ['expert-a'],
    departments: ['运行部'],
    deadline: '2099-01-01',
    reviewEnd: '2099-01-02',
    type: '创新竞赛',
    contact: '演示联系人',
    phone: '000-0000',
    description: '演示活动说明',
    requirements: '演示申报要求',
  });
  const entry = newEntry(activity.id, actor.id);
  entry.name = '附件验证项目';
  entry.summary = '演示项目简介';
  entry.category = '管理创新';
  const data = ref<CompetitionData>({
    version: 1,
    activities: [activity],
    entries: kind === 'entry' ? [entry] : [],
    reviews: [],
  });
  const commit = vi.fn((action: (draft: CompetitionData) => void) => {
    const draft = copy(data.value);
    action(draft);
    data.value = draft;
  });
  let closeGuard: () => Promise<boolean>;
  state.store = { data, actor: ref(actor), commit };
  state.detail = {
    recordId: ref(kind === 'activity' ? activity.id : entry.id),
    activityId: ref(activity.id),
    onBeforeClose: (guard: () => Promise<boolean>) => {
      closeGuard = guard;
    },
    close: () => closeGuard(),
    openDetail: vi.fn(),
    replaceId: vi.fn(),
  };
  const host = document.createElement('div');
  const app = createApp(kind === 'activity' ? ActivityForm : EntryForm);
  app.mount(host);
  cleanups.push(() => app.unmount());
  await nextTick();
  const button = (label: string) =>
    [
      ...host.querySelectorAll<HTMLButtonElement>('.detail-toolbar button'),
    ].find((b) => b.textContent?.replaceAll(' ', '') === label)!;
  return {
    host,
    data,
    commit,
    button,
    close: () => closeGuard(),
    upload: () =>
      state.upload(
        new File(['a'], kind === 'activity' ? '材料.pdf' : '材料.doc'),
      ) as Promise<unknown>,
  };
}

describe('真实活动与申报表单的附件保护接线', () => {
  it.each(['manager', 'manager-operation', 'employee-a'])(
    '%s：申报表单的审核及补交按钮仅对有组织权限的发布人显示',
    async (actorId) => {
      const { data, button } = await mountForm('entry');
      state.store.actor.value = {
        ...person(actorId),
        managedDepartments: ['科技管理部'],
      };
      const pending = copy(data.value);
      pending.activities[0]!.publisherId = 'manager-operation';
      pending.activities[0]!.publisherName = '赵启航';
      pending.entries[0]!.status = '待审核';
      data.value = pending;
      await nextTick();
      expect(!!button('审核通过')).toBe(actorId === 'manager-operation');
      expect(!!button('退回补充')).toBe(actorId === 'manager-operation');
      const returned = copy(data.value);
      returned.entries[0]!.status = '退回修改';
      returned.entries[0]!.supplementDeadline = '2099-01-01';
      data.value = returned;
      await nextTick();
      expect(!!button('延长补交期限')).toBe(actorId === 'manager-operation');
      expect(!!button('终止申报')).toBe(actorId === 'manager-operation');
    },
  );
  it.each(['activity', 'entry'] as const)(
    '%s：读取时禁用保存和提交/发布，结束后恢复并保存附件',
    async (kind) => {
      const { upload, button, commit, data, host } = await mountForm(kind);
      const pending = upload();
      await nextTick();
      expect(host.textContent).toContain('正在读取 1 个附件');
      expect(button('保存').disabled).toBe(true);
      expect(button(kind === 'activity' ? '发布活动' : '提交').disabled).toBe(
        true,
      );
      button('保存').click();
      expect(commit).not.toHaveBeenCalled();
      Reader.current.onload!();
      await pending;
      await nextTick();
      expect(button('保存').disabled).toBe(false);
      expect(button(kind === 'activity' ? '发布活动' : '提交').disabled).toBe(
        false,
      );
      button('保存').click();
      await nextTick();
      expect(commit).toHaveBeenCalledOnce();
      expect(
        (kind === 'activity'
          ? data.value.activities[0]
          : data.value.entries[0])!.attachments[0]!.name,
      ).toBe(kind === 'activity' ? '材料.pdf' : '材料.doc');
      button(kind === 'activity' ? '发布活动' : '提交').click();
      if (kind === 'activity') state.confirm.mock.calls.at(-1)![0].onOk();
      await nextTick();
      const persisted = (
        kind === 'activity' ? data.value.activities[0] : data.value.entries[0]
      )!;
      expect(persisted.status).toBe(kind === 'activity' ? '报名中' : '待审核');
      expect(persisted.attachments[0]!.name).toBe(
        kind === 'activity' ? '材料.pdf' : '材料.doc',
      );
    },
  );
  it.each(['activity', 'entry'] as const)(
    '%s：关闭和刷新使用同一取消读取保护',
    async (kind) => {
      const { upload, button, close } = await mountForm(kind);
      const pending = upload();
      const closing = close();
      expect(state.confirm.mock.calls[0]![0].title).toContain('附件正在读取');
      state.confirm.mock.calls[0]![0].onCancel();
      expect(await closing).toBe(false);
      await nextTick();
      button('刷新').click();
      expect(state.confirm.mock.calls[1]![0].title).toContain('取消读取并刷新');
      state.confirm.mock.calls[1]![0].onOk();
      await pending;
      await nextTick();
      expect(Reader.current.abort).toHaveBeenCalledOnce();
      expect(button('保存').disabled).toBe(false);
    },
  );
});
