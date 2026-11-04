import type { Attachment, Person } from './model';
import type { SourceModule, SourceSelection } from './source-types';

import * as competition from '../competition/model';
import * as exchange from '../exchange/model';
import * as research from '../research/model';

export interface SourceData {
  exchange: exchange.Topic[];
  research: research.Topic[];
  competition: competition.CompetitionData;
  errors: Partial<Record<SourceModule, string>>;
}
// Explicit identity mapping. Never use another module's stored actor or copy admin flags.
export const identityMap: Record<
  string,
  Partial<Record<SourceModule, string>>
> = {
  manager: { exchange: 'manager', research: 'manager', competition: 'manager' },
  curator: { competition: 'expert-b' },
  lin: { exchange: 'lin', research: 'lin', competition: 'employee-a' },
  zhou: { exchange: 'zhou', research: 'zhou', competition: 'employee-b' },
  shen: { exchange: 'shen', research: 'shen', competition: 'expert-a' },
};
export function knowledgeIdentity(module: SourceModule, id: string) {
  return Object.keys(identityMap).find(
    (key) => identityMap[key]?.[module] === id,
  );
}
export function readSources(): SourceData {
  const result: SourceData = {
    exchange: [],
    research: [],
    competition: { version: 1, activities: [], entries: [], reviews: [] },
    errors: {},
  };
  for (const module of ['exchange', 'research', 'competition'] as const) {
    try {
      const raw = localStorage.getItem(`vben-web-innovation:${module}:v1`);
      if (!raw) {
        result.errors[module] = '源模块尚未初始化，请先打开对应模块后刷新';
        continue;
      }
      const data = JSON.parse(raw);
      if (data.version !== 1) throw new Error();
      if (module === 'competition') {
        if (![data.activities, data.entries, data.reviews].every(Array.isArray))
          throw new Error();
        result.competition = competition.normalizeCompetitionData(data);
      } else {
        if (!Array.isArray(data.topics)) throw new Error();
        if (
          !data.topics.every(
            (t: null | Record<string, unknown>) =>
              t &&
              typeof t.id === 'string' &&
              (module === 'exchange'
                ? Array.isArray(t.replies) && Array.isArray(t.attachments)
                : !!t.closure && typeof t.closure === 'object'),
          )
        )
          throw new Error();
        result[module] = data.topics;
      }
    } catch {
      result.errors[module] = '源资料暂无法读取，请恢复后刷新；未修改源数据';
    }
  }
  return result;
}
export const sourceKey = (s: SourceSelection) =>
  `${s.module}:${s.parentId}:${s.objectId}`;
export function selection(
  module: SourceModule,
  parentId: string,
  objectId = '',
): SourceSelection {
  return { module, parentId, objectId, replyIds: [], fileIds: [], parts: [] };
}
export interface SourceRecord {
  selection: SourceSelection;
  code: string;
  title: string;
  parentTitle: string;
  author: string;
  department: string;
  category: string;
  status: string;
  version: string;
  time: string;
  fields: Record<string, string>;
  parts: { id: string; label: string; text: string }[];
  replies: {
    id: string;
    author: string;
    department: string;
    body: string;
    adopted: boolean;
  }[];
  files: (Attachment & { sourceLabel?: string })[];
  eligible: boolean;
}
export type Resolution =
  | { state: 'denied' | 'unavailable' | 'unknown'; message: string }
  | { state: 'ok'; record: SourceRecord };
export function resolveSource(
  s: SourceSelection,
  p: Person,
  data: SourceData,
): Resolution {
  if (data.errors[s.module])
    return { state: 'unknown', message: data.errors[s.module]! };
  const actorId = identityMap[p.id]?.[s.module];
  if (!actorId) return { state: 'denied', message: '该身份暂不支持此来源访问' };
  const missing: Resolution = {
    state: 'unavailable',
    message: '来源已不可用于整理',
  };
  const denied: Resolution = { state: 'denied', message: '暂无查看权限' };
  try {
    if (s.module === 'exchange') {
      const t = data.exchange.find((v) => v.id === s.parentId);
      if (!t) return missing;
      const actor = exchange.people.find((v) => v.id === actorId);
      if (!actor || !exchange.canView(t, actor)) return denied;
      if (t.status !== '已发布') return missing;
      const replies = t.replies.filter(
        (r) => r.status === '有效' && exchange.canViewReply(t, r, actor),
      );
      if (s.replyIds.some((id) => !replies.some((r) => r.id === id)))
        return missing;
      const chosen = replies.filter((r) => s.replyIds.includes(r.id));
      const author = exchange.nameOf(t.authorId);
      return {
        state: 'ok',
        record: {
          selection: s,
          code: t.code,
          title: t.title,
          parentTitle: t.title,
          author,
          department: t.department,
          category: t.category,
          status: t.status,
          version: '',
          time: t.firstPublishedAt,
          fields: {
            title: t.title,
            originalAuthor: author,
            originalDepartment: t.department,
            category: t.category,
          },
          parts: [
            { id: 'topic', label: '主题正文', text: t.body },
            ...chosen.map((r) => ({
              id: r.id,
              label: `回复 · ${exchange.nameOf(r.authorId)}${t.adoptedId === r.id ? '（已采纳）' : ''}`,
              text: r.body,
            })),
          ],
          replies: replies.map((r) => ({
            id: r.id,
            author: exchange.nameOf(r.authorId),
            department: r.department,
            body: r.body,
            adopted: t.adoptedId === r.id,
          })),
          files: [
            ...t.attachments.map((f) => ({ ...f, sourceLabel: '主题附件' })),
            ...chosen.flatMap((r) =>
              r.attachments.map((f) => ({
                ...f,
                sourceLabel: `回复 · ${exchange.nameOf(r.authorId)}`,
              })),
            ),
          ],
          eligible: true,
        },
      };
    }
    if (s.module === 'research') {
      const t = data.research.find((v) => v.id === s.parentId);
      if (!t) return missing;
      const actor = research.people.find((v) => v.id === actorId);
      if (
        !actor ||
        !research.canView(t, actor) ||
        !research.canSeeClosure(t, actor)
      )
        return denied;
      const closure = research.submittedClosure(t);
      if (t.status !== '已结题' || !closure) return missing;
      const r = s.objectId
        ? closure.results.find((r) => r.id === s.objectId)
        : undefined;
      if (s.objectId && !r) return missing;
      const leader = research.person(t.leaderId);
      return {
        state: 'ok',
        record: {
          selection: s,
          code: t.code,
          title: r?.name || t.name,
          parentTitle: t.name,
          author: leader?.name || '历史人员',
          department: leader?.department || '',
          category: t.category,
          status: t.status,
          version: t.closedAt,
          time: t.closedAt,
          fields: {
            title: r?.name || t.name,
            originalAuthor: leader?.name || '',
            originalDepartment: leader?.department || '',
            resultName: r?.name || '',
            resultType: r?.kind || '',
            resultNumber: r?.code || '',
          },
          parts: [
            { id: 'summary', label: '正式结题总结', text: closure.summary },
            { id: 'goal', label: '目标完成情况', text: closure.goal },
            { id: 'outcome', label: '成果说明', text: closure.outcome },
            ...(r
              ? [{ id: 'result', label: '选定成果说明', text: r.description }]
              : []),
          ],
          replies: [],
          files: closure.files.map((f) => ({
            ...f,
            sourceLabel: '课题正式结题附件（整体）',
          })),
          eligible: true,
        },
      };
    }
    const a = data.competition.activities.find((v) => v.id === s.parentId);
    const e = data.competition.entries.find(
      (v) => v.id === s.objectId && v.activityId === s.parentId,
    );
    if (!a || !e) return missing;
    const actor = competition.people.find((v) => v.id === actorId);
    if (!actor || !competition.canSeeEntry(data.competition, e, actor))
      return denied;
    const pub = competition.currentPublication(a);
    const winner = pub?.winners.find((v) => v.id === e.id);
    if (!['已公示', '已结束'].includes(a.status) || !winner || !pub)
      return missing;
    const leader = competition.projectLeader(winner);
    const files = e.attachments.filter(
      (f) =>
        competition.isInternalReader(data.competition, e, actor) ||
        competition.attachmentIsPublic(f),
    );
    return {
      state: 'ok',
      record: {
        selection: s,
        code: winner.code,
        title: winner.name,
        parentTitle: pub.activityName,
        author: leader?.name || '历史人员',
        department: leader?.department || '',
        category: winner.category,
        status: a.status,
        version: String(pub.version),
        time: pub.publishedAt,
        fields: {
          title: winner.name,
          summary: winner.summary,
          originalAuthor: leader?.name || '',
          originalDepartment: leader?.department || '',
          resultName: winner.name,
        },
        parts: [
          { id: 'summary', label: '项目简介', text: winner.summary },
          {
            id: 'achievements',
            label: '获得成果／专利',
            text: winner.achievements,
          },
          {
            id: 'award',
            label: '活动及奖项',
            text: `${pub.activityName} · ${winner.award}`,
          },
        ],
        replies: [],
        files: files.map((f) => ({
          id: f.id,
          name: f.name,
          content: f.content,
          size: f.size,
          uploader: f.uploader,
          time: f.uploadedAt,
          sourceLabel: '获奖项目申报附件',
        })),
        eligible: true,
      },
    };
  } catch {
    return { state: 'unknown', message: '来源资料不完整，暂无法核对' };
  }
}
export function candidates(
  module: SourceModule,
  p: Person,
  data: SourceData,
): SourceRecord[] {
  if (!p.admin) return [];
  let choices: SourceSelection[] = [];
  if (module === 'exchange')
    choices = data.exchange.map((t) => selection(module, t.id));
  else if (module === 'research')
    choices = data.research.flatMap((t) => [
      selection(module, t.id),
      ...(research.submittedClosure(t)?.results || []).map((r) =>
        selection(module, t.id, r.id),
      ),
    ]);
  else
    choices = data.competition.activities.flatMap((a) =>
      (competition.currentPublication(a)?.winners || []).map((w) =>
        selection(module, a.id, w.id),
      ),
    );
  return choices.flatMap((s) => {
    const r = resolveSource(s, p, data);
    return r.state === 'ok' ? [r.record] : [];
  });
}
export type CaseParts = Partial<
  Record<'effect' | 'method' | 'problem', string[]>
>;
export function selectedFields(
  r: SourceRecord,
  caseParts: CaseParts = {},
): Record<string, string> {
  const parts = r.parts.filter((part) => r.selection.parts.includes(part.id));
  return {
    ...r.fields,
    body: parts.map((part) => `${part.label}\n${part.text}`).join('\n\n'),
    ...Object.fromEntries(
      Object.entries(caseParts).map(([field, ids]) => [
        field,
        parts
          .filter((part) => ids.includes(part.id))
          .map((part) => `${part.label}\n${part.text}`)
          .join('\n\n'),
      ]),
    ),
  };
}
// Non-security change token: selected content only; no source body is stored as a hidden cache.
export function fingerprint(r: SourceRecord): string {
  const selectedFiles = r.selection.fileIds.map((id) =>
    r.files.find((f) => f.id === id),
  );
  if (selectedFiles.some((f) => !f)) return 'files-unavailable';
  const raw = JSON.stringify({
    fields: r.fields,
    parts: r.parts.filter((part) => r.selection.parts.includes(part.id)),
    replies: r.replies.filter((v) => r.selection.replyIds.includes(v.id)),
    files: selectedFiles,
    status: r.selection.module === 'competition' ? '有效公示' : r.status,
    version: r.version,
  });
  let h = 2_166_136_261;
  for (let i = 0; i < raw.length; i++)
    h = Math.imul(h ^ raw.charCodeAt(i), 16_777_619);
  return (h >>> 0).toString(16);
}
