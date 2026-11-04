import { expect, it } from 'vitest';

import { copy, people, removeTopic, saveClosure } from './model';
import { seedData } from './seed';

it('旧撤回草稿缺首次提交时间但保留提交历史时仍禁止删除', () => {
  const t = seedData().find((v) => v.status === '待立项')!;
  t.status = '草稿';
  t.firstSubmittedAt = '';
  const all = [t];
  const before = copy(all);
  expect(() => removeTopic(all, people[2]!, t.id, t.revision)).toThrow(
    '从未提交',
  );
  expect(all).toEqual(before);
});

it('申请结题列出未完成任务，失败不改变状态、时间及草稿', () => {
  const t = seedData().find((v) => v.status === '攻关中')!;
  const before = copy(t);
  expect(() => saveClosure(t, people[2]!, t.revision, t.closure, true)).toThrow(
    t.tasks[1]!.name,
  );
  expect(t).toEqual(before);
});
