<script setup lang="ts">
import type { Knowledge } from './model';
import type { SourceModule } from './source-types';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { Button } from 'ant-design-vue';

import KnowledgeDialog from './KnowledgeDialog.vue';
import { people } from './model';
import SourcePicker from './SourcePicker.vue';
import {
  knowledgeIdentity,
  readSources,
  resolveSource,
  selection,
} from './sources';

import './ims.css';
const props = defineProps<{
  module: SourceModule;
  parentId: string;
  objectId?: string;
  sourceActorId: string;
}>();
const emit = defineEmits<{ busy: [boolean] }>();
const detail = ref<Knowledge>();
const picker = ref(false);
watch(
  () => !!(picker.value || detail.value),
  (v) => emit('busy', v),
);
onBeforeUnmount(() => emit('busy', false));
const actor = computed(() =>
  people.find(
    (p) => p.id === knowledgeIdentity(props.module, props.sourceActorId),
  ),
);
const initial = computed(() =>
  selection(props.module, props.parentId, props.objectId),
);
const allowed = computed(
  () =>
    actor.value?.admin &&
    resolveSource(initial.value, actor.value, readSources()).state === 'ok',
);
function apply(v: Knowledge) {
  picker.value = false;
  detail.value = v;
}
</script>
<template>
  <Button v-if="allowed" type="link" @click="picker = true">整理为知识</Button>
  <SourcePicker
    v-if="picker && actor"
    :actor="actor"
    :initial-selection="initial"
    @close="picker = false"
    @apply="apply"
    @open="apply"
  />
  <KnowledgeDialog
    v-if="detail && actor"
    :initial="detail"
    :actor-override="actor"
    @close="detail = undefined"
  />
</template>
