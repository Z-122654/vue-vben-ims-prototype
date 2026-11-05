import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  activePublicationApproval,
  activityOf,
  beginResultCorrection,
  canEditEntry,
  canManageActivity,
  canProcessEntry,
  canReadPublicationApproval,
  canSeeEntry,
  changeActivity,
  copy,
  currentPublication,
  decidePublicationApproval,
  discardResultCorrection,
  isInternalReader,
  normalizeCompetitionData,
  pendingPublicationApproval,
  person,
  publicationApprovalRevision,
  publishResultCorrection,
  saveResults,
  submitPublicationApproval,
  withdrawPublicationApproval,
} from './model';
import { seedData } from './seed';

const admin = person('manager');
const a = person('employee-c');
const b = person('expert-b');
function fixture() {
  const data = seedData();
  const activity = activityOf(data, 'demo-workflow-pending-result');
  activity.publicApproverIds = [a.id, b.id];
  activity.noticeTitle = '审批结果公示';
  activity.noticeBody = '已保存的本轮公示正文';
  activity.showcase = false;
  return { data, activity, id: activity.id };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('公示并行会签', () => {
  it('所有领导同意才自动公示，最后一票记录时间与版本；兼任及跨部门均允许', () => {
    const { data, activity, id } = fixture();
    const owner = person(
      data.entries.find((e) => e.activityId === id)!.ownerId,
    );
    activity.publicApproverIds = [admin.id, owner.id, b.id];
    const round = submitPublicationApproval(data, admin, id);
    expect(activity.status).toBe('待公示');
    for (const leader of [admin, owner]) {
      decidePublicationApproval(data, leader, id, round, '同意', '');
      expect(currentPublication(activity)).toBeUndefined();
    }
    decidePublicationApproval(data, b, id, round, '同意', '通过');
    expect(activity.status).toBe('已公示');
    expect(currentPublication(activity)).toMatchObject({
      title: '审批结果公示',
      version: 1,
    });
    expect(activity.publishedAt).toBe(
      activity.publicationApprovals![0]!.endedAt,
    );
    expect(activePublicationApproval(activity)).toBeUndefined();
  });
  it('任一驳回结束整轮；修改重提全员待办，旧轮操作被拒绝', () => {
    const { data, activity, id } = fixture();
    const first = submitPublicationApproval(data, admin, id);
    decidePublicationApproval(data, a, id, first, '同意', '');
    expect(() =>
      decidePublicationApproval(data, b, id, first, '驳回', ' '),
    ).toThrow('原因');
    decidePublicationApproval(data, b, id, first, '驳回', '请补充');
    expect(activity.status).toBe('待公示');
    saveResults(data, admin, id, [], '修改公示', '补充正文', '', [a.id, b.id]);
    const second = submitPublicationApproval(data, admin, id);
    expect(activity.publicationApprovals).toHaveLength(2);
    expect(pendingPublicationApproval(activity, a)).toBe(true);
    const before = copy(data);
    expect(() =>
      decidePublicationApproval(data, b, id, first, '同意', ''),
    ).toThrow('轮次');
    expect(data).toEqual(before);
    decidePublicationApproval(data, b, id, second, '同意', '');
    expect(currentPublication(activity)).toBeUndefined();
    decidePublicationApproval(data, a, id, second, '同意', '');
    expect(currentPublication(activity)?.title).toBe('修改公示');
  });
  it('拒绝无审批人、无效/重复人员、非管理员、空正文及直接发布，失败不改数据', () => {
    for (const ids of [[], ['missing'], [a.id, a.id]]) {
      const { data, activity, id } = fixture();
      activity.publicApproverIds = ids;
      const before = copy(data);
      expect(() => submitPublicationApproval(data, admin, id)).toThrow(
        '审批人',
      );
      expect(data).toEqual(before);
    }
    const { data, activity, id } = fixture();
    expect(() => submitPublicationApproval(data, a, id)).toThrow('管理员');
    expect(() => changeActivity(data, admin, id, '已公示')).toThrow('审批');
    expect(() => publishResultCorrection(data, admin, id)).toThrow('审批');
    activity.noticeBody = ' ';
    expect(() => submitPublicationApproval(data, admin, id)).toThrow('正文');
  });
  it('审批中锁定内容；重复提交、重复同意及非审批人处理均无副作用', () => {
    const { data, activity, id } = fixture();
    const round = submitPublicationApproval(data, admin, id);
    const before = copy(data);
    expect(() =>
      saveResults(data, admin, id, [], '修改', '正文', '', [admin.id]),
    ).toThrow('撤回');
    expect(() => submitPublicationApproval(data, admin, id)).toThrow(
      '尚未结束',
    );
    expect(() =>
      decidePublicationApproval(data, admin, id, round, '同意', ''),
    ).toThrow('待处理');
    expect(data).toEqual(before);
    decidePublicationApproval(data, a, id, round, '同意', '');
    const after = copy(data);
    expect(() =>
      decidePublicationApproval(data, a, id, round, '同意', ''),
    ).toThrow('已完成');
    expect(data).toEqual(after);
    expect(activity.status).toBe('待公示');
  });
  it('管理员撤回后可编辑重新提交，原同意无效；非管理员不得撤回', () => {
    const { data, activity, id } = fixture();
    const round = submitPublicationApproval(data, admin, id);
    decidePublicationApproval(data, a, id, round, '同意', '');
    expect(() => withdrawPublicationApproval(data, a, id, round)).toThrow(
      '管理员',
    );
    withdrawPublicationApproval(data, admin, id, round);
    expect(activity.publicationApprovals![0]!.status).toBe('已撤回');
    submitPublicationApproval(data, admin, id);
    expect(pendingPublicationApproval(activity, a)).toBe(true);
  });
  it('提交校验页面版本；旧内容页面不能发起新一轮审批', () => {
    const { data, activity, id } = fixture();
    const revision = publicationApprovalRevision(activity);
    saveResults(data, admin, id, [], '已变更', '新正文', '', [a.id]);
    expect(() => submitPublicationApproval(data, admin, id, revision)).toThrow(
      '变化',
    );
    expect(activePublicationApproval(activity)).toBeUndefined();
  });
  it('过期编辑不能覆盖新轮次内容；发布使用提交快照而非之后的表单值', () => {
    const { data, activity, id } = fixture();
    const revision = publicationApprovalRevision(activity);
    const round = submitPublicationApproval(data, admin, id);
    withdrawPublicationApproval(data, admin, id, round);
    expect(() =>
      saveResults(
        data,
        admin,
        id,
        [],
        '旧页面',
        '旧正文',
        '',
        [a.id],
        revision,
      ),
    ).toThrow('变化');
    const next = submitPublicationApproval(data, admin, id);
    const title = activePublicationApproval(activity)!.snapshot.title;
    activity.noticeTitle = '模拟迟到的表单数据';
    decidePublicationApproval(data, a, id, next, '同意', '');
    decidePublicationApproval(data, b, id, next, '同意', '');
    expect(currentPublication(activity)?.title).toBe(title);
  });
  it('仅已提交轮次审批人可读完整参评材料，不增加管理审核编辑权限', () => {
    const { data, activity, id } = fixture();
    const entry = data.entries.find((e) => e.activityId === id)!;
    expect(canSeeEntry(data, entry, a)).toBe(false);
    expect(canReadPublicationApproval(activity, a)).toBe(false);
    submitPublicationApproval(data, admin, id);
    expect(canSeeEntry(data, entry, a)).toBe(true);
    expect(isInternalReader(data, entry, a)).toBe(true);
    expect(canManageActivity(activity, a)).toBe(false);
    expect(canProcessEntry(activity, a)).toBe(false);
    expect(canEditEntry(activity, entry, a)).toBe(false);
    expect(isInternalReader(data, entry, person('manager-operation'))).toBe(
      false,
    );
  });
  it.each(['已公示', '已结束'] as const)(
    '更正会签保持 %s 的原有效版本和证书资料，全部同意才换版',
    (status) => {
      const { data, activity, id } = fixture();
      const first = submitPublicationApproval(data, admin, id);
      decidePublicationApproval(data, a, id, first, '同意', '');
      decidePublicationApproval(data, b, id, first, '同意', '');
      activity.status = status;
      const original = copy(currentPublication(activity));
      beginResultCorrection(data, admin, id, '更正说明');
      saveResults(data, admin, id, [], '更正标题', '更正正文', '', [
        a.id,
        b.id,
      ]);
      const round = submitPublicationApproval(data, admin, id);
      expect(() => discardResultCorrection(data, admin, id)).toThrow('撤回');
      expect(() => changeActivity(data, admin, id, '已结束')).toThrow('撤回');
      decidePublicationApproval(data, a, id, round, '同意', '');
      expect(currentPublication(activity)).toEqual(original);
      decidePublicationApproval(data, b, id, round, '同意', '');
      expect(activity.status).toBe(status);
      expect(activity.publications).toHaveLength(2);
      expect(activity.publications![0]).toEqual(original);
      expect(currentPublication(activity)?.title).toBe('更正标题');
    },
  );
  it('旧已公示数据不伪造审批；旧待公示必须补选审批人', () => {
    const data = normalizeCompetitionData(seedData());
    const published = activityOf(data, 'demo-workflow-published');
    expect(published.publicationApprovals).toBeUndefined();
    expect(currentPublication(published)).toBeDefined();
    expect(() =>
      submitPublicationApproval(data, admin, 'demo-workflow-pending-result'),
    ).toThrow('至少');
  });
  it('五组虚构示例覆盖待提交、会签中、驳回、撤回和更正审批，不改旧活动', () => {
    const data = seedData();
    expect(
      activityOf(data, 'demo-approval-draft').publicationApprovals,
    ).toEqual([]);
    expect(
      activePublicationApproval(
        activityOf(data, 'demo-approval-pending'),
      )?.decisions.filter((d) => d.status === '同意'),
    ).toHaveLength(1);
    expect(
      activityOf(data, 'demo-approval-rejected').publicationApprovals?.at(-1)
        ?.status,
    ).toBe('已驳回');
    expect(
      activityOf(data, 'demo-approval-withdrawn').publicationApprovals?.at(-1)
        ?.status,
    ).toBe('已撤回');
    expect(
      activityOf(data, 'demo-approval-correction').publications,
    ).toHaveLength(1);
  });
  it('最后一票存储失败不产生部分结果；重试成功且旧标签页无法重复处理', async () => {
    vi.resetModules();
    const { data, activity, id } = fixture();
    const round = submitPublicationApproval(data, admin, id);
    decidePublicationApproval(data, a, id, round, '同意', '');
    const key = 'vben-web-innovation:competition:v1';
    const storage = new Map([[key, JSON.stringify(data)]]);
    let failing = false;
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, value: string) => {
        if (failing) throw new Error('quota');
        storage.set(k, value);
      },
    });
    const { useCompetition } = await import('./store');
    const store = useCompetition();
    const before = copy(store.data.value);
    failing = true;
    expect(() =>
      store.commit((d) =>
        decidePublicationApproval(d, b, id, round, '同意', ''),
      ),
    ).toThrow('未保存');
    expect(store.data.value).toEqual(before);
    expect(
      JSON.parse(storage.get(key)!).activities.find(
        (x: { id: string }) => x.id === id,
      ).status,
    ).toBe('待公示');
    failing = false;
    store.commit((d) => decidePublicationApproval(d, b, id, round, '同意', ''));
    expect(activityOf(store.data.value, id).status).toBe('已公示');
    const saved = storage.get(key);
    store.data.value = before; // 模拟另一标签页的旧内存
    expect(() =>
      store.commit((d) =>
        decidePublicationApproval(d, b, id, round, '同意', ''),
      ),
    ).toThrow('轮次');
    expect(storage.get(key)).toBe(saved);
    expect(activity.status).toBe('待公示');
  });
});
