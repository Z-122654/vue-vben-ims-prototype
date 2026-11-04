import type { Knowledge, Person } from './model';

import { computed, ref } from 'vue';

import { copy, people } from './model';
import { auditSources } from './references';
import { seedData } from './seed';
const key = 'vben-web-innovation:knowledge:v1';
const warning = ref('');
function load(): Knowledge[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const v = JSON.parse(raw);
      if (v.version === 1 && Array.isArray(v.items)) {
        warning.value = '';
        return v.items;
      }
      throw new Error('版本不匹配');
    }
    const items = seedData();
    localStorage.setItem(key, JSON.stringify({ version: 1, items }));
    warning.value = '';
    return items;
  } catch {
    warning.value = '本地数据无法读取或保存，当前展示初始示例；原存储未覆盖。';
    return seedData();
  }
}
const items = ref<Knowledge[]>(load());
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
export function commit(
  action: (draft: Knowledge[]) => void,
  actingPerson = actor.value,
) {
  // Re-read before writing so an old dialog cannot overwrite another tab's work.
  let latest = items.value;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.version !== 1 || !Array.isArray(saved.items)) throw new Error();
      latest = saved.items;
    }
  } catch {
    throw new Error('本地数据无法读取，本次操作未保存，请刷新后重试。');
  }
  const draft = copy(latest);
  auditSources(draft, actingPerson);
  action(draft);
  try {
    localStorage.setItem(key, JSON.stringify({ version: 1, items: draft }));
  } catch {
    throw new Error('本地空间不足或不可用，本次操作未保存。');
  }
  items.value = draft;
  warning.value = '';
}
function refresh() {
  items.value = load();
  audit();
}
function audit(actingPerson: Person = actor.value) {
  let draft: Knowledge[];
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    if (saved.version !== 1 || !Array.isArray(saved.items)) return;
    draft = copy(saved.items);
  } catch {
    return;
  }
  if (!auditSources(draft, actingPerson)) return;
  // Detection only annotates provenance. It never changes content or publication times.
  try {
    localStorage.setItem(key, JSON.stringify({ version: 1, items: draft }));
    items.value = draft;
  } catch {
    warning.value =
      '来源变化已检测，但复核提示暂无法保存，请恢复本地空间后刷新';
  }
}
// Keep open read-only dialogs aligned with changes made in another browser tab.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === key || event.key === null) refresh();
    else if (
      /^vben-web-innovation:(exchange|research|competition):v1$/.test(event.key)
    )
      audit();
  });
  window.addEventListener('focus', refresh);
}
function reset() {
  commit((d) => {
    const seeds = seedData();
    const revision = Math.max(0, ...d.map((v) => v.revision)) + 1;
    for (const item of seeds) item.revision = revision;
    d.splice(0, d.length, ...seeds);
  });
}
export function useKnowledge() {
  return {
    items,
    actor,
    actorId,
    switchActor,
    commit,
    reset,
    refresh,
    audit,
    warning,
  };
}
