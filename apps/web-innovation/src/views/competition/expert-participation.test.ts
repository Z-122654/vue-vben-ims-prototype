import type { CompetitionData, Entry } from './model';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  activityExpertConflicts,
  auditEntry,
  canStartEntry,
  changeActivity,
  copy,
  entryExpertConflicts,
  expertConflictMessage,
  expertOptions,
  leaderOptionsForActivity,
  newEntry,
  person,
  saveActivity,
  saveActivityExperts,
  saveEntry,
} from './model';
import { seedData } from './seed';

const manager = person('manager');
const owner = person('employee-a');
function fixture(status: Entry['status'] = '草稿') {
  const activity = copy(seedData().activities[0]!);
  activity.status = '报名中';
  activity.deadline = '2026-11-05';
  activity.expertIds = ['expert-a'];
  const entry = {
    ...newEntry(activity.id, owner.id),
    name: '冲突验证项目',
    category: '管理创新',
    summary: '验证人员身份互斥',
    leaderId: 'employee-c',
    status,
    supplementDeadline: '2026-11-05',
  };
  const data: CompetitionData = {
    version: 1,
    activities: [activity],
    entries: [entry],
    reviews: [],
  };
  return { data, activity, entry };
}
beforeEach(() =>
  vi.useFakeTimers().setSystemTime(new Date('2026-10-27T10:00:00')),
);
afterEach(() => vi.useRealTimers());

describe('活动专家与参赛身份提前互斥', () => {
  it('只限制本活动已选专家，不因角色或其他活动的专家身份禁止申报', () => {
    const { activity } = fixture();
    expect(canStartEntry(activity, person('expert-a'))).toBe(false);
    expect(canStartEntry(activity, person('expert-b'))).toBe(true);
    expect(
      canStartEntry(
        { ...activity, expertIds: ['expert-b'] },
        person('expert-a'),
      ),
    ).toBe(true);
    expect(canStartEntry(activity, owner)).toBe(true);
  });
  it.each(['草稿', '已撤回', '退回修改'] as const)(
    '%s重新提交同时检查填报人和负责人，保存仍可保留资料',
    (status) => {
      for (const expertId of [owner.id, 'employee-c']) {
        const { data, activity, entry } = fixture(status);
        activity.expertIds = [expertId];
        saveEntry(data, owner, {
          ...copy(entry),
          summary: '保留尚未解决的草稿资料',
        });
        const before = copy(data);
        expect(() => saveEntry(data, owner, copy(entry), true)).toThrow(
          '专家与参赛身份冲突',
        );
        expect(data).toEqual(before);
        saveActivityExperts(data, manager, activity.id, ['expert-a']);
        saveEntry(data, owner, copy(entry), true);
        expect(entry.status).toBe('待审核');
      }
    },
  );
  it('表单打开后名单变化也阻止新提交；改负责人不能绕过填报人冲突', () => {
    const { data, activity, entry } = fixture();
    const staleForm = copy(entry);
    saveActivityExperts(data, manager, activity.id, [owner.id]);
    const before = copy(data);
    expect(() => saveEntry(data, owner, staleForm, true)).toThrow('林知远');
    expect(data).toEqual(before);
    data.entries = [];
    expect(() => saveEntry(data, owner, staleForm, true)).toThrow('填报人');
    expect(data.entries).toHaveLength(0);
  });
  it.each(['待审核', '退回修改', '审核通过'] as const)(
    '%s的填报人和负责人不可配置成专家，两个保存入口都原子拒绝',
    (status) => {
      const { data, activity } = fixture(status);
      for (const expertId of [owner.id, 'employee-c']) {
        const before = copy(data);
        expect(() =>
          saveActivityExperts(data, manager, activity.id, [expertId]),
        ).toThrow('冲突验证项目');
        expect(() =>
          saveActivity(data, manager, {
            ...copy(activity),
            expertIds: [expertId],
          }),
        ).toThrow('冲突验证项目');
        expect(data).toEqual(before);
      }
    },
  );
  it.each(['草稿', '已撤回', '已终止'] as const)(
    '%s不占用参赛身份，选择专家不自动修改项目',
    (status) => {
      const { data, activity, entry } = fixture(status);
      const beforeEntry = copy(entry);
      saveActivityExperts(data, manager, activity.id, [owner.id, 'employee-c']);
      expect(activity.expertIds).toEqual([owner.id, 'employee-c']);
      expect(entry).toEqual(beforeEntry);
      expect(data.reviews).toEqual([]);
    },
  );
  it('其他活动的有效申报不影响当前活动专家名单', () => {
    const { data, activity, entry } = fixture('审核通过');
    entry.activityId = 'another-activity';
    saveActivityExperts(data, manager, activity.id, [owner.id]);
    expect(activity.expertIds).toEqual([owner.id]);
  });
  it('草稿活动保存也检查旧异常记录，失败不覆盖活动内容', () => {
    const { data, activity } = fixture('待审核');
    activity.status = '草稿';
    const before = copy(data);
    expect(() =>
      saveActivity(data, manager, {
        ...copy(activity),
        name: '未保存',
        expertIds: [owner.id],
      }),
    ).toThrow('冲突');
    expect(data).toEqual(before);
  });
  it('旧冲突在审核通过前被拦截，移除冲突专家后可正常审核和提前开启', () => {
    const { data, activity, entry } = fixture('待审核');
    activity.expertIds = [owner.id, 'expert-a'];
    const before = copy(data);
    expect(() => auditEntry(data, manager, entry.id, true, '通过')).toThrow(
      '林知远',
    );
    expect(data).toEqual(before);
    // Conflict does not block a legitimate return-for-supplement operation.
    auditEntry(data, manager, entry.id, false, '补充资料', '2026-11-05');
    expect(entry.status).toBe('退回修改');
    saveActivityExperts(data, manager, activity.id, ['expert-a']);
    saveEntry(data, owner, copy(entry), true);
    auditEntry(data, manager, entry.id, true, '通过');
    changeActivity(data, manager, activity.id, '评审中');
    expect(data.reviews).toHaveLength(1);
    expect(activity.deadline).toBe('2026-11-05');
  });
  it('旧审核通过冲突仍在开启评审时拦截，不产生部分任务或实际时间', () => {
    const { data, activity } = fixture('审核通过');
    activity.expertIds = ['employee-c'];
    const before = copy(data);
    expect(() => changeActivity(data, manager, activity.id, '评审中')).toThrow(
      '许文清',
    );
    expect(data).toEqual(before);
  });
  it('专家候选禁用活跃参赛人员，旧已选冲突仍能移除；负责人限定同部门且禁用已选专家', () => {
    const { data, activity } = fixture('待审核');
    expect(
      expertOptions(data, activity.id, []).find((p) => p.value === owner.id)
        ?.disabled,
    ).toBe(true);
    expect(
      expertOptions(data, activity.id, [owner.id]).find(
        (p) => p.value === owner.id,
      )?.disabled,
    ).toBe(false);
    expect(
      expertOptions(data, activity.id, []).find((p) => p.value === 'expert-a')
        ?.disabled,
    ).toBe(false);
    activity.expertIds = ['employee-c'];
    const options = leaderOptionsForActivity(owner.department, activity);
    expect(options.map((p) => p.value)).not.toContain('expert-a');
    expect(options.find((p) => p.value === 'employee-c')).toMatchObject({
      disabled: true,
    });
    expect(options.find((p) => p.value === owner.id)?.disabled).toBe(false);
  });
  it('冲突信息列出姓名、项目及关系，重复专家不重复列出，同一人双重关系合并', () => {
    const { data, activity, entry } = fixture('待审核');
    const conflicts = activityExpertConflicts(data, activity.id, [
      owner.id,
      'employee-c',
      owner.id,
    ]);
    expect(conflicts).toHaveLength(2);
    expect(expertConflictMessage(conflicts)).toContain(
      '林知远—冲突验证项目（填报人）',
    );
    expect(expertConflictMessage(conflicts)).toContain(
      '许文清—冲突验证项目（项目负责人）',
    );
    entry.leaderId = owner.id;
    expect(entryExpertConflicts(entry, [owner.id])[0]?.relation).toBe(
      '填报人及项目负责人',
    );
  });
});
