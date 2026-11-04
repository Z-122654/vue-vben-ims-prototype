import type { Topic } from './model';

import { describe, expect, it } from 'vitest';

import {
  adjustDates,
  canEdit,
  canReview,
  canSeeClosure,
  canView,
  copy,
  deleteProgress,
  freshProgress,
  freshTopic,
  people,
  processTopic,
  removeTopic,
  saveClosure,
  savePlan,
  saveProgress,
  saveTopic,
  states,
  taskAction,
  today,
  validateFiles,
  visibleProgress,
} from './model';
import { seedData } from './seed';
const admin = people[0]!;
const admin2 = people[1]!;
const lead = people[2]!;
const member = people[3]!;
const stranger = people[5]!;
const sample = (state: Topic['status'] = '攻关中') =>
  seedData().find((t) => t.status === state)!;
const closure = {
  goal: '完成目标',
  summary: '已完成实施与验证',
  outcome: '形成方案',
  issues: '',
  results: [],
  files: [],
};
function submit() {
  const t = freshTopic(lead);
  Object.assign(t, {
    name: '测试课题',
    category: '设备治理',
    background: '问题',
    goal: '目标',
    solution: '方案',
    start: '2026-01-01',
    end: '2027-12-31',
  });
  const all: Topic[] = [];
  saveTopic(all, lead, t, true);
  return all[0]!;
}
describe('课题申报和立项', () => {
  it('名称可单独保存，完整提交允许零附件', () => {
    const all: Topic[] = [];
    const t = freshTopic(lead);
    t.name = '仅名称';
    saveTopic(all, lead, t);
    expect(all[0]!.status).toBe('草稿');
    expect(() => saveTopic(all, lead, all[0]!, true)).toThrow('填写');
    expect(submit().files).toEqual([]);
  });
  it('管理员可代填，填报人不随负责人转移', () => {
    const all: Topic[] = [];
    const t = freshTopic(admin);
    t.name = '代填';
    t.leaderId = lead.id;
    t.members.push({ personId: lead.id, duty: '' });
    saveTopic(all, admin, t);
    expect(all[0]!.ownerId).toBe(admin.id);
    expect(all[0]!.leaderId).toBe(lead.id);
  });
  it('员工不能代其他负责人申报', () => {
    const t = freshTopic(lead);
    t.name = '越权';
    t.leaderId = member.id;
    t.members.push({ personId: member.id, duty: '' });
    expect(() => saveTopic([], lead, t)).toThrow('不能代');
  });
  it('管理员不能自审，由其他管理员处理', () => {
    const t = submit();
    t.leaderId = admin.id;
    expect(canReview(t, admin)).toBe(false);
    expect(() => processTopic(t, admin, t.revision, 'approve')).toThrow('回避');
    processTopic(t, admin2, t.revision, 'approve');
    expect(t.status).toBe('攻关中');
    expect(t.approvedAt).toBeTruthy();
  });
  it('退回必填原因，重提保留首次提交与处理历史', () => {
    const t = submit();
    expect(() => processTopic(t, admin, t.revision, 'return')).toThrow('原因');
    const first = t.firstSubmittedAt;
    processTopic(t, admin, t.revision, 'return', '补充方案');
    expect(canEdit(t, lead)).toBe(true);
    saveTopic([t], lead, copy(t), true);
    expect(t.firstSubmittedAt).toBe(first);
    expect(t.history.some((h) => h.note === '补充方案')).toBe(true);
  });
  it('撤回仅本次提交人，历史提交过的草稿不能删除', () => {
    const t = submit();
    expect(() => processTopic(t, admin, t.revision, 'withdraw')).toThrow(
      '提交人',
    );
    processTopic(t, lead, t.revision, 'withdraw');
    expect(t.status).toBe('草稿');
    expect(() => removeTopic([t], lead, t.id, t.revision)).toThrow('从未提交');
  });
  it('过期版本不能覆盖最新处理结果', () => {
    const t = submit();
    const old = copy(t);
    processTopic(t, admin, t.revision, 'approve');
    expect(() => saveTopic([t], lead, old)).toThrow('发生变化');
  });
  it('非法计划时间阻止提交，不产生部分记录', () => {
    const t = freshTopic(lead);
    Object.assign(t, {
      name: '日期测试',
      start: '2026-12-31',
      end: '2026-01-01',
    });
    const all: Topic[] = [];
    expect(() => saveTopic(all, lead, t)).toThrow('不能早于');
    expect(all).toEqual([]);
  });
});
describe('数据访问', () => {
  it('私人草稿仅填报人可见，管理员及预填成员不可见', () => {
    const t = sample('草稿');
    expect(canView(t, lead)).toBe(true);
    expect(canView(t, admin)).toBe(false);
    expect(canView(t, member)).toBe(false);
  });
  it('跨部门成员可看已提交课题，无关同部门员工不可看', () => {
    const t = sample();
    expect(canView(t, member)).toBe(true);
    expect(canView(t, stranger)).toBe(false);
    expect(canView(t, admin)).toBe(true);
  });
  it('进展草稿和结题草稿不向普通获准浏览者公开', () => {
    const t = sample();
    const p = freshProgress(lead);
    p.title = '私有';
    saveProgress(t, lead, t.revision, p);
    expect(visibleProgress(t, admin).some((v) => v.id === p.id)).toBe(false);
    expect(canSeeClosure(t, admin)).toBe(false);
    expect(canSeeClosure(t, lead)).toBe(true);
    expect(t.history.at(-1)!.note).toBe('');
  });
});
describe('团队与任务', () => {
  it('成员不能修改计划，不能执行他人的任务', () => {
    const t = sample();
    expect(() => savePlan(t, member, copy(t))).toThrow('负责人');
    expect(() => taskAction(t, lead, t.revision, t.tasks[1]!.id)).toThrow(
      '责任人',
    );
  });
  it('关联非团队人员或超出总体日期均被阻止', () => {
    const t = sample();
    const f = copy(t);
    f.tasks[1]!.personId = stranger.id;
    expect(() => savePlan(t, lead, f, '调整')).toThrow('来自团队');
    f.tasks[1]!.personId = member.id;
    f.tasks[1]!.end = '2099-12-31';
    expect(() => savePlan(t, lead, f, '调整')).toThrow('总计划');
  });
  it('调整责任人须有原因并保留原计划', () => {
    const t = sample();
    const f = copy(t);
    f.tasks[1]!.personId = lead.id;
    expect(() => savePlan(t, lead, f)).toThrow('变更原因');
    savePlan(t, lead, f, '调整分工');
    expect(t.history.at(-1)!.note).toContain(member.name);
    expect(t.tasks[1]!.personId).toBe(lead.id);
  });
  it('已完成任务不能修改，关联进展任务不能删除', () => {
    const t = sample();
    const f = copy(t);
    f.tasks[0]!.name = '改写';
    expect(() => savePlan(t, lead, f)).toThrow('已完成');
    f.tasks = copy(t.tasks).slice(0, 1);
    expect(() => savePlan(t, lead, f)).toThrow('不能删除');
  });
  it('移除历史成员被阻止，不能通过保存计划伪造完成', () => {
    const t = sample();
    let f = copy(t);
    f.members = f.members.filter((m) => m.personId !== member.id);
    f.tasks[1]!.personId = lead.id;
    expect(() => savePlan(t, lead, f, '变更')).toThrow('历史');
    f = copy(t);
    f.tasks[1]!.status = '已完成';
    expect(() => savePlan(t, lead, f, '变更')).toThrow('任务状态');
  });
  it('任务人工开始完成，记录实际时间；逾期不阻止反馈', () => {
    const t = sample();
    const task = t.tasks[1]!;
    expect(task.end < today()).toBe(true);
    taskAction(t, member, t.revision, task.id);
    expect(task.status).toBe('已完成');
    expect(task.completedAt).toBeTruthy();
    expect(t.status).toBe('攻关中');
  });
  it('调整总计划需要管理员和原因，不得截断任务日期', () => {
    const t = sample();
    expect(() =>
      adjustDates(t, lead, t.revision, t.start, t.end, '调整'),
    ).toThrow('管理员');
    expect(() => adjustDates(t, admin, t.revision, t.start, t.end, '')).toThrow(
      '原因',
    );
    expect(() =>
      adjustDates(t, admin, t.revision, t.start, t.start, '缩短'),
    ).toThrow('总计划');
    const end = t.end;
    adjustDates(t, admin, t.revision, t.start, '2029-12-31', '延期');
    expect(t.history.at(-1)!.note).toContain(end);
  });
});
describe('进展与结题', () => {
  it('成员只能关联本人任务，提交后不改原文', () => {
    const t = sample();
    const p = freshProgress(member);
    Object.assign(p, {
      title: '反馈',
      content: '已验证',
      taskId: t.tasks[0]!.id,
    });
    expect(() => saveProgress(t, member, t.revision, p, true)).toThrow(
      '有权限',
    );
    p.taskId = t.tasks[1]!.id;
    saveProgress(t, member, t.revision, p, true);
    const saved = t.progress.find((v) => v.id === p.id)!;
    expect(saved.submittedAt).toBeTruthy();
    expect(() => saveProgress(t, member, t.revision, saved)).toThrow('草稿');
    expect(() => deleteProgress(t, member, t.revision, p.id)).toThrow('草稿');
  });
  it('更正新增记录保留原文，无需进展审批', () => {
    const t = sample();
    const original = copy(t.progress[0]!);
    const p = freshProgress(member);
    Object.assign(p, {
      title: '更正',
      content: '补充说明',
      correctionId: original.id,
    });
    saveProgress(t, member, t.revision, p, true);
    expect(t.progress[0]).toEqual(original);
    expect(t.progress).toHaveLength(2);
  });
  it('未来日期、无内容提交及非参与人反馈失败', () => {
    const t = sample();
    const p = freshProgress(member);
    p.title = '测试';
    p.date = '2099-12-31';
    expect(() => saveProgress(t, member, t.revision, p, true)).toThrow('日期');
    p.date = today();
    expect(() => saveProgress(t, member, t.revision, p, true)).toThrow(
      '本次内容',
    );
    expect(() => saveProgress(t, stranger, t.revision, p)).toThrow('无权');
  });
  it('零任务与未完成任务不允许结题，保存结题草稿不受此限制', () => {
    const t = sample();
    saveClosure(t, lead, t.revision, closure);
    expect(() => saveClosure(t, lead, t.revision, closure, true)).toThrow(
      '全部完成',
    );
    t.tasks = [];
    expect(() => saveClosure(t, lead, t.revision, closure, true)).toThrow(
      '至少一项',
    );
  });
  it('结题提交锁定计划和进展，退回恢复，审批完成后只读', () => {
    const t = sample();
    taskAction(t, member, t.revision, t.tasks[1]!.id);
    saveClosure(t, lead, t.revision, closure, true);
    expect(t.status).toBe('待结题');
    expect(canSeeClosure(t, admin)).toBe(true);
    expect(() => savePlan(t, lead, copy(t))).toThrow('攻关中');
    expect(() =>
      saveProgress(t, member, t.revision, freshProgress(member)),
    ).toThrow('攻关中');
    processTopic(t, admin, t.revision, 'return', '补充结题说明');
    expect(t.status).toBe('攻关中');
    saveClosure(t, lead, t.revision, closure, true);
    processTopic(t, admin, t.revision, 'approve');
    expect(t.status).toBe('已结题');
    expect(t.closedAt).toBeTruthy();
    expect(() => saveClosure(t, lead, t.revision, closure)).toThrow('攻关中');
  });
  it.each(['待立项', '立项退回', '攻关中', '待结题'] as const)(
    '终止%s保留资料并阻止后续修改',
    (state) => {
      const t = sample(state);
      const tasks = copy(t.tasks);
      processTopic(t, admin, t.revision, 'terminate', '研究条件变化');
      expect(t.status).toBe('已终止');
      expect(t.tasks).toEqual(tasks);
      expect(() => saveClosure(t, lead, t.revision, closure)).toThrow();
      expect(() =>
        saveProgress(t, member, t.revision, freshProgress(member)),
      ).toThrow();
    },
  );
  it('附件选填，拒绝超限或不支持的格式', () => {
    expect(() => validateFiles([])).not.toThrow();
    const f = {
      id: 'f',
      name: '测试.doc',
      size: 32,
      content: 'data:application/msword;base64,dGVzdA==',
      uploader: '测试',
      time: '',
    };
    expect(() => validateFiles([f])).not.toThrow();
    expect(() => validateFiles([{ ...f, name: 'test.exe' }])).toThrow('支持');
    expect(() => validateFiles([{ ...f, size: 2 * 1024 * 1024 }])).toThrow(
      '1 MB',
    );
  });
  it('预置示例覆盖七种状态且无跨课题任务引用', () => {
    const seed = seedData();
    expect(new Set(seed.map((t) => t.status))).toEqual(new Set(states));
    for (const t of seed)
      for (const p of t.progress)
        expect(t.tasks.some((v) => v.id === p.taskId)).toBe(true);
  });
});
