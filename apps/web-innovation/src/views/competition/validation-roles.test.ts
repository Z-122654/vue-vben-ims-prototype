import { approveForTest } from './publication-test-support';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  activityTypeOptions,
  auditEntry,
  canApply,
  canDownloadCertificate,
  canEditEntry,
  canManageActivity,
  canSeeActivity,
  canSeeEntry,
  changeActivity,
  copy,
  currentPublication,
  isInternalReader,
  newActivity,
  newEntry,
  normalizeCompetitionData,
  people,
  person,
  returnReview,
  saveActivity,
  saveEntry,
  saveResults,
  saveReview,
  validateActivity,
  withdrawEntry,
} from './model';
import { seedData } from './seed';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-27T10:00:00'));
});
afterEach(() => vi.useRealTimers());
const manager = person('manager');
const employee = person('employee-a');

describe('第3批校验边界', () => {
  it.each([0, -1, 1.5, 101, Infinity, Number.NaN])(
    '指标满分 %s 不可保存或发布，失败不改变活动',
    (max) => {
      const data = seedData();
      const draft = data.activities.find((a) => a.status === '草稿')!;
      const form = copy(draft);
      form.criteria[0]!.max = max;
      const before = copy(data);
      expect(() => saveActivity(data, manager, form)).toThrow('正整数');
      expect(() => validateActivity(form)).toThrow('正整数');
      expect(data).toEqual(before);
    },
  );
  it('合法指标不要求合计100；空名称、重复名称、重复标识不能发布', () => {
    const data = seedData();
    const draft = data.activities.find((a) => a.status === '草稿')!;
    draft.criteria = [
      { id: 'a', name: '创新', max: 1 },
      { id: 'b', name: '应用', max: 100 },
    ];
    draft.expertIds = ['expert-a'];
    expect(() => validateActivity(draft)).not.toThrow();
    draft.criteria[1]!.name = '';
    expect(() => validateActivity(draft)).toThrow('指标');
    draft.criteria[1]!.name = ' 创新 ';
    expect(() => validateActivity(draft)).toThrow('重复');
    draft.criteria[1]!.name = '应用';
    draft.criteria[1]!.id = 'a';
    expect(() => validateActivity(draft)).toThrow('标识');
  });
  it('名称和类别长度在保存及提交层校验，边界值可用且失败不部分修改', () => {
    const data = seedData();
    const draft = copy(data.activities.find((a) => a.status === '草稿')!);
    draft.name = '活'.repeat(80);
    draft.expertIds = ['expert-a'];
    saveActivity(data, manager, draft);
    draft.name += '动';
    expect(() => saveActivity(data, manager, draft)).toThrow('80');
    expect(() => validateActivity(draft)).toThrow('80');
    const entry = copy(data.entries[0]!);
    entry.name = '项'.repeat(200);
    entry.category = '类'.repeat(100);
    entry.summary = '简'.repeat(1000);
    saveEntry(data, employee, entry);
    const before = copy(data);
    for (const [key, value, message] of [
      ['name', `${entry.name}目`, '200'],
      ['category', `${entry.category}别`, '100'],
      ['summary', `${entry.summary}介`, '1000'],
    ] as const) {
      for (const submit of [false, true]) {
        expect(() =>
          saveEntry(data, employee, { ...entry, [key]: value }, submit),
        ).toThrow(message);
        expect(data).toEqual(before);
      }
    }
    saveEntry(data, employee, entry, true);
    expect(data.entries.find((e) => e.id === entry.id)?.status).toBe('待审核');
  });
  it.each([-0.1, 30.1, 1.25, Number.NaN, Infinity])(
    '评分 %s 不可暂存或提交，原分数不变',
    (value) => {
      const data = seedData();
      const review = data.reviews.find((r) => r.id === 'review-1')!;
      const before = copy(review);
      for (const submit of [false, true]) {
        expect(() =>
          saveReview(
            data,
            person(review.expertId),
            review.id,
            { innovation: value },
            '意见',
            submit,
          ),
        ).toThrow();
        expect(review).toEqual(before);
      }
    },
  );
  it('0分、满分及一位小数可提交，空分和空意见只能暂存', () => {
    const data = seedData();
    const review = data.reviews.find((r) => r.id === 'review-1')!;
    const actor = person(review.expertId);
    saveReview(data, actor, review.id, { innovation: 0 }, '', false);
    expect(() =>
      saveReview(data, actor, review.id, { innovation: 0 }, '意见', true),
    ).toThrow();
    const scores = { innovation: 0, practice: 30, safety: 19.9, benefit: 8.1 };
    expect(() =>
      saveReview(data, actor, review.id, scores, '   ', true),
    ).toThrow('意见');
    saveReview(data, actor, review.id, scores, '符合要求', true);
    expect(review.scores).toEqual(scores);
  });
  it('自定义活动类型保存后可复用，兼容旧类型但不重写历史', () => {
    const data = seedData();
    const draft = copy(data.activities.find((a) => a.status === '草稿')!);
    draft.type = '  设备维护专项  ';
    draft.expertIds = ['expert-a'];
    saveActivity(data, manager, draft);
    expect(activityTypeOptions(data)).toContainEqual({ value: '设备维护专项' });
    expect(
      normalizeCompetitionData(data).activities.find((a) => a.id === draft.id)
        ?.type,
    ).toBe('设备维护专项');
    draft.type = '   ';
    expect(() => validateActivity(draft)).toThrow('活动类型');
  });
});

describe('各角色完整业务链路', () => {
  it('创建发布→同部门代填与多项目→退回重提→两专家评审→退回重评→公示结束，角色权限始终独立', () => {
    const data = seedData();
    const a = {
      ...newActivity(),
      name: '全角色完整流程验收',
      phone: '演示内线',
      description: '虚构验收',
      deadline: '2026-10-27',
      reviewEnd: '2026-10-30',
      expertIds: ['expert-a', 'expert-b'],
    };
    saveActivity(data, manager, a);
    const activity = data.activities.find((item) => item.id === a.id)!;
    for (const actor of people) {
      expect(canSeeActivity(data, activity, actor)).toBe(
        actor.id === 'manager',
      );
      expect(canManageActivity(activity, actor)).toBe(actor.id === 'manager');
    }
    changeActivity(data, manager, a.id, '报名中');
    const form = {
      ...newEntry(a.id, employee.id),
      name: '同部门代填项目',
      leaderId: 'employee-c',
      category: '自定义类别',
      summary: '完整流程验证',
      attachments: copy(data.entries[0]!.attachments),
    };
    saveEntry(data, employee, form, true);
    const entry = data.entries.find((e) => e.id === form.id)!;
    // 同一填报人再次申报，原记录归属不会跟随负责人改变。
    const extra = { ...form, id: 'role-second-project', name: '第二个项目' };
    saveEntry(data, employee, extra, true);
    withdrawEntry(data, employee, extra.id);
    expect(data.entries.filter((e) => e.activityId === a.id)).toHaveLength(2);
    expect(canEditEntry(activity, entry, person('employee-c'))).toBe(false);
    auditEntry(data, manager, entry.id, false, '补充说明', '2026-10-28');
    vi.setSystemTime(new Date('2026-10-28T10:00:00'));
    expect(canApply(activity, employee)).toBe(false);
    expect(canEditEntry(activity, entry, employee)).toBe(true);
    saveEntry(
      data,
      employee,
      { ...copy(entry), summary: '补充后的完整说明' },
      true,
    );
    auditEntry(data, manager, entry.id, true, '材料完整');
    changeActivity(data, manager, a.id, '评审中');
    const tasks = data.reviews.filter((r) => r.entryId === entry.id);
    expect(tasks).toHaveLength(2);
    for (const actor of people) {
      expect(canSeeEntry(data, entry, actor)).toBe(true);
      expect(isInternalReader(data, entry, actor)).toBe(
        ['employee-a', 'expert-a', 'expert-b', 'manager'].includes(actor.id),
      );
      expect(canEditEntry(activity, entry, actor)).toBe(false);
    }
    expect(() => changeActivity(data, manager, a.id, '待公示')).toThrow();
    const scores = Object.fromEntries(
      activity.criteria.map((c) => [c.id, c.max - 0.1]),
    );
    for (const task of tasks) {
      for (const actor of people.filter((p) => p.id !== task.expertId)) {
        expect(() =>
          saveReview(data, actor, task.id, scores, '越权尝试', true),
        ).toThrow();
      }
      saveReview(
        data,
        person(task.expertId),
        task.id,
        scores,
        '独立评审意见',
        true,
      );
    }
    returnReview(data, manager, tasks[0]!.id, '补充专业依据');
    expect(() => changeActivity(data, manager, a.id, '待公示')).toThrow();
    saveReview(
      data,
      person(tasks[0]!.expertId),
      tasks[0]!.id,
      scores,
      '已补充专业依据',
      true,
    );
    changeActivity(data, manager, a.id, '待公示');
    saveResults(
      data,
      manager,
      a.id,
      [{ entryId: entry.id, award: '一等奖', reason: '线下确认' }],
      '获奖公示',
      '结果说明',
      '',
    );
    approveForTest(data, manager, a.id);
    const winner = currentPublication(activity)!.winners[0]!;
    for (const actor of people) {
      expect(canDownloadCertificate(activity, winner, actor)).toBe(
        ['employee-a', 'employee-c', 'manager'].includes(actor.id),
      );
    }
    changeActivity(data, manager, a.id, '已结束');
    expect(activity.status).toBe('已结束');
    expect(currentPublication(activity)!.winners[0]!.leaderSnapshot?.name).toBe(
      '许文清',
    );
    expect(normalizeCompetitionData(data)).toEqual(data);
  });
});
