import type { Knowledge } from './model';

import { freshKnowledge, people, saveKnowledge, takeDown } from './model';
export function seedData(): Knowledge[] {
  const all: Knowledge[] = [];
  const examples = [
    [
      '循环水泵巡检定位标识优化',
      '成果',
      '运行',
      '统一设备标识，便于现场巡检定位。',
    ],
    [
      '风机振动异常排查案例',
      '案例',
      '检修',
      '介绍测点复核、基础紧固和对中检查的排查方法。',
    ],
    [
      '交接班记录填写指南',
      '文档',
      '综合技术',
      '手工登记的历史技术指南，提供正文查阅。',
    ],
    ['温度测点维护经验（草稿）', '案例', '热控', '正在整理，尚未向员工发布。'],
    [
      '检修工装使用说明（已下架）',
      '文档',
      '检修',
      '内容待修订，暂时停止展示。',
    ],
    ['节水运行调整成果', '成果', '安全环保', '结合现场记录总结节水操作要点。'],
  ];
  examples.forEach(([title, type, category, summary], i) => {
    const f = freshKnowledge(people[i % 2]!);
    Object.assign(f, {
      id: `knowledge-demo-${i + 1}`,
      code: `ZS202600${i + 1}`,
      title,
      type,
      category,
      summary,
      keywords: i === 1 ? '振动 排查' : '技术 经验',
      originalAuthor: i % 2 ? '周亦安' : '林知远',
      originalDepartment: i % 2 ? '检修部' : '运行部',
      body: `本条资料为虚构原型演示。${summary}\n整理步骤：核实现场现象、记录处理过程、复核实际结果。资料仅用于交流参考，具体操作按现场规程执行。`,
      scenario: '现场经验查阅与技术交流',
    });
    if (type === '成果')
      Object.assign(f, {
        resultName: title,
        resultType: '技术改进',
        resultNumber: '演示资料，无正式鉴定编号',
      });
    if (type === '案例')
      Object.assign(f, {
        problem: '现场发现异常，需要核实原因。',
        method: '逐项复核仪表、设备状态和运行记录。',
        effect: '形成可复用的检查清单。',
      });
    saveKnowledge(all, people[i % 2]!, f, i !== 3);
    if (i === 4) {
      const v = all.at(-1)!;
      takeDown(all, people[0]!, v.id, v.revision, '演示：资料修订期间暂停展示');
    }
  });
  return all;
}
