import type { Knowledge, Person } from './model';
import type { SourceLink } from './source-types';
import type { CaseParts, SourceRecord } from './sources';

import { checkFiles, copy, now, uid, ValidationError } from './model';
import {
  fingerprint,
  readSources,
  resolveSource,
  selectedFields,
  sourceKey,
} from './sources';

// Session evidence of a successful, permission-checked import. This is not a
// persisted authorization flag: after source loss it permits draft preservation
// only, never publication or reading another source/file.
const stagedImports = new Map<
  string,
  {
    fields: string[];
    files: Knowledge['attachments'];
  }
>();
function evidenceKey(id: string, p: Person, link: SourceLink) {
  return JSON.stringify([
    id,
    p.id,
    link.key,
    link.selection,
    link.fingerprint,
    link.title,
    link.code,
    link.parentTitle,
    link.author,
    link.department,
    link.scope,
    link.contributors,
    link.version,
  ]);
}
export function isClearedReference(v: Knowledge, link: SourceLink) {
  return (
    !!link.removed &&
    link.fields.length === 0 &&
    !v.attachments.some((f) => f.origin?.key === link.key)
  );
}

export function requireSource(ok: unknown, message: string): asserts ok {
  if (!ok) throw new ValidationError('sources', message);
}
export function sourceState(link: SourceLink, p: Person, data = readSources()) {
  const result = resolveSource(link.selection, p, data);
  const token =
    result.state === 'ok' ? fingerprint(result.record) : result.state;
  const inaccessible = result.state !== 'ok';
  const changed =
    token !== link.fingerprint ||
    (!!link.observedFingerprint &&
      link.observedFingerprint !== link.reviewedObservation);
  const reviewed =
    link.reviewedFingerprint === token &&
    link.observedFingerprint === link.reviewedObservation &&
    (result.state !== 'denied' || link.reviewerId === p.id);
  return {
    result,
    token,
    changed,
    reviewed,
    pending: changed && !reviewed,
    label:
      result.state === 'unknown'
        ? '暂无法核对'
        : changed && !reviewed
          ? '待复核'
          : reviewed
            ? '已核对'
            : '正常',
    inaccessible,
  };
}
export function auditSources(
  all: Knowledge[],
  p: Person,
  data = readSources(),
) {
  if (!p.admin) return false;
  let changed = false;
  for (const v of all)
    for (const link of v.sources || []) {
      if (
        link.removed &&
        link.fields.length === 0 &&
        !v.attachments.some((f) => f.origin?.key === link.key)
      )
        continue;
      const state = sourceState(link, p, data);
      // A permission failure belongs to the current actor; it is not a global source deletion.
      if (['denied', 'unknown'].includes(state.result.state)) continue;
      if (
        state.token !== link.fingerprint &&
        state.token !== link.observedFingerprint
      ) {
        link.observedFingerprint = state.token;
        changed = true;
      }
    }
  return changed;
}
export const activeSources = (v: Knowledge) =>
  (v.sources || []).filter((s) => !s.removed);
export function referenceStatus(v: Knowledge, p: Person, data = readSources()) {
  const states = (v.sources || [])
    .filter(
      (s) =>
        !s.removed ||
        s.fields.length ||
        v.attachments.some((a) => a.origin?.key === s.key),
    )
    .map((s) => sourceState(s, p, data));
  return states.some((s) => s.result.state === 'unknown')
    ? '暂无法核对'
    : states.some((s) => s.pending)
      ? '待复核'
      : states.length > 0
        ? '已核对'
        : '无关联来源';
}
export type FieldAction = 'append' | 'keep' | 'replace';
export interface ImportPlan {
  caseParts?: CaseParts;
  record: SourceRecord;
  actions: Record<string, FieldAction>;
  copyFiles: boolean;
  confirmedFiles: boolean;
}
export function applyImport(
  form: Knowledge,
  p: Person,
  plan: ImportPlan,
  data = readSources(),
): Knowledge {
  requireSource(
    p.admin && form.status !== '已发布',
    '仅知识管理员可向草稿或已下架知识带入资料',
  );
  const resolved = resolveSource(plan.record.selection, p, data);
  requireSource(
    resolved.state === 'ok',
    '来源资格或访问权限已变化，请重新选择',
  );
  const record = resolved.record;
  requireSource(
    fingerprint(record) === fingerprint(plan.record),
    '选定来源已变化，请刷新预览后确认',
  );
  requireSource(
    record.selection.parts.every((id) => record.parts.some((v) => v.id === id)),
    '选定正文已不可用',
  );
  const result = copy(form);
  result.sources ||= [];
  const key = sourceKey(record.selection);
  const existing = result.sources.find((s) => s.key === key);
  // Same source selection is deliberately replaced only after a preview. Other links are untouched.
  requireSource(
    !plan.caseParts || form.type === '案例',
    '仅案例知识可对应案例字段',
  );
  for (const [field, ids] of Object.entries(plan.caseParts || {}))
    requireSource(
      ['effect', 'method', 'problem'].includes(field) &&
        ids.every((id) => record.selection.parts.includes(id)),
      '案例字段只能对应已选正文',
    );
  const fields = selectedFields(record, plan.caseParts);
  const changed: string[] = [];
  for (const [field, action] of Object.entries(plan.actions)) {
    if (action === 'keep' || !(field in fields) || !fields[field]) continue;
    requireSource(
      [
        'body',
        'category',
        'effect',
        'method',
        'originalAuthor',
        'originalDepartment',
        'problem',
        'resultName',
        'resultNumber',
        'resultType',
        'summary',
        'title',
      ].includes(field),
      '带入字段无效',
    );
    const target = result as unknown as Record<string, string>;
    requireSource(action !== 'append' || field === 'body', '仅正文支持追加');
    target[field] =
      action === 'append' && target[field]
        ? `${target[field]}\n\n${fields[field]}`
        : fields[field]!;
    changed.push(field);
  }
  if (plan.copyFiles) {
    requireSource(
      plan.confirmedFiles || record.selection.fileIds.length === 0,
      '请确认选定文件随知识向登录员工发布',
    );
    for (const id of record.selection.fileIds) {
      const file = record.files.find((f) => f.id === id);
      requireSource(file, '选定文件已不可访问');
      const old = result.attachments.find(
        (f) => f.origin?.key === key && f.origin.fileId === id,
      );
      if (old) {
        requireSource(
          old.content === file.content,
          '源文件已有更新，请先移除旧副本，再明确重新带入',
        );
        continue;
      }
      result.attachments.push({
        ...copy(file),
        id: uid(),
        origin: { key, fileId: id, copiedAt: now(), copiedBy: p.id },
      });
    }
    checkFiles(result.attachments);
  }
  const link: SourceLink = {
    key,
    selection: copy(record.selection),
    title: record.title,
    code: record.code,
    parentTitle: record.parentTitle,
    scope: record.parts
      .filter((p) => record.selection.parts.includes(p.id))
      .map((p) => p.label),
    author: record.author,
    department: record.department,
    contributors: record.replies
      .filter((r) => record.selection.replyIds.includes(r.id))
      .map((r) => ({ id: r.id, name: r.author, department: r.department })),
    fingerprint: fingerprint(record),
    version: record.version,
    linkedAt: existing?.linkedAt || '',
    linkedBy: existing?.linkedBy || '',
    fields: [...new Set([...(existing?.fields || []), ...changed])],
    published: existing?.published || false,
  };
  // Keep earlier selected objects/files when adding from the same parent. Require a fresh combined preview.
  if (existing) {
    requireSource(
      isClearedReference(form, existing) ||
        (existing.selection.replyIds.every((id) =>
          link.selection.replyIds.includes(id),
        ) &&
          existing.selection.parts.every((id) =>
            link.selection.parts.includes(id),
          ) &&
          existing.selection.fileIds.every((id) =>
            link.selection.fileIds.includes(id),
          )),
      '补充同一来源须保留已有正文、回复和文件选择；请先删除关联，再在关联记录中清理遗留材料',
    );
    result.sources[result.sources.findIndex((s) => s.key === key)] = link;
  } else result.sources.push(link);
  if (!form.revision && !form.registration)
    result.registration = '从已有资料整理';
  stagedImports.set(evidenceKey(result.id, p, link), {
    fields: [...link.fields],
    files: copy(result.attachments.filter((f) => f.origin?.key === key)),
  });
  return result;
}
export function removeReference(
  form: Knowledge,
  p: Person,
  key: string,
  clearMaterials: boolean,
) {
  requireSource(
    p.admin && form.status !== '已发布',
    '已发布知识须先下架再调整来源',
  );
  const result = copy(form);
  const link = result.sources?.find((s) => s.key === key);
  requireSource(link, '来源关系不存在');
  if (clearMaterials) {
    for (const field of link.fields)
      (result as unknown as Record<string, string>)[field] = '';
    result.attachments = result.attachments.filter(
      (f) => f.origin?.key !== key,
    );
    link.fields = [];
  }
  link.removed = true;
  return result;
}
// Validate the entire selection before changing the draft. Source materials stay intact.
export function removeReferences(
  form: Knowledge,
  p: Person,
  keys: string[],
  module: SourceLink['selection']['module'],
) {
  requireSource(
    p.admin && form.status !== '已发布',
    '已发布知识须先下架再调整来源',
  );
  requireSource(keys.length > 0, '请选择要删除的关联');
  const selected = new Set(keys);
  for (const key of selected) {
    const link = form.sources?.find((s) => s.key === key);
    requireSource(
      link && !link.removed && link.selection.module === module,
      '选定关联已变化，请重新选择',
    );
  }
  const result = copy(form);
  for (const link of result.sources || [])
    if (selected.has(link.key)) link.removed = true;
  return result;
}
// Called inside the same local transaction as the knowledge save.
export function prepareReferences(
  form: Knowledge,
  old: Knowledge | undefined,
  p: Person,
  publish: boolean,
  data = readSources(),
) {
  const links = copy(form.sources || []);
  requireSource(
    new Set(links.map((s) => s.key)).size === links.length,
    '来源关系重复',
  );
  for (const previous of old?.sources || []) {
    const next = links.find((s) => s.key === previous.key);
    requireSource(next, '移除来源须使用子表删除操作，保留材料追溯');
    for (const field of previous.fields) {
      requireSource(
        next.fields.includes(field) ||
          !(form as unknown as Record<string, string>)[field],
        '清理来源须清除对应带入字段，不能仅抹去追溯',
      );
    }
  }
  for (const file of form.attachments) {
    const original = old?.attachments.find((f) => f.id === file.id)?.origin;
    requireSource(
      !original || JSON.stringify(file.origin) === JSON.stringify(original),
      '知识副本的来源追溯不能删除',
    );
    requireSource(
      !file.origin || links.some((s) => s.key === file.origin!.key),
      '来源文件缺少追溯关系',
    );
    if (file.origin && !original) {
      const link = links.find((s) => s.key === file.origin!.key)!;
      const stagedFile = stagedImports
        .get(evidenceKey(form.id, p, link))
        ?.files.find(
          (f) => f.id === file.id && f.origin?.fileId === file.origin!.fileId,
        );
      const source = resolveSource(link.selection, p, data);
      const sourceFile =
        source.state === 'ok'
          ? source.record.files.find((f) => f.id === file.origin!.fileId)
          : undefined;
      requireSource(
        (sourceFile &&
          sourceFile.content === file.content &&
          sourceFile.name === file.name) ||
          (!publish &&
            stagedFile &&
            stagedFile.content === file.content &&
            stagedFile.name === file.name &&
            stagedFile.size === file.size &&
            stagedFile.uploader === file.uploader &&
            stagedFile.time === file.time),
        '新增来源副本已变化或不可访问，请重新带入',
      );
      file.origin.copiedAt = now();
      file.origin.copiedBy = p.id;
    }
  }
  for (const link of links) {
    const previous = old?.sources?.find((s) => s.key === link.key);
    requireSource(link.key === sourceKey(link.selection), '来源标识不一致');
    const state = sourceState(link, p, data);
    const evidence = stagedImports.get(evidenceKey(form.id, p, link));
    const staged =
      evidence && link.fields.every((field) => evidence.fields.includes(field));
    const newSelection =
      !previous ||
      previous.fingerprint !== link.fingerprint ||
      JSON.stringify(previous.selection) !== JSON.stringify(link.selection);
    if (newSelection) {
      requireSource(
        (state.result.state === 'ok' &&
          state.token === link.fingerprint &&
          state.token !== 'files-unavailable') ||
          (staged && (!publish || isClearedReference(form, link))),
        '新增带入的来源或文件已变化，请重新预览',
      );
      link.reviewedFingerprint = undefined;
      link.reviewNote = undefined;
      link.reviewedAt = undefined;
      link.reviewerId = undefined;
      link.observedFingerprint = undefined;
      link.reviewedObservation = undefined;
    } else {
      link.reviewedFingerprint = previous.reviewedFingerprint;
      link.reviewNote = previous.reviewNote;
      link.reviewedAt = previous.reviewedAt;
      link.reviewerId = previous.reviewerId;
      link.observedFingerprint = previous.observedFingerprint;
      link.reviewedObservation = previous.reviewedObservation;
    }
    const newMaterials =
      newSelection ||
      link.fields.some((field) => !previous?.fields.includes(field)) ||
      form.attachments.some(
        (file) =>
          file.origin?.key === link.key &&
          !old?.attachments.some((saved) => saved.id === file.id),
      );
    // A previously published source does not authorize newly added material.
    // After a draft save, the first-publication gate must still apply to it.
    link.published = !newMaterials && !!previous?.published;
    link.linkedAt = previous?.linkedAt || now();
    link.linkedBy = previous?.linkedBy || p.id;
    const used =
      !link.removed ||
      link.fields.length > 0 ||
      form.attachments.some((f) => f.origin?.key === link.key);
    if (publish && used) {
      const checked = sourceState(link, p, data);
      if (!link.published || newSelection)
        requireSource(
          checked.result.state === 'ok' &&
            checked.token === link.fingerprint &&
            checked.token !== 'files-unavailable',
          '首次发布或新增带入的来源已失效／变化，请处理后发布',
        );
      else
        requireSource(
          checked.result.state !== 'unknown' && !checked.pending,
          '来源仍需复核或暂无法核对，请处理后重新发布',
        );
      link.published = true;
    }
  }
  return links;
}
export function reviewReference(
  all: Knowledge[],
  p: Person,
  id: string,
  revision: number,
  key: string,
  note: string,
  expectedToken: string,
  data = readSources(),
) {
  requireSource(p.admin, '仅知识管理员可复核');
  const v = all.find((v) => v.id === id);
  requireSource(v && v.revision === revision, '记录已变化，请刷新后重试');
  const link = v.sources?.find((s) => s.key === key);
  requireSource(link, '来源已不存在');
  const state = sourceState(link, p, data);
  requireSource(
    state.result.state !== 'unknown',
    '暂无法核对，请恢复读取后再处理',
  );
  requireSource(
    state.token === expectedToken,
    '来源在处理期间再次变化，请重新核对',
  );
  requireSource(note.trim(), '请填写复核意见');
  requireSource(
    link.published ||
      (state.result.state === 'ok' && state.token === link.fingerprint),
    '未发布的失效材料不能通过确认保留绕过发布检查',
  );
  link.reviewedFingerprint = state.token;
  link.reviewNote = note.trim();
  link.reviewedAt = now();
  link.reviewerId = p.id;
  link.reviewedObservation = link.observedFingerprint;
  v.revision++;
  v.history.push({
    id: uid(),
    action: state.inaccessible
      ? '来源不可访问，确认保留已发布副本'
      : '来源复核：确认继续保留',
    actorId: p.id,
    time: now(),
    note: note.trim(),
    source: {
      key: link.key,
      module: link.selection.module,
      title: link.title,
      code: link.code,
      version: link.version,
      checkedToken: state.token,
    },
  });
}
