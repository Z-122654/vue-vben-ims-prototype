import type { Topic } from './model';

import { copy, freshTopic, people, states } from './model';
export function seedData(): Topic[] {
  const date = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString('sv-SE');
  };
  return states.map((status, i) => {
    const a = people[2]!;
    const t = freshTopic(a);
    t.id = `research-demo-${i}`;
    t.code = `KT2026${String(i + 1).padStart(3, '0')}`;
    t.name = [
      '循环水泵节能优化研究',
      '输煤系统堵煤治理',
      '设备点检标准化改进',
      '风机轴承可靠性提升',
      '凝汽器清洁技术攻关',
      '排水沟防堵装置改进',
      '旧设备监测方案',
    ][i]!;
    Object.assign(t, {
      status,
      category: '设备治理',
      start: date(-14),
      end: date(i === 3 ? -1 : 30),
      background: '针对现场设备运行中发现的问题，组织跨专业团队开展技术攻关。',
      goal: '降低重复故障，提高运行可靠性，形成可复用的实施方案。',
      solution: '分析故障记录，进行方案验证，完成现场试用与效果评价。',
      expected: '实施方案和试验报告',
      revision: 1,
      updatedAt: `${date(-1)} 09:00:00`,
    });
    t.members = [
      { personId: 'lin', duty: '组织协调与方案验证' },
      { personId: 'zhou', duty: '现场检修与实施' },
      { personId: 'shen', duty: '技术分析' },
    ];
    t.tasks = [
      {
        id: `task-${i}-1`,
        name: '现场调研与原因分析',
        personId: 'lin',
        start: date(-14),
        end: date(-7),
        description: '梳理典型问题并制定验证方案',
        status: '已完成',
        startedAt: `${date(-14)} 09:00:00`,
        completedAt: `${date(-7)} 16:00:00`,
      },
      {
        id: `task-${i}-2`,
        name: '实施验证与效果评价',
        personId: 'zhou',
        start: date(-6),
        end: t.end,
        description: '实施小范围试用并反馈效果',
        status: '进行中',
        startedAt: `${date(-6)} 09:00:00`,
        completedAt: '',
      },
    ];
    if (['待立项', '立项退回', '草稿'].includes(status)) t.tasks = [];
    t.history = [
      {
        id: `h-${i}`,
        action: '保存申报',
        personId: 'lin',
        time: `${date(-20)} 09:00:00`,
        note: '虚构演示数据',
      },
    ];
    if (status !== '草稿') {
      t.firstSubmittedAt = t.submittedAt = `${date(-18)} 09:00:00`;
      t.history.push({
        id: `h-submit-${i}`,
        action: '提交立项',
        personId: 'lin',
        time: t.submittedAt,
        note: '',
      });
    }
    if (status === '立项退回')
      t.history.push({
        id: `h-return-${i}`,
        action: '立项退回',
        personId: 'manager',
        time: `${date(-17)} 09:00:00`,
        note: '请补充方案的验证方式。',
      });
    if (['已终止', '已结题', '待结题', '攻关中'].includes(status)) {
      t.approvedAt = `${date(-15)} 10:00:00`;
      t.history.push({
        id: `h-approve-${i}`,
        action: '立项通过',
        personId: 'manager',
        time: t.approvedAt,
        note: '',
      });
      t.progress = [
        {
          id: `p-${i}`,
          ownerId: 'zhou',
          title: '现场试验进展与风险记录',
          kind: '实施进展',
          taskId: `task-${i}-2`,
          date: date(-2),
          content: '已完成现场安装验证，目前运行稳定，将继续观察长期效果。',
          risk: '观察极端工况下的适用性。',
          next: '补充验证记录并形成总结。',
          correctionId: '',
          submittedAt: `${date(-2)} 15:00:00`,
          files: [],
        },
      ];
    }
    if (['已结题', '待结题'].includes(status)) {
      t.tasks = t.tasks.map((v) => ({
        ...v,
        status: '已完成',
        completedAt: `${date(-2)} 16:00:00`,
      }));
      t.closure = {
        goal: '已完成预定验证目标。',
        summary: '完成调研、方案验证和现场试用，效果符合预期。',
        outcome: '形成一套可复用的技术方案。',
        issues: '持续跟踪长期效果。',
        results: [
          {
            id: `r-${i}`,
            name: '技术改进实施方案',
            kind: '方案',
            code: '',
            description: '虚构示例',
          },
        ],
        files: [],
      };
      t.closureSubmittedAt = `${date(-1)} 09:00:00`;
      t.history.push({
        id: `h-close-submit-${i}`,
        action: '申请结题',
        personId: 'lin',
        time: t.closureSubmittedAt,
        note: '',
      });
    }
    if (status === '已结题') {
      t.closedAt = `${date(-1)} 16:00:00`;
      t.history.push({
        id: `h-close-${i}`,
        action: '结题通过',
        personId: 'manager',
        time: t.closedAt,
        note: '完成目标，留档。',
      });
    }
    if (status === '已终止')
      t.history.push({
        id: `h-stop-${i}`,
        action: '终止课题',
        personId: 'manager',
        time: `${date(-1)} 16:00:00`,
        note: '研究条件发生变化，保留已有资料。',
      });
    return copy(t);
  });
}
