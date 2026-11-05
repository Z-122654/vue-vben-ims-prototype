import type { Knowledge } from './model';
import type { SourceData } from './sources';

import { beforeEach, expect, it } from 'vitest';

import {
  beginResultCorrection,
  canDownloadCertificate,
  currentPublication,
  decidePublicationApproval,
  person as competitionPerson,
  saveResults,
  submitPublicationApproval,
} from '../competition/model';
import { seedData as competitionSeeds } from '../competition/seed';
import { seedData as exchangeSeeds } from '../exchange/seed';
import { seedData as researchSeeds } from '../research/seed';
import {
  copy,
  emptyFilters,
  freshKnowledge,
  people,
  saveKnowledge,
  searchKnowledge,
  takeDown,
} from './model';
import {
  applyImport,
  auditSources,
  prepareReferences,
  removeReference,
  removeReferences,
  reviewReference,
  sourceState,
} from './references';
import {
  candidates,
  fingerprint,
  knowledgeIdentity,
  readSources,
  resolveSource,
  selection,
} from './sources';
const admin = people[0]!;
const curator = people[1]!;
const employee = people[2]!;
let data: SourceData;
function persist() {
  for (const module of ['exchange', 'research', 'competition'] as const)
    localStorage.setItem(
      `vben-web-innovation:${module}:v1`,
      JSON.stringify(
        module === 'competition'
          ? data.competition
          : { version: 1, topics: data[module] },
      ),
    );
}
beforeEach(() => {
  localStorage.clear();
  data = {
    exchange: exchangeSeeds(),
    research: researchSeeds(),
    competition: competitionSeeds(),
    errors: {},
  };
  persist();
});
function record() {
  const s = selection('exchange', data.exchange[0]!.id);
  s.parts = ['topic'];
  s.replyIds = ['exchange-demo-answer'];
  s.parts.push('exchange-demo-answer');
  const r = resolveSource(s, admin, data);
  if (r.state !== 'ok') throw new Error('fixture');
  return r.record;
}
function imported() {
  const v = {
    ...freshKnowledge(admin),
    title: '知识测试',
    type: '案例',
    category: '运行',
    summary: '摘要',
    body: '原正文',
  };
  return applyImport(
    v,
    admin,
    {
      record: record(),
      actions: { body: 'replace', originalAuthor: 'replace' },
      copyFiles: false,
      confirmedFiles: false,
    },
    data,
  );
}
function saved(publish = false) {
  const all: Knowledge[] = [];
  saveKnowledge(all, admin, imported(), publish);
  return { all, v: all[0]! };
}
it('映射同一人员，不使用源模块缓存管理员身份，不提供不存在映射的资料', () => {
  localStorage.setItem('vben-web-innovation:research:v1:actor', 'manager');
  expect(candidates('research', curator, readSources())).toEqual([]);
  expect(knowledgeIdentity('competition', 'expert-b')).toBe('curator');
  expect(candidates('exchange', employee, data)).toEqual([]);
  expect(localStorage.getItem('vben-web-innovation:research:v1:actor')).toBe(
    'manager',
  );
});
it('交流仅已发布主题及有效选定回复，采纳事实和作者保留，其他回复不带入', () => {
  const r = record();
  expect(r.replies.some((v) => v.id === 'exchange-demo-hidden')).toBe(false);
  const v = imported();
  expect(v.body).toContain('周亦安');
  expect(v.body).toContain('已采纳');
  expect(v.body).not.toContain('此条为已下架回复');
  expect(v.sources![0]!.contributors![0]!.name).toBe('周亦安');
  const s = selection('exchange', data.exchange[3]!.id);
  expect(resolveSource(s, admin, data).state).toBe('denied');
});
it('课题只读正式结题版本和成果，草稿变化不污染候选', () => {
  const t = data.research.find((t) => t.status === '已结题')!;
  t.submittedClosure = copy(t.closure);
  t.closure.summary = '未提交的草稿';
  const r = resolveSource(selection('research', t.id), admin, data);
  expect(r.state).toBe('ok');
  if (r.state === 'ok')
    expect(r.record.parts.some((p) => p.text === '未提交的草稿')).toBe(false);
  expect(
    candidates('research', admin, data).every((r) => r.status === '已结题'),
  ).toBe(true);
});
it('零成果行仍能选择整体结题资料', () => {
  const t = data.research.find((t) => t.status === '已结题')!;
  t.submittedClosure = copy(t.closure);
  t.submittedClosure.results = [];
  expect(
    candidates('research', admin, data).filter(
      (r) => r.selection.parentId === t.id,
    ),
  ).toHaveLength(1);
});
it('竞赛采用有效公示快照，不采用项目后续编辑，附件按当前同人权限过滤', () => {
  const a = data.competition.activities.find(
    (a) => currentPublication(a)?.winners.length,
  )!;
  const winner = currentPublication(a)!.winners[0]!;
  const e = data.competition.entries.find((e) => e.id === winner.id)!;
  e.name = '未公示的变更';
  e.attachments = [
    {
      id: 'private',
      name: '内部.pdf',
      size: 3,
      content: 'data:application/pdf;base64,YWJj',
      uploader: '甲',
      uploadedAt: '',
      public: false,
    },
  ];
  const r = resolveSource(selection('competition', a.id, e.id), curator, data);
  expect(r.state).toBe('ok');
  if (r.state === 'ok') {
    expect(r.record.title).toBe(winner.name);
    expect(r.record.files).toEqual([]);
  }
  expect(
    resolveSource(selection('competition', a.id, e.id), admin, data).state,
  ).toBe('ok');
});
it('来源存储损坏和未初始化区别于删除，不覆盖源存储', () => {
  localStorage.setItem('vben-web-innovation:exchange:v1', 'broken');
  expect(readSources().errors.exchange).toContain('暂无法读取');
  expect(localStorage.getItem('vben-web-innovation:exchange:v1')).toBe(
    'broken',
  );
  localStorage.removeItem('vben-web-innovation:research:v1');
  expect(readSources().errors.research).toContain('尚未初始化');
});
it('带入只修改返回表单，已有主表署名和未选字段不被覆盖', () => {
  const before = copy(data);
  const v = {
    ...freshKnowledge(admin),
    title: '自定标题',
    originalAuthor: '主署名',
    body: '自定正文',
  };
  const after = applyImport(
    v,
    admin,
    {
      record: record(),
      actions: { body: 'append' },
      copyFiles: false,
      confirmedFiles: false,
    },
    data,
  );
  expect(after.body).toMatch(/^自定正文/);
  expect(after.originalAuthor).toBe('主署名');
  expect(after.title).toBe('自定标题');
  expect(v.sources).toBeUndefined();
  expect(data).toEqual(before);
});
it('同来源补充不新增重复关系，未保留原选回复则拦截', () => {
  const r = record();
  const v = imported();
  const updated = applyImport(
    v,
    admin,
    { record: r, actions: {}, copyFiles: false, confirmedFiles: false },
    data,
  );
  expect(updated.sources).toHaveLength(1);
  r.selection.replyIds = [];
  r.selection.parts = ['topic'];
  expect(() =>
    applyImport(
      v,
      admin,
      { record: r, actions: {}, copyFiles: false, confirmedFiles: false },
      data,
    ),
  ).toThrow('须保留');
});
it('已发布知识及非知识管理员不能带入', () => {
  const plan = {
    record: record(),
    actions: {},
    copyFiles: false,
    confirmedFiles: false,
  };
  const v = imported();
  expect(() => applyImport(v, employee, plan, data)).toThrow('仅知识管理员');
  v.status = '已发布';
  expect(() => applyImport(v, admin, plan, data)).toThrow('仅知识管理员');
});
it('来源预览后发生变化时带入失败，原表单不变', () => {
  const v = imported();
  const before = copy(v);
  const r = record();
  data.exchange[0]!.body = '源更新';
  expect(() =>
    applyImport(
      v,
      admin,
      {
        record: r,
        actions: { body: 'replace' },
        copyFiles: false,
        confirmedFiles: false,
      },
      data,
    ),
  ).toThrow('已变化');
  expect(v).toEqual(before);
});
it('源文件必须明确公开确认，复制独立且不重复，超限整次失败', () => {
  const f = {
    id: 'file',
    name: '资料.pdf',
    size: 3,
    content: 'data:application/pdf;base64,YWJj',
    uploader: '原作者',
    time: '2026-01-01',
  };
  data.exchange[0]!.attachments = [f];
  const r = record();
  r.selection.fileIds = ['file'];
  const plan = {
    record: r,
    actions: {},
    copyFiles: true,
    confirmedFiles: false,
  };
  const v = imported();
  expect(() => applyImport(v, admin, plan, data)).toThrow('请确认');
  const result = applyImport(v, admin, { ...plan, confirmedFiles: true }, data);
  expect(result.attachments[0]!.id).not.toBe(f.id);
  expect(result.attachments[0]!.uploader).toBe('原作者');
  expect(
    applyImport(result, admin, { ...plan, confirmedFiles: true }, data)
      .attachments,
  ).toHaveLength(1);
  f.name = '不支持.txt';
  const latest = record();
  latest.selection.fileIds = ['file'];
  expect(() =>
    applyImport(
      v,
      admin,
      { ...plan, record: latest, confirmedFiles: true },
      data,
    ),
  ).toThrow();
  expect(v.attachments).toEqual([]);
});
it('合法带入后首次保存前源失效仍可暂存；关联时间在保存时记录，发布被阻止', () => {
  const v = imported();
  expect(v.sources![0]!.linkedAt).toBe('');
  const all: Knowledge[] = [];
  data.exchange[0]!.status = '已下架';
  persist();
  saveKnowledge(all, admin, v);
  expect(all[0]!.body).toBe(v.body);
  expect(all[0]!.sources![0]!.linkedAt).toBeTruthy();
  expect(sourceState(all[0]!.sources![0]!, admin).pending).toBe(true);
  expect(() => saveKnowledge(all, admin, copy(all[0]!), true)).toThrow(
    '首次发布',
  );
});
it('保存既有失效草稿允许，首次发布拦截；解绑保留材料不能绕过', () => {
  const { all, v } = saved();
  expect(v.sources![0]!.linkedAt).toBeTruthy();
  data.exchange[0]!.status = '已下架';
  persist();
  saveKnowledge(all, admin, copy(v));
  expect(() => saveKnowledge(all, admin, copy(v), true)).toThrow('首次发布');
  const detached = removeReference(v, admin, v.sources![0]!.key, false);
  expect(() => saveKnowledge(all, admin, detached, true)).toThrow('首次发布');
  expect(detached.body).toBe(v.body);
});
it('失效草稿明确清理带入内容后可重新编辑发布，仍保留追溯', () => {
  const { all, v } = saved();
  data.exchange[0]!.status = '已下架';
  persist();
  const cleaned = removeReference(v, admin, v.sources![0]!.key, true);
  saveKnowledge(all, admin, cleaned);
  const edited = copy(all[0]!);
  edited.body = '独立重新整理的内容';
  saveKnowledge(all, admin, edited, true);
  expect(all[0]!.sources![0]!.removed).toBe(true);
});
it('不能清除追溯而保留材料，也不能伪造已发布标记绕过来源失效', () => {
  const { all, v } = saved();
  const altered = copy(v);
  altered.sources = [];
  expect(() => saveKnowledge(all, admin, altered)).toThrow('保留材料追溯');
  data.exchange[0]!.status = '已下架';
  persist();
  const fake = copy(v);
  fake.sources![0]!.published = true;
  expect(() => saveKnowledge(all, admin, fake, true)).toThrow('首次发布');
});
it('未选择回复新增不产生复核，选择的回复修改和采纳变化产生复核', () => {
  const v = imported();
  const link = v.sources![0]!;
  const original = fingerprint(record());
  data.exchange[0]!.replies.push({
    ...copy(data.exchange[0]!.replies[0]!),
    id: 'unselected',
    body: '新讨论',
  });
  expect(sourceState(link, admin, data).pending).toBe(false);
  expect(fingerprint(record())).toBe(original);
  data.exchange[0]!.adoptedId = 'unselected';
  expect(sourceState(link, admin, data).pending).toBe(true);
});
it('已发布来源失效不改正文和发布日；逐来源复核保留后可重新发布', () => {
  const { all, v } = saved(true);
  const before = copy(v);
  data.exchange[0]!.status = '已下架';
  persist();
  const state = sourceState(v.sources![0]!, admin, data);
  expect(state.pending).toBe(true);
  reviewReference(
    all,
    admin,
    v.id,
    v.revision,
    v.sources![0]!.key,
    '核对后保留独立案例',
    state.token,
    data,
  );
  expect(v.body).toBe(before.body);
  expect(v.publishedAt).toBe(before.publishedAt);
  expect(v.updatedAt).toBe(before.updatedAt);
  expect(v.sources![0]!.reviewNote).toBe('核对后保留独立案例');
  expect(sourceState(v.sources![0]!, admin, data).pending).toBe(false);
  takeDown(all, admin, v.id, v.revision, '补充说明');
  saveKnowledge(all, admin, copy(v), true);
});
it('待复核阻止重新发布；空意见、读取故障、复核期间再次变化均拒绝', () => {
  const { all, v } = saved(true);
  data.exchange[0]!.body = '变化';
  persist();
  const link = v.sources![0]!;
  const token = sourceState(link, admin, data).token;
  expect(() =>
    reviewReference(all, admin, v.id, v.revision, link.key, '', token, data),
  ).toThrow('意见');
  data.errors.exchange = '故障';
  expect(() =>
    reviewReference(
      all,
      admin,
      v.id,
      v.revision,
      link.key,
      '保留',
      token,
      data,
    ),
  ).toThrow('暂无法核对');
  delete data.errors.exchange;
  data.exchange[0]!.body = '再次变化';
  persist();
  expect(() =>
    reviewReference(
      all,
      admin,
      v.id,
      v.revision,
      link.key,
      '保留',
      token,
      data,
    ),
  ).toThrow('再次变化');
  takeDown(all, admin, v.id, v.revision, '更新');
  expect(() => saveKnowledge(all, admin, copy(v), true)).toThrow(
    '来源仍需复核',
  );
});
it('新文件来源失权时保存再次校验，不接受伪造文件和半成品', () => {
  const v = imported();
  v.attachments = [
    {
      id: 'fake',
      name: '秘密.pdf',
      size: 3,
      content: 'data:application/pdf;base64,YWJj',
      time: '',
      uploader: '原作者',
      origin: {
        key: v.sources![0]!.key,
        fileId: 'missing',
        copiedAt: '',
        copiedBy: admin.id,
      },
    },
  ];
  expect(() => prepareReferences(v, undefined, admin, false, data)).toThrow(
    '新增来源副本',
  );
});

it('已发现的来源变化恢复原值后仍待复核，权限失效和临时故障不写成全局删除', () => {
  const original = data.exchange[0]!.body;
  const { all, v } = saved(true);
  data.exchange[0]!.body = '短暂修改';
  expect(auditSources(all, admin, data)).toBe(true);
  data.exchange[0]!.body = original;
  expect(sourceState(v.sources![0]!, admin, data).pending).toBe(true);
  const token = sourceState(v.sources![0]!, admin, data).token;
  reviewReference(
    all,
    admin,
    v.id,
    v.revision,
    v.sources![0]!.key,
    '核对已恢复',
    token,
    data,
  );
  expect(sourceState(v.sources![0]!, admin, data).pending).toBe(false);
  const before = copy(all);
  expect(auditSources(all, curator, data)).toBe(false);
  expect(all).toEqual(before);
  data.errors.exchange = '读取故障';
  expect(auditSources(all, admin, data)).toBe(false);
  expect(all).toEqual(before);
});
it('多来源检索不重复，解绑后无关联与原登记方式分开', () => {
  const r = candidates('research', admin, data)[0]!;
  const v = imported();
  const combined = applyImport(
    v,
    admin,
    { record: r, actions: {}, copyFiles: false, confirmedFiles: false },
    data,
  );
  expect(combined.sources).toHaveLength(2);
  expect(
    searchKnowledge(
      [combined],
      admin,
      'manage',
      { ...emptyFilters(), sourceModule: 'research' },
      data,
    ),
  ).toHaveLength(1);
  let cleared = combined;
  for (const link of combined.sources!)
    cleared = removeReference(cleared, admin, link.key, true);
  expect(
    searchKnowledge(
      [cleared],
      admin,
      'manage',
      { ...emptyFilters(), sourceModule: 'none' },
      data,
    ),
  ).toHaveLength(1);
  expect(cleared.registration).toBe('从已有资料整理');
});
it('清理被删除回复的材料后可重新关联仍有效的主题', () => {
  const v = imported();
  const key = v.sources![0]!.key;
  data.exchange[0]!.replies = [];
  const cleaned = removeReference(v, admin, key, true);
  const resolved = resolveSource(
    selection('exchange', data.exchange[0]!.id),
    admin,
    data,
  );
  if (resolved.state !== 'ok') throw new Error('fixture');
  const again = applyImport(
    cleaned,
    admin,
    {
      record: resolved.record,
      actions: { title: 'replace' },
      copyFiles: false,
      confirmedFiles: false,
    },
    data,
  );
  expect(again.sources).toHaveLength(1);
  expect(again.sources![0]!.removed).toBeUndefined();
  expect(again.sources![0]!.selection.replyIds).toEqual([]);
});

it('kB-A01 补充同源不能保留旧正文却取消其追溯范围', () => {
  const r = record();
  const v = imported();
  r.selection.parts = ['exchange-demo-answer'];
  expect(() =>
    applyImport(
      v,
      admin,
      { record: r, actions: {}, copyFiles: false, confirmedFiles: false },
      data,
    ),
  ).toThrow('须保留已有正文');
  data.exchange[0]!.body = '更新后的问题';
  expect(sourceState(v.sources![0]!, admin, data).pending).toBe(true);
});

it('kB-A03 带入的独立文件随后失效可暂存，伪造文件或其他身份不能借用暂存证据', () => {
  data.exchange[0]!.attachments = [
    {
      id: 'pdf',
      name: '证据.pdf',
      size: 3,
      content: 'data:application/pdf;base64,YWJj',
      uploader: '作者',
      time: '2026-01-01',
    },
  ];
  const rec = record();
  rec.selection.fileIds = ['pdf'];
  const v = applyImport(
    imported(),
    admin,
    { record: rec, actions: {}, copyFiles: true, confirmedFiles: true },
    data,
  );
  data.exchange[0]!.attachments = [];
  persist();
  const fake = copy(v);
  fake.attachments[0]!.content = 'data:application/pdf;base64,ZmFrZQ==';
  expect(() => saveKnowledge([], admin, fake)).toThrow('新增来源副本');
  expect(() => saveKnowledge([], curator, v)).toThrow('新增来源副本');
  const all: Knowledge[] = [];
  saveKnowledge(all, admin, v);
  expect(all[0]!.attachments).toHaveLength(1);
  expect(() => saveKnowledge(all, admin, copy(all[0]!), true)).toThrow(
    '首次发布',
  );
  expect(() =>
    applyImport(v, admin, {
      record: rec,
      actions: {},
      copyFiles: true,
      confirmedFiles: true,
    }),
  ).toThrow();
});

it('kB-A03 新来源失效后明确清理并重新撰写可以保存，不能通过保留材料解绑后直接发布', () => {
  const v = imported();
  data.exchange[0]!.status = '已下架';
  persist();
  const keep = removeReference(v, admin, v.sources![0]!.key, false);
  expect(() => saveKnowledge([], admin, keep, true)).toThrow();
  const clean = removeReference(v, admin, v.sources![0]!.key, true);
  clean.body = '重新独立撰写';
  const all: Knowledge[] = [];
  saveKnowledge(all, admin, clean, true);
  expect(all[0]!.status).toBe('已发布');
  expect(all[0]!.sources![0]!.removed).toBe(true);
});

it('kB-A04 多次复核的历史保留具体来源和当次版本，不因最新复核覆盖', () => {
  const { all, v } = saved(true);
  const link = v.sources![0]!;
  data.exchange[0]!.body += '第一次';
  reviewReference(
    all,
    admin,
    v.id,
    v.revision,
    link.key,
    '第一次保留',
    sourceState(link, admin, data).token,
    data,
  );
  const first = copy(v.history.at(-1)!);
  data.exchange[0]!.body += '第二次';
  reviewReference(
    all,
    admin,
    v.id,
    v.revision,
    link.key,
    '第二次保留',
    sourceState(link, admin, data).token,
    data,
  );
  expect(first.source?.key).toBe(link.key);
  expect(first.source?.title).toBe(link.title);
  expect(v.history.at(-1)!.source?.checkedToken).not.toBe(
    first.source?.checkedToken,
  );
  expect(v.history.at(-2)).toEqual(first);
});

it('kB-A06 案例映射仅使用明确选定部分及动作，不把回答自动当作效果', () => {
  const v = {
    ...freshKnowledge(admin),
    title: '案例',
    type: '案例',
    problem: '已有问题',
    method: '已有方法',
    effect: '未验证',
  };
  const rec = record();
  const mapped = applyImport(
    v,
    admin,
    {
      record: rec,
      actions: { problem: 'replace', method: 'replace' },
      caseParts: { problem: ['topic'], method: ['exchange-demo-answer'] },
      copyFiles: false,
      confirmedFiles: false,
    },
    data,
  );
  expect(mapped.problem).toContain(data.exchange[0]!.body);
  expect(mapped.method).toContain('周亦安');
  expect(mapped.effect).toBe('未验证');
  expect(mapped.sources![0]!.fields).toEqual(['problem', 'method']);
  expect(() =>
    applyImport(
      v,
      admin,
      {
        record: rec,
        actions: { effect: 'replace' },
        caseParts: { effect: ['unselected'] },
        copyFiles: false,
        confirmedFiles: false,
      },
      data,
    ),
  ).toThrow('已选正文');
  expect(() =>
    applyImport(
      { ...v, type: '成果' },
      admin,
      {
        record: rec,
        actions: { problem: 'replace' },
        caseParts: { problem: ['topic'] },
        copyFiles: false,
        confirmedFiles: false,
      },
      data,
    ),
  ).toThrow('仅案例');
});

it('kB-A08 已发布知识下架后补充的新材料不能继承旧材料的已发布资格', () => {
  const { all, v } = saved(true);
  takeDown(all, admin, v.id, v.revision, '补充材料');
  data.exchange[0]!.replies.push({
    ...copy(data.exchange[0]!.replies[0]!),
    id: 'new-answer',
    body: '新材料',
  });
  persist();
  const choice = copy(v.sources![0]!.selection);
  choice.replyIds.push('new-answer');
  choice.parts.push('new-answer');
  const resolved = resolveSource(choice, admin, data);
  if (resolved.state !== 'ok') throw new Error('fixture');
  const next = applyImport(
    copy(v),
    admin,
    {
      record: resolved.record,
      actions: { body: 'append' },
      copyFiles: false,
      confirmedFiles: false,
    },
    data,
  );
  saveKnowledge(all, admin, next);
  expect(v.sources![0]!.published).toBe(false);
  data.exchange[0]!.status = '已下架';
  persist();
  expect(() =>
    reviewReference(
      all,
      admin,
      v.id,
      v.revision,
      v.sources![0]!.key,
      '保留新材料',
      sourceState(v.sources![0]!, admin).token,
    ),
  ).toThrow('未发布');
  expect(() => saveKnowledge(all, admin, copy(v), true)).toThrow('首次发布');
});

it('批量移除先校验全部关系，保留正文、附件、来源范围且不修改输入', () => {
  const form = imported();
  const key = form.sources![0]!.key;
  form.attachments = [
    {
      id: 'copy-file',
      name: '资料.pdf',
      size: 3,
      content: 'data:application/pdf;base64,YWJj',
      uploader: '管理员',
      time: '',
      origin: { key },
    } as any,
  ];
  const before = copy(form);
  expect(() =>
    removeReferences(form, admin, [key, 'missing'], 'exchange'),
  ).toThrow('选定关联已变化');
  expect(() => removeReferences(form, admin, [key], 'research')).toThrow(
    '选定关联已变化',
  );
  expect(() => removeReferences(form, employee, [key], 'exchange')).toThrow();
  expect(() =>
    removeReferences({ ...form, status: '已发布' }, admin, [key], 'exchange'),
  ).toThrow();
  expect(form).toEqual(before);
  const result = removeReferences(form, admin, [key], 'exchange');
  expect(result.sources![0]!.removed).toBe(true);
  expect(result.body).toEqual(before.body);
  expect(result.attachments).toEqual(before.attachments);
  expect(result.sources![0]!.selection).toEqual(before.sources![0]!.selection);
  expect(() => removeReferences(result, admin, [key], 'exchange')).toThrow();
  expect(form).toEqual(before);
});

it('多条有效关联一起标记移除，未选关系保留且保存后可追溯', () => {
  let form = imported();
  for (const record of candidates('exchange', admin, data).slice(1, 3)) {
    form = applyImport(
      form,
      admin,
      { record, actions: {}, copyFiles: false, confirmedFiles: false },
      data,
    );
  }
  expect(form.sources!.length).toBeGreaterThanOrEqual(3);
  const all: Knowledge[] = [];
  saveKnowledge(all, admin, form, false);
  const keys = all[0]!.sources!.slice(0, 2).map((s) => s.key);
  const next = removeReferences(all[0]!, admin, keys, 'exchange');
  expect(next.sources!.filter((s) => s.removed)).toHaveLength(2);
  expect(next.sources!.filter((s) => !s.removed)).toHaveLength(1);
  expect(all[0]!.sources!.every((s) => !s.removed)).toBe(true);
  saveKnowledge(all, admin, next, false);
  expect(all[0]!.sources!.filter((s) => s.removed).map((s) => s.key)).toEqual(
    keys,
  );
  expect(all[0]!.body).toEqual(form.body);
});

it('竞赛更正会签未完成沿用旧知识来源及证书，全部通过才切换版本', () => {
  const competition = data.competition;
  const activity = competition.activities.find(
    (a) => a.id === 'demo-workflow-published',
  )!;
  const publication = copy(currentPublication(activity)!);
  const winner = publication.winners[0]!;
  const source = selection('competition', activity.id, winner.id);
  const before = resolveSource(source, admin, data);
  const manager = competitionPerson('manager');
  const leader = competitionPerson('employee-c');
  beginResultCorrection(competition, manager, activity.id, '修正奖项');
  saveResults(
    competition,
    manager,
    activity.id,
    competition.entries
      .filter((e) => e.activityId === activity.id)
      .map((e) => ({
        entryId: e.id,
        award: e.id === winner.id ? '三等奖' : e.award,
        reason: '更正确认依据',
      })),
    '更正后公示',
    '完整公示正文',
    '',
    [leader.id, 'expert-b'],
  );
  const round = submitPublicationApproval(competition, manager, activity.id);
  decidePublicationApproval(
    competition,
    leader,
    activity.id,
    round,
    '同意',
    '',
  );
  expect(resolveSource(source, admin, data)).toEqual(before);
  expect(currentPublication(activity)).toEqual(publication);
  expect(canDownloadCertificate(activity, winner, leader)).toBe(false);
  decidePublicationApproval(
    competition,
    competitionPerson('expert-b'),
    activity.id,
    round,
    '同意',
    '',
  );
  const after = resolveSource(source, admin, data);
  expect(after.state).toBe('ok');
  if (after.state === 'ok')
    expect(after.record.version).toBe(String(publication.version + 1));
  expect(
    currentPublication(activity)?.winners.find((w) => w.id === winner.id)
      ?.award,
  ).toBe('三等奖');
  expect(activity.publications![0]).toEqual(publication);
});
