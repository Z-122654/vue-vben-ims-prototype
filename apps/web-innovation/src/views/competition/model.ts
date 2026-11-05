export type ActivityStatus =
  | '已公示'
  | '已取消'
  | '已结束'
  | '待公示'
  | '报名中'
  | '草稿'
  | '评审中';
export type EntryStatus =
  | '审核通过'
  | '已撤回'
  | '已终止'
  | '待审核'
  | '草稿'
  | '退回修改';
export interface Person {
  id: string;
  name: string;
  department: string;
  role: 'admin' | 'employee' | 'expert';
  managedDepartments?: string[];
}
export interface Attachment {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  uploader: string;
  public: boolean;
  // 仅兼容旧演示资料；读取时将填报人的选择迁入 public。
  publicRequested?: boolean;
  publicReviewedAt?: string;
  publicReviewer?: string;
  content: string;
}
export interface History {
  id: string;
  action: string;
  actor: string;
  at: string;
  note: string;
}
export interface Criterion {
  id: string;
  name: string;
  max: number;
}
export interface PublicationApproval {
  id: string;
  status: '审批中' | '已通过' | '已驳回' | '已撤回';
  kind: '初次公示' | '结果更正';
  submittedBy: string;
  submittedName: string;
  submittedAt: string;
  endedAt: string;
  withdrawnBy?: string;
  decisions: {
    personId: string;
    name: string;
    department: string;
    status: '待审批' | '同意' | '驳回';
    opinion: string;
    at: string;
  }[];
  snapshot: {
    title: string;
    body: string;
    awards: AwardInput[];
    entryIds: string[];
    publication: Publication;
    baseVersion: number;
  };
}
export interface Activity {
  id: string;
  code: string;
  name: string;
  type: string;
  department: string;
  contact: string;
  phone: string;
  description: string;
  requirements: string;
  departments: string[];
  participation: '个人' | '个人或团队' | '团队';
  start: string;
  deadline: string;
  reviewStart: string;
  reviewEnd: string;
  registeredAt?: string;
  publisherId?: string;
  publisherName?: string;
  reviewStartedAt?: string;
  reviewCompletedAt?: string;
  endedAt?: string;
  status: ActivityStatus;
  showcase: boolean;
  expertIds: string[];
  criteria: Criterion[];
  prizes: string[];
  attachments: Attachment[];
  history: History[];
  noticeTitle: string;
  noticeBody: string;
  noticeDate: string;
  publishedAt: string;
  publicApproverIds?: string[];
  publicationApprovals?: PublicationApproval[];
  publications?: Publication[];
  resultCorrection?: ResultCorrection;
}
export interface Entry {
  id: string;
  code: string;
  activityId: string;
  ownerId: string;
  leaderId: string;
  achievements: string;
  name: string;
  category: string;
  mode: '个人' | '团队';
  teamName: string;
  members: string[];
  phone: string;
  summary: string;
  background: string;
  solution: string;
  innovation: string;
  benefit: string;
  status: EntryStatus;
  submittedAt: string;
  firstSubmittedAt?: string;
  leaderSnapshot?: { id: string; name: string; department: string };
  supplementDeadline: string;
  attachments: Attachment[];
  history: History[];
  award: string;
  awardReason: string;
}
export interface Review {
  id: string;
  entryId: string;
  expertId: string;
  status: '已提交' | '待评审' | '评分暂存';
  scores: Record<string, null | number>;
  comment: string;
  submittedAt: string;
  firstSubmittedAt?: string;
  history: History[];
}
export interface CompetitionData {
  version: 1;
  demoPacks?: string[];
  activities: Activity[];
  entries: Entry[];
  reviews: Review[];
}
export interface AwardInput {
  entryId: string;
  award: string;
  reason: string;
}
export interface ResultCorrection {
  reason: string;
  startedAt: string;
  startedBy: string;
  title: string;
  body: string;
  awards: AwardInput[];
}
export type PublishedWinner = Pick<
  Entry,
  | 'achievements'
  | 'activityId'
  | 'award'
  | 'awardReason'
  | 'category'
  | 'code'
  | 'firstSubmittedAt'
  | 'id'
  | 'leaderId'
  | 'leaderSnapshot'
  | 'name'
  | 'ownerId'
  | 'submittedAt'
  | 'summary'
>;
export interface Publication {
  version: number;
  title: string;
  body: string;
  publishedAt: string;
  noticeDate: string;
  publishedBy: string;
  reason: string;
  legacy?: boolean;
  activityName: string;
  department: string;
  contact: string;
  phone: string;
  winners: PublishedWinner[];
}

export const people: Person[] = [
  {
    id: 'manager',
    name: '陈嘉宁',
    department: '科技管理部',
    role: 'admin',
    managedDepartments: ['科技管理部'],
  },
  { id: 'employee-a', name: '林知远', department: '运行部', role: 'employee' },
  { id: 'employee-b', name: '周亦安', department: '检修部', role: 'employee' },
  { id: 'expert-a', name: '沈明', department: '技术中心', role: 'expert' },
  { id: 'expert-b', name: '顾言', department: '技术中心', role: 'expert' },
  { id: 'employee-c', name: '许文清', department: '运行部', role: 'employee' },
  {
    id: 'manager-operation',
    name: '赵启航',
    department: '运行部',
    role: 'admin',
    managedDepartments: ['运行部'],
  },
];
export const departments = ['运行部', '检修部', '技术中心', '科技管理部'];
export const defaultActivityTypes = ['创新竞赛', '五小成果评比', '技能比武'];
export const fieldLimits = {
  activityName: 80,
  entryName: 200,
  category: 100,
  summary: 1000,
};
export function activityTypeOptions(data: CompetitionData) {
  return [
    ...new Set([
      ...defaultActivityTypes,
      ...data.activities.map((a) => a.type.trim()),
    ]),
  ]
    .filter(Boolean)
    .map((value) => ({ value }));
}
export const categories = [
  '生产制造',
  '科技研发',
  '管理创新',
  '五小成果',
  '青年创新创效项目',
];
export const activityStates: ActivityStatus[] = [
  '草稿',
  '报名中',
  '评审中',
  '待公示',
  '已公示',
  '已结束',
  '已取消',
];
export const entryStates: EntryStatus[] = [
  '草稿',
  '待审核',
  '退回修改',
  '审核通过',
  '已撤回',
  '已终止',
];
export const roleNames = {
  admin: '活动管理员',
  employee: '参赛员工',
  expert: '评审专家',
};
export const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const uid = () => crypto.randomUUID();
export const person = (id: string) => people.find((item) => item.id === id)!;
export const projectLeader = (
  entry: Partial<Pick<Entry, 'status'>> &
    Pick<Entry, 'leaderId' | 'leaderSnapshot'>,
) =>
  entry.status && ['已撤回', '草稿', '退回修改'].includes(entry.status)
    ? person(entry.leaderId)
    : (entry.leaderSnapshot ?? person(entry.leaderId));
export const currentPublication = (activity: Activity) =>
  activity.publications?.at(-1);
export const hasSubmitted = (entry: Entry) =>
  entry.status !== '草稿' ||
  !!entry.submittedAt ||
  !!entry.firstSubmittedAt ||
  entry.history.some((h) =>
    ['提交申报', '撤回申报', '材料审核通过', '退回补充'].includes(h.action),
  );
export const entrySubmissionTime = (entry: Entry) =>
  entry.submittedAt || (hasSubmitted(entry) ? '历史未记录' : '');
export const hasReviewSubmitted = (review: Review) =>
  review.status === '已提交' ||
  !!review.submittedAt ||
  !!review.firstSubmittedAt ||
  review.history.some((h) => ['提交评审', '退回评审'].includes(h.action));
export const reviewSubmissionTime = (review: Review) =>
  review.submittedAt ||
  (hasReviewSubmitted(review) ? '历史未记录' : '尚未提交');
export const canDeleteEntry = (
  entry: Entry,
  actor: Person,
  activity: Activity,
) =>
  activity.id === entry.activityId &&
  activity.status !== '已取消' &&
  entry.ownerId === actor.id &&
  entry.status === '草稿' &&
  !hasSubmitted(entry);
export const countedEntry = (entry: Entry) =>
  ['审核通过', '待审核', '退回修改'].includes(entry.status);
// Identity conflicts are activity-scoped; inactive drafts/withdrawals/terminations
// do not reserve participation identity when administrators select experts.
export function entryExpertConflicts(entry: Entry, expertIds: string[]) {
  return [...new Set(expertIds)]
    .filter((id) => id === entry.ownerId || id === entry.leaderId)
    .map((id) => ({
      expertId: id,
      expertName: person(id)?.name ?? id,
      entryId: entry.id,
      entryName: entry.name || '未命名项目',
      relation:
        id === entry.ownerId && id === entry.leaderId
          ? '填报人及项目负责人'
          : id === entry.ownerId
            ? '填报人'
            : '项目负责人',
    }));
}
export function activityExpertConflicts(
  data: CompetitionData,
  activityId: string,
  expertIds: string[],
) {
  return data.entries
    .filter((entry) => entry.activityId === activityId && countedEntry(entry))
    .flatMap((entry) => entryExpertConflicts(entry, expertIds));
}
export function expertConflictMessage(
  conflicts: ReturnType<typeof entryExpertConflicts>,
) {
  return conflicts.length > 0
    ? `专家与参赛身份冲突：${conflicts.map((c) => `${c.expertName}—${c.entryName}（${c.relation}）`).join('；')}。请在活动信息中调整评审专家名单，或选择符合条件的项目负责人。`
    : '';
}
export function expertOptions(
  data: CompetitionData,
  activityId: string,
  selectedIds: string[],
) {
  return people.map((p) => {
    const conflicts = activityExpertConflicts(data, activityId, [p.id]);
    return {
      value: p.id,
      label: `${p.name} · ${p.department}${conflicts.length > 0 ? '（已有参赛项目，不能担任本活动专家）' : ''}`,
      // Existing conflicting selections must remain removable, not become locked tags.
      disabled: conflicts.length > 0 && !selectedIds.includes(p.id),
    };
  });
}
export function leaderOptionsForActivity(
  department: string | undefined,
  activity?: Activity,
) {
  return people
    .filter((p) => p.department === department)
    .map((p) => ({
      value: p.id,
      label: `${p.name} · ${p.department}${activity?.expertIds.includes(p.id) ? '（本活动评审专家，不可选）' : ''}`,
      disabled: activity?.expertIds.includes(p.id) ?? false,
    }));
}
export const isActivityExpert = (activity: Activity, actor: Person) =>
  activity.expertIds.includes(actor.id);
export const canStartEntry = (activity: Activity, actor: Person) =>
  canApply(activity, actor) && !isActivityExpert(activity, actor);
export const attachmentIsPublic = (attachment: Attachment) => attachment.public;
export const managementDepartments = (actor: Person) =>
  actor.role === 'admin'
    ? (actor.managedDepartments ?? [actor.department])
    : [];
export const canManageActivity = (activity: Activity, actor: Person) =>
  managementDepartments(actor).includes(activity.department);
export const canProcessEntry = (activity: Activity, actor: Person) =>
  !!activity.publisherId &&
  activity.publisherId === actor.id &&
  canManageActivity(activity, actor);
export function activityPublisherLabel(activity?: Activity) {
  if (!activity) return '历史发布人未记录';
  if (activity.publisherId) {
    const name =
      activity.publisherName ||
      people.find((p) => p.id === activity.publisherId)?.name;
    return name ? `活动发布人 · ${name}` : '历史发布人未记录';
  }
  return activity.status === '草稿' ? '发布活动后确定' : '历史发布人未记录';
}
function normalizeActivityPublisher(activity: Activity) {
  if (activity.publisherId)
    return {
      publisherId: activity.publisherId,
      publisherName:
        activity.publisherName ||
        people.find((p) => p.id === activity.publisherId)?.name ||
        '',
    };
  if (activity.status === '草稿') return { publisherId: '', publisherName: '' };
  const publication = activity.history.find((h) => h.action === '活动报名中');
  const matches = publication
    ? people.filter((p) => p.name === publication.actor)
    : [];
  return matches.length === 1
    ? { publisherId: matches[0]!.id, publisherName: publication!.actor }
    : { publisherId: '', publisherName: '' };
}
export function canSeeActivity(
  data: CompetitionData,
  activity: Activity,
  actor: Person,
) {
  if (canManageActivity(activity, actor)) return true;
  if (activity.status === '草稿') return false;
  if (activity.status !== '已取消') return true;
  return data.entries.some(
    (entry) =>
      entry.activityId === activity.id &&
      (entry.ownerId === actor.id ||
        data.reviews.some(
          (review) =>
            review.entryId === entry.id && review.expertId === actor.id,
        )),
  );
}
export const reviewOverdue = (
  activity: Activity,
  day = nowText().slice(0, 10),
) =>
  activity.status === '评审中' &&
  !!activity.reviewEnd &&
  day > activity.reviewEnd;
function actualTime(activity: Activity, action: string) {
  return activity.history.find((h) => h.action === action)?.at ?? '';
}
// 旧资料和评分原样保留；仅评审中的活动补齐统一专家名单对应的任务。
export function normalizeCompetitionData(
  data: CompetitionData,
): CompetitionData {
  const normalized: CompetitionData = {
    ...data,
    activities: data.activities.map((activity) => ({
      ...activity,
      ...normalizeActivityPublisher(activity),
      registeredAt: activity.registeredAt || actualTime(activity, '活动报名中'),
      reviewStartedAt:
        activity.reviewStartedAt || actualTime(activity, '活动评审中'),
      reviewCompletedAt:
        activity.reviewCompletedAt || actualTime(activity, '活动待公示'),
      endedAt: activity.endedAt || actualTime(activity, '活动已结束'),
      expertIds: activity.expertIds?.length
        ? activity.expertIds
        : [
            ...new Set(
              data.reviews
                .filter((review) =>
                  data.entries.some(
                    (entry) =>
                      entry.id === review.entryId &&
                      entry.activityId === activity.id,
                  ),
                )
                .map((review) => review.expertId),
            ),
          ],
    })),
    entries: data.entries.map((entry) => ({
      ...entry,
      leaderId: entry.leaderId ?? entry.ownerId,
      achievements: entry.achievements ?? '',
      submittedAt:
        entry.submittedAt ||
        entry.history.filter((h) => h.action === '提交申报').at(-1)?.at ||
        '',
      firstSubmittedAt:
        entry.firstSubmittedAt ??
        entry.history.find((h) => h.action === '提交申报')?.at ??
        '',
      // 旧拟公开选择直接生效，不再等待确认；移除意向字段，避免覆盖后续取消公开。
      attachments: entry.attachments.map(({ publicRequested, ...a }) => ({
        ...a,
        public: publicRequested ?? a.public,
      })),
    })),
    reviews: data.reviews.map((review) => ({
      ...review,
      firstSubmittedAt:
        review.firstSubmittedAt ??
        review.history.find((h) => h.action === '提交评审')?.at ??
        '',
      submittedAt:
        review.submittedAt ||
        review.history.filter((h) => h.action === '提交评审').at(-1)?.at ||
        '',
    })),
  };
  for (const activity of normalized.activities) {
    if (
      ['已公示', '已结束'].includes(activity.status) &&
      !activity.publications?.length
    ) {
      activity.publications = [
        makePublication(normalized, activity, '历史记录', '', true),
      ];
    }
    if (activity.status === '评审中')
      ensureActivityReviews(normalized, activity);
  }
  return normalized;
}
function ensureActivityReviews(data: CompetitionData, activity: Activity) {
  for (const entry of data.entries.filter(
    (item) => item.activityId === activity.id && item.status === '审核通过',
  )) {
    for (const expertId of activity.expertIds) {
      if (
        data.reviews.some(
          (review) =>
            review.entryId === entry.id && review.expertId === expertId,
        )
      )
        continue;
      data.reviews.push({
        id: `review:${activity.id}:${entry.id}:${expertId}`,
        entryId: entry.id,
        expertId,
        scores: {},
        comment: '',
        submittedAt: '',
        firstSubmittedAt: '',
        status: '待评审',
        history: [],
      });
    }
  }
}
function validateExperts(expertIds: string[]) {
  requireCondition(expertIds.length > 0, '请至少选择一位评审专家。');
  requireCondition(
    expertIds.every((id) => people.some((p) => p.id === id)),
    '请选择有效的评审专家。',
  );
}
export function saveActivityExperts(
  data: CompetitionData,
  actor: Person,
  id: string,
  expertIds: string[],
) {
  requireCondition(actor.role === 'admin', '仅活动管理员可以配置评审专家。');
  const activity = activityOf(data, id);
  requireCondition(
    canManageActivity(activity, actor),
    '无权管理该组织的活动。',
  );
  requireCondition(
    ['报名中', '草稿'].includes(activity.status),
    '开启评审后专家名单已锁定。',
  );
  validateExperts(expertIds);
  const conflictMessage = expertConflictMessage(
    activityExpertConflicts(data, id, expertIds),
  );
  requireCondition(!conflictMessage, conflictMessage);
  activity.expertIds = [...new Set(expertIds)];
  addHistory(
    activity,
    actor,
    '保存评审专家',
    activity.expertIds.map((id) => person(id).name).join('、'),
  );
}
export const nowText = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
};
export function requireCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getFullYear() === Number(value.slice(0, 4)) &&
    parsed.getMonth() + 1 === Number(value.slice(5, 7)) &&
    parsed.getDate() === Number(value.slice(8, 10))
  );
}
export function adjustDeadline(
  data: CompetitionData,
  actor: Person,
  id: string,
  deadline: string,
  reason: string,
) {
  const activity = activityOf(data, id);
  requireCondition(
    canManageActivity(activity, actor),
    '无权管理该组织的活动。',
  );
  requireCondition(
    ['报名中', '评审中'].includes(activity.status),
    '当前阶段不能调整计划截止。',
  );
  requireCondition(reason.trim(), '请填写期限调整原因。');
  requireCondition(validDate(deadline), '请设置有效的计划截止日期。');
  const registration = activity.status === '报名中';
  const start = registration ? activity.registeredAt : activity.reviewStartedAt;
  requireCondition(
    !start || deadline >= start.slice(0, 10),
    '计划截止不能早于该阶段实际开始日期。',
  );
  requireCondition(
    !registration || deadline <= activity.reviewEnd,
    '报名截止不能晚于计划评审截止。',
  );
  const field = registration ? 'deadline' : 'reviewEnd';
  const previous = activity[field];
  activity[field] = deadline;
  addHistory(
    activity,
    actor,
    registration ? '调整报名截止' : '调整计划评审截止',
    `${previous} → ${deadline}；原因：${reason.trim()}`,
  );
}
export function resolveSupplement(
  data: CompetitionData,
  actor: Person,
  id: string,
  action: 'extend' | 'terminate',
  reason: string,
  deadline = '',
) {
  const entry = entryOf(data, id);
  const activity = activityOf(data, entry.activityId);
  requireCondition(
    canProcessEntry(activity, actor) &&
      activity.status === '报名中' &&
      entry.status === '退回修改',
    '当前申报不可延期或终止。',
  );
  requireCondition(reason.trim(), '请填写处理原因。');
  if (action === 'extend') {
    requireCondition(
      validDate(deadline) &&
        deadline >= nowText().slice(0, 10) &&
        deadline > entry.supplementDeadline,
      '新补交截止须晚于原期限且不得早于今天。',
    );
    const previous = entry.supplementDeadline;
    entry.supplementDeadline = deadline;
    addHistory(
      entry,
      actor,
      '延长补交期限',
      `${previous} → ${deadline}；原因：${reason.trim()}`,
    );
  } else {
    requireCondition(action === 'terminate', '无效的处理方式。');
    entry.status = '已终止';
    addHistory(entry, actor, '终止申报', reason.trim());
  }
}
export function addHistory(
  target: { history: History[] },
  actor: Person,
  action: string,
  note = '',
) {
  target.history.push({
    id: uid(),
    actor: actor.name,
    action,
    note,
    at: nowText(),
  });
}
export function newActivity(actor?: Person): Activity {
  const day = new Date();
  const date = (offset: number) => {
    const d = new Date(day);
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  return {
    id: uid(),
    code: `HD${Date.now()}`,
    name: '',
    type: '五小成果评比',
    department: actor ? (managementDepartments(actor)[0] ?? '') : '科技管理部',
    contact: actor?.name ?? '陈嘉宁',
    phone: '',
    description: '',
    requirements: '请提交完整申报书、现场图片及效益证明材料。',
    departments: [...departments],
    participation: '个人或团队',
    start: '',
    deadline: date(14),
    reviewStart: '',
    reviewEnd: date(28),
    registeredAt: '',
    publisherId: '',
    publisherName: '',
    reviewStartedAt: '',
    reviewCompletedAt: '',
    endedAt: '',
    status: '草稿',
    showcase: true,
    expertIds: [],
    criteria: [
      { id: 'innovation', name: '创新性', max: 30 },
      { id: 'practice', name: '实用性', max: 30 },
      { id: 'safety', name: '安全性', max: 20 },
      { id: 'benefit', name: '经济效益', max: 20 },
    ],
    prizes: ['一等奖', '二等奖', '三等奖', '优秀奖'],
    attachments: [],
    history: [],
    noticeTitle: '',
    noticeBody: '',
    noticeDate: '',
    publishedAt: '',
  };
}
export function newEntry(activityId: string, ownerId: string): Entry {
  return {
    id: uid(),
    code: `ZP${Date.now()}`,
    activityId,
    ownerId,
    leaderId: ownerId,
    achievements: '',
    name: '',
    category: '',
    mode: '个人',
    teamName: '',
    members: [],
    phone: '',
    summary: '',
    background: '',
    solution: '',
    innovation: '',
    benefit: '',
    status: '草稿',
    submittedAt: '',
    supplementDeadline: '',
    attachments: [],
    history: [],
    award: '',
    awardReason: '',
  };
}
export function canApply(
  activity: Activity,
  actor: Person,
  day = nowText().slice(0, 10),
) {
  return (
    activity.status === '报名中' &&
    (!activity.registeredAt || day >= activity.registeredAt.slice(0, 10)) &&
    day <= activity.deadline &&
    activity.departments.includes(actor.department)
  );
}
export function canEditEntry(
  activity: Activity,
  entry: Entry,
  actor: Person,
  day = nowText().slice(0, 10),
) {
  return (
    actor.id === entry.ownerId &&
    activity.status === '报名中' &&
    ['已撤回', '草稿', '退回修改'].includes(entry.status) &&
    (entry.status === '退回修改'
      ? !!entry.supplementDeadline && day <= entry.supplementDeadline
      : canApply(activity, actor, day))
  );
}
export function canSeeEntry(
  data: CompetitionData,
  entry: Entry,
  actor: Person,
) {
  const activity = data.activities.find((item) => item.id === entry.activityId);
  return (
    !!activity &&
    (canManageActivity(activity, actor) ||
      (entry.status === '审核通过' &&
        canReadPublicationApproval(activity, actor)) ||
      actor.id === entry.ownerId ||
      data.reviews.some(
        (r) => r.entryId === entry.id && r.expertId === actor.id,
      ) ||
      (entry.status === '审核通过' &&
        activity.showcase &&
        !['已取消', '草稿'].includes(activity.status)) ||
      (['已公示', '已结束'].includes(activity.status) &&
        !!currentPublication(activity)?.winners.some(
          (winner) => winner.id === entry.id,
        )))
  );
}
export function isInternalReader(
  data: CompetitionData,
  entry: Entry,
  actor: Person,
) {
  return (
    data.activities.some(
      (activity) =>
        activity.id === entry.activityId &&
        (canManageActivity(activity, actor) ||
          (entry.status === '审核通过' &&
            canReadPublicationApproval(activity, actor))),
    ) ||
    entry.ownerId === actor.id ||
    data.reviews.some(
      (review) => review.entryId === entry.id && review.expertId === actor.id,
    )
  );
}
export function activityOf(data: CompetitionData, id: string) {
  const value = data.activities.find((item) => item.id === id);
  requireCondition(value, '活动不存在，请返回活动中心。');
  return value;
}
export function entryOf(data: CompetitionData, id: string) {
  const value = data.entries.find((item) => item.id === id);
  requireCondition(value, '作品不存在，请返回列表。');
  return value;
}
export function validateActivity(activity: Activity) {
  validateActivityFields(activity);
  validateExperts(activity.expertIds);
  requireCondition(activity.type.trim(), '请选择或填写活动类型。');
  requireCondition(
    activity.name.trim() &&
      activity.department &&
      activity.contact.trim() &&
      activity.phone.trim(),
    '请填写活动名称、组织单位、联系人和联系方式。',
  );
  requireCondition(
    activity.description.trim() && activity.requirements.trim(),
    '请填写活动说明和申报要求。',
  );
  requireCondition(activity.departments.length > 0, '请选择至少一个参赛部门。');
  requireCondition(
    validDate(activity.deadline) &&
      validDate(activity.reviewEnd) &&
      activity.deadline >= nowText().slice(0, 10) &&
      activity.deadline <= activity.reviewEnd,
    '请设置有效计划期限：报名截止不得早于今天，计划评审截止不得早于报名截止。',
  );
  requireCondition(
    activity.criteria.length > 0 &&
      activity.criteria.every(
        (c) =>
          c.name.trim() &&
          Number.isInteger(c.max) &&
          c.max >= 1 &&
          c.max <= 100,
      ),
    '评分指标名称及分值上限必须有效。',
  );
  requireCondition(
    new Set(activity.criteria.map((c) => c.name.trim())).size ===
      activity.criteria.length,
    '评分指标名称不能重复。',
  );
  requireCondition(
    activity.prizes.length > 0 &&
      activity.prizes.every((p) => p.trim()) &&
      new Set(activity.prizes).size === activity.prizes.length,
    '请设置不重复的奖项。',
  );
}
function validateActivityFields(activity: Activity) {
  requireCondition(
    activity.name.length <= fieldLimits.activityName,
    '活动名称不能超过 80 字。',
  );
  requireCondition(
    activity.criteria.every(
      (c) => Number.isInteger(c.max) && c.max >= 1 && c.max <= 100,
    ),
    '指标满分必须是 1～100 的正整数。',
  );
  requireCondition(
    activity.criteria.every((c) => c.id) &&
      new Set(activity.criteria.map((c) => c.id)).size ===
        activity.criteria.length,
    '评分指标标识缺失或重复，请重新添加对应指标。',
  );
}
export function saveActivity(
  data: CompetitionData,
  actor: Person,
  form: Activity,
) {
  requireCondition(actor.role === 'admin', '仅活动管理员可以维护活动。');
  const existing = data.activities.find((a) => a.id === form.id);
  requireCondition(
    canManageActivity(existing ?? form, actor) &&
      canManageActivity(form, actor),
    '无权管理该组织的活动。',
  );
  if (existing?.status === '报名中') {
    saveActivityExperts(data, actor, existing.id, form.expertIds);
    return;
  }
  requireCondition(form.name.trim(), '请填写活动名称。');
  validateActivityFields(form);
  validateExperts(form.expertIds);
  const conflictMessage = expertConflictMessage(
    activityExpertConflicts(data, form.id, form.expertIds),
  );
  requireCondition(!conflictMessage, conflictMessage);
  requireCondition(
    !existing || existing.status === '草稿',
    '已发布活动的申报要求和评分规则已锁定。',
  );
  const item = copy(form);
  item.type = item.type.trim();
  item.expertIds = [...new Set(item.expertIds)];
  item.status = '草稿';
  item.start = '';
  item.reviewStart = '';
  item.registeredAt = '';
  item.publisherId = '';
  item.publisherName = '';
  item.reviewStartedAt = '';
  item.reviewCompletedAt = '';
  item.endedAt = '';
  item.publishedAt = '';
  item.noticeDate = '';
  item.history = existing ? copy(existing.history) : [];
  addHistory(item, actor, existing ? '保存活动' : '创建活动');
  if (existing) Object.assign(existing, item);
  else data.activities.unshift(item);
}
export function changeActivity(
  data: CompetitionData,
  actor: Person,
  id: string,
  status: ActivityStatus,
  reason = '',
) {
  requireCondition(actor.role === 'admin', '仅活动管理员可以操作。');
  const activity = activityOf(data, id);
  requireCondition(
    canManageActivity(activity, actor),
    '无权管理该组织的活动。',
  );
  requireCondition(
    status !== '已公示',
    '请提交公示审批，全部审批人同意后自动公示。',
  );
  requireCondition(
    !activePublicationApproval(activity),
    '审批中，请先撤回审批。',
  );
  const allowed: Partial<Record<ActivityStatus, ActivityStatus[]>> = {
    草稿: ['报名中', '已取消'],
    报名中: ['评审中', '已取消'],
    评审中: ['待公示', '已取消'],
    待公示: ['已公示'],
    已公示: ['已结束'],
  };
  requireCondition(
    allowed[activity.status]?.includes(status),
    '当前活动状态不支持此操作。',
  );
  if (status === '已取消') requireCondition(reason.trim(), '请填写取消原因。');
  if (status === '报名中') validateActivity(activity);
  if (status === '评审中') {
    requireCondition(
      !data.entries.some(
        (e) => e.activityId === id && ['待审核', '退回修改'].includes(e.status),
      ),
      '请先处理待审核及退回补充的作品。',
    );
    requireCondition(
      data.entries.some((e) => e.activityId === id && e.status === '审核通过'),
      '至少需要一件审核通过的作品。',
    );
    validateExperts(activity.expertIds);
    const conflictMessage = expertConflictMessage(
      activityExpertConflicts(data, id, activity.expertIds),
    );
    requireCondition(
      !conflictMessage,
      `专家须回避本人项目。${conflictMessage}`,
    );
    ensureActivityReviews(data, activity);
  }
  if (status === '待公示') {
    const entries = data.entries.filter(
      (e) => e.activityId === id && e.status === '审核通过',
    );
    requireCondition(
      entries.length > 0 &&
        activity.expertIds.length > 0 &&
        entries.every(
          (e) =>
            activity.expertIds.every((expertId) =>
              data.reviews.some(
                (r) =>
                  r.entryId === e.id &&
                  r.expertId === expertId &&
                  r.status === '已提交',
              ),
            ) &&
            data.reviews
              .filter((r) => r.entryId === e.id)
              .every((r) => r.status === '已提交'),
        ),
      '请等待全部参评项目的所有评审专家提交评审。',
    );
  }
  if (status === '报名中') {
    activity.registeredAt = nowText();
    activity.publisherId = actor.id;
    activity.publisherName = actor.name;
  }
  if (status === '评审中') activity.reviewStartedAt = nowText();
  if (status === '待公示') activity.reviewCompletedAt = nowText();
  if (status === '已结束') activity.endedAt = nowText();
  activity.status = status;
  addHistory(activity, actor, `活动${status}`, reason.trim());
}
export function saveEntry(
  data: CompetitionData,
  actor: Person,
  form: Entry,
  submit = false,
) {
  const activity = activityOf(data, form.activityId);
  const existing = data.entries.find((e) => e.id === form.id);
  requireCondition(
    existing ||
      (form.ownerId === actor.id &&
        form.status === '草稿' &&
        canApply(activity, actor)),
    '请从活动中心符合报名资格的活动发起申报。',
  );
  requireCondition(
    canEditEntry(activity, existing ?? form, actor),
    '当前作品不可编辑，或报名／补交期限已过。',
  );
  requireCondition(
    !existing ||
      (existing.activityId === form.activityId &&
        existing.ownerId === form.ownerId),
    '不允许修改作品所属活动或申报人。',
  );
  requireCondition(form.name.trim(), '请填写项目名称。');
  requireCondition(
    form.name.length <= fieldLimits.entryName,
    '项目名称不能超过 200 字。',
  );
  requireCondition(
    form.category.length <= fieldLimits.category,
    '项目类别不能超过 100 字。',
  );
  requireCondition(
    form.summary.length <= fieldLimits.summary,
    '项目简介不能超过 1000 字。',
  );
  requireCondition(
    !form.leaderId ||
      people.some(
        (p) => p.id === form.leaderId && p.department === actor.department,
      ),
    '项目负责人只能选择当前登录人所在部门的人员。',
  );
  if (submit) {
    const conflictMessage = expertConflictMessage(
      entryExpertConflicts(form, activity.expertIds),
    );
    requireCondition(!conflictMessage, conflictMessage);
    requireCondition(form.summary.trim(), '请补全项目简介后提交。');
    requireCondition(
      people.some(
        (p) => p.id === form.leaderId && p.department === actor.department,
      ),
      '请选择有效的项目负责人，部门将自动带出。',
    );
  }
  const item = copy(form);
  item.award = existing?.award ?? '';
  item.awardReason = existing?.awardReason ?? '';
  item.history = existing ? copy(existing.history) : [];
  item.ownerId = existing?.ownerId ?? actor.id;
  item.supplementDeadline = existing?.supplementDeadline ?? '';
  item.submittedAt = existing?.submittedAt ?? '';
  item.firstSubmittedAt = existing?.firstSubmittedAt ?? '';
  item.leaderSnapshot = existing?.leaderSnapshot;
  item.attachments = form.attachments.map((a) => {
    const attachment = copy(a);
    delete attachment.publicRequested;
    return attachment;
  });
  item.status = submit ? '待审核' : (existing?.status ?? '草稿');
  if (submit) {
    item.submittedAt = nowText();
    if (!existing || !hasSubmitted(existing)) {
      item.firstSubmittedAt = item.submittedAt;
    }
    const leader = person(item.leaderId);
    item.leaderSnapshot = {
      id: leader.id,
      name: leader.name,
      department: leader.department,
    };
  }
  addHistory(item, actor, submit ? '提交申报' : '保存申报');
  if (existing) Object.assign(existing, item);
  else data.entries.unshift(item);
}
export function withdrawEntry(
  data: CompetitionData,
  actor: Person,
  id: string,
) {
  const entry = entryOf(data, id);
  const activity = activityOf(data, entry.activityId);
  requireCondition(
    actor.id === entry.ownerId &&
      canApply(activity, actor) &&
      ['审核通过', '待审核', '退回修改'].includes(entry.status),
    '仅报名期内可撤回本人已提交的作品。',
  );
  entry.status = '已撤回';
  data.reviews = data.reviews.filter((r) => r.entryId !== id);
  addHistory(entry, actor, '撤回申报');
}
export function auditEntry(
  data: CompetitionData,
  actor: Person,
  id: string,
  pass: boolean,
  note: string,
  deadline = '',
) {
  const entry = entryOf(data, id);
  requireCondition(
    canProcessEntry(activityOf(data, entry.activityId), actor) &&
      activityOf(data, entry.activityId).status === '报名中' &&
      (entry.status === '待审核' || (!pass && entry.status === '审核通过')),
    '当前作品不可审核。',
  );
  if (pass) {
    const conflictMessage = expertConflictMessage(
      entryExpertConflicts(entry, activityOf(data, entry.activityId).expertIds),
    );
    requireCondition(!conflictMessage, conflictMessage);
  }
  requireCondition(note.trim(), '请填写审核意见。');
  if (!pass)
    requireCondition(
      validDate(deadline) && deadline >= nowText().slice(0, 10),
      '请设置有效的补交截止日期。',
    );
  entry.status = pass ? '审核通过' : '退回修改';
  entry.supplementDeadline = pass ? '' : deadline;
  addHistory(
    entry,
    actor,
    pass ? '材料审核通过' : '退回补充',
    pass ? note : `${note}；补交截止：${deadline}`,
  );
}
export function saveReview(
  data: CompetitionData,
  actor: Person,
  id: string,
  scores: Review['scores'],
  comment: string,
  submit: boolean,
) {
  const review = data.reviews.find((r) => r.id === id);
  requireCondition(
    review && review.expertId === actor.id && review.status !== '已提交',
    '当前任务不可评分。',
  );
  const activity = activityOf(data, entryOf(data, review.entryId).activityId);
  requireCondition(activity.status === '评审中', '活动当前不在评审阶段。');
  for (const criterion of activity.criteria) {
    const value = scores[criterion.id];
    requireCondition(
      value == null
        ? !submit
        : Number.isFinite(value) && value >= 0 && value <= criterion.max,
      `${criterion.name}评分须在 0～${criterion.max} 之间。`,
    );
    requireCondition(
      value == null || Math.abs(value * 10 - Math.round(value * 10)) < 1e-8,
      `${criterion.name}评分最多保留一位小数。`,
    );
  }
  if (submit) requireCondition(comment.trim(), '请填写评审意见。');
  const previouslySubmitted = hasReviewSubmitted(review);
  review.scores = Object.fromEntries(
    activity.criteria.map((c) => [c.id, scores[c.id] ?? null]),
  );
  review.comment = comment;
  review.status = submit ? '已提交' : '评分暂存';
  if (submit) {
    if (previouslySubmitted) {
      review.firstSubmittedAt ??= '';
    } else {
      review.firstSubmittedAt = nowText();
    }
    review.submittedAt = nowText();
  }
  addHistory(review, actor, submit ? '提交评审' : '暂存评分');
}
export function returnReview(
  data: CompetitionData,
  actor: Person,
  id: string,
  reason: string,
) {
  const review = data.reviews.find((r) => r.id === id);
  requireCondition(
    review &&
      canManageActivity(
        activityOf(data, entryOf(data, review.entryId).activityId),
        actor,
      ) &&
      review.status === '已提交' &&
      activityOf(data, entryOf(data, review.entryId).activityId).status ===
        '评审中',
    '只能退回评审中的已提交任务。',
  );
  requireCondition(reason.trim(), '请填写退回原因。');
  review.status = '评分暂存';
  addHistory(review, actor, '退回评审', reason);
}
export function saveResults(
  data: CompetitionData,
  actor: Person,
  id: string,
  awards: { entryId: string; award: string; reason: string }[],
  title: string,
  body: string,
  date: string,
  approverIds?: string[],
  expectedRevision?: string,
) {
  const activity = activityOf(data, id);
  requireCondition(
    !activePublicationApproval(activity),
    '审批中，请先撤回审批。',
  );
  requireCondition(
    expectedRevision === undefined ||
      expectedRevision === publicationApprovalRevision(activity),
    '公示内容或审批轮次已变化，请刷新后重试。',
  );
  if (approverIds) validatePublicApprovers(approverIds);
  requireCondition(
    canManageActivity(activity, actor) &&
      (activity.status === '待公示' || !!activity.resultCorrection),
    '仅待公示阶段可登记结果。',
  );
  validateAwards(data, activity, awards);
  if (approverIds) activity.publicApproverIds = [...approverIds];
  if (activity.resultCorrection) {
    Object.assign(activity.resultCorrection, {
      awards: copy(awards),
      title,
      body,
    });
  } else {
    for (const item of awards) {
      const entry = entryOf(data, item.entryId);
      entry.award = item.award;
      entry.awardReason = item.reason;
    }
    activity.noticeTitle = title;
    activity.noticeBody = body;
  }
  // 日期由发布操作生成；保留旧调用签名，不接受人工日期。
  void date;
  addHistory(
    activity,
    actor,
    '登记获奖结果',
    '依据线下确认结果手工登记，未计算专家总分或排名。',
  );
}
function validateAwards(
  data: CompetitionData,
  activity: Activity,
  awards: { entryId: string; award: string; reason: string }[],
) {
  requireCondition(
    new Set(awards.map((a) => a.entryId)).size === awards.length,
    '同一项目只能登记一次奖项。',
  );
  for (const item of awards) {
    const entry = entryOf(data, item.entryId);
    requireCondition(
      entry.activityId === activity.id && entry.status === '审核通过',
      '获奖作品必须是本活动审核通过的作品。',
    );
    requireCondition(
      !item.award || activity.prizes.includes(item.award),
      '请选择本活动设置的奖项。',
    );
    requireCondition(!item.award || item.reason.trim(), '请填写获奖确认依据。');
  }
}
export function deleteDraft(
  data: CompetitionData,
  actor: Person,
  kind: 'activity' | 'entry',
  id: string,
) {
  if (kind === 'activity') {
    const item = activityOf(data, id);
    requireCondition(
      canManageActivity(item, actor) &&
        item.status === '草稿' &&
        !data.entries.some((e) => e.activityId === id),
      '只能删除没有任何申报记录的草稿活动。',
    );
    data.activities = data.activities.filter((a) => a.id !== id);
  } else {
    const item = entryOf(data, id);
    requireCondition(
      canDeleteEntry(item, actor, activityOf(data, item.activityId)),
      '只能删除未取消活动中本人从未提交的草稿，已提交、撤回或活动已取消的记录须保留。',
    );
    data.entries = data.entries.filter((e) => e.id !== id);
    data.reviews = data.reviews.filter((r) => r.entryId !== id);
  }
}

// 历史公示只能冻结现存资料，不伪造过去的人事信息；新版发布使用提交快照。
function makePublication(
  data: CompetitionData,
  activity: Activity,
  publisher: string,
  reason = '',
  legacy = false,
): Publication {
  return {
    version: (activity.publications?.length ?? 0) + 1,
    title: activity.noticeTitle,
    body: activity.noticeBody,
    publishedAt: activity.publishedAt,
    noticeDate: activity.noticeDate,
    publishedBy: publisher,
    reason,
    legacy,
    activityName: activity.name,
    department: activity.department,
    contact: activity.contact,
    phone: activity.phone,
    winners: data.entries
      .filter((e) => e.activityId === activity.id && e.award)
      .map((e) => {
        const leader =
          e.leaderSnapshot ??
          currentPublication(activity)?.winners.find(
            (winner) => winner.id === e.id,
          )?.leaderSnapshot ??
          person(e.leaderId);
        return copy({
          id: e.id,
          code: e.code,
          activityId: e.activityId,
          ownerId: e.ownerId,
          leaderId: e.leaderId,
          leaderSnapshot: leader
            ? {
                id: leader.id,
                name: leader.name,
                department: leader.department,
              }
            : undefined,
          name: e.name,
          category: e.category,
          summary: e.summary,
          achievements: e.achievements,
          submittedAt: e.submittedAt,
          firstSubmittedAt: e.firstSubmittedAt,
          award: e.award,
          awardReason: e.awardReason,
        });
      }),
  };
}
export function publishedEntry(data: CompetitionData, entry: Entry): Entry {
  const activity = activityOf(data, entry.activityId);
  const snapshot = currentPublication(activity)?.winners.find(
    (winner) => winner.id === entry.id,
  );
  return snapshot ? { ...entry, ...copy(snapshot) } : entry;
}
export function canDownloadCertificate(
  activity: Activity,
  winner: PublishedWinner,
  actor: Person,
) {
  return (
    ['已公示', '已结束'].includes(activity.status) &&
    !!currentPublication(activity)?.winners.some((e) => e.id === winner.id) &&
    (canManageActivity(activity, actor) ||
      winner.ownerId === actor.id ||
      winner.leaderId === actor.id)
  );
}
export function beginResultCorrection(
  data: CompetitionData,
  actor: Person,
  id: string,
  reason: string,
) {
  const activity = activityOf(data, id);
  requireCondition(
    canManageActivity(activity, actor) &&
      ['已公示', '已结束'].includes(activity.status),
    '仅授权管理员可更正已发布的结果。',
  );
  requireCondition(
    !activity.resultCorrection,
    '已有进行中的结果更正，请继续编辑。',
  );
  requireCondition(reason.trim(), '请填写结果更正原因。');
  const publication = currentPublication(activity);
  requireCondition(publication, '缺少已发布版本，请重新加载历史数据后再更正。');
  activity.resultCorrection = {
    reason: reason.trim(),
    startedAt: nowText(),
    startedBy: actor.name,
    title: publication.title,
    body: publication.body,
    awards: data.entries
      .filter((e) => e.activityId === id && e.status === '审核通过')
      .map((e) => ({ entryId: e.id, award: e.award, reason: e.awardReason })),
  };
  addHistory(activity, actor, '发起结果更正', reason.trim());
}
export function discardResultCorrection(
  data: CompetitionData,
  actor: Person,
  id: string,
) {
  const activity = activityOf(data, id);
  requireCondition(
    canManageActivity(activity, actor) && activity.resultCorrection,
    '没有可放弃的结果更正。',
  );
  requireCondition(
    !activePublicationApproval(activity),
    '审批中，请先撤回审批。',
  );
  addHistory(activity, actor, '放弃结果更正', activity.resultCorrection.reason);
  delete activity.resultCorrection;
}
// 保留旧调用的明确拒绝，避免旧页面绕过会签发布。
export function publishResultCorrection(
  _data: CompetitionData,
  _actor: Person,
  _id: string,
): never {
  throw new Error('请提交公示审批，全部审批人同意后自动公示。');
}

export function activePublicationApproval(activity: Activity) {
  return activity.publicationApprovals?.find(
    (round) => round.status === '审批中',
  );
}
export function pendingPublicationApproval(activity: Activity, actor: Person) {
  return (
    activePublicationApproval(activity)?.decisions.some(
      (decision) =>
        decision.personId === actor.id && decision.status === '待审批',
    ) ?? false
  );
}
// 只有本轮已经提交的审批人获得材料只读权限；配置但未提交不授予权限。
export function canReadPublicationApproval(activity: Activity, actor: Person) {
  return (
    activity.publicationApprovals
      ?.at(-1)
      ?.decisions.some((decision) => decision.personId === actor.id) ?? false
  );
}
function validatePublicApprovers(ids: string[]) {
  requireCondition(new Set(ids).size === ids.length, '公示审批人不能重复。');
  requireCondition(
    ids.every((id) => people.some((p) => p.id === id)),
    '公示审批人无效，请重新选择。',
  );
}
export function publicationApprovalRevision(activity: Activity) {
  return JSON.stringify([
    activity.publicApproverIds ?? [],
    activity.noticeTitle,
    activity.noticeBody,
    activity.resultCorrection,
    activity.publicationApprovals ?? [],
    activity.publications?.length ?? 0,
    activity.status,
    activity.history,
  ]);
}
export function submitPublicationApproval(
  data: CompetitionData,
  actor: Person,
  id: string,
  expectedRevision?: string,
) {
  const activity = activityOf(data, id);
  requireCondition(
    canManageActivity(activity, actor),
    '仅授权管理员可提交公示审批。',
  );
  requireCondition(
    activity.status === '待公示' ||
      (!!activity.resultCorrection &&
        ['已公示', '已结束'].includes(activity.status)),
    '当前阶段不能提交公示审批。',
  );
  requireCondition(!activePublicationApproval(activity), '本轮审批尚未结束。');
  requireCondition(
    expectedRevision === undefined ||
      expectedRevision === publicationApprovalRevision(activity),
    '公示内容或审批轮次已变化，请刷新后重试。',
  );
  const ids = activity.publicApproverIds ?? [];
  validatePublicApprovers(ids);
  requireCondition(ids.length > 0, '请至少选择一位公示审批人并保存。');
  const correction = activity.resultCorrection;
  const title = correction?.title ?? activity.noticeTitle;
  const body = correction?.body ?? activity.noticeBody;
  requireCondition(title.trim() && body.trim(), '请填写并保存公示标题和正文。');
  const awards =
    correction?.awards ??
    data.entries
      .filter(
        (e) => e.activityId === id && (e.status === '审核通过' || e.award),
      )
      .map((e) => ({
        entryId: e.id,
        award: e.award,
        reason: e.awardReason ?? '',
      }));
  validateAwards(data, activity, awards);
  // 在隔离副本中生成完整公示快照；本轮审批不会更改对外有效版本。
  const prepared = copy(data);
  const draftActivity = activityOf(prepared, id);
  for (const item of awards) {
    const entry = entryOf(prepared, item.entryId);
    entry.award = item.award;
    entry.awardReason = item.reason;
  }
  draftActivity.noticeTitle = title;
  draftActivity.noticeBody = body;
  const publication = makePublication(
    prepared,
    draftActivity,
    actor.name,
    correction?.reason ?? '',
  );
  publication.publishedAt = '';
  publication.noticeDate = '';
  const round: PublicationApproval = {
    id: `approval-${uid()}`,
    status: '审批中',
    kind: correction ? '结果更正' : '初次公示',
    submittedBy: actor.id,
    submittedName: actor.name,
    submittedAt: nowText(),
    endedAt: '',
    decisions: ids.map((id) => {
      const p = person(id);
      return {
        personId: id,
        name: p.name,
        department: p.department,
        status: '待审批',
        opinion: '',
        at: '',
      };
    }),
    snapshot: {
      title,
      body,
      awards: copy(awards),
      publication,
      entryIds: data.entries
        .filter((e) => e.activityId === id && e.status === '审核通过')
        .map((e) => e.id),
      baseVersion: activity.publications?.length ?? 0,
    },
  };
  activity.publicationApprovals = [
    ...(activity.publicationApprovals ?? []),
    round,
  ];
  addHistory(activity, actor, '提交公示审批', round.id);
  return round.id;
}
export function withdrawPublicationApproval(
  data: CompetitionData,
  actor: Person,
  id: string,
  roundId: string,
) {
  const activity = activityOf(data, id);
  requireCondition(
    canManageActivity(activity, actor),
    '仅授权管理员可撤回审批。',
  );
  const round = activePublicationApproval(activity);
  requireCondition(
    round && round.id === roundId,
    '审批轮次已变化或结束，请刷新。',
  );
  round.status = '已撤回';
  round.endedAt = nowText();
  round.withdrawnBy = actor.name;
  addHistory(activity, actor, '撤回公示审批', round.id);
}
export function decidePublicationApproval(
  data: CompetitionData,
  actor: Person,
  id: string,
  roundId: string,
  decision: '同意' | '驳回',
  opinion: string,
) {
  const activity = activityOf(data, id);
  const round = activePublicationApproval(activity);
  requireCondition(
    round && round.id === roundId,
    '审批轮次已变化或结束，请刷新。',
  );
  const vote = round.decisions.find((item) => item.personId === actor.id);
  requireCondition(
    vote && vote.status === '待审批',
    '您不是当前待处理审批人，或已完成审批。',
  );
  requireCondition(
    decision === '同意' || decision === '驳回',
    '无效的审批操作。',
  );
  requireCondition(decision !== '驳回' || opinion.trim(), '请填写驳回原因。');
  requireCondition(
    round.snapshot.baseVersion === (activity.publications?.length ?? 0),
    '公示版本已变化，请刷新。',
  );
  requireCondition(
    round.kind === '初次公示'
      ? activity.status === '待公示'
      : !!activity.resultCorrection &&
          ['已公示', '已结束'].includes(activity.status),
    '活动阶段已变化。',
  );
  const completed =
    decision === '同意' &&
    round.decisions.every(
      (item) => item.personId === actor.id || item.status === '同意',
    );
  // 先完成所有校验；最后一票、公示和历史一起交由 store 原子保存。
  if (completed) validateAwards(data, activity, round.snapshot.awards);
  const at = nowText();
  Object.assign(vote, { status: decision, opinion: opinion.trim(), at });
  if (decision === '驳回') {
    round.status = '已驳回';
    round.endedAt = at;
  } else if (completed) {
    for (const item of round.snapshot.awards) {
      Object.assign(entryOf(data, item.entryId), {
        award: item.award,
        awardReason: item.reason,
      });
    }
    const publication = copy(round.snapshot.publication);
    publication.publishedAt = at;
    publication.noticeDate = at.slice(0, 10);
    activity.noticeTitle = publication.title;
    activity.noticeBody = publication.body;
    activity.publishedAt = at;
    activity.noticeDate = publication.noticeDate;
    activity.publications = [...(activity.publications ?? []), publication];
    if (round.kind === '初次公示') activity.status = '已公示';
    delete activity.resultCorrection;
    round.status = '已通过';
    round.endedAt = at;
    addHistory(
      activity,
      actor,
      '会签通过自动公示',
      `第 ${publication.version} 版`,
    );
  }
  addHistory(activity, actor, `公示审批${decision}`, opinion.trim());
}
