<script setup lang="ts">
import type { Progress } from './model';

import { computed, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';

import {
  Button,
  DatePicker,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
} from 'ant-design-vue';

import Attachments from './Attachments.vue';
import { copy, nameOf, participant, person, saveProgress } from './model';
import Section from './Section.vue';
import { useResearch } from './store';
import { ask, perform } from './ui';
import { useValidation } from './validation';
const props = defineProps<{ topicId: string; initial: Progress }>();
const emit = defineEmits<{ close: [] }>();
const { topics, actor, commit, refresh: reloadData } = useResearch();
const topic = computed(() => topics.value.find((t) => t.id === props.topicId)!);
const revision = ref(topic.value.revision);
const existing = ref(
  topic.value.progress.some((v) => v.id === props.initial.id),
);
const form = ref(copy(props.initial));
const baseline = ref(JSON.stringify(form.value));
const pending = ref(0);
const body = ref<HTMLElement>();
const validation = useValidation(() => body.value);
const { field } = validation;
const files = ref<InstanceType<typeof Attachments>>();
const editable = computed(
  () =>
    topic.value.status === '攻关中' &&
    participant(topic.value, actor.value) &&
    form.value.ownerId === actor.value.id &&
    !form.value.submittedAt,
);
const tasks = computed(() =>
  topic.value.tasks
    .filter(
      (t) =>
        !editable.value ||
        topic.value.leaderId === actor.value.id ||
        t.personId === actor.value.id,
    )
    .map((t) => ({ value: t.id, label: t.name })),
);
const changed = computed(
  () => JSON.stringify(form.value) !== baseline.value || pending.value > 0,
);
async function guard() {
  if (changed.value && !(await ask('放弃未保存的进展？'))) return false;
  files.value?.cancel();
  return true;
}
async function close() {
  if (await guard()) emit('close');
}
onBeforeRouteLeave(guard);
async function refresh() {
  if (!(await guard())) return;
  reloadData();
  validation.clear();
  const saved = topic.value.progress.find((v) => v.id === props.initial.id);
  if (existing.value && !saved) {
    message.warning('该进展记录已删除，已返回进展列表');
    emit('close');
    return;
  }
  form.value = copy(saved ?? props.initial);
  existing.value = !!saved;
  baseline.value = JSON.stringify(form.value);
  revision.value = topic.value.revision;
}
function save(submit = false) {
  if (pending.value) return;
  validation.clear();
  if (
    perform(
      () =>
        commit((all) =>
          saveProgress(
            all.find((t) => t.id === props.topicId)!,
            actor.value,
            revision.value,
            form.value,
            submit,
            existing.value,
          ),
        ),
      undefined,
      validation.report,
    )
  ) {
    existing.value = true;
    form.value = copy(
      topic.value.progress.find((v) => v.id === form.value.id)!,
    );
    baseline.value = JSON.stringify(form.value);
    revision.value = topic.value.revision;
  }
}
</script>
<template>
  <Modal
    open
    title="进展明细"
    width="min(1280px,calc(100vw - 72px))"
    :footer="null"
    :mask-closable="false"
    :style="{ top: '36px' }"
    :body-style="{
      padding: 0,
      maxHeight: 'calc(100dvh - 135px)',
      overflowY: 'auto',
    }"
    @cancel="close"
  >
    <div ref="body" class="research-page research-dialog-content">
      <div class="detail-toolbar">
        <Button type="primary" @click="close">关闭</Button
        ><Button
          v-if="editable"
          type="primary"
          :disabled="pending > 0"
          @click="save()"
        >
          保存草稿 </Button
        ><Button type="primary" @click="refresh">刷新</Button
        ><Button v-if="editable" :disabled="pending > 0" @click="save(true)">
          提交
        </Button>
      </div>
      <div class="ims-body">
        <Section title="基本信息">
          <Form layout="horizontal" :label-col="{ style: { width: '110px' } }">
            <div class="ims-form-grid">
              <FormItem label="所属课题" class="span-two">
                <Input :value="topic.name" disabled /> </FormItem
              ><FormItem label="记录状态">
                <Input :value="form.submittedAt ? '已提交' : '草稿'" disabled />
              </FormItem>
              <FormItem
                v-bind="field('title')"
                label="记录标题"
                required
                class="span-two"
              >
                <Input
                  v-model:value="form.title"
                  :disabled="!editable"
                /> </FormItem
              ><FormItem v-bind="field('kind')" label="记录类型" required>
                <Select
                  v-model:value="form.kind"
                  :disabled="!editable"
                  :options="
                    ['实施进展', '研讨纪要', '问题风险'].map((v) => ({
                      value: v,
                      label: v,
                    }))
                  "
                />
              </FormItem>
              <FormItem v-bind="field('taskId')" label="关联任务">
                <Select
                  v-model:value="form.taskId"
                  :disabled="!editable"
                  :options="[{ value: '', label: '不关联任务' }, ...tasks]"
                /> </FormItem
              ><FormItem v-bind="field('date')" label="反馈日期" required>
                <DatePicker
                  :value="form.date"
                  @update:value="(v) => (form.date = String(v ?? ''))"
                  value-format="YYYY-MM-DD"
                  :disabled="!editable"
                /> </FormItem
              ><FormItem label="填报人">
                <Input :value="nameOf(form.ownerId)" disabled /> </FormItem
              ><FormItem label="部门">
                <Input
                  :value="person(form.ownerId)?.department"
                  disabled
                /> </FormItem
              ><FormItem label="提交时间">
                <Input
                  :value="form.submittedAt || '尚未提交'"
                  disabled
                /> </FormItem
              ><FormItem v-if="form.correctionId" label="更正原记录">
                <Input
                  :value="
                    topic.progress.find((p) => p.id === form.correctionId)
                      ?.title
                  "
                  disabled
                />
              </FormItem>
            </div>
          </Form> </Section
        ><Section title="进展内容">
          <Form :label-col="{ style: { width: '130px' } }">
            <FormItem v-bind="field('content')" label="本次内容" required>
              <Input.TextArea
                v-model:value="form.content"
                :rows="5"
                :disabled="!editable"
              /> </FormItem
            ><FormItem label="问题与风险">
              <Input.TextArea
                v-model:value="form.risk"
                :rows="3"
                :disabled="!editable"
              /> </FormItem
            ><FormItem label="下一步安排">
              <Input.TextArea
                v-model:value="form.next"
                :rows="3"
                :disabled="!editable"
              />
            </FormItem>
          </Form> </Section
        ><Section title="附件" data-field="files">
          <Attachments
            ref="files"
            v-model="form.files"
            :readonly="!editable"
            :uploader="actor.name"
            @pending="pending = $event"
          />
        </Section>
      </div>
    </div>
  </Modal>
</template>
