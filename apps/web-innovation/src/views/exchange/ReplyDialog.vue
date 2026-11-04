<script setup lang="ts">
import type { Reply } from './model';

import { computed, ref, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';

import { Alert, Button, Form, FormItem, Input, Modal } from 'ant-design-vue';

import Attachments from './Attachments.vue';
import { addReply, canViewReply, copy, nameOf } from './model';
import Section from './Section.vue';
import { useExchange } from './store';
import { ask, perform } from './ui';
import { useValidation } from './validation';
const props = defineProps<{
  topicId: string;
  initial: Reply;
  revision: number;
  create: boolean;
}>();
const emit = defineEmits<{ close: []; saved: [] }>();
const { topics, actor, commit, refresh } = useExchange();
const form = ref(copy(props.initial));
const baseline = ref(JSON.stringify(form.value));
const revision = ref(props.revision);
const current = computed(() =>
  topics.value.find((t) => t.id === props.topicId),
);
const saved = computed(() =>
  current.value?.replies.find((r) => r.id === form.value.id),
);
const allowed = computed(
  () =>
    !!current.value &&
    (props.create
      ? current.value.status === '已发布' &&
        form.value.authorId === actor.value.id
      : !!saved.value && canViewReply(current.value, saved.value, actor.value)),
);
const editable = computed(() => props.create && allowed.value);
const previewing = ref(false);
watch(
  saved,
  () => {
    if (!props.create && saved.value && allowed.value) {
      form.value = copy(saved.value);
      baseline.value = JSON.stringify(form.value);
    }
  },
  { deep: true },
);
const body = ref<HTMLElement>();
const files = ref<InstanceType<typeof Attachments>>();
const pending = ref(0);
const validation = useValidation(() => body.value);
const { field } = validation;
const dirty = computed(
  () =>
    props.create &&
    (JSON.stringify(form.value) !== baseline.value || pending.value > 0),
);
const reference = computed(() => {
  const r = current.value?.replies.find((v) => v.id === form.value.referenceId);
  return r?.status === '有效'
    ? `${nameOf(r.authorId)}：${r.body}`
    : form.value.referenceId
      ? '引用回复已不可用'
      : '直接回复主题';
});
async function canLeave() {
  if (previewing.value) return false;
  if (dirty.value && !(await ask('放弃未提交的回复？'))) return false;
  files.value?.cancel();
  return true;
}
async function close() {
  if (await canLeave()) emit('close');
}
onBeforeRouteLeave(canLeave);
async function reload() {
  if (!(await canLeave())) return;
  refresh();
  if (!allowed.value) return;
  form.value = copy(props.create ? props.initial : saved.value!);
  baseline.value = JSON.stringify(form.value);
  revision.value = current.value!.revision;
  validation.clear();
}
function submit() {
  if (pending.value) return;
  if (
    perform(
      () =>
        commit((d) =>
          addReply(d, actor.value, props.topicId, revision.value, form.value),
        ),
      '回复已提交',
      validation.report,
    )
  ) {
    emit('saved');
    emit('close');
  }
}
</script>
<template>
  <Modal
    open
    title="回复明细"
    width="90vw"
    class="exchange-page exchange-dialog-content"
    wrap-class-name="exchange-detail-modal"
    :style="{ top: '4vh' }"
    :body-style="{ maxHeight: '83vh', overflowY: 'auto' }"
    :footer="null"
    :mask-closable="false"
    :keyboard="!previewing"
    @cancel="close"
  >
    <div class="detail-toolbar">
      <Button type="primary" @click="close">关闭</Button
      ><Button type="primary" @click="reload">刷新</Button
      ><Button
        v-if="create"
        :disabled="!editable || pending > 0"
        @click="submit"
      >
        提交回复
      </Button>
    </div>
    <div ref="body" class="ims-body">
      <Alert
        v-if="!allowed"
        type="warning"
        message="主题或回复已不可用，请关闭或刷新。"
      />
      <template v-else>
        <Section title="基本信息">
          <Form :label-col="{ style: { width: '110px' } }">
            <div class="ims-form-grid">
              <FormItem label="所属主题" class="span-two">
                <Input :value="current?.title" disabled /> </FormItem
              ><FormItem label="回复人">
                <Input :value="nameOf(form.authorId)" disabled />
              </FormItem>
              <FormItem label="部门">
                <Input :value="form.department" disabled /> </FormItem
              ><FormItem label="提交时间">
                <Input :value="form.time || '尚未提交'" disabled /> </FormItem
              ><FormItem label="状态">
                <Input :value="create ? '未提交' : saved?.status" disabled />
              </FormItem>
              <FormItem label="回复对象" class="wide">
                <Input.TextArea :value="reference" :rows="2" disabled />
              </FormItem>
            </div>
          </Form>
        </Section>
        <Section title="回复内容">
          <Form :label-col="{ style: { width: '110px' } }">
            <FormItem label="正文" required v-bind="field('body')">
              <Input.TextArea
                v-model:value="form.body"
                :rows="7"
                :disabled="!editable"
              />
            </FormItem>
          </Form>
        </Section>
        <Section title="附件">
          <Attachments
            ref="files"
            v-model="form.attachments"
            :readonly="!editable"
            :uploader="actor.name"
            @pending="pending = $event"
            @previewing="previewing = $event"
          />
        </Section>
      </template>
    </div>
  </Modal>
</template>
