import type { Activity, CompetitionData } from './model';
import {
  beginResultCorrection,
  copy,
  decidePublicationApproval,
  person,
  saveResults,
  submitPublicationApproval,
  withdrawPublicationApproval,
} from './model';
export const approvalExamplePack = 'publication-approval-v1';
const prefix = 'demo-approval-';

export function addApprovalExamples(data: CompetitionData): CompetitionData {
  const result = copy(data);
  const source = result.activities.find(
    (a) => a.id === 'demo-workflow-pending-result',
  )!;
  const entries = result.entries.filter((e) => e.activityId === source.id);
  const reviews = result.reviews.filter((r) =>
    entries.some((e) => e.id === r.entryId),
  );
  const manager = person('manager');
  for (const [key, label] of [
    ['draft', '待提交'],
    ['pending', '多人审批中'],
    ['rejected', '审批驳回'],
    ['withdrawn', '审批撤回'],
    ['correction', '更正审批中'],
  ]) {
    const id = `${prefix}${key}`;
    const activity: Activity = {
      ...copy(source),
      id,
      code: `SP-${key}`,
      name: `领导会签演示（${label}）`,
      history: [],
      publicApproverIds: ['employee-c', 'expert-b'],
      publicationApprovals: [],
      publications: [],
      publishedAt: '',
      noticeDate: '',
      showcase: false,
    };
    result.activities.push(activity);
    for (const entry of entries)
      result.entries.push({
        ...copy(entry),
        id: `${id}-${entry.id}`,
        activityId: id,
      });
    for (const review of reviews)
      result.reviews.push({
        ...copy(review),
        id: `${id}-${review.id}`,
        entryId: `${id}-${review.entryId}`,
      });
    saveResults(
      result,
      manager,
      id,
      result.entries
        .filter((e) => e.activityId === id)
        .map((e) => ({ entryId: e.id, award: e.award, reason: e.awardReason })),
      `${label} · 结果公示`,
      '本记录为多人会签的虚构演示资料，展示审批流转与版本隔离。',
      '',
      activity.publicApproverIds,
    );
    if (key === 'draft') continue;
    const round = submitPublicationApproval(result, manager, id);
    decidePublicationApproval(
      result,
      person('employee-c'),
      id,
      round,
      '同意',
      '材料完整。',
    );
    if (key === 'rejected')
      decidePublicationApproval(
        result,
        person('expert-b'),
        id,
        round,
        '驳回',
        '请补充公示说明后重新提交。',
      );
    if (key === 'withdrawn')
      withdrawPublicationApproval(result, manager, id, round);
    if (key === 'correction') {
      decidePublicationApproval(
        result,
        person('expert-b'),
        id,
        round,
        '同意',
        '',
      );
      beginResultCorrection(
        result,
        manager,
        id,
        '补充公示正文（虚构更正演示）。',
      );
      activity.resultCorrection!.body +=
        ' 本次补充说明待所有审批人同意后生效。';
      submitPublicationApproval(result, manager, id);
    }
  }
  result.demoPacks = [...(result.demoPacks ?? []), approvalExamplePack];
  return result;
}
export function withApprovalExamples(
  data: CompetitionData,
  initial: CompetitionData,
): CompetitionData {
  if (data.demoPacks?.includes(approvalExamplePack)) return data;
  const activities = initial.activities.filter(
    (a) =>
      a.id.startsWith(prefix) &&
      !data.activities.some((old) => old.id === a.id),
  );
  const entries = initial.entries.filter((e) =>
    activities.some((a) => a.id === e.activityId),
  );
  const reviews = initial.reviews.filter((r) =>
    entries.some((e) => e.id === r.entryId),
  );
  return {
    ...data,
    activities: [...data.activities, ...copy(activities)],
    entries: [...data.entries, ...copy(entries)],
    reviews: [...data.reviews, ...copy(reviews)],
    demoPacks: [...(data.demoPacks ?? []), approvalExamplePack],
  };
}
