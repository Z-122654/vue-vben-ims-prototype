import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  activityStates,
  canApply,
  canEditEntry,
  changeActivity,
  copy,
  entryStates,
  normalizeCompetitionData,
  person,
  reviewOverdue,
  saveReview,
} from './model';
import { seedData } from './seed';
import {
  withWorkflowExamples,
  workflowExamplePack,
  workflowExamples,
} from './workflow-examples';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-27T10:00:00'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('完整状态演示数据', () => {
  it('覆盖全部活动、申报和评分状态，关系、时间、材料与任务一致', () => {
    const data = workflowExamples();
    expect(data.activities).toHaveLength(9);
    expect(data.entries).toHaveLength(19);
    expect(data.reviews).toHaveLength(22);
    expect(new Set(data.activities.map((a) => a.status))).toEqual(
      new Set(activityStates),
    );
    expect(new Set(data.entries.map((e) => e.status))).toEqual(
      new Set(entryStates),
    );
    expect(new Set(data.reviews.map((r) => r.status))).toEqual(
      new Set(['已提交', '待评审', '评分暂存']),
    );
    for (const group of [data.activities, data.entries, data.reviews])
      expect(new Set(group.map((x) => x.id)).size).toBe(group.length);
    for (const a of data.activities) {
      expect(a.history.map((h) => h.at)).toEqual(
        a.history.map((h) => h.at).sort(),
      );
      for (const e of data.entries.filter((e) => e.activityId === a.id)) {
        expect(person(e.ownerId).department).toBe(
          person(e.leaderId).department,
        );
        expect(e.history.map((h) => h.at)).toEqual(
          e.history.map((h) => h.at).sort(),
        );
        for (const attachment of e.attachments) {
          const content = decodeURIComponent(attachment.content.split(',')[1]!);
          expect(new TextEncoder().encode(content).length).toBe(
            attachment.size,
          );
        }
        if (a.reviewStartedAt && e.status === '审核通过') {
          expect(e.submittedAt < a.reviewStartedAt).toBe(true);
          expect(a.expertIds).not.toContain(e.ownerId);
          expect(a.expertIds).not.toContain(e.leaderId);
          expect(
            data.reviews
              .filter((r) => r.entryId === e.id)
              .map((r) => r.expertId)
              .sort(),
          ).toEqual([...a.expertIds].sort());
        }
        if (a.reviewCompletedAt) {
          for (const r of data.reviews.filter((r) => r.entryId === e.id)) {
            expect(r.status).toBe('已提交');
            expect(r.submittedAt < a.reviewCompletedAt).toBe(true);
          }
        }
      }
    }
    expect(normalizeCompetitionData(data)).toEqual(data);
  });
  it('截止待开启、待公示和已公示示例可直接演示下一步操作', () => {
    const data = workflowExamples();
    const manager = person('manager');
    changeActivity(data, manager, 'demo-workflow-ready', '评审中');
    expect(
      data.reviews.filter((r) => r.entryId === 'demo-workflow-entry-ready'),
    ).toHaveLength(2);
    changeActivity(data, manager, 'demo-workflow-pending-result', '已公示');
    changeActivity(data, manager, 'demo-workflow-published', '已结束');
    expect(
      data.activities.find((a) => a.id === 'demo-workflow-pending-result')!
        .noticeDate,
    ).toBe('2026-10-27');
  });
  it('补交、部门范围、评审逾期、终止和取消示例能触发对应权限', () => {
    const data = workflowExamples();
    const open = data.activities.find((a) => a.id === 'demo-workflow-open')!;
    const employee = person('employee-a');
    expect(canApply(open, employee)).toBe(true);
    expect(canApply(open, person('expert-a'))).toBe(false);
    for (const [key, editable] of [
      ['returned', true],
      ['expired', false],
      ['withdrawn', true],
      ['terminated', false],
    ] as const) {
      expect(
        canEditEntry(
          open,
          data.entries.find((e) => e.id === `demo-workflow-entry-${key}`)!,
          employee,
        ),
      ).toBe(editable);
    }
    const overdue = data.activities.find(
      (a) => a.id === 'demo-workflow-overdue',
    )!;
    expect(reviewOverdue(overdue)).toBe(true);
    saveReview(
      data,
      person('expert-a'),
      'demo-workflow-entry-overdue-expert-a',
      { innovation: 26, practice: 27, safety: 18, benefit: 17 },
      '逾期仍可提交',
      true,
    );
    expect(() =>
      saveReview(
        data,
        person('expert-a'),
        'demo-workflow-entry-cancelled-a-expert-a',
        {},
        '',
        false,
      ),
    ).toThrow('评审阶段');
  });
  it('旧数据只追加一次，保留原记录及子数据，刷新不恢复已删除草稿', () => {
    const initial = seedData();
    const old = copy(initial);
    old.activities = old.activities.filter(
      (a) => !a.id.startsWith('demo-workflow-'),
    );
    old.entries = old.entries.filter((e) => !e.id.startsWith('demo-workflow-'));
    old.reviews = old.reviews.filter((r) => !r.id.startsWith('demo-workflow-'));
    delete old.demoPacks;
    old.activities[0]!.name = '用户自己的修改';
    old.entries[0]!.attachments[0]!.name = '用户附件.doc';
    old.reviews[0]!.comment = '保留用户评分';
    const before = copy(old);
    const merged = withWorkflowExamples(old, initial);
    expect(old).toEqual(before);
    expect(merged.activities.slice(0, old.activities.length)).toEqual(
      old.activities,
    );
    expect(merged.entries.slice(0, old.entries.length)).toEqual(old.entries);
    expect(merged.reviews.slice(0, old.reviews.length)).toEqual(old.reviews);
    merged.activities = merged.activities.filter(
      (a) => a.id !== 'demo-workflow-draft',
    );
    merged.activities.at(-1)!.name = '新示例上的后续修改';
    expect(withWorkflowExamples(merged, initial)).toBe(merged);
    expect(merged.demoPacks).toContain(workflowExamplePack);
  });
  it('首次安装立即保存，次日刷新保留日期和示例数量', async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    vi.resetModules();
    const first = (await import('./store')).useCompetition();
    const before = JSON.stringify(first.data.value);
    expect(values.get('vben-web-innovation:competition:v1')).toBe(before);
    vi.setSystemTime(new Date('2026-10-28T10:00:00'));
    vi.resetModules();
    const second = (await import('./store')).useCompetition();
    expect(JSON.stringify(second.data.value)).toBe(before);
  });
});
