import type { CompetitionData, Entry, History } from './model';

import {
  copy,
  newActivity,
  newEntry,
  normalizeCompetitionData,
  nowText,
  person,
} from './model';
import { addApprovalExamples } from './approval-examples';
import { workflowExamplePack, workflowExamples } from './workflow-examples';

// 全部人物、项目和效益为虚构演示数据。日期相对首次初始化日生成。
export function seedData(): CompetitionData {
  const date = (offset: number) => {
    const day = new Date();
    day.setDate(day.getDate() + offset);
    return new Date(day.getTime() - day.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 10);
  };
  const history = (action: string, actor = '陈嘉宁', note = ''): History => ({
    id: `seed-${action}-${actor}`,
    action,
    actor,
    note,
    at: `${nowText().slice(0, 10)} 09:00:00`,
  });
  const a = {
    ...newActivity(),
    id: 'activity-open',
    publisherId: 'manager',
    publisherName: '陈嘉宁',
    registeredAt: `${date(-7)} 09:00:00`,
    expertIds: ['expert-a', 'expert-b'],
    code: 'CXJS2026001',
    name: '2026 年度岗位五小创新成果评比',
    phone: '020-5550-1001',
    description:
      '立足岗位、解决问题。征集在安全生产、节能降耗、设备可靠性提升等方面具有实际应用价值的五小创新成果。',
    status: '报名中' as const,
    history: [history('创建活动'), history('活动报名中')],
  };
  const b = {
    ...newActivity(),
    id: 'activity-review',
    publisherId: 'manager',
    publisherName: '陈嘉宁',
    registeredAt: `${date(-30)} 09:00:00`,
    reviewStartedAt: `${date(-6)} 09:00:00`,
    expertIds: ['expert-a', 'expert-b'],
    code: 'CXJS2026002',
    name: '设备可靠性提升技术创新竞赛',
    type: '创新竞赛',
    start: date(-30),
    deadline: date(-7),
    reviewStart: date(-6),
    reviewEnd: date(7),
    phone: '020-5550-1002',
    description:
      '围绕设备故障预防、检修工具改进与运维效率提升，展示团队创新实践。',
    status: '评审中' as const,
    history: [history('创建活动'), history('活动评审中')],
  };
  const c = {
    ...newActivity(),
    id: 'activity-published',
    publisherId: 'manager',
    publisherName: '陈嘉宁',
    registeredAt: `${date(-60)} 09:00:00`,
    reviewStartedAt: `${date(-29)} 09:00:00`,
    reviewCompletedAt: `${date(-7)} 09:00:00`,
    code: 'CXJS2026003',
    name: '节能降耗优秀成果评比',
    start: date(-60),
    deadline: date(-30),
    reviewStart: date(-29),
    reviewEnd: date(-7),
    phone: '020-5550-1003',
    description: '聚焦节水、节电和余热利用，推广一线岗位创新成果。',
    status: '已公示' as const,
    noticeTitle: '节能降耗优秀成果评比获奖结果公示',
    noticeBody:
      '经专家独立评审和线下评议，现将确认的获奖名单予以公示。如有异议，请联系活动组织单位。',
    noticeDate: nowText().slice(0, 10),
    publishedAt: nowText(),
    history: [history('活动已公示')],
  };
  const d = {
    ...newActivity(),
    id: 'activity-draft',
    code: 'CXJS2026004',
    name: '运行优化合理化建议征集',
    phone: '020-5550-1004',
    description: '征集岗位优化与管理改进建议。',
    history: [history('创建活动')],
  };
  const hiddenShowcase = {
    ...c,
    id: 'activity-hidden-showcase',
    expertIds: ['expert-a'],
    code: 'CXJS2026005',
    name: '设备维护创新成果评比（不展示参赛作品示例）',
    showcase: false,
    description:
      '本活动关闭参赛作品展示，获奖结果仍按流程发布公示。用于对比参赛作品浏览与结果公示的区别。',
    noticeTitle: '设备维护创新成果评比获奖结果公示',
    noticeBody:
      '经专家独立评审和线下评议，现公布获奖名单。本活动不开放参赛作品集中展示，获奖结果正常公示。所有内容均为虚构演示数据。',
    history: [history('创建活动'), history('活动已公示')],
  };
  const descriptions = [
    ['循环水泵就地巡检标识优化', '五小成果'],
    ['便携式阀门定位辅助工具', '青年创新创效项目'],
    ['凝结水回收管线优化', '生产制造'],
    ['设备点检记录标准化建议', '管理创新'],
    ['风机轴承在线测温支架改进', '科技研发'],
    ['检修专用快速定位工装', '五小成果'],
    ['照明分区节能控制优化', '青年创新创效项目'],
    ['循环冷却水分级调节方案', '生产制造'],
    ['检修工器具分类定位改进', '管理创新'],
  ];
  const entries: Entry[] = descriptions.map(([name, category], i) => {
    const activityId =
      i < 4 ? a.id : i < 6 ? b.id : i < 8 ? c.id : hiddenShowcase.id;
    const status =
      i === 0 ? '草稿' : i === 1 ? '待审核' : i === 2 ? '退回修改' : '审核通过';
    const ownerId = i % 2 === 0 ? 'employee-a' : 'employee-b';
    const entry = {
      ...newEntry(activityId, ownerId),
      id: i === 8 ? 'entry-hidden-showcase' : `entry-${i + 1}`,
      code: `ZPSB202600${i + 1}`,
      name: name!,
      category: category!,
      achievements:
        i === 4 ? '已完成内部试用验证，形成装置改进报告（虚构演示）。' : '',
      status,
      phone: '020-5550-2001',
      summary: '针对一线作业中的实际问题，通过小改进提升作业效率和安全性。',
      background:
        '现有作业方式存在操作不便、重复确认次数较多的问题，需要结合现场条件进行优化。',
      solution:
        '开展现场调研，优化结构与布置，经过试用验证后完善操作说明，并组织岗位人员学习。',
      innovation: '采用标准化与便携化设计，充分利用现有资源，降低改造成本。',
      benefit:
        '试用阶段减少重复操作，提升现场作业效率。具体效益以附件中的演示记录为准。',
      submittedAt: i === 0 ? '' : nowText(),
      supplementDeadline: a.deadline,
      history: [history('保存申报', person(ownerId).name)],
    } as Entry;
    entry.attachments = [
      {
        id: `attachment-${i}`,
        name: '申报材料说明.txt',
        size: 160,
        uploadedAt: nowText(),
        uploader: person(ownerId).name,
        public: false,
        content: `data:text/plain;charset=utf-8,${encodeURIComponent(`${name}\n\n本文件为原型演示材料。\n实施方案：${entry.solution}\n应用效果：${entry.benefit}`)}`,
      },
    ];
    if (i > 0) entry.history.push(history('提交申报', person(ownerId).name));
    if (status === '退回修改')
      entry.history.push(
        history('退回补充', '陈嘉宁', '请补充实施前后对比图片及效益说明。'),
      );
    if (status === '审核通过')
      entry.history.push(
        history('材料审核通过', '陈嘉宁', '材料齐全，符合参赛要求。'),
      );
    if (i >= 6) {
      entry.award = i === 6 ? '一等奖' : '二等奖';
      entry.awardReason = '依据线下评议确认名单登记。';
    }
    return entry;
  });
  const examples = workflowExamples();
  const data = normalizeCompetitionData({
    version: 1,
    activities: [a, b, c, d, hiddenShowcase],
    entries,
    reviews: [
      {
        id: 'review-1',
        entryId: 'entry-5',
        expertId: 'expert-a',
        status: '待评审',
        scores: {},
        comment: '',
        submittedAt: '',
        history: [],
      },
      {
        id: 'review-2',
        entryId: 'entry-5',
        expertId: 'expert-b',
        status: '已提交',
        scores: { innovation: 26, practice: 27, safety: 18, benefit: 17 },
        comment: '方案适用性较好，建议补充长期使用效果跟踪。',
        submittedAt: nowText(),
        history: [history('提交评审', '顾言')],
      },
      {
        id: 'review-3',
        entryId: 'entry-6',
        expertId: 'expert-a',
        status: '评分暂存',
        scores: { innovation: 25, practice: 26 },
        comment: '定位设计简洁，具备现场应用价值。',
        submittedAt: '',
        history: [history('暂存评分', '沈明')],
      },
      {
        id: 'review-hidden-showcase',
        entryId: 'entry-hidden-showcase',
        expertId: 'expert-a',
        status: '已提交',
        scores: { innovation: 25, practice: 26, safety: 18, benefit: 17 },
        comment: '分类定位方案有助于减少取用时间，建议持续跟踪应用效果。',
        submittedAt: nowText(),
        history: [history('提交评审', '沈明')],
      },
    ],
  });
  return addApprovalExamples(
    normalizeCompetitionData({
      ...data,
      activities: [...data.activities, ...examples.activities],
      entries: [...data.entries, ...examples.entries],
      reviews: [...data.reviews, ...examples.reviews],
      demoPacks: [workflowExamplePack],
    }),
  );
}

// 已有浏览器仅补充新示例，保留其原记录、附件及评分；重复加载不覆盖示例上的后续操作。
export function withActivityPublishers(
  data: CompetitionData,
  initial: CompetitionData,
): CompetitionData {
  return {
    ...data,
    activities: data.activities.map((activity) => {
      if (activity.publisherId || activity.status === '草稿') return activity;
      // 发布历史存在但无法识别时，不以预置人覆盖实际操作证据。
      if (activity.history.some((h) => h.action === '活动报名中'))
        return activity;
      // 草稿直接取消的活动从未发布，不能补造发布人。
      if (activity.status === '已取消' && !activity.registeredAt)
        return activity;
      const preset = initial.activities.find((a) => a.id === activity.id);
      return preset?.publisherId
        ? {
            ...activity,
            publisherId: preset.publisherId,
            publisherName: preset.publisherName,
          }
        : activity;
    }),
  };
}

export function withHiddenShowcaseExample(
  data: CompetitionData,
  initial: CompetitionData,
): CompetitionData {
  const id = 'activity-hidden-showcase';
  if (data.activities.some((activity) => activity.id === id)) return data;
  const activities = initial.activities.filter(
    (activity) => activity.id === id,
  );
  const entries = initial.entries.filter((entry) => entry.activityId === id);
  const reviews = initial.reviews.filter((review) =>
    entries.some((entry) => entry.id === review.entryId),
  );
  return {
    ...data,
    activities: [...data.activities, ...copy(activities)],
    entries: [...data.entries, ...copy(entries)],
    reviews: [...data.reviews, ...copy(reviews)],
  };
}
