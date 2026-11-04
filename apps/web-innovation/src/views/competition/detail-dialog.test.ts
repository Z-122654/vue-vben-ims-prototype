import { describe, expect, it, vi } from 'vitest';

import { createDetailStack } from './detail-dialog';

describe('明细弹窗导航', () => {
  it('子明细关闭后恢复同一个父弹窗，新建保存只更新当前记录编号', async () => {
    const dialogs = createDetailStack();
    await dialogs.open({ kind: 'activity', id: 'new' });
    const parent = dialogs.panels.value[0]!;
    dialogs.replaceId(parent.key, 'saved-activity');
    await dialogs.open({ kind: 'entry', id: 'entry-1' });
    await dialogs.close();
    expect(dialogs.panels.value).toHaveLength(1);
    expect(dialogs.panels.value[0]).toBe(parent);
    expect(parent.id).toBe('saved-activity');
  });

  it('取消未保存提醒时保留弹窗，阻止关闭及打开子明细', async () => {
    const dialogs = createDetailStack();
    await dialogs.open({ kind: 'entry', id: 'new', activityId: 'activity-1' });
    const panel = dialogs.panels.value[0]!;
    dialogs.guards.set(panel.key, () => false);
    await dialogs.close();
    await dialogs.open({ kind: 'result', id: 'activity-1' });
    expect(dialogs.panels.value).toEqual([panel]);
    expect(await dialogs.closeAll()).toBe(false);
    expect(dialogs.panels.value).toEqual([panel]);
  });

  it('离开列表时从子到父检查未保存内容，并清理关闭检查', async () => {
    const dialogs = createDetailStack();
    await dialogs.open({ kind: 'activity', id: 'activity-1' });
    await dialogs.open({ kind: 'entry', id: 'entry-1' });
    const order: number[] = [];
    for (const panel of dialogs.panels.value) {
      dialogs.guards.set(panel.key, () => {
        order.push(panel.key);
        return true;
      });
    }
    const expected = dialogs.panels.value.map((panel) => panel.key).reverse();
    expect(await dialogs.closeAll()).toBe(true);
    expect(order).toEqual(expected);
    expect(dialogs.panels.value).toEqual([]);
    expect(dialogs.guards.size).toBe(0);
  });

  it('重复点击关闭不会绕过正在等待的确认', async () => {
    const dialogs = createDetailStack();
    await dialogs.open({ kind: 'activity', id: 'activity-1' });
    let confirm!: (allowed: boolean) => void;
    const guard = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          confirm = resolve;
        }),
    );
    dialogs.guards.set(dialogs.panels.value[0]!.key, guard);
    const pending = dialogs.close();
    await dialogs.close();
    expect(guard).toHaveBeenCalledTimes(1);
    expect(dialogs.panels.value).toHaveLength(1);
    confirm(true);
    await pending;
    expect(dialogs.panels.value).toEqual([]);
  });
});
