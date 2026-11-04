import type { Topic } from './model';

import {
  addReply,
  freshReply,
  freshTopic,
  people,
  replyAction,
  saveTopic,
  topicAction,
} from './model';
export function seedData(): Topic[] {
  const all: Topic[] = [];
  const titles = [
    '循环水泵振动偏大如何排查？',
    '检修工具定置管理经验分享',
    '运行交接班记录交流',
    '热控测点异常排查（草稿）',
    '重复发布内容（下架示例）',
    '电机温升问题（待解决）',
  ];
  titles.forEach((title, i) => {
    const author = people[(i % 3) + 1]!;
    const t = freshTopic(author);
    t.id = `exchange-demo-${i + 1}`;
    t.code = `JL202600${i + 1}`;
    t.title = title;
    t.type = ['技术问答', '经验分享', '日常交流'][i % 3]!;
    t.category = i % 2 ? '检修' : '运行';
    t.body =
      i === 0
        ? '近期巡检发现循环水泵振动数值上升，现场应从哪些方面进行排查？请分享排查顺序及注意事项。本记录为虚构演示内容。'
        : '结合现场工作交流方法、检查记录与改进经验。请围绕问题补充可参考的处理步骤。本记录为虚构演示资料。';
    if (i === 5) t.type = '技术问答';
    saveTopic(all, author, t, i !== 3);
  });
  const first = all[0]!;
  const r = freshReply(people[2]!);
  r.id = 'exchange-demo-answer';
  r.body =
    '建议先复核测点和仪表，再检查基础紧固、联轴器对中及轴承状态，按现场规程执行。';
  addReply(all, people[2]!, first.id, first.revision, r);
  replyAction(all, people[1]!, first.id, first.revision, r.id, '采纳');
  const hidden = freshReply(people[3]!);
  hidden.id = 'exchange-demo-hidden';
  hidden.body = '此条为已下架回复，演示作者及管理员查看权限。';
  addReply(all, people[3]!, first.id, first.revision, hidden);
  replyAction(
    all,
    people[0]!,
    first.id,
    first.revision,
    hidden.id,
    '下架回复',
    '演示：内容与问题无关',
  );
  const down = all[4]!;
  topicAction(
    all,
    people[0]!,
    down.id,
    down.revision,
    '下架',
    '演示：重复主题，保留记录供作者核对',
  );
  return all;
}
