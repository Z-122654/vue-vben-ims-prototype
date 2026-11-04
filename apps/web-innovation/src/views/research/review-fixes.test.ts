import type { Topic } from './model';

import { describe, expect, it } from 'vitest';

import { syncProgress } from './editor';
import {
  adjustDates,
  canSeeClosure,
  copy,
  deleteProgress,
  freshProgress,
  freshTopic,
  people,
  processTopic,
  saveClosure,
  savePlan,
  saveProgress,
  saveTopic,
  topicForViewer,
  ValidationError,
  validDate,
  visibleHistory,
} from './model';
import { seedData } from './seed';

const admin = people[0]!;
const lead = people[2]!;
const member = people[3]!;
const sample = (status: Topic['status'] = '攻关中') =>
  seedData().find((t) => t.status === status)!;
const file = {
  id: 'private',
  name: '私有.docx',
  size: 1,
  content: 'data:text/plain;base64,YQ==',
  uploader: '测试',
  time: '',
};
function fieldFailure(fn: () => void, field: string) {
  try {
    fn();
    throw new Error('校验未阻止操作');
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).field).toBe(field);
  }
}

describe('复核：草稿隐私和局部刷新', () => {
  it.each(['return', 'withdraw'] as const)(
    '结题%s后的新正文及附件仅负责人可见，重提才更新正式版',
    (action) => {
      const t = sample('待结题');
      const published = copy(t.closure);
      processTopic(
        t,
        action === 'return' ? admin : lead,
        t.revision,
        action,
        '补充',
      );
      const draft = {
        ...copy(t.closure),
        summary: '尚未提交的总结',
        files: [file],
      };
      saveClosure(t, lead, t.revision, draft);
      for (const viewer of [admin, member]) {
        expect(canSeeClosure(t, viewer)).toBe(true);
        expect(topicForViewer(t, viewer).closure).toEqual(published);
      }
      expect(topicForViewer(t, lead).closure).toEqual(draft);
      saveClosure(t, lead, t.revision, draft, true);
      draft.summary = '外部引用变化';
      expect(topicForViewer(t, member).closure.summary).toBe('尚未提交的总结');
      expect(topicForViewer(t, member).closure.files).toEqual([file]);
    },
  );
  it('旧退回资料无正式快照时不猜测，原草稿与历史保留，重新提交后可见', () => {
    const t = sample();
    t.closureSubmittedAt = '2026-01-01 10:00:00';
    t.closure.summary = '旧混合草稿';
    const before = copy(t);
    expect(canSeeClosure(t, admin)).toBe(false);
    expect(topicForViewer(t, member).closure.summary).toBe('');
    expect(topicForViewer(t, lead).closure.summary).toBe('旧混合草稿');
    expect(t).toEqual(before);
  });
  it('终止退回后的课题仍不公开新草稿，旧已结题资料继续可读', () => {
    const t = sample('待结题');
    const original = copy(t.closure);
    processTopic(t, admin, t.revision, 'return', '补充');
    saveClosure(t, lead, t.revision, { ...t.closure, summary: '私有' });
    processTopic(t, admin, t.revision, 'terminate', '终止');
    expect(topicForViewer(t, member).closure).toEqual(original);
    expect(
      topicForViewer(sample('已结题'), admin).closure.summary,
    ).toBeTruthy();
  });
  it('删除草稿不通过流程历史泄露标题，历史旧记录也不展示私有标题', () => {
    const t = sample();
    const p = {
      ...freshProgress(lead),
      title: '私有标题',
      content: '私有内容',
      files: [file],
    };
    saveProgress(t, lead, t.revision, p);
    deleteProgress(t, lead, t.revision, p.id);
    expect(JSON.stringify(t.history)).not.toContain('私有');
    t.history.at(-1)!.note = '旧版泄露标题';
    expect(JSON.stringify(visibleHistory(t))).not.toContain('旧版泄露标题');
    expect(t.history.at(-1)!.note).toBe('旧版泄露标题');
  });
  it('删除进展仅更新对应数据，保留跨页签未保存编辑和正在读取的附件引用', () => {
    const t = sample();
    const p = { ...freshProgress(lead), title: '待删草稿' };
    saveProgress(t, lead, t.revision, p);
    const baseline = copy(t);
    const form = copy(t);
    form.closure.summary = '未保存结题';
    form.members[1]!.duty = '未保存职责';
    form.tasks[1]!.description = '未保存计划';
    const readingFiles = form.closure.files;
    deleteProgress(t, lead, t.revision, p.id);
    syncProgress(form, baseline, t);
    expect(form.closure.files).toBe(readingFiles);
    readingFiles.push(file);
    expect(form.closure.files).toEqual([file]);
    expect(form.closure.summary).toBe('未保存结题');
    expect(form.members[1]!.duty).toBe('未保存职责');
    expect(form.tasks[1]!.description).toBe('未保存计划');
    expect(form.progress.some((v) => v.id === p.id)).toBe(false);
    expect(form.revision).toBe(t.revision);
    expect(baseline.closure.summary).toBe('');
    expect(JSON.stringify(form)).not.toBe(JSON.stringify(baseline));
    saveClosure(t, lead, form.revision, form.closure);
    expect(t.closure.summary).toBe('未保存结题');
  });
  it('过期表单不能借删除草稿绕过版本校验', () => {
    const t = sample();
    const p = { ...freshProgress(lead), title: '草稿' };
    saveProgress(t, lead, t.revision, p);
    const rev = t.revision;
    saveClosure(t, lead, rev, t.closure);
    expect(() => deleteProgress(t, lead, rev, p.id)).toThrow('发生变化');
    expect(t.progress.some((v) => v.id === p.id)).toBe(true);
  });
});

describe('复核：日期与字段定位', () => {
  it.each(['2026-02-31', '2026-02-29', '2026-04-31', '2026-13-01', 'x', null])(
    '拒绝无效日历值 %s',
    (value) => {
      expect(validDate(value)).toBe(false);
    },
  );
  it('接受闰年及正常月末', () => {
    expect(validDate('2024-02-29')).toBe(true);
    expect(validDate('2026-04-30')).toBe(true);
  });
  it('datePicker 清空后可保存无任务草稿，提交定位日期，失败不部分保存', () => {
    const t = freshTopic(lead);
    Object.assign(t, {
      name: '日期',
      category: '设备治理',
      background: '背景',
      goal: '目标',
      solution: '方案',
      start: null,
      end: null,
    });
    const all: Topic[] = [];
    saveTopic(all, lead, t);
    expect(all[0]!.start).toBe('');
    expect(all[0]!.end).toBe('');
    const before = copy(all);
    fieldFailure(() => saveTopic(all, lead, all[0]!, true), 'start');
    expect(all).toEqual(before);
  });
  it('单独填写的非法日期也不能保存草稿', () => {
    const t = freshTopic(lead);
    t.name = '日期';
    t.start = '2026-02-31';
    const all: Topic[] = [];
    fieldFailure(() => saveTopic(all, lead, t), 'start');
    expect(all).toEqual([]);
  });
  it('任务行、管理员总计划、进展反馈均校验日历并标识字段', () => {
    const t = sample();
    const f = copy(t);
    f.tasks[1]!.end = '2026-02-31';
    fieldFailure(() => savePlan(t, lead, f, '调整'), 'tasks.1.end');
    fieldFailure(
      () => adjustDates(t, admin, t.revision, '2026-02-31', t.end, '调整'),
      'action.start',
    );
    const p = { ...freshProgress(member), title: '进展', date: '2026-02-31' };
    fieldFailure(() => saveProgress(t, member, t.revision, p), 'date');
    Object.assign(p, { date: null });
    saveProgress(t, member, t.revision, p);
    expect(t.progress.at(-1)!.date).toBe('');
    fieldFailure(() => saveProgress(t, member, t.revision, p, true), 'date');
  });
  it('主表必填、任务责任人、结题正文和成果行返回准确位置', () => {
    const t = freshTopic(lead);
    fieldFailure(() => saveTopic([], lead, t), 'name');
    t.name = '名称';
    fieldFailure(() => saveTopic([], lead, t, true), 'category');
    const ongoing = sample();
    const f = copy(ongoing);
    f.tasks[1]!.personId = '';
    fieldFailure(() => savePlan(ongoing, lead, f), 'tasks.1.personId');
    ongoing.tasks.forEach((v) => (v.status = '已完成'));
    fieldFailure(
      () => saveClosure(ongoing, lead, ongoing.revision, ongoing.closure, true),
      'closure.goal',
    );
    const c = copy(ongoing.closure);
    c.results.push({
      id: 'r',
      name: '',
      kind: '方案',
      code: '',
      description: '',
    });
    fieldFailure(
      () => saveClosure(ongoing, lead, ongoing.revision, c),
      'closure.results.0.name',
    );
  });
});
