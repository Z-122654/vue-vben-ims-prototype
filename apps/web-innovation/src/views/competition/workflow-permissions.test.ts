import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  adjustDeadline,
  auditEntry,
  canApply,
  canEditEntry,
  canManageActivity,
  canSeeActivity,
  canSeeEntry,
  changeActivity,
  copy,
  deleteDraft,
  isInternalReader,
  newActivity,
  newEntry,
  normalizeCompetitionData,
  nowText,
  person,
  resolveSupplement,
  returnReview,
  reviewOverdue,
  saveActivity,
  saveActivityExperts,
  saveEntry,
  saveResults,
  saveReview,
  withdrawEntry,
} from './model';
import { seedData } from './seed';

const manager = person('manager');
const employee = person('employee-a');
const otherManager = person('manager-operation');
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-27T10:00:00'));
});
afterEach(() => vi.useRealTimers());
const scores = { innovation: 25, practice: 26, safety: 18, benefit: 17 };

describe('第1批主流程与权限', () => {
  it('发布只记录成功事件时间，不信任预填实际日期，截止当天允许报名', () => {
    const data = seedData();
    const draft = data.activities.find((a) => a.status === '草稿')!;
    const form = {
      ...copy(draft),
      expertIds: ['expert-a'],
      registeredAt: '2000-01-01',
      reviewStartedAt: '2000-01-02',
    };
    saveActivity(data, manager, form);
    expect(draft.registeredAt).toBe('');
    changeActivity(data, manager, draft.id, '报名中');
    expect(draft.registeredAt).toBe(nowText());
    expect(draft.reviewStartedAt).toBe('');
    expect(canApply(draft, employee, draft.deadline)).toBe(true);
    expect(canApply(draft, employee, '2099-01-01')).toBe(false);
    expect(draft.status).toBe('报名中');
  });
  it('无效计划日期或发布校验失败不产生实际时间和状态', () => {
    const data = seedData();
    const draft = data.activities.find((a) => a.status === '草稿')!;
    draft.expertIds = ['expert-a'];
    for (const date of ['2026-02-30', '2026-10-26', '']) {
      draft.deadline = date;
      const before = copy(data);
      expect(() => changeActivity(data, manager, draft.id, '报名中')).toThrow(
        '期限',
      );
      expect(data).toEqual(before);
    }
  });
  it.each(['2026-10-28', '2026-10-27', '2026-10-26'])(
    '报名截止为%s时，材料收口即可开启，保留计划日期、记录实际时间并仅生成通过项目任务',
    (deadline) => {
      const data = seedData();
      const activity = data.activities[0]!;
      activity.deadline = deadline;
      activity.expertIds = ['expert-a', 'expert-b'];
      const entries = data.entries.filter((e) => e.activityId === activity.id);
      entries.forEach((e) => {
        if (['待审核', '退回修改'].includes(e.status)) e.status = '审核通过';
      });
      for (const status of ['草稿', '已撤回', '已终止'] as const) {
        data.entries.push({
          ...newEntry(activity.id, employee.id),
          name: status,
          status,
        });
      }
      const approved = entries.filter((e) => e.status === '审核通过');
      const staleDraft = copy(entries.find((e) => e.status === '草稿')!);
      changeActivity(data, manager, activity.id, '评审中');
      expect(activity.deadline).toBe(deadline);
      expect(activity.reviewStartedAt).toBe(nowText());
      expect(activity.history.at(-1)?.action).toBe('活动评审中');
      expect(activity.history.at(-1)?.at).toBe(nowText());
      const tasks = data.reviews.filter((r) =>
        data.entries.some(
          (e) => e.id === r.entryId && e.activityId === activity.id,
        ),
      );
      expect(tasks).toHaveLength(approved.length * 2);
      expect(tasks.every((r) => approved.some((e) => e.id === r.entryId))).toBe(
        true,
      );
      expect(canApply(activity, employee)).toBe(false);
      expect(canEditEntry(activity, staleDraft, employee)).toBe(false);
      const before = copy(data);
      for (const submit of [false, true]) {
        expect(() => saveEntry(data, employee, staleDraft, submit)).toThrow(
          '不可编辑',
        );
        expect(() =>
          saveEntry(
            data,
            employee,
            { ...newEntry(activity.id, employee.id), name: '新申报' },
            submit,
          ),
        ).toThrow('报名资格');
      }
      expect(() =>
        withdrawEntry(
          data,
          employee,
          approved.find((e) => e.ownerId === employee.id)!.id,
        ),
      ).toThrow('报名期');
      expect(() =>
        saveActivityExperts(data, manager, activity.id, ['expert-b']),
      ).toThrow('锁定');
      expect(data).toEqual(before);
    },
  );
  it.each([
    '待审核',
    '退回修改',
    '无通过项目',
    '缺专家',
    '无效专家',
    '本人填报',
    '本人负责',
    '越权',
  ])('报名未截止时仍阻止%s，失败不产生任务、时间或状态变化', (scenario) => {
    const data = seedData();
    const activity = data.activities[0]!;
    activity.deadline = '2026-11-10';
    activity.expertIds = ['expert-a'];
    const entries = data.entries.filter((e) => e.activityId === activity.id);
    entries.forEach((e) => {
      if (e.status !== '草稿') e.status = '审核通过';
    });
    const approved = entries.find((e) => e.status === '审核通过')!;
    if (scenario === '待审核' || scenario === '退回修改')
      approved.status = scenario;
    if (scenario === '无通过项目')
      entries.forEach((e) => (e.status = '已终止'));
    if (scenario === '缺专家') activity.expertIds = [];
    if (scenario === '无效专家') activity.expertIds = ['missing'];
    if (scenario === '本人填报') activity.expertIds = [approved.ownerId];
    if (scenario === '本人负责') {
      approved.leaderId = 'expert-a';
    }
    const before = copy(data);
    expect(() =>
      changeActivity(
        data,
        scenario === '越权' ? otherManager : manager,
        activity.id,
        '评审中',
      ),
    ).toThrow();
    expect(data).toEqual(before);
  });
  it('专家自由跨部门选择且去重，本人填报或负责项目须整体回避', () => {
    const data = seedData();
    const activity = data.activities[0]!;
    activity.deadline = '2026-10-26';
    data.entries
      .filter((e) => e.activityId === activity.id && e.status !== '草稿')
      .forEach((e) => (e.status = '审核通过'));
    const beforeSelection = copy(data);
    expect(() =>
      saveActivityExperts(data, manager, activity.id, [
        employee.id,
        'expert-a',
      ]),
    ).toThrow('专家与参赛身份冲突');
    expect(data).toEqual(beforeSelection);
    // Legacy conflicting lists remain blocked at the final transition.
    activity.expertIds = [employee.id, 'expert-a'];
    const before = copy(data);
    expect(() => changeActivity(data, manager, activity.id, '评审中')).toThrow(
      '回避',
    );
    expect(data).toEqual(before);
    const entry = data.entries.find((e) => e.id === 'entry-4')!;
    entry.leaderId = 'employee-c';
    expect(() =>
      saveActivityExperts(data, manager, activity.id, ['employee-c']),
    ).toThrow('项目负责人');
    saveActivityExperts(data, manager, activity.id, [
      manager.id,
      manager.id,
      'expert-a',
    ]);
    expect(activity.expertIds).toEqual([manager.id, 'expert-a']);
    changeActivity(data, manager, activity.id, '评审中');
    expect(activity.reviewStartedAt).toBe(nowText());
    const tasks = data.reviews.filter((r) =>
      data.entries.some(
        (e) => e.id === r.entryId && e.activityId === activity.id,
      ),
    );
    expect(tasks).toHaveLength(6);
    const task = tasks.find((r) => r.expertId === manager.id)!;
    saveReview(data, manager, task.id, scores, '兼任专家提交', true);
    expect(task.status).toBe('已提交');
    expect(() => saveActivityExperts(data, manager, activity.id, [])).toThrow(
      '锁定',
    );
  });
  it('专家和管理员兼任员工时可报名，但仍受部门范围、归属及负责人限制', () => {
    const data = seedData();
    const activity = data.activities[0]!;
    for (const actor of [person('expert-a'), manager]) {
      expect(canApply(activity, actor)).toBe(true);
      saveEntry(data, actor, {
        ...newEntry(activity.id, actor.id),
        name: '兼任申报',
      });
    }
    activity.departments = ['运行部'];
    expect(canApply(activity, manager)).toBe(false);
    expect(() =>
      saveEntry(data, manager, {
        ...newEntry(activity.id, manager.id),
        name: '越范围',
      }),
    ).toThrow();
  });
  it('跨部门负责人在保存草稿和提交时都被拒绝，同部门代填不转移权限', () => {
    const data = seedData();
    const draft = copy(data.entries[0]!);
    for (const submit of [false, true]) {
      expect(() =>
        saveEntry(data, employee, { ...draft, leaderId: 'employee-b' }, submit),
      ).toThrow('所在部门');
    }
    saveEntry(data, employee, { ...draft, leaderId: 'employee-c' }, true);
    expect(data.entries[0]!.ownerId).toBe(employee.id);
    expect(isInternalReader(data, data.entries[0]!, person('employee-c'))).toBe(
      false,
    );
    expect(() =>
      saveEntry(data, person('employee-c'), copy(data.entries[0]!)),
    ).toThrow();
  });
  it('拒绝无活动、伪造归属、伪造补交状态及修改已有申报所属活动', () => {
    const data = seedData();
    expect(() =>
      saveEntry(data, employee, {
        ...newEntry('', employee.id),
        name: '无上下文',
      }),
    ).toThrow('活动不存在');
    expect(() =>
      saveEntry(data, employee, {
        ...newEntry('activity-open', 'employee-b'),
        name: '伪造',
      }),
    ).toThrow();
    expect(() =>
      saveEntry(data, employee, {
        ...newEntry('activity-open', employee.id),
        name: '伪造',
        status: '退回修改',
        supplementDeadline: '2099-01-01',
      }),
    ).toThrow();
    expect(() =>
      saveEntry(data, employee, {
        ...copy(data.entries[0]!),
        activityId: 'activity-review',
      }),
    ).toThrow();
    const before = copy(data.entries[2]!);
    saveEntry(data, employee, { ...before, supplementDeadline: '2099-01-01' });
    expect(data.entries[2]!.supplementDeadline).toBe(before.supplementDeadline);
  });
  it('组织范围同时限制界面可见性、内部材料和所有管理写操作', () => {
    const data = seedData();
    const activity = data.activities[0]!;
    const draft = data.activities.find((a) => a.status === '草稿')!;
    expect(canManageActivity(activity, otherManager)).toBe(false);
    expect(canSeeActivity(data, draft, otherManager)).toBe(false);
    expect(canSeeActivity(data, activity, otherManager)).toBe(true);
    expect(isInternalReader(data, data.entries[1]!, otherManager)).toBe(false);
    expect(canSeeEntry(data, data.entries[1]!, otherManager)).toBe(false);
    const before = copy(data);
    for (const action of [
      () => saveActivity(data, otherManager, copy(draft)),
      () => saveActivityExperts(data, otherManager, activity.id, ['expert-a']),
      () => changeActivity(data, otherManager, activity.id, '已取消'),
      () =>
        adjustDeadline(data, otherManager, activity.id, '2026-11-05', '越权'),
      () => auditEntry(data, otherManager, 'entry-2', true, '越权'),
      () =>
        resolveSupplement(data, otherManager, 'entry-3', 'terminate', '越权'),
      () => returnReview(data, otherManager, 'review-2', '越权'),
      () => saveResults(data, otherManager, 'activity-review', [], '', '', ''),
      () => deleteDraft(data, otherManager, 'activity', draft.id),
    ])
      expect(action).toThrow();
    expect(data).toEqual(before);
    const owned = {
      ...newActivity(otherManager),
      name: '运行部活动',
      expertIds: ['expert-a'],
    };
    saveActivity(data, otherManager, owned);
    expect(canManageActivity(owned, otherManager)).toBe(true);
    expect(canManageActivity(owned, manager)).toBe(false);
  });
  it('补交截止独立于普通报名期限，截止当天有效、超期不自动终止', () => {
    const data = seedData();
    const activity = data.activities[0]!;
    const entry = data.entries[2]!;
    activity.deadline = '2026-11-05';
    entry.supplementDeadline = '2026-10-26';
    expect(canApply(activity, employee)).toBe(true);
    expect(canEditEntry(activity, entry, employee)).toBe(false);
    expect(() => saveEntry(data, employee, copy(entry), true)).toThrow('期限');
    expect(entry.status).toBe('退回修改');
    activity.deadline = '2026-10-26';
    entry.supplementDeadline = '2026-10-27';
    expect(canEditEntry(activity, entry, employee)).toBe(true);
    saveEntry(data, employee, copy(entry), true);
    expect(entry.status).toBe('待审核');
  });
  it('超期延期必须有效且有原因，终止保留材料并解除开启评审阻塞', () => {
    const data = seedData();
    const activity = data.activities[0]!;
    const entry = data.entries[2]!;
    activity.deadline = '2026-10-26';
    entry.supplementDeadline = '2026-10-25';
    expect(() =>
      resolveSupplement(data, manager, entry.id, 'extend', '', '2026-10-28'),
    ).toThrow('原因');
    expect(() =>
      resolveSupplement(
        data,
        manager,
        entry.id,
        'extend',
        '延期',
        '2026-02-30',
      ),
    ).toThrow('截止');
    resolveSupplement(
      data,
      manager,
      entry.id,
      'extend',
      '补充证明',
      '2026-10-28',
    );
    expect(canEditEntry(activity, entry, employee)).toBe(true);
    auditEntry(data, manager, 'entry-2', true, '齐全');
    expect(() => changeActivity(data, manager, activity.id, '评审中')).toThrow(
      '退回补充',
    );
    const attachments = copy(entry.attachments);
    resolveSupplement(data, manager, entry.id, 'terminate', '不再参评');
    expect(entry.attachments).toEqual(attachments);
    expect(canEditEntry(activity, entry, employee)).toBe(false);
    expect(() => saveEntry(data, employee, copy(entry), true)).toThrow();
    changeActivity(data, manager, activity.id, '评审中');
    expect(data.reviews.some((r) => r.entryId === entry.id)).toBe(false);
    expect(entry.history.at(-1)?.note).toBe('不再参评');
  });
  it('计划期限调整必须按阶段、组织和原因校验，不改变实际时间或锁定', () => {
    const data = seedData();
    const activity = data.activities[0]!;
    const actual = activity.registeredAt;
    expect(() =>
      adjustDeadline(data, manager, activity.id, '2026-10-27', ''),
    ).toThrow('原因');
    adjustDeadline(data, manager, activity.id, '2026-10-26', '报名已结束');
    expect(canApply(activity, employee)).toBe(false);
    adjustDeadline(data, manager, activity.id, '2026-10-29', '延期接收');
    expect(canApply(activity, employee)).toBe(true);
    expect(activity.registeredAt).toBe(actual);
    expect(activity.status).toBe('报名中');
    expect(activity.history.at(-1)?.note).toContain('2026-10-26 → 2026-10-29');
    const review = data.activities.find((a) => a.id === 'activity-review')!;
    const originalExperts = copy(review.expertIds);
    adjustDeadline(data, manager, review.id, '2026-10-26', '计划调整');
    expect(reviewOverdue(review)).toBe(true);
    saveReview(data, person('expert-a'), 'review-1', scores, '逾期提交', true);
    expect(review.status).toBe('评审中');
    expect(review.expertIds).toEqual(originalExperts);
  });
  it('完成、公示和结束只在成功操作时记录，公示日期取实际发布时间', () => {
    const data = seedData();
    const activity = data.activities[1]!;
    expect(() =>
      changeActivity(data, manager, activity.id, '待公示'),
    ).toThrow();
    expect(activity.reviewCompletedAt).toBe('');
    for (const task of data.reviews.filter(
      (r) =>
        ['entry-5', 'entry-6'].includes(r.entryId) && r.status !== '已提交',
    ))
      saveReview(data, person(task.expertId), task.id, scores, '认可', true);
    changeActivity(data, manager, activity.id, '待公示');
    expect(activity.reviewCompletedAt).toBe(nowText());
    saveResults(
      data,
      manager,
      activity.id,
      [{ entryId: 'entry-5', award: '一等奖', reason: '线下结果' }],
      '公示',
      '正文',
      '2000-01-01',
    );
    expect(activity.noticeDate).toBe('');
    changeActivity(data, manager, activity.id, '已公示');
    expect(activity.noticeDate).toBe('2026-10-27');
    changeActivity(data, manager, activity.id, '已结束');
    expect(activity.endedAt).toBe(nowText());
  });
  it('旧数据仅从对应历史事件补实际时间，保留旧计划值、附件和评分且重复读取稳定', () => {
    const data = seedData();
    const activity = data.activities[0]!;
    Reflect.deleteProperty(activity, 'registeredAt');
    Reflect.deleteProperty(activity, 'reviewStartedAt');
    activity.start = '2000-01-01';
    activity.reviewStart = '2099-01-01';
    const before = copy(data);
    const migrated = normalizeCompetitionData(data);
    expect(data).toEqual(before);
    expect(migrated.activities[0]!.registeredAt).toBe(
      activity.history.find((h) => h.action === '活动报名中')!.at,
    );
    expect(migrated.activities[0]!.reviewStartedAt).toBe('');
    expect(migrated.activities[0]!.reviewStart).toBe('2099-01-01');
    expect(migrated.entries).toEqual(before.entries);
    expect(migrated.reviews).toEqual(before.reviews);
    expect(normalizeCompetitionData(migrated)).toEqual(migrated);
  });
});
