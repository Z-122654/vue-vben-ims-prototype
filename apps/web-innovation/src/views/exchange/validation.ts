import type { InjectionKey, Ref } from 'vue';

import { nextTick, provide, ref } from 'vue';

import { ValidationError } from './model';

export const validationTarget: InjectionKey<Ref<string>> = Symbol(
  'exchange-validation',
);

export function useValidation(
  root: (field: string) => HTMLElement | undefined,
  reveal: (field: string) => void = () => {},
) {
  const target = ref('');
  const error = ref('');
  provide(validationTarget, target);
  function clear() {
    target.value = '';
    error.value = '';
  }
  async function report(e: unknown) {
    if (!(e instanceof ValidationError)) return;
    clear();
    await nextTick();
    reveal(e.field);
    target.value = e.field;
    error.value = e.message;
    await nextTick();
    // Sections react to the target after the tab is rendered.
    await nextTick();
    const el = [
      ...(root(e.field)?.querySelectorAll<HTMLElement>('[data-field]') ?? []),
    ].find((v) => v.dataset.field === e.field);
    el?.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    el?.querySelector<HTMLElement>(
      'input:not(:disabled),textarea:not(:disabled),button:not(:disabled)',
    )?.focus({ preventScroll: true });
  }
  function field(path: string) {
    return {
      'data-field': path,
      validateStatus: target.value === path ? ('error' as const) : undefined,
      help: target.value === path ? error.value : undefined,
    };
  }
  return { clear, report, field, target, error };
}
