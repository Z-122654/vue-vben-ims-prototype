import type { CompetitionData } from './model';

import { computed, ref } from 'vue';

import { copy, normalizeCompetitionData, people } from './model';
import {
  seedData,
  withActivityPublishers,
  withHiddenShowcaseExample,
} from './seed';
import { withApprovalExamples } from './approval-examples';
import { withWorkflowExamples } from './workflow-examples';

const key = 'vben-web-innovation:competition:v1';
const actorKey = 'vben-web-innovation:competition:actor';
const initial = seedData();
const storageWarning = ref('');
function load(): CompetitionData {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed.version === 1 &&
        Array.isArray(parsed.activities) &&
        Array.isArray(parsed.entries) &&
        Array.isArray(parsed.reviews)
      ) {
        const normalized = withHiddenShowcaseExample(
          normalizeCompetitionData(parsed),
          initial,
        );
        const enriched = withActivityPublishers(
          withApprovalExamples(
            withWorkflowExamples(normalized, initial),
            initial,
          ),
          initial,
        );
        if (JSON.stringify(enriched) !== raw) {
          try {
            localStorage.setItem(key, JSON.stringify(enriched));
          } catch {
            storageWarning.value =
              '兼容资料已在本次页面补齐，但本地存储空间不足，暂未持久化；原有保存数据未重置。';
          }
        }
        return enriched;
      }
      throw new Error('不兼容的数据版本');
    }
    try {
      localStorage.setItem(key, JSON.stringify(initial));
    } catch {
      storageWarning.value =
        '初始演示数据暂未保存到浏览器；可继续查看，本地存储恢复后再保存操作。';
    }
  } catch {
    storageWarning.value =
      '本地演示数据无法读取，已载入初始数据。可使用“重置演示”恢复。';
  }
  return copy(initial);
}
const data = ref<CompetitionData>(load());
const actorId = ref('manager');
try {
  actorId.value = localStorage.getItem(actorKey) || 'manager';
} catch {
  /* 可使用内存角色 */
}
const actor = computed(
  () => people.find((p) => p.id === actorId.value) ?? people[0]!,
);
function switchActor(id: string) {
  actorId.value = id;
  try {
    localStorage.setItem(actorKey, id);
  } catch {
    /* 不影响本次角色切换 */
  }
}
function commit(action: (draft: CompetitionData) => void) {
  let base = data.value;
  try {
    const raw = localStorage.getItem(key);
    if (raw) base = normalizeCompetitionData(JSON.parse(raw));
  } catch {
    throw new Error('无法读取最新演示数据，请刷新后重试。本次更改未保存。');
  }
  const draft = copy(base);
  action(draft);
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    throw new Error(
      '本地存储不可用或空间已满，请删除较大附件后重试。本次更改未保存。',
    );
  }
  data.value = draft;
}
function refresh() {
  try {
    const raw = localStorage.getItem(key);
    if (raw) data.value = normalizeCompetitionData(JSON.parse(raw));
  } catch {
    throw new Error('无法读取最新演示数据，请重试。');
  }
}
function reset() {
  const fresh = seedData();
  try {
    localStorage.setItem(key, JSON.stringify(fresh));
  } catch {
    throw new Error('无法写入本地存储，请检查浏览器存储设置。');
  }
  data.value = fresh;
  storageWarning.value = '';
}
export function useCompetition() {
  return {
    data,
    actor,
    actorId,
    switchActor,
    commit,
    refresh,
    reset,
    storageWarning,
  };
}
