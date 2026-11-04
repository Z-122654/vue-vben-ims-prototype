import { onBeforeUnmount, ref } from 'vue';

import { readSources } from './sources';
export function useSourceData() {
  const data = ref(readSources());
  const refresh = () => {
    data.value = readSources();
  };
  const changed = (e: StorageEvent) => {
    if (
      !e.key ||
      /vben-web-innovation:(exchange|research|competition):v1$/.test(e.key)
    )
      refresh();
  };
  window.addEventListener('storage', changed);
  window.addEventListener('focus', refresh);
  onBeforeUnmount(() => {
    window.removeEventListener('storage', changed);
    window.removeEventListener('focus', refresh);
  });
  return { data, refresh };
}
