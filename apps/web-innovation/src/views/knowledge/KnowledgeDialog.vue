<script setup lang="ts">
import type { Knowledge, Person } from './model';

import { computed, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';

import {
  Alert,
  Button,
  Form,
  FormItem,
  Input,
  Modal,
  Select,
  Table,
  TabPane,
  Tabs,
} from 'ant-design-vue';

import Attachments from './Attachments.vue';
import {
  canEdit,
  canView,
  categories,
  copy,
  nameOf,
  saveKnowledge,
  takeDown,
  types,
} from './model';
import { reviewReference } from './references';
import Section from './Section.vue';
import { sourceNames } from './source-types';
import SourcesPanel from './SourcesPanel.vue';
import { useKnowledge } from './store';
import { ask, perform } from './ui';
import { useValidation } from './validation';
const props = defineProps<{ initial: Knowledge; actorOverride?: Person }>();
const emit = defineEmits<{ close: [] }>();
const { items, actor: storedActor, commit, refresh } = useKnowledge();
const actor = computed(() => props.actorOverride || storedActor.value);
const initialStored = items.value.find((v) => v.id === props.initial.id);
const unchangedInitial =
  !!initialStored &&
  JSON.stringify(initialStored) === JSON.stringify(props.initial);
useKnowledge().audit?.(actor.value);
const sourceBusy = ref(false);
// Detection updates provenance only. Do not treat that update as a user edit,
// but preserve genuinely edited forms passed from a source import.
const form = ref(
  copy(
    unchangedInitial
      ? (items.value.find((v) => v.id === props.initial.id) ?? props.initial)
      : props.initial,
  ),
);
const baseline = ref(
  JSON.stringify(
    items.value.find((v) => v.id === form.value.id) ||
      (form.value.sources?.length ? null : form.value),
  ),
);
const current = computed(() => items.value.find((v) => v.id === form.value.id));
const active = computed(
  () => current.value ?? (form.value.revision === 0 ? form.value : undefined),
);
const allowed = computed(
  () => !!active.value && canView(active.value, actor.value),
);
const editable = computed(
  () => !!active.value && canEdit(active.value, actor.value),
);
const display = computed(() =>
  editable.value ? form.value : (current.value ?? form.value),
);
const down = ref(false);
const history = ref(false);
const reason = ref('');
const tab = ref('info');
const files = ref<InstanceType<typeof Attachments>>();
const pending = ref(0);
const body = ref<HTMLElement>();
const downBody = ref<HTMLElement>();
const validation = useValidation(
  (field) => (field === 'reason' ? downBody.value : body.value),
  (field) => {
    if (field !== 'reason')
      tab.value =
        field === 'sources'
          ? 'sources'
          : field === 'attachments'
            ? 'attachments'
            : 'info';
  },
);
const { field } = validation;
const dirty = computed(
  () => JSON.stringify(form.value) !== baseline.value || pending.value > 0,
);
const options = (values: string[]) =>
  values.map((v) => ({ value: v, label: v }));
const columns = [
  { title: '操作', dataIndex: 'action', width: 140 },
  { title: '关联来源', key: 'source', width: 240 },
  { title: '处理人', key: 'actor', width: 120 },
  { title: '时间', dataIndex: 'time', width: 190 },
  { title: '说明', dataIndex: 'note' },
];
function sync() {
  if (current.value) {
    form.value = copy(current.value);
    baseline.value = JSON.stringify(form.value);
    validation.clear();
  }
}
async function canLeave() {
  if (history.value || down.value || sourceBusy.value) return false;
  if (dirty.value && !(await ask('放弃未保存的知识内容？'))) return false;
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
  if (current.value) sync();
  else if (form.value.revision === 0) {
    form.value = copy(props.initial);
    baseline.value = JSON.stringify(
      form.value.sources?.length ? null : form.value,
    );
    validation.clear();
  }
}
function save(publish = false) {
  if (pending.value) return;
  if (
    perform(
      () =>
        commit(
          (d) => saveKnowledge(d, actor.value, form.value, publish),
          actor.value,
        ),
      publish ? '知识已发布' : '知识已保存',
      validation.report,
    )
  )
    sync();
}
function reviewSource(
  key: string,
  note: string,
  token: string,
  done: () => void,
) {
  if (dirty.value) return;
  if (
    perform(
      () =>
        commit(
          (d) =>
            reviewReference(
              d,
              actor.value,
              form.value.id,
              form.value.revision,
              key,
              note,
              token,
            ),
          actor.value,
        ),
      '来源复核已记录',
      validation.report,
    )
  ) {
    sync();
    done();
  }
}
function openDown() {
  down.value = true;
  reason.value = '';
  validation.clear();
}
async function closeDown() {
  if (!reason.value.trim() || (await ask('放弃下架原因？'))) down.value = false;
}
function confirmDown() {
  if (
    perform(
      () =>
        commit((d) =>
          takeDown(
            d,
            actor.value,
            form.value.id,
            form.value.revision,
            reason.value,
          ),
        ),
      '知识已下架，可修改后重新发布',
      validation.report,
    )
  ) {
    down.value = false;
    sync();
  }
}
</script>
<template>
  <Modal
    open
    title="知识明细"
    width="94vw"
    class="knowledge-page knowledge-dialog-content"
    wrap-class-name="knowledge-detail-modal"
    :style="{ top: '3vh' }"
    :body-style="{ maxHeight: '86vh', overflowY: 'auto' }"
    :footer="null"
    :mask-closable="false"
    :keyboard="!history && !down && !sourceBusy"
    @cancel="close"
  >
    <div class="detail-toolbar">
      <Button type="primary" @click="close">关闭</Button
      ><Button
        v-if="editable"
        type="primary"
        :disabled="pending > 0"
        @click="save()"
      >
        {{ active?.status === '草稿' ? '保存草稿' : '保存' }} </Button
      ><Button type="primary" @click="reload">刷新</Button
      ><Button v-if="editable" :disabled="pending > 0" @click="save(true)">
        {{ active?.firstPublishedAt ? '重新发布' : '发布' }} </Button
      ><Button
        v-if="actor.admin && current?.status === '已发布'"
        danger
        @click="openDown"
      >
        下架 </Button
      ><Button
        v-if="actor.admin && current?.history.length"
        @click="history = true"
      >
        处理记录
      </Button>
    </div>
    <div ref="body" class="ims-body">
      <Alert
        v-if="!allowed"
        type="warning"
        message="知识已下架或不可访问，请关闭明细。"
      />
      <Tabs v-else v-model:active-key="tab">
        <TabPane key="info" tab="知识信息" force-render>
          <Section title="基本信息">
            <Form :label-col="{ style: { width: '125px' } }">
              <div class="ims-form-grid">
                <FormItem
                  label="标题"
                  class="span-two"
                  required
                  v-bind="field('title')"
                >
                  <Input
                    v-model:value="display.title"
                    :disabled="!editable"
                    placeholder="请输入知识标题"
                  /> </FormItem
                ><FormItem label="编号">
                  <Input :value="display.code" disabled />
                </FormItem>
                <FormItem label="知识类型" required v-bind="field('type')">
                  <Select
                    v-model:value="display.type"
                    :options="options(types)"
                    :disabled="!editable"
                  /> </FormItem
                ><FormItem label="专业分类" required v-bind="field('category')">
                  <Select
                    v-model:value="display.category"
                    :options="options(categories)"
                    :disabled="!editable"
                  /> </FormItem
                ><FormItem label="内容状态">
                  <Input :value="active?.status" disabled />
                </FormItem>
                <FormItem label="原作者／负责人">
                  <Input
                    v-model:value="display.originalAuthor"
                    :disabled="!editable"
                    placeholder="选填，按原资料填写"
                  /> </FormItem
                ><FormItem label="原作者部门">
                  <Input
                    v-model:value="display.originalDepartment"
                    :disabled="!editable"
                    placeholder="选填，按原资料填写"
                  /> </FormItem
                ><FormItem label="登记方式">
                  <Input :value="display.registration || '手工登记'" disabled />
                </FormItem>
                <FormItem label="整理人">
                  <Input
                    :value="nameOf(display.curatorId)"
                    disabled
                  /> </FormItem
                ><FormItem label="发布人">
                  <Input
                    :value="
                      display.publisherId
                        ? nameOf(display.publisherId)
                        : '尚未发布'
                    "
                    disabled
                  /> </FormItem
                ><FormItem label="更新时间">
                  <Input :value="display.updatedAt || '尚未保存'" disabled />
                </FormItem>
                <FormItem label="首次发布时间">
                  <Input
                    :value="display.firstPublishedAt || '尚未发布'"
                    disabled
                  /> </FormItem
                ><FormItem label="最近发布时间">
                  <Input :value="display.publishedAt || '尚未发布'" disabled />
                </FormItem>
                <FormItem label="关键词" class="wide">
                  <Input
                    v-model:value="display.keywords"
                    :disabled="!editable"
                    placeholder="选填，用空格分隔便于阅读"
                  /> </FormItem
                ><FormItem
                  label="摘要"
                  required
                  class="wide"
                  v-bind="field('summary')"
                >
                  <Input.TextArea
                    v-model:value="display.summary"
                    :rows="3"
                    :disabled="!editable"
                  />
                </FormItem>
              </div>
            </Form>
            <p v-if="editable" class="rule-caption">
              保存只要求标题。发布还需类型、专业分类和摘要；成果／案例必须填写正文，文档至少有正文或一份附件。发布后向登录员工展示本条知识及附件。
            </p>
          </Section>
          <Section title="知识内容">
            <Form :label-col="{ style: { width: '125px' } }">
              <FormItem
                label="正文"
                :required="display.type === '成果' || display.type === '案例'"
                v-bind="field('body')"
              >
                <Input.TextArea
                  v-model:value="display.body"
                  :rows="9"
                  :disabled="!editable"
                /> </FormItem
              ><FormItem label="适用场景">
                <Input.TextArea
                  v-model:value="display.scenario"
                  :rows="3"
                  :disabled="!editable"
                />
              </FormItem>
            </Form>
          </Section>
          <Section v-if="display.type === '成果'" title="成果信息">
            <Form :label-col="{ style: { width: '125px' } }">
              <div class="ims-form-grid">
                <FormItem label="成果名称">
                  <Input
                    v-model:value="display.resultName"
                    :disabled="!editable"
                  /> </FormItem
                ><FormItem label="成果类型">
                  <Input
                    v-model:value="display.resultType"
                    :disabled="!editable"
                  /> </FormItem
                ><FormItem label="编号／专利号">
                  <Input
                    v-model:value="display.resultNumber"
                    :disabled="!editable"
                  />
                </FormItem>
              </div>
            </Form>
          </Section>
          <Section v-if="display.type === '案例'" title="案例信息">
            <Form :label-col="{ style: { width: '125px' } }">
              <FormItem label="问题描述">
                <Input.TextArea
                  v-model:value="display.problem"
                  :rows="3"
                  :disabled="!editable"
                /> </FormItem
              ><FormItem label="处理方法">
                <Input.TextArea
                  v-model:value="display.method"
                  :rows="3"
                  :disabled="!editable"
                /> </FormItem
              ><FormItem label="实施效果">
                <Input.TextArea
                  v-model:value="display.effect"
                  :rows="3"
                  :disabled="!editable"
                />
              </FormItem>
            </Form>
          </Section>
        </TabPane>
        <TabPane key="attachments" tab="附件资料" force-render>
          <Section title="附件" data-field="attachments">
            <Alert
              v-if="validation.target.value === 'attachments'"
              type="error"
              :message="validation.error.value"
            /><Attachments
              ref="files"
              :model-value="display.attachments"
              :readonly="!editable"
              :sources="display.sources"
              :actor="actor"
              :uploader="actor.name"
              @update:model-value="form.attachments = $event"
              @pending="pending = $event"
            />
          </Section>
        </TabPane>
        <TabPane key="sources" tab="关联来源" force-render>
          <Alert
            v-if="validation.target.value === 'sources'"
            type="error"
            :message="validation.error.value"
          />
          <SourcesPanel
            :model-value="display"
            :actor="actor"
            :editable="editable"
            :blocked="pending > 0"
            :dirty="dirty"
            @update:model-value="form = $event"
            @busy="sourceBusy = $event"
            @review="reviewSource"
          />
        </TabPane>
      </Tabs>
    </div>
  </Modal>
  <Modal
    :open="history && actor.admin"
    title="处理记录"
    width="80vw"
    class="knowledge-page knowledge-dialog-content"
    :footer="null"
    :mask-closable="false"
    @cancel="history = false"
  >
    <Section title="处理记录">
      <Table
        class="ims-child-table"
        bordered
        row-key="id"
        :columns="columns"
        :data-source="current?.history || []"
        :scroll="{ y: 450 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'actor'">
            {{ nameOf(record.actorId) }} </template
          ><template v-if="column.key === 'source'">
            {{
              record.source
                ? `${sourceNames[record.source.module as keyof typeof sourceNames]} · ${record.source.title} · ${record.source.code || record.source.key}`
                : record.action.includes('来源')
                  ? '历史来源未记录'
                  : '—'
            }}
          </template>
        </template>
      </Table>
    </Section>
  </Modal>
  <Modal
    :open="down"
    title="知识下架"
    class="knowledge-page knowledge-dialog-content"
    :footer="null"
    :mask-closable="false"
    @cancel="closeDown"
  >
    <div ref="downBody">
      <Section title="处理信息">
        <Form>
          <FormItem label="下架原因" required v-bind="field('reason')">
            <Input.TextArea v-model:value="reason" :rows="4" />
          </FormItem>
        </Form>
        <p class="rule-caption">
          下架后员工无法检索及查看本条知识，管理员可修改后重新发布。
        </p>
        <div class="ims-toolbar">
          <Button @click="closeDown">取消</Button
          ><Button type="primary" @click="confirmDown">确认下架</Button>
        </div>
      </Section>
    </div>
  </Modal>
</template>
