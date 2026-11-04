import { createApp, nextTick, reactive } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import FlowModal from './components/FlowModal.vue';
import { auditEntry, copy, newEntry, person, saveEntry } from './model';
import { seedData } from './seed';

vi.mock('ant-design-vue', async () => {
  const { defineComponent, h } = await import('vue');
  const container = defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  });
  return {
    Modal: container,
    Form: container,
    FormItem: container,
    Popover: container,
    Input: defineComponent({
      props: ['value'],
      setup: (props) => () => h('input', { value: props.value }),
    }),
  };
});
vi.mock('./components/ImsSection.vue', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    default: defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h('section', slots.default?.()),
    }),
  };
});

describe('材料流程图历史节点', () => {
  it('审核节点显示固定发布人，已有处理记录继续显示实际处理人', () => {
    const data = seedData();
    const activity = data.activities[0]!;
    activity.publisherId = 'manager-operation';
    activity.publisherName = '赵启航';
    const entry = data.entries[0]!;
    const host = document.createElement('div');
    const app = createApp(FlowModal, { open: true, entry, activity });
    app.mount(host);
    try {
      expect(host.querySelectorAll('.flow-node')[2]!.textContent).toContain(
        '活动发布人 · 赵启航',
      );
      for (const record of entry.history)
        expect(host.textContent).toContain(record.actor);
    } finally {
      app.unmount();
    }
  });
  it.each([
    '草稿',
    '待审核',
    '退回修改',
    '审核通过',
    '已撤回',
    '已终止',
  ] as const)(
    '%s没有历史提交时间时，节点与当前状态一致但不补造时间',
    (status) => {
      const entry = newEntry('activity', 'employee-a');
      entry.status = status;
      const before = copy(entry);
      const host = document.createElement('div');
      const app = createApp(FlowModal, { open: true, entry });
      app.mount(host);
      try {
        const nodes = host.querySelectorAll('.flow-node');
        expect(nodes[1]!.classList.contains('complete')).toBe(
          status !== '草稿',
        );
        expect(nodes[3]!.classList.contains('complete')).toBe(
          status === '审核通过',
        );
        expect(nodes[2]!.classList.contains('current')).toBe(
          status === '待审核',
        );
        expect(nodes[1]!.classList.contains('current')).toBe(
          status === '退回修改',
        );
        expect(host.textContent?.includes('提交时间历史未记录')).toBe(
          status !== '草稿',
        );
        expect(entry).toEqual(before);
      } finally {
        app.unmount();
      }
    },
  );

  it('退回等待填报人，实际重提后切换为管理员审核，保留退回历史', async () => {
    const data = seedData();
    const entry = reactive(data.entries[0]!);
    data.entries[0] = entry;
    entry.status = '待审核';
    auditEntry(
      data,
      person('manager'),
      entry.id,
      false,
      '补充说明',
      '2099-12-31',
    );
    const history = copy(entry.history);
    const host = document.createElement('div');
    const app = createApp(FlowModal, { open: true, entry });
    app.mount(host);
    try {
      expect(
        host.querySelectorAll('.flow-node')[1]!.classList.contains('current'),
      ).toBe(true);
      expect(
        host.querySelectorAll('.flow-node')[2]!.classList.contains('current'),
      ).toBe(false);
      expect(host.textContent).toContain('等待填报人补充材料／重新提交');
      saveEntry(data, person(entry.ownerId), copy(entry), true);
      await nextTick();
      expect(
        host.querySelectorAll('.flow-node')[1]!.classList.contains('current'),
      ).toBe(false);
      expect(
        host.querySelectorAll('.flow-node')[2]!.classList.contains('current'),
      ).toBe(true);
      expect(host.textContent).not.toContain('等待填报人补充材料／重新提交');
      expect(entry.history.slice(0, history.length)).toEqual(history);
      expect(entry.history.at(-1)?.action).toBe('提交申报');
    } finally {
      app.unmount();
    }
  });
});
