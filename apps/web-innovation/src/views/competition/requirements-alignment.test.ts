import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  auditEntry,
  canApply,
  canDeleteEntry,
  canEditEntry,
  canSeeEntry,
  changeActivity,
  copy,
  currentPublication,
  deleteDraft,
  newEntry,
  normalizeCompetitionData,
  person,
  saveEntry,
  saveResults,
} from './model';
import { seedData } from './seed';

const manager = person('manager');
const employee = person('employee-a');
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-27T10:00:00'));
});
afterEach(() => vi.useRealTimers());

describe('需求核对后补齐的边界', () => {
  it('取消后本人草稿不可删除，材料和历史保留；其他活动的本人草稿仍可删', () => {
    const data = seedData();
    const activity = data.activities.find((a) => a.id === 'activity-open')!;
    const entry = data.entries[0]!;
    expect(canDeleteEntry(entry, employee, activity)).toBe(true);
    changeActivity(data, manager, activity.id, '已取消', '取消活动');
    const before = copy(data);
    expect(canDeleteEntry(entry, employee, activity)).toBe(false);
    expect(() => deleteDraft(data, employee, 'entry', entry.id)).toThrow(
      '取消',
    );
    expect(data).toEqual(before);
    expect(canSeeEntry(data, entry, employee)).toBe(true);
    expect(canEditEntry(activity, entry, employee)).toBe(false);
    const other = data.activities.find((a) => a.status === '草稿')!;
    const draft = newEntry(other.id, employee.id);
    data.entries.push(draft);
    expect(canDeleteEntry(draft, manager, other)).toBe(false);
    expect(canDeleteEntry(draft, employee, other)).toBe(true);
    deleteDraft(data, employee, 'entry', draft.id);
    expect(data.entries.some((e) => e.id === draft.id)).toBe(false);
  });

  it('报名截止后可退回已通过项目，按补交期限重提；评审开始后及越权操作仍禁止', () => {
    const data = seedData();
    const activity = data.activities.find((a) => a.id === 'activity-open')!;
    const entry = data.entries[0]!;
    saveEntry(data, employee, copy(entry), true);
    auditEntry(data, manager, entry.id, true, '材料齐全');
    activity.deadline = '2026-10-26';
    expect(canApply(activity, employee)).toBe(false);
    const before = copy(data);
    for (const actor of [
      employee,
      person('manager-operation'),
      person('expert-a'),
    ]) {
      expect(() =>
        auditEntry(data, actor, entry.id, false, '补充', '2026-10-28'),
      ).toThrow();
    }
    expect(() =>
      auditEntry(data, manager, entry.id, true, '重复通过'),
    ).toThrow();
    expect(() =>
      auditEntry(data, manager, entry.id, false, '', '2026-10-28'),
    ).toThrow('意见');
    expect(() =>
      auditEntry(data, manager, entry.id, false, '补充', '2026-10-26'),
    ).toThrow('截止');
    expect(data).toEqual(before);
    const attachments = copy(entry.attachments);
    const firstSubmittedAt = entry.firstSubmittedAt;
    auditEntry(data, manager, entry.id, false, '补充说明', '2026-10-28');
    expect(entry.status).toBe('退回修改');
    expect(entry.attachments).toEqual(attachments);
    expect(canSeeEntry(data, entry, person('employee-c'))).toBe(false);
    expect(canEditEntry(activity, entry, employee)).toBe(true);
    expect(() => changeActivity(data, manager, activity.id, '评审中')).toThrow(
      '退回补充',
    );
    vi.setSystemTime(new Date('2026-10-28T11:00:00'));
    saveEntry(data, employee, { ...copy(entry), summary: '已补充说明' }, true);
    expect(entry.firstSubmittedAt).toBe(firstSubmittedAt);
    expect(entry.submittedAt).toBe('2026-10-28 11:00:00');
    auditEntry(data, manager, entry.id, true, '通过');
    expect(entry.supplementDeadline).toBe('');
    for (const status of [
      '评审中',
      '待公示',
      '已公示',
      '已结束',
      '已取消',
    ] as const) {
      activity.status = status;
      const snapshot = copy(data);
      expect(() =>
        auditEntry(data, manager, entry.id, false, '不可退回', '2099-01-01'),
      ).toThrow();
      expect(data).toEqual(snapshot);
    }
  });

  it('零获奖正文由管理员负责说明，系统只校验标题和正文非空', () => {
    const data = seedData();
    const activity = data.activities.find(
      (a) => a.id === 'demo-workflow-pending-result',
    )!;
    const awards = data.entries
      .filter((e) => e.activityId === activity.id)
      .map((e) => ({ entryId: e.id, award: '', reason: '' }));
    saveResults(data, manager, activity.id, awards, '结果公示', ' ', '');
    expect(() => changeActivity(data, manager, activity.id, '已公示')).toThrow(
      '正文',
    );
    saveResults(
      data,
      manager,
      activity.id,
      awards,
      '结果公示',
      '评选情况见本次说明。',
      '',
    );
    changeActivity(data, manager, activity.id, '已公示');
    expect(currentPublication(activity)?.winners).toHaveLength(0);
  });

  it('后续阶段缺名单和任务时不补造专家、任务或评分', () => {
    for (const status of [
      '评审中',
      '待公示',
      '已公示',
      '已结束',
      '已取消',
    ] as const) {
      const data = seedData();
      const activity = data.activities.find((a) => a.id === 'activity-review')!;
      activity.status = status;
      Reflect.deleteProperty(activity, 'expertIds');
      data.reviews = data.reviews.filter(
        (r) =>
          !data.entries.some(
            (e) => e.id === r.entryId && e.activityId === activity.id,
          ),
      );
      const normalized = normalizeCompetitionData(data);
      expect(
        normalized.activities.find((a) => a.id === activity.id)?.expertIds,
      ).toEqual([]);
      expect(normalized.reviews).toEqual(data.reviews);
      expect(normalized.entries).toEqual(data.entries);
      expect(normalizeCompetitionData(normalized)).toEqual(normalized);
    }
  });
});
