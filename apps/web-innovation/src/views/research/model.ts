export interface Person {
  id: string;
  name: string;
  department: string;
  admin?: boolean;
}
export const people: Person[] = [
  { id: 'manager', name: '陈嘉宁', department: '科技管理部', admin: true },
  { id: 'manager2', name: '赵启航', department: '运行部', admin: true },
  { id: 'lin', name: '林知远', department: '运行部' },
  { id: 'zhou', name: '周亦安', department: '检修部' },
  { id: 'shen', name: '沈明', department: '技术中心' },
  { id: 'xu', name: '许文清', department: '运行部' },
];
export const states = [
  '草稿',
  '待立项',
  '立项退回',
  '攻关中',
  '待结题',
  '已结题',
  '已终止',
] as const;
export type Status = (typeof states)[number];
export const categories = [
  '节能降耗',
  '设备治理',
  '可靠性提升',
  '安全生产',
  '管理改进',
  '其他',
];
export interface Attachment {
  id: string;
  name: string;
  size: number;
  content: string;
  uploader: string;
  time: string;
}
export interface Member {
  personId: string;
  duty: string;
}
export interface Task {
  id: string;
  name: string;
  personId: string;
  start: string;
  end: string;
  description: string;
  status: '已完成' | '未开始' | '进行中';
  startedAt: string;
  completedAt: string;
}
export interface Progress {
  id: string;
  ownerId: string;
  title: string;
  kind: string;
  taskId: string;
  date: string;
  content: string;
  risk: string;
  next: string;
  correctionId: string;
  submittedAt: string;
  files: Attachment[];
}
export interface Result {
  id: string;
  name: string;
  kind: string;
  code: string;
  description: string;
}
export interface Closure {
  goal: string;
  summary: string;
  outcome: string;
  issues: string;
  results: Result[];
  files: Attachment[];
}
export interface History {
  id: string;
  action: string;
  personId: string;
  time: string;
  note: string;
}
export interface Topic {
  id: string;
  code: string;
  revision: number;
  name: string;
  category: string;
  ownerId: string;
  leaderId: string;
  status: Status;
  start: string;
  end: string;
  background: string;
  goal: string;
  solution: string;
  expected: string;
  firstSubmittedAt: string;
  submittedAt: string;
  approvedAt: string;
  closureSubmittedAt: string;
  closedAt: string;
  updatedAt: string;
  members: Member[];
  tasks: Task[];
  progress: Progress[];
  files: Attachment[];
  closure: Closure;
  submittedClosure?: Closure;
  history: History[];
}
export const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toLocaleString('sv-SE');
export const today = () => now().slice(0, 10);
export const person = (id: string) => people.find((p) => p.id === id);
export const nameOf = (id: string) => person(id)?.name ?? '未知人员';
export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
export function ensure(
  value: unknown,
  message: string,
  field?: string,
): asserts value {
  if (!value)
    throw field ? new ValidationError(message, field) : new Error(message);
}
export const participant = (t: Topic, a: Person) =>
  t.leaderId === a.id || t.members.some((m) => m.personId === a.id);
export const hasSubmitted = (t: Topic) =>
  !!(t.firstSubmittedAt || t.submittedAt) ||
  t.history.some((h) => h.action === '提交立项');
export const canView = (t: Topic, a: Person) =>
  t.status === '草稿'
    ? t.ownerId === a.id || (t.leaderId === a.id && hasSubmitted(t))
    : !!(a.admin || t.ownerId === a.id || participant(t, a));
export const canEdit = (t: Topic, a: Person) =>
  canView(t, a) &&
  ['立项退回', '草稿'].includes(t.status) &&
  (t.ownerId === a.id || t.leaderId === a.id);
export const canPlan = (t: Topic, a: Person) =>
  canView(t, a) && t.status === '攻关中' && t.leaderId === a.id;
export const canReview = (t: Topic, a: Person) =>
  !!a.admin && t.leaderId !== a.id && ['待立项', '待结题'].includes(t.status);
export const visibleProgress = (t: Topic, a: Person) =>
  canView(t, a)
    ? t.progress.filter((p) => p.submittedAt || p.ownerId === a.id)
    : [];
export const canSeeClosure = (t: Topic, a: Person) =>
  canView(t, a) && (t.leaderId === a.id || !!submittedClosure(t));
// Legacy pending/closed records are immutable, so their material is a reliable
// submitted version. Returned/withdrawn drafts cannot reconstruct old content.
export function submittedClosure(t: Topic): Closure | undefined {
  return (
    t.submittedClosure ??
    (t.closureSubmittedAt && ['已结题', '待结题'].includes(t.status)
      ? t.closure
      : undefined)
  );
}
export function topicForViewer(t: Topic, a: Person): Topic {
  const result = copy(t);
  if (t.leaderId !== a.id)
    result.closure = copy(submittedClosure(t) ?? freshTopic(a).closure);
  return result;
}
export const visibleHistory = (t: Topic) =>
  t.history.map((h) =>
    ['保存进展', '删除进展草稿'].includes(h.action) ? { ...h, note: '' } : h,
  );
export const overdue = (end: string, finished: boolean) =>
  !!end && end < today() && !finished;
export function freshTopic(a: Person): Topic {
  return {
    id: uid(),
    code: '',
    revision: 0,
    name: '',
    category: '',
    ownerId: a.id,
    leaderId: a.id,
    status: '草稿',
    start: '',
    end: '',
    background: '',
    goal: '',
    solution: '',
    expected: '',
    firstSubmittedAt: '',
    submittedAt: '',
    approvedAt: '',
    closureSubmittedAt: '',
    closedAt: '',
    updatedAt: '',
    members: [{ personId: a.id, duty: '课题负责人' }],
    tasks: [],
    progress: [],
    files: [],
    closure: {
      goal: '',
      summary: '',
      outcome: '',
      issues: '',
      results: [],
      files: [],
    },
    history: [],
  };
}
export function freshTask(): Task {
  return {
    id: uid(),
    name: '',
    personId: '',
    start: '',
    end: '',
    description: '',
    status: '未开始',
    startedAt: '',
    completedAt: '',
  };
}
export function freshProgress(a: Person): Progress {
  return {
    id: uid(),
    ownerId: a.id,
    title: '',
    kind: '实施进展',
    taskId: '',
    date: today(),
    content: '',
    risk: '',
    next: '',
    correctionId: '',
    submittedAt: '',
    files: [],
  };
}
function event(t: Topic, a: Person, action: string, note = '') {
  t.revision++;
  t.updatedAt = now();
  t.history.push({
    id: uid(),
    action,
    personId: a.id,
    time: t.updatedAt,
    note,
  });
}
function check(t: Topic, a: Person, rev: number) {
  ensure(canView(t, a), '无权访问该课题');
  ensure(t.revision === rev, '课题已发生变化，请刷新后重试；本次未保存');
}
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
function dates(start: string, end: string, prefix = '') {
  ensure(validDate(start), '请填写有效的计划开始日期', `${prefix}start`);
  ensure(validDate(end), '请填写有效的计划完成日期', `${prefix}end`);
  ensure(start <= end, '计划完成日期不能早于开始日期', `${prefix}end`);
}
export function validateFiles(files: Attachment[], field = 'files') {
  ensure(files.length <= 6, '原型每组附件最多6个', field);
  for (const f of files) {
    ensure(
      /\.(docx?|pdf|png|jpe?g)$/i.test(f.name),
      '附件支持 Word、PDF、PNG、JPG',
      field,
    );
    ensure(f.size <= 1024 * 1024, '原型每个附件不超过1 MB', field);
    ensure(f.content.startsWith('data:'), '附件内容无效', field);
  }
}
function validateTeam(t: Topic) {
  ensure(
    new Set(t.members.map((m) => m.personId)).size === t.members.length,
    '团队成员不能重复',
    'members',
  );
  ensure(
    t.members.some((m) => m.personId === t.leaderId),
    '负责人必须在团队中',
    'members',
  );
  t.members.forEach((m, index) =>
    ensure(
      person(m.personId),
      `第${index + 1}行：请选择有效团队成员`,
      `members.${index}.personId`,
    ),
  );
}
function validateTasks(t: Topic) {
  for (const [index, task] of t.tasks.entries()) {
    const field = `tasks.${index}.`;
    ensure(
      task.name.trim(),
      `第${index + 1}行：请填写任务名称`,
      `${field}name`,
    );
    ensure(
      t.members.some((m) => m.personId === task.personId),
      `第${index + 1}行：任务责任人必须来自团队`,
      `${field}personId`,
    );
    try {
      dates(task.start, task.end, field);
    } catch (error) {
      if (error instanceof ValidationError)
        error.message = `第${index + 1}行：${error.message}`;
      throw error;
    }
    ensure(
      task.start >= t.start && task.end <= t.end,
      `第${index + 1}行：任务计划必须在课题总计划范围内`,
      `${field}${task.start < t.start ? 'start' : 'end'}`,
    );
  }
  ensure(
    new Set(t.tasks.map((v) => v.id)).size === t.tasks.length,
    '任务标识不能重复',
    'tasks',
  );
}
export function saveTopic(
  all: Topic[],
  a: Person,
  form: Topic,
  submit = false,
) {
  const old = all.find((t) => t.id === form.id);
  if (old) {
    check(old, a, form.revision);
    ensure(canEdit(old, a), '当前状态或身份不允许修改申报');
  } else
    ensure(form.ownerId === a.id && form.revision === 0, '新建课题归属无效');
  const t = old ? copy(old) : freshTopic(a);
  t.id = form.id;
  for (const key of [
    'name',
    'category',
    'leaderId',
    'start',
    'end',
    'background',
    'goal',
    'solution',
    'expected',
  ] as const)
    t[key] = (form[key] ?? '').trim();
  ensure(t.name, '请填写课题名称', 'name');
  ensure(person(t.leaderId), '请选择负责人', 'leaderId');
  ensure(
    a.admin || t.leaderId === old?.leaderId || t.leaderId === a.id,
    '普通员工不能代其他负责人申报',
  );
  t.members = copy(form.members);
  t.files = copy(form.files);
  t.tasks = copy(form.tasks);
  validateFiles(t.files);
  validateTeam(t);
  if (t.start) ensure(validDate(t.start), '请填写有效的计划开始日期', 'start');
  if (t.end) ensure(validDate(t.end), '请填写有效的计划完成日期', 'end');
  if (t.start && t.end) dates(t.start, t.end);
  if (t.tasks.length > 0) {
    dates(t.start, t.end);
    validateTasks(t);
  }
  if (submit) {
    for (const [key, label] of [
      ['category', '课题类别'],
      ['background', '问题背景'],
      ['goal', '攻关目标'],
      ['solution', '实施方案'],
    ] as const)
      ensure(t[key], `请填写${label}`, key);
    dates(t.start, t.end);
    t.status = '待立项';
    t.submittedAt = now();
    t.firstSubmittedAt ||= t.submittedAt;
  }
  t.code ||= `KT${today().replaceAll('-', '')}-${t.id.slice(0, 8)}`;
  event(t, a, submit ? '提交立项' : '保存申报');
  if (old) Object.assign(old, t);
  else all.push(t);
  return t.id;
}
export function processTopic(
  t: Topic,
  a: Person,
  rev: number,
  action: 'approve' | 'return' | 'terminate' | 'withdraw',
  reason = '',
) {
  check(t, a, rev);
  const published = submittedClosure(t);
  // Capture legacy submitted material before moving back into an editable state.
  const retainPublished = () => {
    if (published && !t.submittedClosure) t.submittedClosure = copy(published);
  };
  if (action === 'terminate') {
    ensure(
      a.admin && ['待立项', '待结题', '攻关中', '立项退回'].includes(t.status),
      '当前不能终止',
    );
    ensure(reason.trim(), '请填写终止原因', 'action.reason');
    retainPublished();
    t.status = '已终止';
    event(t, a, '终止课题', reason.trim());
    return;
  }
  if (action === 'withdraw') {
    if (t.status === '待立项') {
      const last = t.history.filter((h) => h.action === '提交立项').at(-1);
      ensure(last?.personId === a.id, '仅本次提交人可以撤回');
      t.status = '草稿';
    } else {
      ensure(t.status === '待结题' && t.leaderId === a.id, '当前不能撤回');
      retainPublished();
      t.status = '攻关中';
    }
    event(t, a, '撤回申请');
    return;
  }
  ensure(canReview(t, a), '仅业务管理员可处理，且须回避本人负责的课题');
  const stage = t.status === '待立项' ? '立项' : '结题';
  if (action === 'return') {
    ensure(reason.trim(), '请填写退回原因', 'action.reason');
    retainPublished();
    t.status = stage === '立项' ? '立项退回' : '攻关中';
  } else {
    t.status = stage === '立项' ? '攻关中' : '已结题';
    if (stage === '立项') t.approvedAt = now();
    else t.closedAt = now();
  }
  event(
    t,
    a,
    `${stage}${action === 'return' ? '退回' : '通过'}`,
    reason.trim(),
  );
}
export function removeTopic(all: Topic[], a: Person, id: string, rev: number) {
  const t = all.find((v) => v.id === id);
  ensure(t, '课题不存在');
  check(t, a, rev);
  ensure(
    t.status === '草稿' && t.ownerId === a.id && !hasSubmitted(t),
    '仅可删除本人从未提交的草稿',
  );
  all.splice(all.indexOf(t), 1);
}
export function savePlan(t: Topic, a: Person, form: Topic, reason = '') {
  check(t, a, form.revision);
  ensure(canPlan(t, a), '仅攻关中的负责人可维护计划');
  const next = copy(t);
  next.members = copy(form.members);
  next.tasks = copy(form.tasks);
  validateTeam(next);
  validateTasks(next);
  let changed = false;
  for (const member of t.members)
    if (!next.members.some((m) => m.personId === member.personId)) {
      ensure(
        !t.tasks.some(
          (v) =>
            v.personId === member.personId &&
            (v.status === '已完成' ||
              next.tasks.some(
                (n) => n.id === v.id && n.personId === member.personId,
              )),
        ) && !t.progress.some((p) => p.ownerId === member.personId),
        '成员存在任务或历史记录，请先转交任务并保留历史成员',
        'members',
      );
    }
  for (const old of t.tasks) {
    const n = next.tasks.find((v) => v.id === old.id);
    if (n) {
      ensure(
        n.status === old.status &&
          n.startedAt === old.startedAt &&
          n.completedAt === old.completedAt,
        '不能通过保存计划改变任务状态',
      );
      if (old.status === '已完成')
        ensure(
          JSON.stringify(n) === JSON.stringify(old),
          '已完成任务不可修改',
          'tasks',
        );
      else if (
        old.personId !== n.personId ||
        old.start !== n.start ||
        old.end !== n.end
      )
        changed = true;
    } else {
      ensure(
        old.status === '未开始' && !t.progress.some((p) => p.taskId === old.id),
        '已执行或有进展记录的任务不能删除',
        'tasks',
      );
    }
  }
  for (const n of next.tasks)
    if (!t.tasks.some((v) => v.id === n.id))
      ensure(
        n.status === '未开始' && !n.startedAt && !n.completedAt,
        '新任务须为未开始',
      );
  if (changed)
    ensure(
      reason.trim(),
      '调整责任人或计划日期须填写变更原因',
      'action.reason',
    );
  const note = changed
    ? `${reason.trim()}；原计划：${t.tasks.map((v) => `${v.name} / ${nameOf(v.personId)} / ${v.start}～${v.end}`).join('；')}`
    : reason.trim();
  t.members = next.members;
  t.tasks = next.tasks;
  event(t, a, '保存团队与任务计划', note);
}
export function adjustDates(
  t: Topic,
  a: Person,
  rev: number,
  start: string,
  end: string,
  reason: string,
) {
  check(t, a, rev);
  ensure(a.admin && t.status === '攻关中', '仅业务管理员可调整攻关中的总计划');
  ensure(reason.trim(), '请填写调整原因', 'action.reason');
  dates(start, end, 'action.');
  const n = copy(t);
  n.start = start;
  n.end = end;
  // A total-plan conflict belongs to the administrator's date dialog.
  for (const task of n.tasks) {
    ensure(
      task.start >= start,
      `任务“${task.name}”计划开始为 ${task.start}，总计划开始不能晚于该日期`,
      'action.start',
    );
    ensure(
      task.end <= end,
      `任务“${task.name}”计划完成为 ${task.end}，总计划完成不能早于该日期`,
      'action.end',
    );
  }
  validateTasks(n);
  const note = `${reason.trim()}；原计划：${t.start}～${t.end}；新计划：${start}～${end}`;
  t.start = start;
  t.end = end;
  event(t, a, '调整总体计划', note);
}
export function taskAction(t: Topic, a: Person, rev: number, id: string) {
  check(t, a, rev);
  ensure(t.status === '攻关中' && participant(t, a), '当前不能执行任务');
  const task = t.tasks.find((v) => v.id === id);
  ensure(task && task.personId === a.id, '仅任务责任人可操作');
  ensure(task.status !== '已完成', '任务已完成');
  if (task.status === '未开始') {
    task.status = '进行中';
    task.startedAt = now();
  } else {
    task.status = '已完成';
    task.completedAt = now();
  }
  event(t, a, task.status === '进行中' ? '开始任务' : '完成任务', task.name);
}
export function saveProgress(
  t: Topic,
  a: Person,
  rev: number,
  form: Progress,
  submit = false,
  existing = false,
) {
  check(t, a, rev);
  ensure(
    t.status === '攻关中' && participant(t, a),
    '仅攻关中的负责人或成员可反馈',
  );
  const old = t.progress.find((v) => v.id === form.id);
  ensure(!existing || old, '该进展记录已删除，请返回进展列表');
  ensure(
    !old || (old.ownerId === a.id && !old.submittedAt),
    '仅可修改本人进展草稿',
  );
  ensure(form.ownerId === a.id, '不能代他人反馈');
  const p = copy(form);
  p.title = p.title.trim();
  p.submittedAt = '';
  ensure(p.title, '请填写记录标题', 'title');
  p.date ||= '';
  if (p.taskId)
    ensure(
      t.tasks.some(
        (v) =>
          v.id === p.taskId && (t.leaderId === a.id || v.personId === a.id),
      ),
      '只能关联本课题中有权限的任务',
      'taskId',
    );
  if (p.correctionId)
    ensure(
      t.progress.some(
        (v) => v.id === p.correctionId && v.ownerId === a.id && v.submittedAt,
      ),
      '只能追加更正本人已提交的记录',
    );
  validateFiles(p.files);
  if (p.date) {
    ensure(validDate(p.date), '请填写有效的反馈日期', 'date');
    ensure(p.date <= today(), '反馈日期不能晚于今天', 'date');
  }
  if (submit) {
    ensure(p.date, '请填写反馈日期', 'date');
    ensure(
      ['实施进展', '研讨纪要', '问题风险'].includes(p.kind),
      '请选择记录类型',
      'kind',
    );
    ensure(p.content.trim(), '请填写本次内容', 'content');
    p.submittedAt = now();
  }
  if (old) Object.assign(old, p);
  else t.progress.push(p);
  event(t, a, submit ? '提交进展' : '保存进展', submit ? p.title : '');
}
export function deleteProgress(t: Topic, a: Person, rev: number, id: string) {
  check(t, a, rev);
  ensure(t.status === '攻关中' && participant(t, a), '当前不能删除进展');
  const p = t.progress.find((v) => v.id === id);
  ensure(p && p.ownerId === a.id && !p.submittedAt, '仅可删除本人进展草稿');
  t.progress.splice(t.progress.indexOf(p), 1);
  event(t, a, '删除进展草稿');
}
export function saveClosure(
  t: Topic,
  a: Person,
  rev: number,
  c: Closure,
  submit = false,
) {
  check(t, a, rev);
  ensure(canPlan(t, a), '仅攻关中的负责人可编辑结题资料');
  validateFiles(c.files, 'closure.files');
  c.results.forEach((r, index) => {
    ensure(
      r.name.trim(),
      `第${index + 1}行：请填写成果名称`,
      `closure.results.${index}.name`,
    );
    ensure(
      r.kind,
      `第${index + 1}行：请选择成果类型`,
      `closure.results.${index}.kind`,
    );
  });
  if (submit) {
    ensure(t.tasks.length, '至少一项任务且全部完成后才可申请结题', 'tasks');
    const unfinished = t.tasks.filter((v) => v.status !== '已完成');
    ensure(
      unfinished.length === 0,
      `任务全部完成后才可申请结题；未完成任务：${unfinished.map((v) => v.name).join('、')}`,
      'tasks',
    );
    for (const [key, label] of [
      ['goal', '目标完成情况'],
      ['summary', '结题总结'],
      ['outcome', '成果与应用说明'],
    ] as const)
      ensure(c[key].trim(), `请填写${label}`, `closure.${key}`);
  }
  t.closure = copy(c);
  if (submit) {
    t.status = '待结题';
    t.closureSubmittedAt = now();
    t.submittedClosure = copy(c);
  }
  event(t, a, submit ? '申请结题' : '保存结题资料');
}
