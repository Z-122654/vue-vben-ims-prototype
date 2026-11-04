import type { Topic } from './model';

import { describe, expect, it } from 'vitest';

import {
  addReply,
  canView,
  copy,
  freshReply,
  freshTopic,
  listTopics,
  people,
  questionState,
  replyAction,
  saveTopic,
  topicAction,
  visibleHistory,
  visibleReplies,
} from './model';
import { seedData } from './seed';
const admin = people[0]!;
const author = people[1]!;
const other = people[2]!;
function setup() {
  const all: Topic[] = [];
  const f = freshTopic(author);
  Object.assign(f, {
    title: '试验主题',
    type: '技术问答',
    category: '运行',
    body: '待讨论正文',
  });
  saveTopic(all, author, f, true);
  return { all, t: all[0]! };
}
function answer(all: Topic[], t: Topic, actor = other) {
  const r = freshReply(actor);
  r.body = '参考答复';
  addReply(all, actor, t.id, t.revision, r);
  return t.replies.at(-1)!;
}
describe('主题及访问边界', () => {
  it('私人草稿仅作者可见，管理员也不可读取和代填', () => {
    const all: Topic[] = [];
    const f = freshTopic(author);
    f.title = '私人';
    saveTopic(all, author, f);
    expect(canView(all[0]!, author)).toBe(true);
    expect(canView(all[0]!, admin)).toBe(false);
    expect(listTopics(all, admin, 'manage')).toEqual([]);
    expect(() => saveTopic(all, other, copy(all[0]!))).toThrow('仅作者');
  });
  it.each(['title', 'type', 'category', 'body'] as const)(
    '发布校验 %s，失败不产生记录，草稿仅要求标题',
    (field) => {
      const { t } = setup();
      const f = freshTopic(author);
      Object.assign(f, {
        title: t.title,
        type: t.type,
        category: t.category,
        body: t.body,
      });
      f[field] = ' ';
      const all: Topic[] = [];
      expect(() => saveTopic(all, author, f, true)).toThrow();
      expect(all).toEqual([]);
      const draft = freshTopic(author);
      draft.title = '仅标题';
      saveTopic(all, author, draft);
      expect(all[0]!.status).toBe('草稿');
    },
  );
  it('零附件发布，原文锁定；撤回重发保留首次时间和历史，不可删除', () => {
    const { all, t } = setup();
    const first = t.firstPublishedAt;
    expect(t.attachments).toEqual([]);
    expect(() => saveTopic(all, author, copy(t))).toThrow('仅作者');
    topicAction(all, author, t.id, t.revision, '撤回');
    expect(() => topicAction(all, author, t.id, t.revision, '删除')).toThrow(
      '从未发布',
    );
    saveTopic(all, author, copy(t), true);
    expect(t.firstPublishedAt).toBe(first);
    expect(t.history.filter((h) => h.action === '发布')).toHaveLength(2);
  });
  it('只能删除从未发布草稿，删除后旧表单不能保存复活', () => {
    const all: Topic[] = [];
    const f = freshTopic(author);
    f.title = '草稿';
    saveTopic(all, author, f);
    const old = copy(all[0]!);
    topicAction(all, author, old.id, old.revision, '删除');
    expect(() => saveTopic(all, author, old)).toThrow('已删除');
    expect(all).toEqual([]);
  });
  it('下架需原因且仅管理员；作者只读，其他员工无访问权', () => {
    const { all, t } = setup();
    const before = copy(t);
    expect(() =>
      topicAction(all, other, t.id, t.revision, '下架', '说明'),
    ).toThrow('仅交流管理员');
    expect(() =>
      topicAction(all, admin, t.id, t.revision, '下架', ' '),
    ).toThrow('原因');
    expect(t).toEqual(before);
    topicAction(all, admin, t.id, t.revision, '下架', '重复');
    expect(canView(t, author)).toBe(true);
    expect(canView(t, other)).toBe(false);
    expect(visibleHistory(t, author).at(-1)?.note).toBe('重复');
    expect(visibleHistory(t, other)).toEqual([]);
  });
  it('已下架回复仍阻止撤回；恢复主题不恢复单独下架回复', () => {
    const { all, t } = setup();
    const r = answer(all, t);
    replyAction(all, admin, t.id, t.revision, r.id, '下架回复', '测试');
    expect(() => topicAction(all, author, t.id, t.revision, '撤回')).toThrow(
      '已有回复',
    );
    topicAction(all, admin, t.id, t.revision, '下架', '测试');
    expect(() =>
      replyAction(all, admin, t.id, t.revision, r.id, '恢复回复'),
    ).toThrow('已下架');
    topicAction(all, admin, t.id, t.revision, '恢复');
    expect(r.status).toBe('已下架');
  });
  it('跨部门员工可参与，同一主题去重，无实际回复不算参与', () => {
    const { all, t } = setup();
    expect(listTopics(all, other, 'mine')).toEqual([]);
    answer(all, t);
    answer(all, t);
    answer(all, t, author);
    expect(listTopics(all, other, 'mine', 'joined')).toHaveLength(1);
    expect(listTopics(all, author, 'mine')).toHaveLength(1);
    expect(listTopics(all, other, 'manage')).toEqual([]);
  });
});
describe('回复及采纳', () => {
  it('不能代填、跨主题引用、引用失效回复或空白提交', () => {
    const { all, t } = setup();
    const r = freshReply(other);
    expect(() => addReply(all, other, t.id, t.revision, r)).toThrow('正文');
    r.body = '有效';
    expect(() => addReply(all, author, t.id, t.revision, r)).toThrow('代填');
    r.referenceId = 'not-in-topic';
    expect(() => addReply(all, other, t.id, t.revision, r)).toThrow('引用');
    expect(t.replies).toEqual([]);
  });
  it('正式回复不可重复提交，引用补充不修改原文', () => {
    const { all, t } = setup();
    const r = answer(all, t);
    const next = freshReply(author, r.id);
    next.body = '补充';
    addReply(all, author, t.id, t.revision, next);
    expect(() => addReply(all, other, t.id, t.revision, r)).toThrow('重复提交');
    expect(t.replies[0]!.body).toBe('参考答复');
    expect(t.replies[1]!.referenceId).toBe(r.id);
  });
  it('本人答案、非作者、非问答不能采纳', () => {
    const { all, t } = setup();
    const own = answer(all, t, author);
    const r = answer(all, t);
    expect(() =>
      replyAction(all, author, t.id, t.revision, own.id, '采纳'),
    ).toThrow('本人');
    expect(() =>
      replyAction(all, admin, t.id, t.revision, r.id, '采纳'),
    ).toThrow('提问人');
    t.type = '经验分享';
    expect(() =>
      replyAction(all, author, t.id, t.revision, r.id, '采纳'),
    ).toThrow('提问人');
  });
  it('只采纳一个，已解决可继续回复，取消恢复待解决，恢复下架答案不恢复采纳', () => {
    const { all, t } = setup();
    const a = answer(all, t);
    const b = answer(all, t);
    replyAction(all, author, t.id, t.revision, a.id, '采纳');
    expect(questionState(t)).toBe('已解决');
    answer(all, t);
    expect(t.replies).toHaveLength(3);
    expect(() =>
      replyAction(all, author, t.id, t.revision, b.id, '采纳'),
    ).toThrow('先取消');
    replyAction(all, author, t.id, t.revision, a.id, '取消采纳');
    expect(questionState(t)).toBe('待解决');
    replyAction(all, author, t.id, t.revision, a.id, '采纳');
    replyAction(all, admin, t.id, t.revision, a.id, '下架回复', '更正');
    expect(questionState(t)).toBe('待解决');
    expect(t.adoptedAt).toBe('');
    replyAction(all, admin, t.id, t.revision, a.id, '恢复回复');
    expect(t.adoptedId).toBe('');
  });
  it('隐藏回复内容、附件和处理原因仅作者及管理员可见', () => {
    const { all, t } = setup();
    const r = answer(all, t);
    replyAction(all, admin, t.id, t.revision, r.id, '下架回复', '内部处理原因');
    expect(visibleReplies(t, author)).toEqual([]);
    expect(visibleReplies(t, other)).toHaveLength(1);
    expect(
      visibleHistory(t, author).some((h) => h.note === '内部处理原因'),
    ).toBe(false);
    expect(visibleHistory(t, other).at(-1)?.note).toBe('内部处理原因');
  });
  it('旧弹窗不能在下架或并发更改后提交', () => {
    const { all, t } = setup();
    const rev = t.revision;
    const r = freshReply(other);
    r.body = '旧表单';
    topicAction(all, admin, t.id, t.revision, '下架', '暂不开放');
    expect(() => addReply(all, other, t.id, rev, r)).toThrow('已发生变化');
    expect(() => addReply(all, other, t.id, t.revision, r)).toThrow('已下架');
    expect(t.replies).toEqual([]);
  });
  it('附件格式和大小业务层也校验，失败不追加回复', () => {
    const { all, t } = setup();
    const r = freshReply(other);
    r.body = '附件测试';
    r.attachments = [
      {
        id: 'bad',
        name: 'run.exe',
        size: 5,
        content: 'data:;base64,YWJj',
        uploader: other.name,
        time: '',
      },
    ];
    expect(() => addReply(all, other, t.id, t.revision, r)).toThrow('附件格式');
    expect(t.replies).toEqual([]);
  });
  it('种子覆盖三种内容、三种主题状态、问答两种状态和下架回复', () => {
    const data = seedData();
    expect(new Set(data.map((t) => t.status)).size).toBe(3);
    expect(new Set(data.map((t) => t.type)).size).toBe(3);
    expect(data.some((t) => questionState(t) === '已解决')).toBe(true);
    expect(data.some((t) => questionState(t) === '待解决')).toBe(true);
    expect(data.some((t) => t.replies.some((r) => r.status === '已下架'))).toBe(
      true,
    );
  });
});
