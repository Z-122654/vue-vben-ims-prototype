import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  auditEntry,
  copy,
  entrySubmissionTime,
  normalizeCompetitionData,
  person,
  projectLeader,
  returnReview,
  reviewSubmissionTime,
  saveEntry,
  saveReview,
  withdrawEntry,
} from './model';
import { seedData } from './seed';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-27T10:00:00'));
});
afterEach(() => vi.useRealTimers());

describe('当前负责人及旧历史兼容', () => {
  it.each([undefined, ''])(
    '活动实际时间为%s时仅按对应历史恢复，重复加载及原数据保持稳定',
    (missing) => {
      const data = seedData();
      const activity = data.activities[0]!;
      const fields = [
        'registeredAt',
        'reviewStartedAt',
        'reviewCompletedAt',
        'endedAt',
      ] as const;
      const actions = ['活动报名中', '活动评审中', '活动待公示', '活动已结束'];
      const times = [
        '2026-10-01 09:00:00',
        '2026-10-05 10:00:00',
        '2026-10-06 11:00:00',
        '2026-10-07 12:00:00',
      ];
      activity.status = '已结束';
      fields.forEach((field) => {
        activity[field] = missing;
      });
      activity.history = actions.map((action, i) => ({
        id: String(i),
        action,
        at: times[i]!,
        actor: '陈嘉宁',
        note: '',
      }));
      const before = copy(data);
      const restored = normalizeCompetitionData(data);
      fields.forEach((field, i) =>
        expect(restored.activities[0]![field]).toBe(times[i]),
      );
      expect(data).toEqual(before);
      expect(normalizeCompetitionData(copy(restored))).toEqual(restored);
      activity.history = [
        {
          id: 'save',
          action: '保存活动',
          at: '2026-10-02 09:00:00',
          actor: '陈嘉宁',
          note: '',
        },
      ];
      const unknown = normalizeCompetitionData(data).activities[0]!;
      fields.forEach((field) => expect(unknown[field]).toBe(''));
      fields.forEach((field) => {
        activity[field] = '2026-09-01 08:00:00';
      });
      const preserved = normalizeCompetitionData(data).activities[0]!;
      fields.forEach((field) =>
        expect(preserved[field]).toBe('2026-09-01 08:00:00'),
      );
    },
  );
  it.each(['已撤回', '退回修改'] as const)(
    '%s旧申报无历史时间，暂存和重提不补造首次时间，重载仍保留未知值',
    (status) => {
      const data = seedData();
      const entry = data.entries[0]!;
      Object.assign(entry, {
        status,
        submittedAt: '',
        history: [],
        supplementDeadline: '2026-10-28',
      });
      delete entry.firstSubmittedAt;
      const owner = person(entry.ownerId);
      expect(entrySubmissionTime(entry)).toBe('历史未记录');
      saveEntry(data, owner, copy(entry), false);
      expect(entrySubmissionTime(entry)).toBe('历史未记录');
      saveEntry(data, owner, copy(entry), true);
      expect(entry.firstSubmittedAt).toBe('');
      expect(entrySubmissionTime(entry)).toBe('2026-10-27 10:00:00');
      expect(
        normalizeCompetitionData(copy(data)).entries[0]!.firstSubmittedAt,
      ).toBe('');
    },
  );

  it.each([undefined, '', '2026-09-01 10:00:00'])(
    '旧评审首次时间为%s时，退回、暂存、重提和重载都不改写或补造',
    (firstSubmittedAt) => {
      const data = seedData();
      const review = data.reviews.find((r) => r.id === 'review-1')!;
      const entry = data.entries.find((e) => e.id === review.entryId)!;
      const activity = data.activities.find((a) => a.id === entry.activityId)!;
      Object.assign(review, {
        status: '已提交',
        submittedAt: '',
        firstSubmittedAt,
        history: [],
      });
      expect(reviewSubmissionTime(review)).toBe('历史未记录');
      returnReview(data, person('manager'), review.id, '补充意见');
      expect(reviewSubmissionTime(review)).toBe('历史未记录');
      const scores = Object.fromEntries(
        activity.criteria.map((c) => [c.id, c.max]),
      );
      saveReview(
        data,
        person(review.expertId),
        review.id,
        scores,
        '已补充',
        false,
      );
      expect(reviewSubmissionTime(review)).toBe('历史未记录');
      saveReview(
        data,
        person(review.expertId),
        review.id,
        scores,
        '已补充',
        true,
      );
      expect(review.firstSubmittedAt).toBe(firstSubmittedAt ?? '');
      expect(reviewSubmissionTime(review)).toBe('2026-10-27 10:00:00');
      expect(
        normalizeCompetitionData(copy(data)).reviews.find(
          (r) => r.id === review.id,
        )!.firstSubmittedAt,
      ).toBe(firstSubmittedAt ?? '');
    },
  );

  it('新评审暂存仍显示尚未提交，首次成功提交记录首次与最近时间', () => {
    const data = seedData();
    const review = data.reviews.find((r) => r.id === 'review-1')!;
    const entry = data.entries.find((e) => e.id === review.entryId)!;
    const activity = data.activities.find((a) => a.id === entry.activityId)!;
    expect(reviewSubmissionTime(review)).toBe('尚未提交');
    saveReview(data, person(review.expertId), review.id, {}, '', false);
    expect(reviewSubmissionTime(review)).toBe('尚未提交');
    const scores = Object.fromEntries(
      activity.criteria.map((c) => [c.id, c.max]),
    );
    saveReview(
      data,
      person(review.expertId),
      review.id,
      scores,
      '完成评审',
      true,
    );
    expect(review.firstSubmittedAt).toBe('2026-10-27 10:00:00');
    expect(reviewSubmissionTime(review)).toBe(review.firstSubmittedAt);
  });

  it.each(['已撤回', '退回修改'] as const)(
    '%s保存新负责人后即展示新资料，重提才更新提交快照',
    (status) => {
      const data = seedData();
      const entry = data.entries[0]!;
      const owner = person(entry.ownerId);
      saveEntry(data, owner, copy(entry), true);
      const snapshot = copy(entry.leaderSnapshot);
      const submittedAt = entry.submittedAt;
      if (status === '已撤回') withdrawEntry(data, owner, entry.id);
      else
        auditEntry(
          data,
          person('manager'),
          entry.id,
          false,
          '补充资料',
          '2026-10-28',
        );
      saveEntry(data, owner, { ...copy(entry), leaderId: 'employee-c' }, false);
      expect(entry.status).toBe(status);
      expect(projectLeader(entry).name).toBe('许文清');
      expect(projectLeader(entry).department).toBe('运行部');
      expect(entry.leaderSnapshot).toEqual(snapshot);
      expect(entry.submittedAt).toBe(submittedAt);
      const restored = normalizeCompetitionData(copy(data)).entries.find(
        (e) => e.id === entry.id,
      )!;
      expect(projectLeader(restored).name).toBe('许文清');
      vi.setSystemTime(new Date('2026-10-27T11:00:00'));
      saveEntry(data, owner, copy(entry), true);
      expect(entry.leaderSnapshot?.name).toBe('许文清');
      expect(entry.firstSubmittedAt).toBe(submittedAt);
      expect(entry.submittedAt).toBe('2026-10-27 11:00:00');
      // 公示记录没有业务编辑状态，始终使用冻结的负责人资料。
      expect(
        projectLeader({ leaderId: 'employee-c', leaderSnapshot: snapshot })
          .name,
      ).toBe(snapshot?.name);
    },
  );

  it('旧最近时间仅从提交历史恢复，已有值保持；无证据区分从未提交与历史缺失', () => {
    const data = seedData();
    const entry = data.entries[0]!;
    const owner = person(entry.ownerId);
    saveEntry(data, owner, copy(entry), true);
    withdrawEntry(data, owner, entry.id);
    vi.setSystemTime(new Date('2026-10-27T11:00:00'));
    saveEntry(data, owner, copy(entry), true);
    vi.setSystemTime(new Date('2026-10-27T12:00:00'));
    withdrawEntry(data, owner, entry.id);
    entry.submittedAt = '';
    Reflect.deleteProperty(entry, 'firstSubmittedAt');
    const normalized = normalizeCompetitionData(data);
    const restored = normalized.entries.find((e) => e.id === entry.id)!;
    expect(restored.firstSubmittedAt).toBe('2026-10-27 10:00:00');
    expect(entrySubmissionTime(restored)).toBe('2026-10-27 11:00:00');
    expect(entry.submittedAt).toBe('');
    expect(normalizeCompetitionData(normalized)).toEqual(normalized);
    entry.submittedAt = '2026-10-26 09:00:00';
    expect(normalizeCompetitionData(data).entries[0]!.submittedAt).toBe(
      entry.submittedAt,
    );
    entry.submittedAt = '';
    entry.firstSubmittedAt = '';
    entry.history = [];
    expect(
      entrySubmissionTime(normalizeCompetitionData(data).entries[0]!),
    ).toBe('历史未记录');
    entry.status = '草稿';
    expect(
      entrySubmissionTime(normalizeCompetitionData(data).entries[0]!),
    ).toBe('');
  });

  it.each(['评审中', '待公示', '已公示', '已结束', '已取消'] as const)(
    '%s的空专家名单由已有任务去重恢复，不改写评分',
    (status) => {
      const data = seedData();
      const activity = data.activities.find((a) => a.id === 'activity-review')!;
      activity.status = status;
      activity.expertIds = [];
      const reviews = copy(data.reviews);
      const expectedIds = [
        ...new Set(
          reviews
            .filter((r) =>
              data.entries.some(
                (e) => e.id === r.entryId && e.activityId === activity.id,
              ),
            )
            .map((r) => r.expertId),
        ),
      ];
      expect(expectedIds.length).toBeGreaterThan(0);
      const normalized = normalizeCompetitionData(data);
      expect(
        normalized.activities.find((a) => a.id === activity.id)!.expertIds,
      ).toEqual(expectedIds);
      for (const review of reviews)
        expect(normalized.reviews.find((r) => r.id === review.id)).toEqual(
          review,
        );
      if (status === '评审中') {
        for (const entry of data.entries.filter(
          (e) => e.activityId === activity.id && e.status === '审核通过',
        )) {
          for (const expertId of expectedIds)
            expect(
              normalized.reviews.filter(
                (r) => r.entryId === entry.id && r.expertId === expertId,
              ),
            ).toHaveLength(1);
        }
      } else {
        expect(normalized.reviews).toEqual(reviews);
      }
      expect(normalizeCompetitionData(normalized)).toEqual(normalized);
      expect(activity.expertIds).toEqual([]);
      activity.expertIds = [expectedIds[0]!];
      expect(
        normalizeCompetitionData(data).activities.find(
          (a) => a.id === activity.id,
        )!.expertIds,
      ).toEqual(activity.expertIds);
    },
  );
});
