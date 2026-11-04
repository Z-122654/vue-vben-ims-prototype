import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  attachmentIsPublic,
  auditEntry,
  beginResultCorrection,
  canDeleteEntry,
  canDownloadCertificate,
  canSeeEntry,
  changeActivity,
  copy,
  countedEntry,
  currentPublication,
  deleteDraft,
  discardResultCorrection,
  isInternalReader,
  newEntry,
  normalizeCompetitionData,
  people,
  person,
  projectLeader,
  publishedEntry,
  publishResultCorrection,
  returnReview,
  saveEntry,
  saveResults,
  saveReview,
  withdrawEntry,
} from './model';
import { seedData } from './seed';
const manager = person('manager');
const employee = person('employee-a');
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-27T10:00:00'));
});
afterEach(() => vi.useRealTimers());
describe('第2批公示与数据规则', () => {
  it.each([
    {
      award: '一等奖',
      reason: '',
      status: '审核通过',
      message: '获奖确认依据',
    },
    {
      award: '已废弃奖项',
      reason: '旧评议记录',
      status: '审核通过',
      message: '本活动设置的奖项',
    },
    {
      award: '一等奖',
      reason: '旧评议记录',
      status: '退回修改',
      message: '审核通过',
    },
  ] as const)(
    '首次发布复核旧获奖资料：$message；失败不改状态、时间或版本',
    ({ award, reason, status, message }) => {
      const data = seedData();
      const activity = data.activities.find(
        (a) => a.id === 'demo-workflow-pending-result',
      )!;
      const entry = data.entries.find((e) => e.activityId === activity.id)!;
      Object.assign(activity, {
        noticeTitle: '公示',
        noticeBody: '已保存正文',
      });
      Object.assign(entry, { award, awardReason: reason, status });
      const before = copy(data);
      expect(() =>
        changeActivity(data, manager, activity.id, '已公示'),
      ).toThrow(message);
      expect(data).toEqual(before);
      Object.assign(entry, {
        award: '一等奖',
        awardReason: '经评议确认',
        status: '审核通过',
      });
      changeActivity(data, manager, activity.id, '已公示');
      expect(
        currentPublication(activity)?.winners.find((e) => e.id === entry.id)
          ?.awardReason,
      ).toBe('经评议确认');
    },
  );

  it('评审退回和暂存保留首次及最近提交时间，重提只更新最近时间', () => {
    const data = seedData();
    const review = data.reviews.find((r) => r.id === 'review-1')!;
    const entry = data.entries.find((e) => e.id === review.entryId)!;
    const activity = data.activities.find((a) => a.id === entry.activityId)!;
    const scores = Object.fromEntries(
      activity.criteria.map((c) => [c.id, c.max]),
    );
    const expert = person(review.expertId);
    saveReview(data, expert, review.id, scores, '符合要求', true);
    const first = review.firstSubmittedAt;
    expect(first).toBe(review.submittedAt);
    expect(first).toBeTruthy();
    vi.setSystemTime(new Date('2026-10-28T10:00:00'));
    returnReview(data, manager, review.id, '补充评审依据');
    saveReview(data, expert, review.id, scores, '补充意见', false);
    expect(review.submittedAt).toBe(first);
    saveReview(data, expert, review.id, scores, '补充意见', true);
    expect(review.firstSubmittedAt).toBe(first);
    expect(review.submittedAt).not.toBe(first);
    expect(
      normalizeCompetitionData(data).reviews.find((r) => r.id === review.id),
    ).toEqual(review);
  });
  it('旧记录只有最近提交时间而无历史时，不猜测首次时间', () => {
    const data = seedData();
    const entry = data.entries[0]!;
    entry.status = '已撤回';
    entry.submittedAt = '2026-10-20 10:00:00';
    delete entry.firstSubmittedAt;
    entry.history = [];
    const migrated = normalizeCompetitionData(data);
    const old = migrated.entries.find((e) => e.id === entry.id)!;
    expect(old.firstSubmittedAt).toBe('');
    saveEntry(migrated, employee, copy(old), true);
    expect(old.firstSubmittedAt).toBe('');
    expect(old.submittedAt).toBe('2026-10-27 10:00:00');
  });
  it('填报人设置公开后保存生效，项目查看条件独立，审核和撤回不重置选择', () => {
    const data = seedData();
    const entry = data.entries[0]!;
    const form = copy(entry);
    form.attachments[0]!.public = true;
    const other = person('employee-c');
    saveEntry(data, employee, form, true);
    expect(attachmentIsPublic(entry.attachments[0]!)).toBe(true);
    expect(canSeeEntry(data, entry, other)).toBe(false);
    auditEntry(data, manager, entry.id, false, '补充说明', '2026-10-28');
    expect(attachmentIsPublic(entry.attachments[0]!)).toBe(true);
    saveEntry(data, employee, copy(entry), true);
    auditEntry(data, manager, entry.id, true, '通过');
    expect(canSeeEntry(data, entry, other)).toBe(true);
    expect(entry.history.at(-1)!.note).toBe('通过');
    withdrawEntry(data, employee, entry.id);
    expect(attachmentIsPublic(entry.attachments[0]!)).toBe(true);
    expect(canSeeEntry(data, entry, other)).toBe(false);
    const privateForm = copy(entry);
    privateForm.attachments[0]!.public = false;
    expect(() => saveEntry(data, other, privateForm)).toThrow();
    saveEntry(data, employee, privateForm, true);
    auditEntry(data, manager, entry.id, true, '通过');
    expect(attachmentIsPublic(entry.attachments[0]!)).toBe(false);
    expect(
      normalizeCompetitionData(data).entries.find((e) => e.id === entry.id)!
        .attachments[0]!.public,
    ).toBe(false);
  });
  it('旧公开及拟公开按填报人选择兼容，文件和历史保留，取消公开后刷新不恢复', () => {
    const data = seedData();
    const entry = data.entries.find((e) => e.id === 'entry-4')!;
    entry.status = '审核通过';
    entry.attachments[0]!.public = true;
    delete entry.attachments[0]!.publicRequested;
    delete entry.attachments[0]!.publicReviewedAt;
    const attachment = copy(entry.attachments[0]!);
    entry.attachments = [
      attachment,
      { ...attachment, id: 'requested', public: false, publicRequested: true },
      { ...attachment, id: 'internal', public: false, publicRequested: false },
    ];
    const history = copy(entry.history);
    const migrated = normalizeCompetitionData(data);
    const e = migrated.entries.find((x) => x.id === entry.id)!;
    expect(e.attachments.map(attachmentIsPublic)).toEqual([true, true, false]);
    expect(e.attachments.every((a) => a.content === attachment.content)).toBe(
      true,
    );
    expect(e.attachments.every((a) => a.publicRequested === undefined)).toBe(
      true,
    );
    expect(e.history).toEqual(history);
    expect(normalizeCompetitionData(migrated)).toEqual(migrated);
    e.attachments[1]!.public = false;
    expect(
      normalizeCompetitionData(migrated).entries.find((x) => x.id === e.id)!
        .attachments[1]!.public,
    ).toBe(false);
  });
  it('发布允许零获奖但必须先保存正文；更正期间对外版本不变，重发保留旧版', () => {
    const data = seedData();
    const activity = data.activities.find(
      (a) => a.id === 'demo-workflow-pending-result',
    )!;
    const entries = data.entries.filter((e) => e.activityId === activity.id);
    saveResults(
      data,
      manager,
      activity.id,
      entries.map((e) => ({ entryId: e.id, award: '', reason: '' })),
      '零获奖公示',
      '',
      '',
    );
    expect(() => changeActivity(data, manager, activity.id, '已公示')).toThrow(
      '正文',
    );
    expect(activity.publications).toBeUndefined();
    saveResults(
      data,
      manager,
      activity.id,
      [],
      '零获奖公示',
      '本次无获奖项目，后续继续完善。',
      '',
    );
    changeActivity(data, manager, activity.id, '已公示');
    expect(currentPublication(activity)?.winners).toHaveLength(0);
    const first = copy(currentPublication(activity)!);
    expect(() =>
      saveResults(data, manager, activity.id, [], '直接改', '正文', ''),
    ).toThrow('待公示');
    expect(() => beginResultCorrection(data, manager, activity.id, '')).toThrow(
      '原因',
    );
    beginResultCorrection(data, manager, activity.id, '补录线下确认结果');
    saveResults(
      data,
      manager,
      activity.id,
      [{ entryId: entries[0]!.id, award: '一等奖', reason: '评议记录' }],
      '更正公示',
      '补录一项获奖。',
      '',
    );
    expect(currentPublication(activity)).toEqual(first);
    expect(entries[0]!.award).toBe('');
    vi.setSystemTime(new Date('2026-10-28T11:00:00'));
    publishResultCorrection(data, manager, activity.id);
    expect(activity.publications).toHaveLength(2);
    expect(activity.publications![0]).toEqual(first);
    expect(currentPublication(activity)).toMatchObject({
      version: 2,
      noticeDate: '2026-10-28',
      reason: '补录线下确认结果',
      title: '更正公示',
    });
    expect(currentPublication(activity)?.winners).toHaveLength(1);
    expect(activity.resultCorrection).toBeUndefined();
  });
  it('更正不能越权，可放弃草稿；已结束活动更正不恢复业务流程', () => {
    const data = seedData();
    const activity = data.activities.find(
      (a) => a.id === 'demo-workflow-ended',
    )!;
    const original = copy(currentPublication(activity)!);
    for (const actor of [
      employee,
      person('expert-a'),
      person('manager-operation'),
    ]) {
      expect(() =>
        beginResultCorrection(data, actor, activity.id, '更正'),
      ).toThrow('授权');
      expect(() => publishResultCorrection(data, actor, activity.id)).toThrow();
    }
    beginResultCorrection(data, manager, activity.id, '改正错字');
    expect(() =>
      beginResultCorrection(data, manager, activity.id, '重复'),
    ).toThrow('已有');
    discardResultCorrection(data, manager, activity.id);
    expect(currentPublication(activity)).toEqual(original);
    beginResultCorrection(data, manager, activity.id, '改正错字');
    publishResultCorrection(data, manager, activity.id);
    expect(activity.status).toBe('已结束');
    expect(activity.publications).toHaveLength(2);
  });
  it('首次提交保留，重提更新最近时间与负责人快照，不接受前端伪造快照', () => {
    const data = seedData();
    const entry = data.entries[0]!;
    saveEntry(data, employee, copy(entry), true);
    const first = entry.firstSubmittedAt;
    const leader = person(entry.leaderId);
    const oldName = leader.name;
    try {
      leader.name = '目录改名测试';
      expect(projectLeader(entry).name).toBe(oldName);
      withdrawEntry(data, employee, entry.id);
      vi.setSystemTime(new Date('2026-10-28T11:00:00'));
      saveEntry(
        data,
        employee,
        {
          ...copy(entry),
          firstSubmittedAt: '伪造',
          leaderSnapshot: { id: leader.id, name: '伪造', department: '伪造' },
        },
        true,
      );
      expect(entry.firstSubmittedAt).toBe(first);
      expect(entry.submittedAt).toBe('2026-10-28 11:00:00');
      expect(projectLeader(entry).name).toBe('目录改名测试');
    } finally {
      leader.name = oldName;
    }
  });
  it('公示名单、申报查看和证书资料取固定快照，目录改名或源数据改动不改变已发布内容', () => {
    const data = seedData();
    const activity = data.activities.find(
      (a) => a.id === 'demo-workflow-published',
    )!;
    const pub = copy(currentPublication(activity)!);
    const winner = pub.winners[0]!;
    const entry = data.entries.find((e) => e.id === winner.id)!;
    const leader = person(entry.leaderId);
    const before = { ...leader };
    try {
      leader.name = '新姓名';
      leader.department = '新部门';
      entry.name = '源资料改动';
      entry.award = '源奖项改动';
      expect(currentPublication(activity)).toEqual(pub);
      expect(publishedEntry(data, entry).name).toBe(winner.name);
      expect(projectLeader(publishedEntry(data, entry)).name).toBe(
        winner.leaderSnapshot!.name,
      );
    } finally {
      Object.assign(leader, before);
    }
  });
  it('证书仅授权管理员、填报人或项目负责人可下载；负责人不获得内部附件权', () => {
    const data = seedData();
    const activity = data.activities.find(
      (a) => a.id === 'demo-workflow-published',
    )!;
    const winner = currentPublication(activity)!.winners[0]!;
    winner.leaderId = 'employee-c';
    for (const p of people)
      expect(canDownloadCertificate(activity, winner, p)).toBe(
        ['employee-a', 'employee-c', 'manager'].includes(p.id),
      );
    const entry = data.entries.find((e) => e.id === winner.id)!;
    expect(isInternalReader(data, entry, person('employee-c'))).toBe(false);
    activity.showcase = false;
    expect(canSeeEntry(data, entry, person('employee-b'))).toBe(true);
  });
  it('删除只允许无申报草稿活动和从未提交的本人草稿，撤回记录保留', () => {
    const data = seedData();
    const activity = data.activities.find((a) => a.id === 'activity-draft')!;
    const draft = newEntry(activity.id, employee.id);
    data.entries.push(draft);
    expect(() => deleteDraft(data, manager, 'activity', activity.id)).toThrow(
      '任何申报',
    );
    expect(() =>
      deleteDraft(data, person('employee-b'), 'entry', draft.id),
    ).toThrow('本人');
    deleteDraft(data, employee, 'entry', draft.id);
    deleteDraft(data, manager, 'activity', activity.id);
    const entry = data.entries[0]!;
    saveEntry(data, employee, copy(entry), true);
    withdrawEntry(data, employee, entry.id);
    expect(
      canDeleteEntry(
        entry,
        employee,
        data.activities.find((a) => a.id === entry.activityId)!,
      ),
    ).toBe(false);
    expect(() => deleteDraft(data, employee, 'entry', entry.id)).toThrow(
      '保留',
    );
    entry.status = '草稿';
    expect(
      canDeleteEntry(
        entry,
        employee,
        data.activities.find((a) => a.id === entry.activityId)!,
      ),
    ).toBe(false);
  });
  it('取消必须原因且保留资料与历史，统计排除草稿、撤回和终止', () => {
    const data = seedData();
    const activity = data.activities.find(
      (a) => a.id === 'demo-workflow-open',
    )!;
    const entries = copy(
      data.entries.filter((e) => e.activityId === activity.id),
    );
    expect(entries.filter(countedEntry)).toHaveLength(4);
    expect(() => changeActivity(data, manager, activity.id, '已取消')).toThrow(
      '原因',
    );
    expect(activity.status).toBe('报名中');
    changeActivity(data, manager, activity.id, '已取消', '活动计划调整');
    expect(activity.history.at(-1)?.note).toBe('活动计划调整');
    expect(data.entries.filter((e) => e.activityId === activity.id)).toEqual(
      entries,
    );
    expect(() => changeActivity(data, manager, activity.id, '报名中')).toThrow(
      '不支持',
    );
  });
  it('旧公示兼容快照标明来源且只冻结一次，不伪造提交时姓名部门', () => {
    const data = seedData();
    const activity = data.activities.find(
      (a) => a.id === 'activity-published',
    )!;
    delete activity.publications;
    const migrated = normalizeCompetitionData(data);
    const a = migrated.activities.find((x) => x.id === activity.id)!;
    expect(currentPublication(a)?.legacy).toBe(true);
    expect(normalizeCompetitionData(migrated)).toEqual(migrated);
    expect(
      migrated.entries.find((e) => e.activityId === a.id)?.leaderSnapshot,
    ).toBeUndefined();
  });
});
