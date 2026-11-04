import type { FileOrigin, SourceLink, SourceModule } from './source-types';
import type { SourceData } from './sources';

import {
  activeSources,
  prepareReferences,
  referenceStatus,
} from './references';
import { readSources } from './sources';
export interface Person {
  id: string;
  name: string;
  department: string;
  admin?: boolean;
}
export const people: Person[] = [
  { id: 'manager', name: '陈嘉宁', department: '科技管理部', admin: true },
  { id: 'curator', name: '顾言', department: '技术中心', admin: true },
  { id: 'lin', name: '林知远', department: '运行部' },
  { id: 'zhou', name: '周亦安', department: '检修部' },
  { id: 'shen', name: '沈明', department: '技术中心' },
];
export const types = ['成果', '案例', '文档'];
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
export const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
export const nameOf = (id: string) =>
  id ? people.find((p) => p.id === id)?.name || '历史人员' : '尚未记录';
export interface Attachment {
  origin?: FileOrigin;
  id: string;
  name: string;
  size: number;
  content: string;
  uploader: string;
  time: string;
}
export interface History {
  source?: {
    key: string;
    module: SourceModule;
    title: string;
    code?: string;
    version: string;
    checkedToken: string;
  };
  id: string;
  action: string;
  actorId: string;
  time: string;
  note: string;
}
export interface Knowledge {
  sources?: SourceLink[];
  registration?: string;
  id: string;
  code: string;
  title: string;
  type: string;
  category: string;
  keywords: string;
  summary: string;
  body: string;
  scenario: string;
  originalAuthor: string;
  originalDepartment: string;
  resultName: string;
  resultType: string;
  resultNumber: string;
  problem: string;
  method: string;
  effect: string;
  status: '已下架' | '已发布' | '草稿';
  curatorId: string;
  publisherId: string;
  firstPublishedAt: string;
  publishedAt: string;
  updatedAt: string;
  attachments: Attachment[];
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
export function freshKnowledge(p: Person): Knowledge {
  const id = uid();
  return {
    id,
    code: `ZS${Date.now()}${id.slice(0, 4)}`,
    title: '',
    type: '',
    category: '',
    keywords: '',
    summary: '',
    body: '',
    scenario: '',
    originalAuthor: '',
    originalDepartment: '',
    resultName: '',
    resultType: '',
    resultNumber: '',
    problem: '',
    method: '',
    effect: '',
    status: '草稿',
    curatorId: p.id,
    publisherId: '',
    firstPublishedAt: '',
    publishedAt: '',
    updatedAt: '',
    attachments: [],
    history: [],
    revision: 0,
  };
}
export const canView = (v: Knowledge, p: Person) =>
  !!p.admin || v.status === '已发布';
export const canEdit = (v: Knowledge, p: Person) =>
  !!p.admin && v.status !== '已发布';
export function checkFiles(files: Attachment[]) {
  requireValue(files.length <= 6, '原型每条知识最多6个附件', 'attachments');
  requireValue(
    new Set(files.map((f) => f.id)).size === files.length,
    '附件标识重复',
    'attachments',
  );
  for (const f of files)
    requireValue(
      /\.(docx?|pdf|png|jpe?g)$/i.test(f.name) &&
        f.size > 0 &&
        f.size <= 1024 * 1024 &&
        /^data:[^,]*,.+/.test(f.content),
      '附件须为非空Word、PDF或图片，单文件不超过1 MB',
      'attachments',
    );
}
function current(all: Knowledge[], id: string, revision: number) {
  const v = all.find((r) => r.id === id);
  requireValue(v, '记录已不存在，请关闭明细');
  requireValue(v.revision === revision, '记录已发生变化，请刷新后重试');
  return v;
}
function log(v: Knowledge, p: Person, action: string, note = '') {
  const time = now();
  v.updatedAt = time;
  v.revision++;
  v.history.push({ id: uid(), action, actorId: p.id, time, note });
}
const editableFields = [
  'title',
  'type',
  'category',
  'keywords',
  'summary',
  'body',
  'scenario',
  'originalAuthor',
  'originalDepartment',
  'resultName',
  'resultType',
  'resultNumber',
  'problem',
  'method',
  'effect',
] as const;
export function saveKnowledge(
  all: Knowledge[],
  p: Person,
  form: Knowledge,
  publish = false,
) {
  requireValue(p.admin, '仅知识管理员可保存或发布');
  form = copy(form);
  const existing = all.find((r) => r.id === form.id);
  if (existing) {
    current(all, form.id, form.revision);
    requireValue(canEdit(existing, p), '已发布知识须先下架才能编辑');
  } else requireValue(form.revision === 0, '记录已不存在，不能重新保存旧表单');
  requireValue(form.title.trim(), '请填写标题', 'title');
  requireValue(
    !form.type || types.includes(form.type),
    '请选择有效知识类型',
    'type',
  );
  requireValue(
    !form.category || categories.includes(form.category),
    '请选择有效专业分类',
    'category',
  );
  checkFiles(form.attachments);
  if (publish) {
    requireValue(types.includes(form.type), '请选择知识类型', 'type');
    requireValue(
      categories.includes(form.category),
      '请选择专业分类',
      'category',
    );
    requireValue(form.summary.trim(), '请填写摘要', 'summary');
    requireValue(
      form.body.trim() || (form.type === '文档' && form.attachments.length > 0),
      form.type === '文档'
        ? '文档发布须填写正文或上传至少一份附件'
        : '成果和案例发布须填写正文',
      'body',
    );
  }
  const sources = prepareReferences(form, existing, p, publish);
  const v = existing ?? freshKnowledge(p);
  if (!existing) {
    v.id = form.id;
    v.code = form.code;
  }
  for (const field of editableFields) v[field] = form[field].trim();
  v.attachments = copy(form.attachments);
  v.sources = sources;
  v.registration =
    existing?.registration ||
    (existing ? '手工登记' : form.registration || '手工登记');
  v.curatorId = p.id;
  if (publish) {
    v.status = '已发布';
    v.publisherId = p.id;
    v.publishedAt = now();
    v.firstPublishedAt ||= v.publishedAt;
  }
  log(
    v,
    p,
    publish
      ? existing?.history.some((h) => h.action === '发布')
        ? '重新发布'
        : '发布'
      : '保存',
  );
  if (!existing) all.push(v);
}
export function takeDown(
  all: Knowledge[],
  p: Person,
  id: string,
  revision: number,
  reason: string,
) {
  requireValue(p.admin, '仅知识管理员可下架');
  const v = current(all, id, revision);
  requireValue(v.status === '已发布', '仅已发布知识可下架');
  requireValue(reason.trim(), '请填写下架原因', 'reason');
  v.status = '已下架';
  log(v, p, '下架', reason.trim());
}
export function deleteKnowledge(
  all: Knowledge[],
  p: Person,
  id: string,
  revision: number,
) {
  requireValue(p.admin, '仅知识管理员可删除知识');
  const v = current(all, id, revision);
  requireValue(v.status === '草稿', '仅草稿知识可删除');
  all.splice(all.indexOf(v), 1);
}

export const emptyFilters = () => ({
  query: '',
  code: '',
  type: '',
  category: '',
  curatorId: '',
  status: '',
  from: '',
  to: '',
  sourceModule: '',
  sourceReview: '',
});
export type Filters = ReturnType<typeof emptyFilters>;
export function searchKnowledge(
  all: Knowledge[],
  p: Person,
  view: 'manage' | 'search',
  f: Filters,
  sourceData?: SourceData,
) {
  if (view === 'manage' && !p.admin) return [];
  const query = f.query.trim().toLocaleLowerCase();
  const data = sourceData || (f.sourceReview ? readSources() : undefined);
  return all
    .filter((v) => {
      if (!canView(v, p) || (view === 'search' && v.status !== '已发布'))
        return false;
      const typed =
        v.type === '成果'
          ? [v.resultName, v.resultType, v.resultNumber]
          : v.type === '案例'
            ? [v.problem, v.method, v.effect]
            : [];
      const haystack = [
        v.title,
        v.summary,
        v.keywords,
        v.category,
        v.body,
        v.scenario,
        ...typed,
      ]
        .join('\n')
        .toLocaleLowerCase();
      return (
        (!f.sourceModule ||
          (f.sourceModule === 'none'
            ? activeSources(v).length === 0
            : activeSources(v).some(
                (s) => s.selection.module === f.sourceModule,
              ))) &&
        (!f.sourceReview || referenceStatus(v, p, data) === f.sourceReview) &&
        haystack.includes(query) &&
        v.code.includes(f.code.trim()) &&
        (!f.type || v.type === f.type) &&
        (!f.category || v.category === f.category) &&
        (!f.curatorId || v.curatorId === f.curatorId) &&
        (!f.status || v.status === f.status) &&
        (!f.from || v.publishedAt.slice(0, 10) >= f.from) &&
        (!f.to || (!!v.publishedAt && v.publishedAt.slice(0, 10) <= f.to))
      );
    })
    .sort(
      (a, b) =>
        (b.publishedAt || b.updatedAt).localeCompare(
          a.publishedAt || a.updatedAt,
        ) || a.id.localeCompare(b.id),
    );
}
