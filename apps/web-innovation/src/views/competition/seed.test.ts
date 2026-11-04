import { describe, expect, it } from 'vitest';

import { canSeeEntry, isInternalReader, person } from './model';
import { seedData, withHiddenShowcaseExample } from './seed';

describe('关闭参赛作品展示的演示场景', () => {
  it('保留已公示获奖结果和公开介绍，同时不开放内部申报材料', () => {
    const data = seedData();
    const activity = data.activities.find(
      (item) => item.id === 'activity-hidden-showcase',
    )!;
    const entry = data.entries.find((item) => item.activityId === activity.id)!;
    expect(activity.showcase).toBe(false);
    expect(activity.status).toBe('已公示');
    expect(activity.noticeTitle).not.toBe('');
    expect(entry.award).not.toBe('');
    const reader = person('employee-b');
    expect(canSeeEntry(data, entry, reader)).toBe(true);
    expect(isInternalReader(data, entry, reader)).toBe(false);
    expect(
      data.reviews.some(
        (review) => review.entryId === entry.id && review.status === '已提交',
      ),
    ).toBe(true);
  });

  it('只补充缺失的新示例，重复读取不覆盖已有活动、附件或评分', () => {
    const initial = seedData();
    const old = seedData();
    old.activities = old.activities.filter(
      (item) => item.id !== 'activity-hidden-showcase',
    );
    old.entries = old.entries.filter(
      (item) => item.id !== 'entry-hidden-showcase',
    );
    old.reviews = old.reviews.filter(
      (item) => item.id !== 'review-hidden-showcase',
    );
    old.activities[0]!.name = '用户保留的活动';
    old.entries[0]!.attachments[0]!.name = '用户保留的附件.doc';
    old.reviews[0]!.comment = '用户保留的评分意见';
    const snapshot = JSON.stringify(old);
    const merged = withHiddenShowcaseExample(old, initial);
    expect(JSON.stringify(old)).toBe(snapshot);
    expect(merged.activities.slice(0, old.activities.length)).toEqual(
      old.activities,
    );
    expect(merged.entries.slice(0, old.entries.length)).toEqual(old.entries);
    expect(merged.reviews.slice(0, old.reviews.length)).toEqual(old.reviews);
    expect(merged.activities).toHaveLength(old.activities.length + 1);
    expect(merged.entries).toHaveLength(old.entries.length + 1);
    expect(merged.reviews).toHaveLength(old.reviews.length + 1);
    merged.activities.at(-1)!.status = '已结束';
    expect(withHiddenShowcaseExample(merged, initial)).toBe(merged);
    expect(merged.activities.at(-1)!.status).toBe('已结束');
  });
});
