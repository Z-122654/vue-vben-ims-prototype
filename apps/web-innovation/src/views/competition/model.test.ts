import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  auditEntry,
  canEditEntry,
  canSeeEntry,
  changeActivity,
  copy,
  isInternalReader,
  newEntry,
  normalizeCompetitionData,
  person,
  projectLeader,
  returnReview,
  saveActivity,
  saveActivityExperts,
  saveEntry,
  saveResults,
  saveReview,
  withdrawEntry,
} from './model';
import { seedData } from './seed';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-20T10:00:00'));
});
const manager = person('manager');
const employee = person('employee-a');
const expert = person('expert-a');

describe('竞赛独立业务流程', () => {
  it('允许同一员工在同一活动提交多件独立作品', () => {
    const data = seedData();
    const template = data.entries[0]!;
    const first = {
      ...copy(template),
      ...newEntry(template.activityId, employee.id),
      name: '作品一',
    };
    saveEntry(data, employee, first);
    saveEntry(data, employee, {
      ...first,
      id: 'another-entry',
      name: '作品二',
    });
    expect(
      data.entries.filter((e) => ['作品一', '作品二'].includes(e.name)),
    ).toHaveLength(2);
  });
  it('完整申报提交后进入管理员审核，不创建部门初审', () => {
    const data = seedData();
    saveEntry(data, employee, copy(data.entries[0]!), true);
    const entry = data.entries.find((e) => e.id === 'entry-1')!;
    expect(entry.status).toBe('待审核');
    auditEntry(data, manager, entry.id, true, '材料完整');
    expect(entry.status).toBe('审核通过');
    expect(entry.history.some((h) => h.action.includes('部门'))).toBe(false);
  });
  it('缺少必填资料仍阻止提交，附件为空可提交并在退回后重提', () => {
    const data = seedData();
    expect(() =>
      saveEntry(
        data,
        employee,
        { ...copy(data.entries[0]!), summary: '' },
        true,
      ),
    ).toThrow('补全');
    const entry = {
      ...copy(data.entries[0]!),
      attachments: [],
      achievements: '',
    };
    saveEntry(data, employee, entry, true);
    const saved = data.entries.find((item) => item.id === entry.id)!;
    expect(saved.status).toBe('待审核');
    expect(saved.attachments).toEqual([]);
    expect(saved.submittedAt).toBeTruthy();
    auditEntry(data, manager, saved.id, false, '补充项目简介', '2026-10-21');
    saveEntry(
      data,
      employee,
      { ...copy(saved), summary: '已补充项目简介' },
      true,
    );
    expect(saved.status).toBe('待审核');
    expect(saved.attachments).toEqual([]);
  });
  it('已提交作品不能直接编辑，撤回后才能修改', () => {
    const data = seedData();
    saveEntry(data, employee, copy(data.entries[0]!), true);
    expect(() => saveEntry(data, employee, copy(data.entries[0]!))).toThrow(
      '不可编辑',
    );
    withdrawEntry(data, employee, 'entry-1');
    saveEntry(data, employee, {
      ...copy(data.entries[0]!),
      name: '修改后的作品',
    });
    expect(data.entries[0]!.name).toBe('修改后的作品');
  });
  it('六项申报不再依赖旧正文、联系方式、团队资料或活动参赛形式', () => {
    const data = seedData();
    data.activities[0]!.participation = '团队';
    const entry = {
      ...newEntry('activity-open', employee.id),
      name: '新项目',
      category: '自定义创新类别',
      summary: '完整内容见申报书',
      attachments: copy(data.entries[0]!.attachments),
    };
    saveEntry(data, employee, entry, true);
    expect(data.entries[0]!.status).toBe('待审核');
    expect(data.entries[0]!.category).toBe('自定义创新类别');
    expect(data.entries[0]!.achievements).toBe('');
  });
  it('草稿仅需所属活动和名称，提交必须具有简介和有效负责人', () => {
    const data = seedData();
    const draft = {
      ...newEntry('activity-open', employee.id),
      name: '草稿项目',
      leaderId: '',
    };
    saveEntry(data, employee, draft);
    expect(data.entries[0]!.status).toBe('草稿');
    for (const changes of [
      { summary: '' },
      { leaderId: '' },
      { leaderId: manager.id },
    ]) {
      expect(() =>
        saveEntry(
          data,
          employee,
          {
            ...copy(data.entries[1]!),
            ...changes,
          },
          true,
        ),
      ).toThrow();
    }
  });
  it.each(['', '   '])(
    '类别选填（%j）：草稿保存、首次提交、撤回及退回重提均不被阻止',
    (category) => {
      const data = seedData();
      const form = {
        ...copy(data.entries[0]!),
        category,
        attachments: [],
        achievements: '',
      };
      saveEntry(data, employee, form);
      expect(data.entries[0]!.category).toBe(category);
      saveEntry(data, employee, form, true);
      const saved = data.entries[0]!;
      expect(saved.status).toBe('待审核');
      withdrawEntry(data, employee, saved.id);
      saveEntry(data, employee, copy(saved), true);
      expect(saved.status).toBe('待审核');
      auditEntry(data, manager, saved.id, false, '补充简介', '2026-10-21');
      saveEntry(
        data,
        employee,
        { ...copy(saved), summary: '已补充简介' },
        true,
      );
      expect(saved.status).toBe('待审核');
      expect(saved.category).toBe(category);
      expect(saved.attachments).toEqual([]);
    },
  );
  it('简介上限1000字，已有成果与竞赛奖项分别保存', () => {
    const data = seedData();
    const entry = {
      ...copy(data.entries[0]!),
      summary: '文'.repeat(1000),
      achievements: '已有成果记录',
    };
    saveEntry(data, employee, entry, true);
    expect(data.entries[0]!.achievements).toBe('已有成果记录');
    expect(data.entries[0]!.award).toBe('');
    withdrawEntry(data, employee, entry.id);
    expect(() =>
      saveEntry(data, employee, { ...entry, summary: '文'.repeat(1001) }, true),
    ).toThrow('1000');
  });
  it('同部门代填显示负责人，编辑及内部访问仍归填报人', () => {
    const data = seedData();
    const entry = { ...copy(data.entries[0]!), leaderId: 'employee-c' };
    saveEntry(data, employee, entry);
    const saved = data.entries[0]!;
    expect(projectLeader(saved).name).toBe('许文清');
    expect(projectLeader(saved).department).toBe('运行部');
    expect(saved.ownerId).toBe(employee.id);
    expect(canEditEntry(data.activities[0]!, saved, employee)).toBe(true);
    expect(canEditEntry(data.activities[0]!, saved, person('employee-c'))).toBe(
      false,
    );
    expect(isInternalReader(data, saved, person('employee-c'))).toBe(false);
    expect(() => withdrawEntry(data, person('employee-c'), saved.id)).toThrow();
  });
  it('报名资格按填报人部门判断，同部门代填不能绕过活动范围', () => {
    const data = seedData();
    data.activities[0]!.departments = [employee.department];
    saveEntry(
      data,
      employee,
      { ...copy(data.entries[0]!), leaderId: 'employee-c' },
      true,
    );
    expect(() =>
      saveEntry(data, person('employee-b'), {
        ...newEntry('activity-open', 'employee-b'),
        leaderId: employee.id,
        name: '代填',
      }),
    ).toThrow('活动中心');
  });
  it('旧记录补齐负责人和成果字段，保留附件、旧类别、历史正文及所有流程数据', () => {
    const legacy = seedData();
    Reflect.deleteProperty(legacy.entries[0]!, 'leaderId');
    Reflect.deleteProperty(legacy.entries[0]!, 'achievements');
    legacy.entries[0]!.category = '小革新';
    const before = copy(legacy);
    const migrated = normalizeCompetitionData(legacy);
    expect(migrated.entries[0]).toEqual({
      ...before.entries[0],
      leaderId: employee.id,
      achievements: '',
    });
    expect(migrated.activities).toEqual(before.activities);
    expect(migrated.reviews).toEqual(before.reviews);
    expect(migrated.entries.slice(1)).toEqual(before.entries.slice(1));
    expect(normalizeCompetitionData(migrated)).toEqual(migrated);
  });
  it('报名截止后仅退回作品可按补交期限重提', () => {
    const data = seedData();
    data.activities[0]!.deadline = '2026-10-19';
    expect(canEditEntry(data.activities[0]!, data.entries[0]!, employee)).toBe(
      false,
    );
    expect(canEditEntry(data.activities[0]!, data.entries[2]!, employee)).toBe(
      true,
    );
    saveEntry(data, employee, copy(data.entries[2]!), true);
    expect(data.entries[2]!.status).toBe('待审核');
  });
  it('开启评审前阻止未处理材料，开启后锁定材料和活动规则', () => {
    const data = seedData();
    data.activities[0]!.deadline = '2026-10-19';
    expect(() =>
      changeActivity(data, manager, 'activity-open', '评审中'),
    ).toThrow('待审核');
    auditEntry(data, manager, 'entry-2', true, '通过');
    saveEntry(data, employee, copy(data.entries[2]!), true);
    auditEntry(data, manager, 'entry-3', true, '通过');
    changeActivity(data, manager, 'activity-open', '评审中');
    expect(canEditEntry(data.activities[0]!, data.entries[0]!, employee)).toBe(
      false,
    );
    expect(() =>
      saveActivity(data, manager, copy(data.activities[0]!)),
    ).toThrow('锁定');
    expect(() => withdrawEntry(data, employee, 'entry-3')).toThrow('报名期');
  });
  it('非管理员不能配置专家，其他专家不能修改别人的评分', () => {
    const data = seedData();
    expect(() =>
      saveActivityExperts(data, employee, 'activity-open', ['expert-a']),
    ).toThrow('仅活动管理员');
    expect(() =>
      saveReview(data, person('expert-b'), 'review-1', {}, '', false),
    ).toThrow('不可评分');
  });
  it('允许暂存部分评分，正式提交必须所有指标有效且有意见', () => {
    const data = seedData();
    saveReview(data, expert, 'review-1', { innovation: 20 }, '', false);
    expect(data.reviews[0]!.status).toBe('评分暂存');
    expect(() =>
      saveReview(data, expert, 'review-1', { innovation: 31 }, '意见', true),
    ).toThrow('创新性');
    const scores = { innovation: 20, practice: 22, safety: 18, benefit: 18 };
    expect(() =>
      saveReview(data, expert, 'review-1', scores, '', true),
    ).toThrow('评审意见');
    saveReview(data, expert, 'review-1', scores, '符合要求', true);
    expect(data.reviews[0]!.scores).toEqual(scores);
    expect(data.reviews[0]).not.toHaveProperty('total');
    expect(data.reviews[0]).not.toHaveProperty('rank');
  });
  it('已提交评分锁定，管理员退回后原专家可以修改', () => {
    const data = seedData();
    const other = person('expert-b');
    expect(() => saveReview(data, other, 'review-2', {}, '', false)).toThrow(
      '不可评分',
    );
    expect(() => returnReview(data, manager, 'review-2', '')).toThrow('原因');
    returnReview(data, manager, 'review-2', '请完善专业点评');
    saveReview(data, other, 'review-2', { innovation: 20 }, '补充意见', false);
    expect(data.reviews[1]!.comment).toBe('补充意见');
  });
  it('未完成评审不允许进入公示；名单手工登记后发布并锁定', () => {
    const data = seedData();
    expect(() =>
      changeActivity(data, manager, 'activity-review', '待公示'),
    ).toThrow('所有评审');
    for (const review of data.reviews.filter(
      (item) =>
        item.status !== '已提交' &&
        data.entries.some(
          (entry) =>
            entry.id === item.entryId && entry.activityId === 'activity-review',
        ),
    ))
      saveReview(
        data,
        person(review.expertId),
        review.id,
        { innovation: 25, practice: 26, safety: 18, benefit: 17 },
        '建议认可',
        true,
      );
    changeActivity(data, manager, 'activity-review', '待公示');
    expect(() =>
      changeActivity(data, manager, 'activity-review', '已公示'),
    ).toThrow('公示标题和正文');
    saveResults(
      data,
      manager,
      'activity-review',
      [{ entryId: 'entry-5', award: '一等奖', reason: '线下确认纪要' }],
      '获奖结果公示',
      '公示正文',
      '2026-10-20',
    );
    changeActivity(data, manager, 'activity-review', '已公示');
    expect(data.entries.find((e) => e.id === 'entry-5')!.award).toBe('一等奖');
    expect(() =>
      saveResults(data, manager, 'activity-review', [], '', '', ''),
    ).toThrow('待公示');
  });
  it('普通浏览者只能看公开作品，不能读取内部申报材料', () => {
    const data = seedData();
    expect(canSeeEntry(data, data.entries[0]!, person('employee-b'))).toBe(
      false,
    );
    expect(canSeeEntry(data, data.entries[4]!, person('employee-b'))).toBe(
      true,
    );
    expect(isInternalReader(data, data.entries[4]!, person('employee-b'))).toBe(
      false,
    );
    expect(isInternalReader(data, data.entries[4]!, expert)).toBe(true);
  });
});
