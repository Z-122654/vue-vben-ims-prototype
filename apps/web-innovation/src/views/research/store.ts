import type { Topic } from './model';

import { computed, ref } from 'vue';

import { copy, people } from './model';
import { seedData } from './seed';
const key = 'vben-web-innovation:research:v1';
const warning = ref('');
function load(): Topic[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const v = JSON.parse(raw);
      if (v.version === 1 && Array.isArray(v.topics)) {
        warning.value = '';
        return v.topics;
      }
      throw new Error('版本不匹配');
    }
    const topics = seedData();
    localStorage.setItem(key, JSON.stringify({ version: 1, topics }));
    warning.value = '';
    return topics;
  } catch {
    warning.value = '本地数据无法读取或保存，当前展示初始示例；原存储未覆盖。';
    return seedData();
  }
}
const topics = ref<Topic[]>(load());
const actorId = ref('manager');
try {
  actorId.value = localStorage.getItem(`${key}:actor`) || 'manager';
} catch {}
const actor = computed(
  () => people.find((p) => p.id === actorId.value) ?? people[0]!,
);
function switchActor(id: string) {
  actorId.value = id;
  try {
    localStorage.setItem(`${key}:actor`, id);
  } catch {}
}
export function commit(action: (draft: Topic[]) => void) {
  // Re-read before writing so an old dialog cannot overwrite another tab's work.
  let latest = topics.value;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.version !== 1 || !Array.isArray(saved.topics))
        throw new Error();
      latest = saved.topics;
    }
  } catch {
    throw new Error('本地数据无法读取，本次操作未保存，请刷新后重试。');
  }
  const draft = copy(latest);
  action(draft);
  try {
    localStorage.setItem(key, JSON.stringify({ version: 1, topics: draft }));
  } catch {
    throw new Error('本地空间不足或不可用，本次操作未保存。');
  }
  topics.value = draft;
  warning.value = '';
}
function refresh() {
  topics.value = load();
}
function reset() {
  commit((d) => d.splice(0, d.length, ...seedData()));
}
export function useResearch() {
  return {
    topics,
    actor,
    actorId,
    switchActor,
    commit,
    reset,
    refresh,
    warning,
  };
}
