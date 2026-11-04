import type { Knowledge } from './model';

import { beforeEach, expect, it, vi } from 'vitest';

import {
  copy,
  deleteKnowledge,
  freshKnowledge,
  people,
  saveKnowledge,
} from './model';
const key = 'vben-web-innovation:knowledge:v1';
beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});
it('成功保存刷新保留，空间失败不改变已保存资料和内存', async () => {
  const store = (await import('./store')).useKnowledge();
  const f = freshKnowledge(people[0]!);
  f.title = '持久化资料';
  store.commit((d) => saveKnowledge(d, people[0]!, f));
  const before = JSON.stringify(store.items.value);
  const raw = localStorage.getItem(key);
  const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  expect(() =>
    store.commit((d) => {
      d[0]!.title = '不应写入';
    }),
  ).toThrow('未保存');
  expect(JSON.stringify(store.items.value)).toBe(before);
  spy.mockRestore();
  store.refresh();
  expect(localStorage.getItem(key)).toBe(raw);
  expect(JSON.stringify(store.items.value)).toBe(before);
});
it('重读存储并拒绝旧修订，不产生部分保存', async () => {
  const store = (await import('./store')).useKnowledge();
  const f = copy(store.items.value.find((v) => v.status === '草稿')!);
  const saved = JSON.parse(localStorage.getItem(key)!);
  const changed = saved.items.find((v: Knowledge) => v.id === f.id);
  changed.revision++;
  changed.title = '其他窗口更新';
  localStorage.setItem(key, JSON.stringify(saved));
  expect(() => store.commit((d) => saveKnowledge(d, people[0]!, f))).toThrow(
    '已发生变化',
  );
  expect(
    JSON.parse(localStorage.getItem(key)!).items.find(
      (v: Knowledge) => v.id === f.id,
    ).title,
  ).toBe('其他窗口更新');
});
it('读取损坏保留原数据，保存拒绝覆盖；恢复后刷新清除警告', async () => {
  const store = (await import('./store')).useKnowledge();
  const raw = localStorage.getItem(key)!;
  localStorage.setItem(key, '{invalid');
  store.refresh();
  expect(store.warning.value).not.toBe('');
  expect(() => store.commit(() => {})).toThrow('无法读取');
  expect(localStorage.getItem(key)).toBe('{invalid');
  localStorage.setItem(key, raw);
  store.refresh();
  expect(store.warning.value).toBe('');
});
it('重置不影响其他模块，重置前旧弹窗无法覆盖种子', async () => {
  for (const m of ['exchange', 'research', 'competition'])
    localStorage.setItem(`vben-web-innovation:${m}:v1`, 'existing');
  const store = (await import('./store')).useKnowledge();
  const old = copy(store.items.value.find((v) => v.status === '草稿')!);
  store.reset();
  expect(() => store.commit((d) => saveKnowledge(d, people[0]!, old))).toThrow(
    '已发生变化',
  );
  for (const m of ['exchange', 'research', 'competition'])
    expect(localStorage.getItem(`vben-web-innovation:${m}:v1`)).toBe(
      'existing',
    );
});
it('其他窗口下架事件刷新可见数据，业务异常不持久化临时修改', async () => {
  const store = (await import('./store')).useKnowledge();
  const saved = JSON.parse(localStorage.getItem(key)!);
  saved.items[0].status = '已下架';
  saved.items[0].revision++;
  localStorage.setItem(key, JSON.stringify(saved));
  window.dispatchEvent(new StorageEvent('storage', { key }));
  expect(store.items.value[0]!.status).toBe('已下架');
  const before = localStorage.getItem(key);
  expect(() =>
    store.commit((d) => {
      d[0]!.title = 'partial';
      throw new Error('stop');
    }),
  ).toThrow('stop');
  expect(localStorage.getItem(key)).toBe(before);
});

it('草稿删除写入失败保留原数据，重试后刷新不恢复且不改源模块', async () => {
  const store = (await import('./store')).useKnowledge();
  const draft = copy(store.items.value.find((v) => v.status === '草稿')!);
  for (const m of ['exchange', 'research', 'competition'])
    localStorage.setItem(`vben-web-innovation:${m}:v1`, 'existing');
  const before = copy(store.items.value);
  const raw = localStorage.getItem(key);
  const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  expect(() =>
    store.commit((all) =>
      deleteKnowledge(all, people[0]!, draft.id, draft.revision),
    ),
  ).toThrow('未保存');
  expect(store.items.value).toEqual(before);
  expect(localStorage.getItem(key)).toBe(raw);
  spy.mockRestore();
  store.commit((all) =>
    deleteKnowledge(all, people[0]!, draft.id, draft.revision),
  );
  store.refresh();
  expect(store.items.value.some((v) => v.id === draft.id)).toBe(false);
  for (const m of ['exchange', 'research', 'competition'])
    expect(localStorage.getItem(`vben-web-innovation:${m}:v1`)).toBe(
      'existing',
    );
});
