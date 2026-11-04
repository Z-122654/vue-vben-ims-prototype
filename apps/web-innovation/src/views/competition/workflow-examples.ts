import type {
  Activity,
  ActivityStatus,
  CompetitionData,
  Entry,
  EntryStatus,
  History,
  Review,
} from './model';

import {
  copy,
  newActivity,
  newEntry,
  normalizeCompetitionData,
  person,
} from './model';

export const workflowExamplePack = 'workflow-states-20261027-v1';
const prefix = 'demo-workflow-';

// 仅使用虚构项目和人员。整组日期在首次安装时固定，刷新不把逾期数据重新延期。
export function workflowExamples(): CompetitionData {
  const date = (offset: number) => {
    const day = new Date();
    day.setDate(day.getDate() + offset);
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  };
  const at = (offset: number) => `${date(offset)} 09:00:00`;
  const activities: Activity[] = [];
  const entries: Entry[] = [];
  const reviews: Review[] = [];
  const event = (
    id: string,
    action: string,
    offset: number,
    actor: string,
    note = '',
  ): History => ({
    id,
    action,
    at: at(offset),
    actor: person(actor).name,
    note,
  });
  function activity(
    key: string,
    name: string,
    status: ActivityStatus,
    options: Partial<Activity> = {},
  ) {
    const id = `${prefix}${key}`;
    const reviewStage = [
      '已公示',
      '已取消',
      '已结束',
      '待公示',
      '评审中',
    ].includes(status);
    const completed = ['已公示', '已结束', '待公示'].includes(status);
    const published = ['已公示', '已结束'].includes(status);
    const item: Activity = {
      ...newActivity(),
      id,
      code: `CXJS-DEMO-${String(activities.length + 1).padStart(3, '0')}`,
      name,
      status,
      phone: '020-5550-3000',
      description: `${name}。用于演示对应业务阶段的表单、材料、权限和操作，全部项目与效益均为虚构。`,
      expertIds: ['expert-a', 'expert-b'],
      registeredAt: status === '草稿' ? '' : at(-40),
      deadline: date(reviewStage ? -15 : 7),
      reviewStartedAt: reviewStage ? at(-14) : '',
      reviewEnd: date(completed ? -7 : 14),
      reviewCompletedAt: completed ? at(-7) : '',
      publishedAt: published ? at(-5) : '',
      noticeDate: published ? date(-5) : '',
      endedAt: status === '已结束' ? at(-1) : '',
      noticeTitle: completed ? `${name}获奖结果公示` : '',
      noticeBody: completed
        ? '经专家独立评审及线下评议，按确认名单登记获奖结果。相关项目均为虚构演示资料；如有异议，请联系组织单位。'
        : '',
      ...options,
    };
    const admin =
      item.department === '运行部' ? 'manager-operation' : 'manager';
    if (item.registeredAt) {
      item.publisherId = admin;
      item.publisherName = person(admin).name;
    }
    item.history = [event(`${id}-create`, '创建活动', -45, admin)];
    if (item.registeredAt)
      item.history.push(event(`${id}-open`, '活动报名中', -40, admin));
    if (reviewStage)
      item.history.push(event(`${id}-review`, '活动评审中', -14, admin));
    if (completed)
      item.history.push(event(`${id}-complete`, '活动待公示', -7, admin));
    if (published)
      item.history.push(event(`${id}-publish`, '活动已公示', -5, admin));
    if (status === '已结束')
      item.history.push(event(`${id}-end`, '活动已结束', -1, admin));
    if (status === '已取消')
      item.history.push(
        event(
          `${id}-cancel`,
          '活动已取消',
          -2,
          admin,
          '演示：组织安排调整，本次活动停止评审，材料及任务历史保留。',
        ),
      );
    activities.push(item);
    return item;
  }
  function entry(
    a: Activity,
    key: string,
    name: string,
    status: EntryStatus,
    ownerId = 'employee-a',
    options: Partial<Entry> = {},
  ) {
    const id = `${prefix}entry-${key}`;
    const offset = a.status === '报名中' ? -5 : -25;
    const item: Entry = {
      ...newEntry(a.id, ownerId),
      id,
      code: `ZPSB-DEMO-${String(entries.length + 1).padStart(3, '0')}`,
      name,
      status,
      category: '五小成果',
      summary: `${name}：针对现场重复操作和定位不便的问题，采用可复用标识、结构优化与标准化流程，提升操作便利性。已完成模拟验证，详细说明见附件。本记录为虚构演示资料。`,
      achievements:
        status === '审核通过'
          ? '形成内部试用报告和操作说明（虚构演示，无真实专利编号）。'
          : '',
      submittedAt: status === '草稿' ? '' : at(offset),
      supplementDeadline: ['已终止', '退回修改'].includes(status)
        ? date(3)
        : '',
      ...options,
    };
    const content = `${name}\n\n本附件为虚构原型材料。\n项目简介：${item.summary}\n已有成果：${item.achievements || '暂无'}\n本材料仅用于功能演示。`;
    item.attachments = [
      {
        id: `${id}-material`,
        name: `${name}-申报说明.txt`,
        size: new TextEncoder().encode(content).length,
        content: `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`,
        uploadedAt: at(offset - 1),
        uploader: person(ownerId).name,
        public: false,
      },
    ];
    if (status === '审核通过') {
      const introduction = `${name}\n公开展示摘要：${item.summary}`;
      item.attachments.push({
        id: `${id}-public`,
        name: `${name}-公开摘要.txt`,
        size: new TextEncoder().encode(introduction).length,
        content: `data:text/plain;charset=utf-8,${encodeURIComponent(introduction)}`,
        uploadedAt: at(offset - 1),
        uploader: person(ownerId).name,
        public: true,
      });
    }
    item.history = [event(`${id}-save`, '保存申报', offset - 1, ownerId)];
    if (status !== '草稿')
      item.history.push(event(`${id}-submit`, '提交申报', offset, ownerId));
    if (status === '审核通过')
      item.history.push(
        event(
          `${id}-audit`,
          '材料审核通过',
          offset + 1,
          'manager',
          '材料齐全，符合本次活动要求。',
        ),
      );
    if (['已终止', '退回修改'].includes(status))
      item.history.push(
        event(
          `${id}-return`,
          '退回补充',
          offset + 1,
          'manager',
          '请补充实施前后对比及现场应用说明。',
        ),
      );
    if (status === '已撤回')
      item.history.push(
        event(
          `${id}-withdraw`,
          '撤回申报',
          offset + 2,
          ownerId,
          '演示：申报人补充资料后重新提交。',
        ),
      );
    if (status === '已终止')
      item.history.push(
        event(
          `${id}-terminate`,
          '终止申报',
          offset + 3,
          'manager',
          '演示：申报人确认不再补交，保留历史材料，不纳入评审。',
        ),
      );
    entries.push(item);
    return item;
  }
  function review(
    e: Entry,
    expertId: string,
    status: Review['status'],
    offset = -3,
  ) {
    const id = `${e.id}-${expertId}`;
    reviews.push({
      id,
      entryId: e.id,
      expertId,
      status,
      scores:
        status === '待评审'
          ? {}
          : status === '评分暂存'
            ? { innovation: 25, practice: 26 }
            : { innovation: 26, practice: 27, safety: 18, benefit: 17 },
      comment:
        status === '待评审'
          ? ''
          : '方案具有现场应用价值，建议跟踪使用效果并完善推广说明（演示意见）。',
      submittedAt: status === '已提交' ? at(offset) : '',
      history:
        status === '待评审'
          ? []
          : [
              event(
                `${id}-score`,
                status === '已提交' ? '提交评审' : '暂存评分',
                offset,
                expertId,
              ),
            ],
    });
  }
  activity('draft', '运行部岗位改进征集（草稿示例）', '草稿', {
    department: '运行部',
    contact: '赵启航',
    expertIds: [],
    departments: ['运行部'],
  });
  const open = activity(
    'open',
    '现场作业优化征集（报名与补交示例）',
    '报名中',
    { departments: ['运行部', '检修部'] },
  );
  entry(open, 'draft', '巡检点位编码规范（草稿）', '草稿', 'employee-a', {
    leaderId: 'employee-c',
  });
  entry(open, 'pending', '阀门防误操作标识（待审核）', '待审核', 'employee-b');
  entry(open, 'returned', '排水沟防堵改进（补交有效）', '退回修改');
  entry(
    open,
    'expired',
    '备件交接清单优化（补交逾期）',
    '退回修改',
    'employee-a',
    { supplementDeadline: date(-1) },
  );
  entry(
    open,
    'approved',
    '便携式测温定位夹具（审核通过）',
    '审核通过',
    'employee-b',
  );
  entry(open, 'withdrawn', '仪表读数辅助标记（已撤回）', '已撤回');
  entry(open, 'terminated', '检修作业收纳盒改进（已终止）', '已终止');

  const ready = activity(
    'ready',
    '工器具改进竞赛（报名截止待开启）',
    '报名中',
    { deadline: date(-1) },
  );
  entry(ready, 'ready', '绝缘工具定置收纳改进', '审核通过');

  const reviewing = activity(
    'review',
    '设备维护创意竞赛（评审中示例）',
    '评审中',
  );
  const r1 = entry(reviewing, 'review-a', '泵组振动测点标识改进', '审核通过');
  const r2 = entry(
    reviewing,
    'review-b',
    '检修平台快速定位工装',
    '审核通过',
    'employee-b',
  );
  review(r1, 'expert-a', '待评审');
  review(r1, 'expert-b', '已提交');
  review(r2, 'expert-a', '评分暂存');
  review(r2, 'expert-b', '待评审');

  const overdue = activity(
    'overdue',
    '运行节能专题评比（评审逾期示例）',
    '评审中',
    { reviewEnd: date(-1) },
  );
  const late = entry(overdue, 'overdue', '冷却风机分时运行优化', '审核通过');
  review(late, 'expert-a', '评分暂存');
  review(late, 'expert-b', '待评审');

  const resultStages = [
    [
      'pending-result',
      '节水技术改进评比（待公示示例）',
      '待公示',
      '循环水回收监测优化',
      '冲洗水定量控制改进',
    ],
    [
      'published',
      '安全生产创新评比（已公示示例）',
      '已公示',
      '受限空间工器具清点改进',
      '安全围栏连接件优化',
    ],
    [
      'ended',
      '岗位五小成果评比（已结束示例）',
      '已结束',
      '辅助照明节能改造',
      '耗材分类回收改进',
    ],
  ] as const;
  for (const [key, name, status, first, second] of resultStages) {
    const a = activity(key, name, status);
    for (const [i, name] of [first, second].entries()) {
      const e = entry(
        a,
        `${key}-${i}`,
        name,
        '审核通过',
        i === 0 ? 'employee-a' : 'employee-b',
        {
          award: i === 0 ? '一等奖' : '二等奖',
          awardReason: '按线下评议确认名单登记（虚构演示）。',
        },
      );
      review(e, 'expert-a', '已提交', -9);
      review(e, 'expert-b', '已提交', -8);
      e.history.push(
        event(`${e.id}-award`, '登记获奖结果', -6, 'manager', e.awardReason),
      );
    }
  }
  const cancelled = activity(
    'cancelled',
    '辅助设备创新竞赛（已取消示例）',
    '已取消',
  );
  const c1 = entry(cancelled, 'cancelled-a', '电缆盘搬运辅助装置', '审核通过');
  const c2 = entry(
    cancelled,
    'cancelled-b',
    '现场指示牌快装支架',
    '审核通过',
    'employee-b',
  );
  for (const e of [c1, c2]) {
    review(e, 'expert-a', '评分暂存');
    review(e, 'expert-b', '已提交');
  }
  return normalizeCompetitionData({ version: 1, activities, entries, reviews });
}

// 按整组活动安装一次；不覆盖用户修改，不重新生成已删除的草稿或补写已操作的子记录。
export function withWorkflowExamples(
  data: CompetitionData,
  initial: CompetitionData,
): CompetitionData {
  if (data.demoPacks?.includes(workflowExamplePack)) return data;
  const added = initial.activities.filter(
    (a) =>
      a.id.startsWith(prefix) &&
      !data.activities.some((existing) => existing.id === a.id),
  );
  const addedEntries = initial.entries.filter((e) =>
    added.some((a) => a.id === e.activityId),
  );
  const addedReviews = initial.reviews.filter((r) =>
    addedEntries.some((e) => e.id === r.entryId),
  );
  return {
    ...data,
    activities: [...data.activities, ...copy(added)],
    entries: [...data.entries, ...copy(addedEntries)],
    reviews: [...data.reviews, ...copy(addedReviews)],
    demoPacks: [...(data.demoPacks ?? []), workflowExamplePack],
  };
}
