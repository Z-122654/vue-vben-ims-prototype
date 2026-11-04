<script setup lang="ts">
import { inject, nextTick, ref, watch } from 'vue';

import { ChevronDown, ArrowUp as ChevronUp } from '@vben/icons';

import { validationTarget } from './validation';
defineProps<{ title: string }>();
const collapsed = ref(false);
const section = ref<HTMLElement>();
const target = inject(validationTarget, ref(''));
watch(
  target,
  async (value) => {
    await nextTick();
    if (
      section.value?.dataset.field === value ||
      [
        ...(section.value?.querySelectorAll<HTMLElement>('[data-field]') ?? []),
      ].some((el) => el.dataset.field === value)
    )
      collapsed.value = false;
  },
  { immediate: true },
);
</script>
<template>
  <section ref="section" class="ims-section">
    <button
      type="button"
      class="section-heading"
      :aria-expanded="!collapsed"
      @click="collapsed = !collapsed"
    >
      <span>{{ title }}</span
      ><ChevronDown v-if="collapsed" :size="18" /><ChevronUp
        v-else
        :size="18"
      />
    </button>
    <div v-show="!collapsed" class="section-content"><slot></slot></div>
  </section>
</template>
