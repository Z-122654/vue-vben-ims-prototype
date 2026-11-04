import type { Attachment, Knowledge } from './model';

import { afterEach, expect, it, vi } from 'vitest';

import {
  canView,
  copy,
  deleteKnowledge,
  emptyFilters,
  freshKnowledge,
  people,
  saveKnowledge,
  searchKnowledge,
  takeDown,
} from './model';
import { seedData } from './seed';
const admin = people[0]!;
const curator = people[1]!;
const employee = people[2]!;
const file = (): Attachment => ({
  id: 'file-1',
  name: '示例.doc',
  size: 3,
  content: 'data:application/msword;base64,YWJj',
  uploader: admin.name,
  time: '',
});
function form(type = '成果') {
  return {
    ...freshKnowledge(admin),
    title: '演示知识',
    type,
    category: '运行',
    summary: '概要',
    body: '有效正文',
  };
}
function published() {
  const all: Knowledge[] = [];
  saveKnowledge(all, admin, form(), true);
  return { all, item: all[0]! };
}
afterEach(() => vi.useRealTimers());
it('只有知识管理员可新建、修改、发布、下架，其他角色不因来源身份获得权限', () => {
  const all: Knowledge[] = [];
  expect(() => saveKnowledge(all, employee, form())).toThrow('仅知识管理员');
  expect(all).toEqual([]);
  saveKnowledge(all, admin, form(), true);
  expect(() =>
    takeDown(all, employee, all[0]!.id, all[0]!.revision, '说明'),
  ).toThrow('仅知识管理员');
});
it('草稿保存只要求标题，普通员工不可见，其他知识管理员可接续整理', () => {
  const all: Knowledge[] = [];
  const v = freshKnowledge(admin);
  v.title = '仅标题';
  saveKnowledge(all, admin, v);
  expect(canView(all[0]!, employee)).toBe(false);
  expect(canView(all[0]!, curator)).toBe(true);
  saveKnowledge(all, curator, copy(all[0]!));
  expect(all[0]!.curatorId).toBe(curator.id);
});
it.each(['title', 'type', 'category', 'summary', 'body'] as const)(
  '发布缺少 %s 拒绝且无部分保存',
  (key) => {
    const all: Knowledge[] = [];
    const v = form();
    v[key] = '';
    expect(() => saveKnowledge(all, admin, v, true)).toThrow();
    expect(all).toEqual([]);
  },
);
it.each(['成果', '案例'])('%s发布即使有附件也要求有效正文', (type) => {
  const all: Knowledge[] = [];
  const v = form(type);
  v.body = ' \n ';
  v.attachments = [file()];
  expect(() => saveKnowledge(all, admin, v, true)).toThrow('须填写正文');
  expect(all).toEqual([]);
});
it('文档允许正文或非空附件，二者皆空拒绝；保存草稿可空', () => {
  const all: Knowledge[] = [];
  const v = form('文档');
  v.body = '';
  expect(() => saveKnowledge(all, admin, v, true)).toThrow('正文或上传');
  saveKnowledge(all, admin, v);
  const ready = copy(all[0]!);
  ready.attachments = [file()];
  saveKnowledge(all, admin, ready, true);
  expect(all[0]!.status).toBe('已发布');
  const text = form('文档');
  saveKnowledge(all, admin, text, true);
  expect(all).toHaveLength(2);
});
it('已发布不可直接更新，必须有理由下架，保存下架修改不重新公开', () => {
  const { all, item } = published();
  const before = copy(item);
  expect(() =>
    saveKnowledge(all, admin, { ...copy(item), title: '绕过' }),
  ).toThrow('先下架');
  expect(() => takeDown(all, admin, item.id, item.revision, ' ')).toThrow(
    '原因',
  );
  expect(item).toEqual(before);
  takeDown(all, admin, item.id, item.revision, '修订');
  saveKnowledge(all, curator, { ...copy(item), body: '修订版' });
  expect(item.status).toBe('已下架');
  expect(searchKnowledge(all, employee, 'search', emptyFilters())).toEqual([]);
  expect(item.history.find((h) => h.action === '下架')?.note).toBe('修订');
});
it('重新发布记录实际发布人和时间，保留首次发布时间、原作者和历史', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-01T10:00:00'));
  const v = form();
  v.originalAuthor = '原作者';
  v.originalDepartment = '原部门';
  const all: Knowledge[] = [];
  saveKnowledge(all, admin, v, true);
  const item = all[0]!;
  const first = item.firstPublishedAt;
  takeDown(all, curator, item.id, item.revision, '更正');
  vi.setSystemTime(new Date('2026-11-02T10:00:00'));
  saveKnowledge(all, curator, copy(item), true);
  expect(item.firstPublishedAt).toBe(first);
  expect(item.publishedAt).not.toBe(first);
  expect(item.publisherId).toBe(curator.id);
  expect(item.curatorId).toBe(curator.id);
  expect(item.originalAuthor).toBe('原作者');
  expect(item.originalDepartment).toBe('原部门');
  expect(item.history.map((h) => h.action)).toEqual([
    '发布',
    '下架',
    '重新发布',
  ]);
});
it('下架再发布重新校验，缺项失败不写入新时间或状态', () => {
  const { all, item } = published();
  takeDown(all, admin, item.id, item.revision, '修订');
  const before = copy(item);
  expect(() =>
    saveKnowledge(all, admin, { ...copy(item), summary: ' ' }, true),
  ).toThrow('摘要');
  expect(item).toEqual(before);
});
it('防止旧弹窗覆盖或复活记录；禁止利用表单改写历史状态和发布人', () => {
  const { all, item } = published();
  const old = copy(item);
  takeDown(all, admin, item.id, item.revision, '修订');
  expect(() => saveKnowledge(all, admin, old)).toThrow('已发生变化');
  expect(() => saveKnowledge([], admin, copy(item))).toThrow('旧表单');
  saveKnowledge(all, curator, {
    ...copy(item),
    publisherId: 'forged',
    history: [],
    status: '已发布',
  });
  expect(item.publisherId).toBe(admin.id);
  expect(item.status).toBe('已下架');
  expect(item.history).toHaveLength(3);
});
it.each(['empty', 'format', 'size', 'count', 'duplicate'] as const)(
  '附件 %s 校验失败不保存',
  (reason) => {
    const all: Knowledge[] = [];
    const v = form('文档');
    v.attachments = [file()];
    if (reason === 'empty') v.attachments[0]!.size = 0;
    if (reason === 'format') v.attachments[0]!.name = 'run.exe';
    if (reason === 'size') v.attachments[0]!.size = 1024 * 1024 + 1;
    if (reason === 'count')
      v.attachments = Array.from({ length: 7 }, (_, i) => ({
        ...file(),
        id: `${i}`,
      }));
    if (reason === 'duplicate') v.attachments.push(file());
    expect(() => saveKnowledge(all, admin, v)).toThrow('附件');
    expect(all).toEqual([]);
  },
);
it('员工只检索已发布，管理员管理可见全部，检索入口仍只显示已发布', () => {
  const all = seedData();
  expect(searchKnowledge(all, employee, 'search', emptyFilters())).toHaveLength(
    4,
  );
  expect(searchKnowledge(all, admin, 'search', emptyFilters())).toHaveLength(4);
  expect(searchKnowledge(all, admin, 'manage', emptyFilters())).toHaveLength(6);
  expect(searchKnowledge(all, employee, 'manage', emptyFilters())).toEqual([]);
});
it.each([
  'title',
  'summary',
  'keywords',
  'category',
  'body',
  'scenario',
] as const)('支持 %s 检索，不依赖附件解析', (field) => {
  const { all, item } = published();
  item[field] = '唯一检索字符串';
  expect(
    searchKnowledge(all, employee, 'search', {
      ...emptyFilters(),
      query: '唯一检索',
    }),
  ).toHaveLength(1);
});
it('不搜索附件内容、下架资料和其他类型残留字段，切换类型保留未用值但不展示检索', () => {
  const all: Knowledge[] = [];
  const v = form('文档');
  v.resultName = '残留成果字样';
  v.attachments = [{ ...file(), content: 'data:text/plain,附件秘密检索词' }];
  saveKnowledge(all, admin, v, true);
  expect(
    searchKnowledge(all, employee, 'search', {
      ...emptyFilters(),
      query: '附件秘密',
    }),
  ).toEqual([]);
  expect(
    searchKnowledge(all, employee, 'search', {
      ...emptyFilters(),
      query: '残留成果',
    }),
  ).toEqual([]);
  expect(all[0]!.resultName).toBe('残留成果字样');
});
it('类型、专业、整理人、日期及状态筛选组合正确', () => {
  const all = seedData();
  const first = all[0]!;
  expect(
    searchKnowledge(all, admin, 'manage', {
      ...emptyFilters(),
      type: '成果',
      category: '运行',
      curatorId: first.curatorId,
      from: first.publishedAt.slice(0, 10),
      to: first.publishedAt.slice(0, 10),
      status: '已发布',
    }),
  ).toEqual([first]);
  expect(
    searchKnowledge(all, admin, 'manage', {
      ...emptyFilters(),
      status: '草稿',
      from: '2000-01-01',
    }),
  ).toEqual([]);
});

it('知识管理员可删除草稿，其他状态、员工、旧版本及已删除记录均拒绝', () => {
  const all = seedData();
  const draft = all.find((v) => v.status === '草稿')!;
  const before = copy(all);
  expect(() =>
    deleteKnowledge(all, employee, draft.id, draft.revision),
  ).toThrow('仅知识管理员');
  expect(() =>
    deleteKnowledge(all, admin, draft.id, draft.revision + 1),
  ).toThrow('已发生变化');
  for (const v of all.filter((v) => v.status !== '草稿'))
    expect(() => deleteKnowledge(all, admin, v.id, v.revision)).toThrow(
      '仅草稿',
    );
  expect(all).toEqual(before);
  deleteKnowledge(all, curator, draft.id, draft.revision);
  expect(all).toEqual(before.filter((v) => v.id !== draft.id));
  expect(() => deleteKnowledge(all, admin, draft.id, draft.revision)).toThrow(
    '已不存在',
  );
  expect(() => saveKnowledge(all, admin, draft)).toThrow('已不存在');
});
