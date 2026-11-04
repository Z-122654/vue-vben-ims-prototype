import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  activityPublisherLabel,
  auditEntry,
  canManageActivity,
  canProcessEntry,
  changeActivity,
  copy,
  newActivity,
  newEntry,
  normalizeCompetitionData,
  person,
  resolveSupplement,
  saveActivity,
  saveEntry,
} from './model';
import { seedData, withActivityPublishers } from './seed';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-28T10:00:00'));
});
afterEach(() => vi.useRealTimers());
const manager = person('manager');
const publisher = {
  ...person('manager-operation'),
  managedDepartments: ['科技管理部'],
};
function published() {
  const data = seedData();
  const form = {
    ...newActivity(manager),
    name: '发布人审核验证',
    phone: '020-5550-9000',
    description: '虚构演示',
    expertIds: ['expert-a'],
  };
  saveActivity(data, manager, form);
  const activity = data.activities.find((a) => a.id === form.id)!;
  changeActivity(data, publisher, activity.id, '报名中');
  const entry = {
    ...newEntry(activity.id, 'employee-a'),
    name: '材料',
    summary: '项目简介',
  };
  saveEntry(data, person('employee-a'), entry, true);
  return {
    data,
    activity,
    entry: data.entries.find((e) => e.id === entry.id)!,
  };
}

describe('活动发布人与材料处理权限', () => {
  it('创建人不是审核人：成功发布记录实际发布人，保存及兼容加载不更换', () => {
    const { data, activity } = published();
    expect(activity.publisherId).toBe(publisher.id);
    expect(activity.publisherName).toBe(publisher.name);
    expect(activityPublisherLabel(activity)).toBe('活动发布人 · 赵启航');
    expect(canManageActivity(activity, manager)).toBe(true);
    expect(canProcessEntry(activity, manager)).toBe(false);
    expect(canProcessEntry(activity, publisher)).toBe(true);
    saveActivity(data, manager, {
      ...copy(activity),
      publisherId: manager.id,
      publisherName: manager.name,
    });
    expect(activity.publisherId).toBe(publisher.id);
    const restored = normalizeCompetitionData(copy(data)).activities.find(
      (a) => a.id === activity.id,
    )!;
    expect(restored.publisherId).toBe(publisher.id);
    changeActivity(data, manager, activity.id, '已取消', '测试取消');
    expect(activity.publisherId).toBe(publisher.id);
  });
  it('草稿保存不接受指定发布人，发布失败不记录发布人和时间', () => {
    const data = seedData();
    const form = {
      ...newActivity(manager),
      name: '草稿',
      expertIds: ['expert-a'],
      publisherId: publisher.id,
      publisherName: publisher.name,
    };
    saveActivity(data, manager, form);
    const saved = data.activities[0]!;
    expect(saved.publisherId).toBe('');
    const before = copy(data);
    expect(() => changeActivity(data, manager, saved.id, '报名中')).toThrow();
    expect(data).toEqual(before);
    expect(saved.registeredAt).toBe('');
  });
  it.each(['manager', 'employee-a', 'expert-a'])(
    '非发布人 %s 不能审核、退回、延期或终止，失败不改数据',
    (id) => {
      const { data, entry } = published();
      const actor = person(id);
      const before = copy(data);
      expect(() => auditEntry(data, actor, entry.id, true, '通过')).toThrow();
      expect(() =>
        auditEntry(data, actor, entry.id, false, '补充', '2026-11-01'),
      ).toThrow();
      expect(data).toEqual(before);
      auditEntry(data, publisher, entry.id, false, '补充', '2026-11-01');
      const returned = copy(data);
      expect(() =>
        resolveSupplement(
          data,
          actor,
          entry.id,
          'extend',
          '延期',
          '2026-11-02',
        ),
      ).toThrow();
      expect(() =>
        resolveSupplement(data, actor, entry.id, 'terminate', '终止'),
      ).toThrow();
      expect(data).toEqual(returned);
    },
  );
  it('发布人可处理全部四项操作，退回重提仍由原发布人处理，旧历史不改写', () => {
    const { data, activity, entry } = published();
    auditEntry(data, publisher, entry.id, false, '补充', '2026-11-01');
    resolveSupplement(
      data,
      publisher,
      entry.id,
      'extend',
      '延期',
      '2026-11-02',
    );
    const history = copy(entry.history);
    saveEntry(data, person(entry.ownerId), copy(entry), true);
    auditEntry(data, publisher, entry.id, true, '通过');
    expect(entry.status).toBe('审核通过');
    expect(entry.history.slice(0, history.length)).toEqual(history);
    expect(entry.history.at(-1)?.actor).toBe(publisher.name);
    auditEntry(data, publisher, entry.id, false, '再次补充', '2026-11-03');
    resolveSupplement(data, publisher, entry.id, 'terminate', '不再参加');
    expect(entry.status).toBe('已终止');
    expect(activity.publisherId).toBe(publisher.id);
    expect(canProcessEntry(activity, person(publisher.id))).toBe(false); // 已无该组织授权时不能处理
  });
  it('刷新兼容优先保留已有身份和姓名快照，其次只从发布历史恢复', () => {
    const data = seedData();
    const activity = data.activities[0]!;
    activity.publisherName = '发布时姓名';
    expect(
      normalizeCompetitionData(copy(data)).activities[0]!.publisherName,
    ).toBe('发布时姓名');
    delete activity.publisherId;
    delete activity.publisherName;
    activity.history.find((h) => h.action === '活动报名中')!.actor =
      publisher.name;
    const result = withActivityPublishers(
      normalizeCompetitionData(data),
      seedData(),
    );
    expect(result.activities[0]!.publisherId).toBe(publisher.id);
    expect(result.activities[0]!.history).toEqual(activity.history);
  });
  it('预置旧活动缺少发布历史可按稳定ID补齐，其余材料完整保留且重复加载幂等', () => {
    const initial = seedData();
    const legacy = copy(initial);
    const activity = legacy.activities.find((a) => a.id === 'activity-review')!;
    delete activity.publisherId;
    delete activity.publisherName;
    activity.history = activity.history.filter(
      (h) => h.action !== '活动报名中',
    );
    const result = withActivityPublishers(
      normalizeCompetitionData(legacy),
      initial,
    );
    expect(
      result.activities.find((a) => a.id === activity.id)!.publisherId,
    ).toBe('manager');
    expect(result.entries).toEqual(initial.entries);
    expect(result.reviews).toEqual(initial.reviews);
    expect(
      result.activities.find((a) => a.id === activity.id)!.history,
    ).toEqual(activity.history);
    expect(
      withActivityPublishers(normalizeCompetitionData(result), initial),
    ).toEqual(result);
  });
  it('未知发布历史不被预置身份覆盖，自建无历史活动不猜测，草稿直接取消不补发布人', () => {
    const data = seedData();
    const activity = data.activities[0]!;
    activity.publisherId = '';
    activity.publisherName = '';
    activity.history.find((h) => h.action === '活动报名中')!.actor = '未知人员';
    const custom = { ...copy(activity), id: 'custom-no-history', history: [] };
    data.activities.push(custom);
    const draft = data.activities.find((a) => a.status === '草稿')!;
    changeActivity(data, manager, draft.id, '已取消', '取消草稿');
    const result = withActivityPublishers(
      normalizeCompetitionData(data),
      seedData(),
    );
    for (const id of [activity.id, custom.id, draft.id]) {
      const item = result.activities.find((a) => a.id === id)!;
      expect(item.publisherId).toBe('');
      expect(canProcessEntry(item, manager)).toBe(false);
      expect(activityPublisherLabel(item)).toBe('历史发布人未记录');
    }
  });
});
