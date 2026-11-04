import { describe, expect, it } from 'vitest';

import {
  adjustDates,
  canEdit,
  canView,
  copy,
  deleteProgress,
  freshProgress,
  people,
  processTopic,
  saveProgress,
  saveTopic,
} from './model';
import { seedData } from './seed';

const admin = people[0]!;
const leader = people[2]!;
const member = people[3]!;

describe('撤回后的代填课题', () => {
  it('负责人重提并撤回后可修改重提，填报人仍可访问，成员和其他管理员不可访问草稿', () => {
    const t = seedData().find((v) => v.status === '待立项')!;
    t.ownerId = admin.id;
    processTopic(t, admin, t.revision, 'return', '请补充');
    const all = [t];
    saveTopic(all, leader, copy(t), true);
    processTopic(t, leader, t.revision, 'withdraw');
    expect(t.status).toBe('草稿');
    expect(canEdit(t, leader)).toBe(true);
    expect(canEdit(t, admin)).toBe(true);
    expect(canView(t, member)).toBe(false);
    expect(canView(t, people[1]!)).toBe(false);
    const first = t.firstSubmittedAt;
    const form = copy(t);
    form.name = '负责人撤回后修改';
    saveTopic(all, leader, form, true);
    expect(t.status).toBe('待立项');
    expect(t.name).toBe(form.name);
    expect(t.ownerId).toBe(admin.id);
    expect(t.firstSubmittedAt).toBe(first);
  });

  it('未提交的代填草稿仍只对填报人开放；旧撤回记录可按提交历史识别', () => {
    const t = seedData().find((v) => v.status === '草稿')!;
    t.ownerId = admin.id;
    expect(canView(t, leader)).toBe(false);
    expect(canView(t, admin)).toBe(true);
    t.history.push({
      id: 'prior-submit',
      action: '提交立项',
      personId: admin.id,
      time: '',
      note: '',
    });
    expect(canEdit(t, leader)).toBe(true);
    expect(canView(t, member)).toBe(false);
  });
});

describe('已删除进展不能按新增保存', () => {
  it.each([false, true])(
    '旧编辑器在最新版本也不能恢复删除记录（提交=%s）',
    (submit) => {
      const t = seedData().find((v) => v.status === '攻关中')!;
      const p = {
        ...freshProgress(leader),
        title: '旧编辑器',
        content: '有效内容',
      };
      saveProgress(t, leader, t.revision, p);
      deleteProgress(t, leader, t.revision, p.id);
      const before = copy(t);
      expect(() =>
        saveProgress(t, leader, t.revision, p, submit, true),
      ).toThrow('已删除');
      expect(t).toEqual(before);
    },
  );

  it('真正新建的进展仍可保存及提交', () => {
    const t = seedData().find((v) => v.status === '攻关中')!;
    const p = {
      ...freshProgress(leader),
      title: '新建进展',
      content: '有效内容',
    };
    saveProgress(t, leader, t.revision, p, false, false);
    saveProgress(t, leader, t.revision, p, true, true);
    expect(t.progress.filter((v) => v.id === p.id)).toHaveLength(1);
    expect(t.progress.find((v) => v.id === p.id)?.submittedAt).toBeTruthy();
  });
});

describe('总计划与任务日期冲突', () => {
  it.each(['start', 'end'] as const)(
    '冲突定位总计划%s，失败不修改数据，修正后可保存',
    (side) => {
      const t = seedData().find((v) => v.status === '攻关中')!;
      const before = copy(t);
      const start = side === 'start' ? t.tasks[1]!.start : t.start;
      const end = side === 'end' ? t.tasks[0]!.end : t.end;
      expect(() =>
        adjustDates(t, admin, t.revision, start, end, '调整原因'),
      ).toThrow(
        expect.objectContaining({
          field: `action.${side}`,
          message: expect.stringContaining('任务“'),
        }),
      );
      expect(t).toEqual(before);
      adjustDates(t, admin, t.revision, t.start, t.end, '调整原因');
      expect(t.revision).toBe(before.revision + 1);
    },
  );
});
