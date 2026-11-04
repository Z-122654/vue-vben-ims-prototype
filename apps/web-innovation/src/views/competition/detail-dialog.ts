import type { ComputedRef, InjectionKey } from 'vue';

import { inject, ref } from 'vue';

export type DetailKind = 'activity' | 'entry' | 'result' | 'review';
export type CloseGuard = () => boolean | Promise<boolean>;
export interface DetailTarget {
  kind: DetailKind;
  id: string;
  activityId?: string;
}
export interface DetailPanel extends DetailTarget {
  key: number;
}
export interface DetailContext {
  recordId: ComputedRef<string>;
  activityId: ComputedRef<string>;
  openDetail: (target: DetailTarget) => Promise<void>;
  replaceId: (id: string) => void;
  close: () => Promise<void>;
  onBeforeClose: (guard: CloseGuard) => void;
}
export const detailContextKey: InjectionKey<DetailContext> = Symbol(
  'competition-detail-dialog',
);

export function useDetailDialog() {
  const context = inject(detailContextKey);
  if (!context) throw new Error('明细组件需要在明细弹窗中打开。');
  return context;
}

// 每个列表维护自己的弹窗栈；子明细关闭后恢复父明细及原来的页签。
export function createDetailStack() {
  const panels = ref<DetailPanel[]>([]);
  const guards = new Map<number, CloseGuard>();
  let nextKey = 0;
  let checking = false;
  async function allowed(action: () => void, all = false) {
    if (checking) return false;
    checking = true;
    try {
      const targets = all
        ? [...panels.value].reverse()
        : panels.value.slice(-1);
      for (const target of targets) {
        if ((await guards.get(target.key)?.()) === false) return false;
      }
      action();
      return true;
    } finally {
      checking = false;
    }
  }
  async function open(target: DetailTarget) {
    await allowed(() => panels.value.push({ ...target, key: ++nextKey }));
  }
  async function close() {
    await allowed(() => {
      const panel = panels.value.pop();
      if (panel) guards.delete(panel.key);
    });
  }
  async function closeAll() {
    return allowed(() => {
      panels.value = [];
      guards.clear();
    }, true);
  }
  function replaceId(key: number, id: string) {
    const panel = panels.value.find((item) => item.key === key);
    if (panel) panel.id = id;
  }
  return { panels, guards, open, close, closeAll, replaceId };
}
