export interface Person {
  id: string;
  name: string;
  department: string;
  admin?: boolean;
}
export const people: Person[] = [
  { id: 'manager', name: '陈嘉宁', department: '科技管理部', admin: true },
  { id: 'lin', name: '林知远', department: '运行部' },
  { id: 'zhou', name: '周亦安', department: '检修部' },
  { id: 'shen', name: '沈明', department: '技术中心' },
  { id: 'xu', name: '许文清', department: '运行部' },
];
export const types = ['日常交流', '技术问答', '经验分享'];
export const categories = [
  '运行',
  '检修',
  '热控',
  '电气',
  '安全环保',
  '综合技术',
];
export const states = ['草稿', '已发布', '已下架'];
export const now = () => new Date().toLocaleString('sv-SE');
export const uid = () => crypto.randomUUID();
export const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const nameOf = (id: string) =>
  people.find((p) => p.id === id)?.name || '历史人员';
export interface Attachment {
  id: string;
  name: string;
  size: number;
  content: string;
  uploader: string;
  time: string;
}
export interface History {
  id: string;
  action: string;
  actorId: string;
  time: string;
  note: string;
  replyId?: string;
}
export interface Reply {
  id: string;
  authorId: string;
  department: string;
  body: string;
  attachments: Attachment[];
  referenceId: string;
  time: string;
  status: '已下架' | '有效';
}
export interface Topic {
  id: string;
  code: string;
  title: string;
  type: string;
  category: string;
  body: string;
  authorId: string;
  department: string;
  status: '已下架' | '已发布' | '草稿';
  firstPublishedAt: string;
  updatedAt: string;
  adoptedId: string;
  adoptedAt: string;
  attachments: Attachment[];
  replies: Reply[];
  history: History[];
  revision: number;
}
export class ValidationError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
  }
}
function requireValue(ok: unknown, message: string, field = ''): asserts ok {
  if (!ok) throw new ValidationError(field, message);
}
export function freshTopic(p: Person): Topic {
  const id = uid();
  return {
    id,
    code: `JL${Date.now()}${id.slice(0, 4)}`,
    title: '',
    type: '',
    category: '',
    body: '',
    authorId: p.id,
    department: p.department,
    status: '草稿',
    firstPublishedAt: '',
    updatedAt: '',
    adoptedId: '',
    adoptedAt: '',
    attachments: [],
    replies: [],
    history: [],
    revision: 0,
  };
}
export function freshReply(p: Person, referenceId = ''): Reply {
  return {
    id: uid(),
    authorId: p.id,
    department: p.department,
    body: '',
    attachments: [],
    referenceId,
    time: '',
    status: '有效',
  };
}
export const canView = (t: Topic, p: Person) =>
  t.status === '已发布' ||
  t.authorId === p.id ||
  (t.status === '已下架' && !!p.admin);
export const canEdit = (t: Topic, p: Person) =>
  t.status === '草稿' && t.authorId === p.id;
export const hasPublished = (t: Topic) =>
  !!t.firstPublishedAt || t.history.some((h) => h.action === '发布');
export const canViewReply = (t: Topic, r: Reply, p: Person) =>
  canView(t, p) && (r.status === '有效' || !!p.admin || r.authorId === p.id);
export const visibleReplies = (t: Topic, p: Person) =>
  t.replies.filter((r) => canViewReply(t, r, p));
export function visibleHistory(t: Topic, p: Person) {
  if (!canView(t, p)) return [];
  if (p.admin) return t.history;
  return t.history.filter((h) =>
    h.replyId
      ? t.replies.find((r) => r.id === h.replyId)?.authorId === p.id
      : t.authorId === p.id,
  );
}
export const questionState = (t: Topic) =>
  t.type === '技术问答' ? (t.adoptedId ? '已解决' : '待解决') : '—';
export function listTopics(
  all: Topic[],
  p: Person,
  view: 'center' | 'manage' | 'mine',
  relation = '',
) {
  return all.filter((t) => {
    if (!canView(t, p)) return false;
    if (view === 'center') return t.status === '已发布';
    if (view === 'manage') return !!p.admin && t.status !== '草稿';
    const joined = t.replies.some((r) => r.authorId === p.id);
    const own = t.authorId === p.id;
    return relation === 'own'
      ? own
      : relation === 'joined'
        ? joined
        : own || joined;
  });
}
export function checkFiles(files: Attachment[]) {
  requireValue(files.length <= 6, '原型每组最多6个附件', 'attachments');
  requireValue(
    new Set(files.map((f) => f.id)).size === files.length,
    '附件标识重复',
    'attachments',
  );
  for (const f of files)
    requireValue(
      /\.(docx?|pdf|png|jpe?g)$/i.test(f.name) &&
        f.size <= 1024 * 1024 &&
        f.size >= 0 &&
        f.content.startsWith('data:'),
      '附件格式或大小不符合原型限制',
      'attachments',
    );
}
function log(t: Topic, p: Person, action: string, note = '', replyId?: string) {
  const time = now();
  t.updatedAt = time;
  t.revision++;
  t.history.push({ id: uid(), action, actorId: p.id, time, note, replyId });
}
function current(all: Topic[], id: string, revision: number) {
  const t = all.find((v) => v.id === id);
  requireValue(t, '主题已删除，请关闭明细');
  requireValue(t.revision === revision, '记录已发生变化，请刷新后重试');
  return t;
}
export function saveTopic(
  all: Topic[],
  p: Person,
  form: Topic,
  publish = false,
) {
  const existing = all.find((v) => v.id === form.id);
  if (existing) current(all, form.id, form.revision);
  else requireValue(form.revision === 0, '主题已删除，不能重新保存');
  requireValue(
    canEdit(existing ?? form, p) && form.authorId === p.id,
    '仅作者可编辑本人草稿',
  );
  requireValue(form.title.trim(), '请填写标题', 'title');
  requireValue(
    !form.type || types.includes(form.type),
    '请选择有效交流类型',
    'type',
  );
  requireValue(
    !form.category || categories.includes(form.category),
    '请选择有效专业分类',
    'category',
  );
  if (publish) {
    requireValue(types.includes(form.type), '请选择交流类型', 'type');
    requireValue(
      categories.includes(form.category),
      '请选择专业分类',
      'category',
    );
    requireValue(form.body.trim(), '请填写正文', 'body');
  }
  checkFiles(form.attachments);
  const target = existing ?? freshTopic(p);
  if (!existing) {
    target.id = form.id;
    target.code = form.code;
  }
  Object.assign(target, {
    title: form.title.trim(),
    type: form.type,
    category: form.category,
    body: form.body.trim(),
    attachments: copy(form.attachments),
  });
  if (publish) {
    target.status = '已发布';
    target.firstPublishedAt ||= now();
  }
  log(target, p, publish ? '发布' : '保存草稿');
  if (!existing) all.push(target);
}
export function topicAction(
  all: Topic[],
  p: Person,
  id: string,
  revision: number,
  action: '下架' | '删除' | '恢复' | '撤回',
  reason = '',
) {
  const t = current(all, id, revision);
  if (action === '删除') {
    requireValue(
      canEdit(t, p) && !hasPublished(t),
      '仅能删除本人从未发布的草稿',
    );
    all.splice(all.indexOf(t), 1);
    return;
  }
  if (action === '撤回') {
    requireValue(
      t.authorId === p.id && t.status === '已发布',
      '仅作者可撤回已发布主题',
    );
    requireValue(t.replies.length === 0, '已有回复（含下架记录），不能撤回');
    t.status = '草稿';
  } else {
    requireValue(p.admin, '仅交流管理员可处理');
    requireValue(
      t.status === (action === '下架' ? '已发布' : '已下架'),
      '当前状态不允许此操作',
    );
    if (action === '下架')
      requireValue(reason.trim(), '请填写下架原因', 'reason');
    t.status = action === '下架' ? '已下架' : '已发布';
  }
  log(t, p, action, reason.trim());
}
export function addReply(
  all: Topic[],
  p: Person,
  id: string,
  revision: number,
  form: Reply,
) {
  const t = current(all, id, revision);
  requireValue(t.status === '已发布', '主题未发布或已下架，不能回复');
  requireValue(
    form.authorId === p.id && !t.replies.some((r) => r.id === form.id),
    '回复不可代填或重复提交',
  );
  requireValue(form.body.trim(), '请填写回复正文', 'body');
  if (form.referenceId)
    requireValue(
      t.replies.some((r) => r.id === form.referenceId && r.status === '有效'),
      '引用回复已不可用，请关闭后重新回复',
      'referenceId',
    );
  checkFiles(form.attachments);
  const reply = {
    ...copy(form),
    department: p.department,
    body: form.body.trim(),
    time: now(),
    status: '有效' as const,
  };
  t.replies.push(reply);
  log(t, p, '回复', '', reply.id);
}
export function replyAction(
  all: Topic[],
  p: Person,
  id: string,
  revision: number,
  replyId: string,
  action: '下架回复' | '取消采纳' | '恢复回复' | '采纳',
  reason = '',
) {
  const t = current(all, id, revision);
  requireValue(t.status === '已发布', '主题未发布或已下架，不能处理回复');
  const r = t.replies.find((v) => v.id === replyId);
  requireValue(r, '回复不存在');
  if (action === '采纳' || action === '取消采纳') {
    requireValue(
      t.type === '技术问答' && t.authorId === p.id,
      '仅提问人可处理采纳',
    );
    requireValue(r.status === '有效', '回复不可用');
    if (action === '采纳') {
      requireValue(r.authorId !== p.id, '不能采纳本人回复');
      requireValue(!t.adoptedId, '请先取消当前采纳');
      t.adoptedId = r.id;
      t.adoptedAt = now();
    } else {
      requireValue(t.adoptedId === r.id, '该回复并非当前采纳');
      t.adoptedId = '';
      t.adoptedAt = '';
    }
  } else {
    requireValue(p.admin, '仅交流管理员可处理回复');
    requireValue(
      r.status === (action === '下架回复' ? '有效' : '已下架'),
      '回复状态已变化',
    );
    if (action === '下架回复')
      requireValue(reason.trim(), '请填写下架原因', 'reason');
    r.status = action === '下架回复' ? '已下架' : '有效';
    if (r.status === '已下架' && t.adoptedId === r.id) {
      t.adoptedId = '';
      t.adoptedAt = '';
      log(t, p, '取消采纳', '已采纳回复下架，自动恢复待解决', r.id);
    }
  }
  log(t, p, action, reason.trim(), r.id);
}
