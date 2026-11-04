<script setup lang="ts">
import { ref } from 'vue';

import { ChevronDown, ArrowUp as ChevronUp } from '@vben/icons';
defineProps<{ title: string }>();
const collapsed = ref(false);
</script>
<template>
  <section class="ims-section">
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
