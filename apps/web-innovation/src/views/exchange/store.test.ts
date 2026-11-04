import { beforeEach, expect, it, vi } from 'vitest';

import { freshTopic, people, saveTopic, topicAction } from './model';
it('读取异常恢复后刷新清除过期警告，且不覆盖原有数据', async () => {
  const key = 'vben-web-innovation:exchange:v1';
  const store = (await import('./store')).useExchange();
  const saved = localStorage.getItem(key)!;
  const spy = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
    throw new Error('temporary');
  });
  store.refresh();
  expect(store.warning.value).not.toBe('');
  spy.mockRestore();
  store.refresh();
  expect(store.warning.value).toBe('');
  expect(localStorage.getItem(key)).toBe(saved);
  expect(store.topics.value).toEqual(JSON.parse(saved).topics);
});
it('另一页签更新后，旧表单不能覆盖最新存储', async () => {
  const store = (await import('./store')).useExchange();
  const t = freshTopic(people[2]!);
  t.title = '跨页签验证';
  store.commit((d) => saveTopic(d, people[2]!, t));
  const form = JSON.parse(
    JSON.stringify(store.topics.value.find((v) => v.id === t.id)),
  );
  const key = 'vben-web-innovation:exchange:v1';
  const latest = JSON.parse(localStorage.getItem(key)!);
  const changed = latest.topics.find((v: { id: string }) => v.id === t.id);
  changed.revision++;
  changed.title = '另一页签已保存';
  localStorage.setItem(key, JSON.stringify(latest));
  expect(() => store.commit((d) => saveTopic(d, people[2]!, form))).toThrow(
    '已发生变化',
  );
  expect(
    JSON.parse(localStorage.getItem(key)!).topics.find(
      (v: { id: string }) => v.id === t.id,
    ).title,
  ).toBe('另一页签已保存');
});
beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});
it('持久化失败不改变内存记录，重新加载保留已成功保存的数据', async () => {
  const { useExchange } = await import('./store');
  const store = useExchange();
  const t = freshTopic(people[2]!);
  t.title = '本地持久化验证';
  store.commit((d) => saveTopic(d, people[2]!, t));
  const before = JSON.stringify(store.topics.value);
  const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  expect(() =>
    store.commit((d) => {
      d[0]!.title = '不应写入';
    }),
  ).toThrow('未保存');
  expect(JSON.stringify(store.topics.value)).toBe(before);
  spy.mockRestore();
  vi.resetModules();
  const reload = (await import('./store')).useExchange();
  expect(reload.topics.value.some((v) => v.title === '本地持久化验证')).toBe(
    true,
  );
});
it('业务异常不产生部分保存，重置不清理竞赛数据', async () => {
  localStorage.setItem('vben-web-innovation:competition:v1', 'existing');
  const store = (await import('./store')).useExchange();
  const before = JSON.stringify(store.topics.value);
  expect(() =>
    store.commit((d) => {
      d[0]!.title = '临时';
      throw new Error('blocked');
    }),
  ).toThrow('blocked');
  expect(JSON.stringify(store.topics.value)).toBe(before);
  store.reset();
  expect(localStorage.getItem('vben-web-innovation:competition:v1')).toBe(
    'existing',
  );
});

it('其他窗口重置示例后，旧草稿不能覆盖重置后的同标识记录', async () => {
  const store = (await import('./store')).useExchange();
  const draft = JSON.parse(
    JSON.stringify(store.topics.value.find((t) => t.status === '草稿')),
  );
  const author = people.find((p) => p.id === draft.authorId)!;
  draft.title = '旧窗口不应写入';
  store.reset();
  expect(() => store.commit((all) => saveTopic(all, author, draft))).toThrow(
    '已发生变化',
  );
  expect(store.topics.value.some((t) => t.title === draft.title)).toBe(false);
});

it('示例先删除再重置，也不允许删除前的草稿复活覆盖', async () => {
  const store = (await import('./store')).useExchange();
  const draft = JSON.parse(
    JSON.stringify(store.topics.value.find((t) => t.status === '草稿')),
  );
  const author = people.find((p) => p.id === draft.authorId)!;
  store.commit((all) =>
    topicAction(all, author, draft.id, draft.revision, '删除'),
  );
  store.reset();
  expect(() => store.commit((all) => saveTopic(all, author, draft))).toThrow(
    '已发生变化',
  );
});
