import type { CompetitionData, Person } from './model';
import {
  activityOf,
  decidePublicationApproval,
  submitPublicationApproval,
} from './model';

// 既有公示回归用例经真实提交及会签发布；不提供生产绕过入口。
export function approveForTest(
  data: CompetitionData,
  actor: Person,
  id: string,
) {
  const activity = activityOf(data, id);
  const previous = activity.publicApproverIds;
  activity.publicApproverIds = [actor.id];
  let round: string;
  try {
    round = submitPublicationApproval(data, actor, id);
  } catch (error) {
    if (previous === undefined) delete activity.publicApproverIds;
    else activity.publicApproverIds = previous;
    throw error;
  }
  decidePublicationApproval(data, actor, id, round, '同意', '');
}
