import { describe, expect, it } from 'vitest';

import { copy, normalizeCompetitionData, person, saveReview } from './model';
import { seedData } from './seed';

describe('评分子表数据兼容', () => {
  it('旧暂存中的零分、空值与未填项，以及已提交评分和历史均原样保留', () => {
    const legacy = seedData();
    legacy.reviews[0]!.scores = { innovation: 0, practice: null };
    const before = copy(legacy);
    const loaded = normalizeCompetitionData(legacy);
    expect(loaded.activities).toEqual(before.activities);
    expect(loaded.reviews).toEqual(before.reviews);
    expect(normalizeCompetitionData(loaded)).toEqual(loaded);
    expect(legacy).toEqual(before);
  });

  it('指标改名或调整展示顺序后仍按 ID 保存评分，不按行号或名称匹配', () => {
    const data = seedData();
    const activity = data.activities.find(
      (item) => item.id === 'activity-review',
    )!;
    activity.criteria.reverse();
    activity.criteria.find((item) => item.id === 'innovation')!.name =
      '技术创新性';
    const scores = { innovation: 0, practice: 22.5, safety: 18, benefit: 17 };
    saveReview(
      data,
      person('expert-a'),
      'review-1',
      scores,
      '逐项独立评价',
      true,
    );
    const saved = data.reviews.find((item) => item.id === 'review-1')!;
    expect(saved.scores).toEqual(scores);
    expect(activity.criteria.map((item) => saved.scores[item.id])).toEqual([
      17, 18, 22.5, 0,
    ]);
    expect(saved.status).toBe('已提交');
  });
});
