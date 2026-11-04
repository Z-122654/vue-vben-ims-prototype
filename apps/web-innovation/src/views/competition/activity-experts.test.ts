import { describe, expect, it } from 'vitest';

import {
  changeActivity,
  copy,
  newActivity,
  normalizeCompetitionData,
  nowText,
  person,
  saveActivity,
  saveActivityExperts,
} from './model';
import { seedData } from './seed';
const manager = person('manager');

function readyData() {
  const data = seedData();
  data.activities[0]!.deadline = nowText().slice(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  data.activities[0]!.deadline = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  for (const entry of data.entries.filter(
    (item) => item.activityId === 'activity-open',
  )) {
    if (entry.status === '待审核' || entry.status === '退回修改')
      entry.status = '审核通过';
  }
  return data;
}

describe('活动统一评审专家', () => {
  it('草稿专家必填，名单去重并拒绝无效人员；报名中只保存专家名单', () => {
    const data = seedData();
    const draft = data.activities.find((item) => item.id === 'activity-draft')!;
    const original = copy(data);
    expect(() =>
      saveActivity(data, manager, { ...copy(draft), expertIds: [] }),
    ).toThrow('至少选择');
    expect(() => changeActivity(data, manager, draft.id, '报名中')).toThrow(
      '至少选择',
    );
    expect(() =>
      saveActivity(data, manager, { ...newActivity(), name: '新建必填验证' }),
    ).toThrow('至少选择');
    expect(data).toEqual(original);
    saveActivityExperts(data, manager, draft.id, ['expert-a', 'expert-a']);
    expect(draft.expertIds).toEqual(['expert-a']);
    expect(() =>
      saveActivityExperts(data, manager, draft.id, ['unknown-person']),
    ).toThrow('有效');
    const activity = data.activities[0]!;
    const before = copy(activity);
    expect(() => saveActivityExperts(data, manager, activity.id, [])).toThrow(
      '至少选择',
    );
    expect(() =>
      saveActivity(data, manager, { ...copy(activity), expertIds: [] }),
    ).toThrow('至少选择');
    expect(activity).toEqual(before);
    saveActivity(data, manager, {
      ...copy(activity),
      name: '不得覆盖',
      description: '不得覆盖',
      criteria: [],
      expertIds: ['expert-b'],
    });
    expect(activity).toEqual({
      ...before,
      expertIds: ['expert-b'],
      history: activity.history,
    });
    expect(
      data.reviews.some((review) =>
        data.entries.some(
          (entry) =>
            entry.activityId === activity.id && entry.id === review.entryId,
        ),
      ),
    ).toBe(false);
  });
  it('开启前必须选专家；开启时仅为审核通过项目生成完整任务且名单锁定', () => {
    const data = readyData();
    // 旧演示活动可能存在空名单，开启时仍须拦截，不自动填充人员。
    data.activities.find((a) => a.id === 'activity-open')!.expertIds = [];
    const before = copy(data);
    expect(() =>
      changeActivity(data, manager, 'activity-open', '评审中'),
    ).toThrow('至少选择');
    expect(data).toEqual(before);
    saveActivityExperts(data, manager, 'activity-open', [
      'expert-a',
      'expert-b',
    ]);
    changeActivity(data, manager, 'activity-open', '评审中');
    const entries = data.entries.filter(
      (entry) =>
        entry.activityId === 'activity-open' && entry.status === '审核通过',
    );
    const tasks = data.reviews.filter((review) =>
      entries.some((entry) => entry.id === review.entryId),
    );
    expect(tasks).toHaveLength(entries.length * 2);
    expect(tasks.every((review) => review.status === '待评审')).toBe(true);
    expect(data.reviews.some((review) => review.entryId === 'entry-1')).toBe(
      false,
    );
    expect(() =>
      saveActivityExperts(data, manager, 'activity-open', ['expert-b']),
    ).toThrow('锁定');
    expect(() =>
      saveActivity(data, manager, copy(data.activities[0]!)),
    ).toThrow('锁定');
    expect(normalizeCompetitionData(data).reviews).toEqual(data.reviews);
  });
  it('每个项目的每位专家必须提交，任务缺失也不能完成评审', () => {
    const data = seedData();
    const activity = data.activities.find(
      (item) => item.id === 'activity-review',
    )!;
    const entries = data.entries.filter(
      (entry) => entry.activityId === activity.id,
    );
    const tasks = data.reviews.filter((review) =>
      entries.some((entry) => entry.id === review.entryId),
    );
    tasks.forEach((review) => {
      review.status = '已提交';
    });
    const missing = tasks.at(-1)!;
    data.reviews = data.reviews.filter((review) => review.id !== missing.id);
    expect(() => changeActivity(data, manager, activity.id, '待公示')).toThrow(
      '所有评审',
    );
    data.reviews.push({ ...missing, status: '评分暂存' });
    expect(() => changeActivity(data, manager, activity.id, '待公示')).toThrow(
      '所有评审',
    );
    data.reviews.at(-1)!.status = '已提交';
    changeActivity(data, manager, activity.id, '待公示');
    expect(activity.status).toBe('待公示');
  });
  it('旧评审中活动从历史任务提取专家并补齐缺项，不改原评分且可重复读取', () => {
    const legacy = seedData();
    legacy.activities.forEach((activity) =>
      Reflect.deleteProperty(activity, 'expertIds'),
    );
    legacy.reviews = legacy.reviews.filter(
      (review) =>
        !(review.entryId === 'entry-6' && review.expertId === 'expert-b'),
    );
    const before = copy(legacy);
    const migrated = normalizeCompetitionData(legacy);
    expect(legacy).toEqual(before);
    expect(
      migrated.activities.find((activity) => activity.id === 'activity-review')!
        .expertIds,
    ).toEqual(['expert-a', 'expert-b']);
    expect(
      migrated.activities.find((activity) => activity.id === 'activity-open')!
        .expertIds,
    ).toEqual([]);
    expect(migrated.reviews.slice(0, before.reviews.length)).toEqual(
      before.reviews,
    );
    expect(migrated.reviews).toHaveLength(before.reviews.length + 1);
    expect(migrated.reviews.at(-1)).toMatchObject({
      entryId: 'entry-6',
      expertId: 'expert-b',
      status: '待评审',
      scores: {},
    });
    expect(migrated.entries).toEqual(before.entries);
    expect(normalizeCompetitionData(migrated)).toEqual(migrated);
  });
  it('待公示、已公示、已结束及取消的历史活动只回填名单，不追加任务', () => {
    for (const status of ['待公示', '已公示', '已结束', '已取消'] as const) {
      const legacy = seedData();
      const activity = legacy.activities.find(
        (item) => item.id === 'activity-review',
      )!;
      activity.status = status;
      Reflect.deleteProperty(activity, 'expertIds');
      legacy.reviews = legacy.reviews.filter(
        (review) =>
          !(review.entryId === 'entry-6' && review.expertId === 'expert-b'),
      );
      const before = copy(legacy);
      const migrated = normalizeCompetitionData(legacy);
      expect(migrated.reviews).toEqual(before.reviews);
      expect(migrated.entries).toEqual(before.entries);
      expect(
        migrated.activities.find((item) => item.id === activity.id),
      ).toMatchObject({
        ...before.activities.find((item) => item.id === activity.id),
        expertIds: ['expert-a', 'expert-b'],
      });
      expect(normalizeCompetitionData(migrated)).toEqual(migrated);
    }
  });
});
