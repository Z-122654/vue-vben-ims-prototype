<script setup lang="ts">
import type { Reply, Topic } from './model';

import { computed, ref, watch } from 'vue';
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
  Tag,
} from 'ant-design-vue';

import SourceLaunch from '../knowledge/SourceLaunch.vue';
import Attachments from './Attachments.vue';
import {
  canEdit,
  canView,
  categories,
  copy,
  freshReply,
  hasPublished,
  nameOf,
  questionState,
  replyAction,
  saveTopic,
  topicAction,
  types,
  visibleHistory,
  visibleReplies,
} from './model';
import ReplyDialog from './ReplyDialog.vue';
import Section from './Section.vue';
import { useExchange } from './store';
import { ask, perform } from './ui';
import { useValidation } from './validation';
// 临时隐藏交流明细的整理入口，保留原功能以便恢复。
const showKnowledgeImportEntry = false;

const props = defineProps<{ initial: Topic }>();
const emit = defineEmits<{ close: [] }>();
const knowledgeBusy = ref(false);
const { topics, actor, commit, refresh } = useExchange();
const form = ref(copy(props.initial));
const baseline = ref(JSON.stringify(form.value));
const current = computed(() =>
  topics.value.find((t) => t.id === form.value.id),
);
const active = computed(
  () => current.value ?? (form.value.revision === 0 ? form.value : undefined),
);
const allowed = computed(
  () => !!active.value && canView(active.value, actor.value),
);
const editable = computed(
  () => !!active.value && allowed.value && canEdit(active.value, actor.value),
);
const body = ref<HTMLElement>();
const files = ref<InstanceType<typeof Attachments>>();
const pending = ref(0);
const previewing = ref(false);
// Read-only material follows the current record; editable drafts retain unsaved input.
watch(
  current,
  () => {
    if (!editable.value && current.value && allowed.value) sync();
  },
  { deep: true },
);
const history = ref(false);
const tab = ref('info');
const reply = ref<{ data: Reply; create: boolean; revision: number }>();
const operation = ref<{ name: '下架' | '下架回复'; replyId?: string }>();
const operationBody = ref<HTMLElement>();
const reason = ref('');
const validation = useValidation(
  (field) => (field === 'reason' ? operationBody.value : body.value),
  (field) => {
    if (field !== 'reason') tab.value = 'info';
  },
);
const { field } = validation;
const dirty = computed(
  () => JSON.stringify(form.value) !== baseline.value || pending.value > 0,
);
const replies = computed(() =>
  current.value && allowed.value
    ? visibleReplies(current.value, actor.value)
    : [],
);
const records = computed(() =>
  current.value ? visibleHistory(current.value, actor.value) : [],
);
const replyCols = [
  { title: '回复内容', dataIndex: 'body', width: 350, ellipsis: true },
  { title: '回复人', key: 'author', width: 100 },
  { title: '部门', dataIndex: 'department', width: 120 },
  { title: '提交时间', dataIndex: 'time', width: 180 },
  { title: '回复对象', key: 'reference', width: 130 },
  { title: '状态', key: 'status', width: 130 },
  { title: '操作', key: 'actions', width: 300 },
];
const historyCols = [
  { title: '操作', dataIndex: 'action' },
  { title: '处理人', key: 'actor' },
  { title: '时间', dataIndex: 'time' },
  { title: '说明', dataIndex: 'note' },
];
const options = (items: string[]) => items.map((v) => ({ value: v, label: v }));
function sync() {
  if (current.value) {
    form.value = copy(current.value);
    baseline.value = JSON.stringify(form.value);
    validation.clear();
  }
}
async function canLeave() {
  if (
    reply.value ||
    operation.value ||
    history.value ||
    knowledgeBusy.value ||
    previewing.value
  )
    return false;
  if (dirty.value && !(await ask('放弃未保存的交流内容？'))) return false;
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
    baseline.value = JSON.stringify(form.value);
    validation.clear();
  }
}
function save(publish = false) {
  if (pending.value) return;
  if (
    perform(
      () => commit((d) => saveTopic(d, actor.value, form.value, publish)),
      publish ? '主题已发布' : '草稿已保存',
      validation.report,
    )
  )
    sync();
}
async function act(action: '删除' | '恢复' | '撤回') {
  if (
    !(await ask(
      `确定${action}主题？`,
      action === '恢复'
        ? '仅恢复主题，单独下架的回复仍保持下架。'
        : '此操作更新当前交流记录，保留应保留的历史。',
    ))
  )
    return;
  if (
    perform(() =>
      commit((d) =>
        topicAction(d, actor.value, form.value.id, form.value.revision, action),
      ),
    )
  ) {
    if (action === '删除') emit('close');
    else sync();
  }
}
function openReply(data?: Reply, referenceId = '') {
  if (!current.value) return;
  reply.value = {
    data: data ? copy(data) : freshReply(actor.value, referenceId),
    create: !data,
    revision: current.value.revision,
  };
}
async function handleReply(r: Reply, action: '取消采纳' | '恢复回复' | '采纳') {
  if (
    !(await ask(
      `确定${action}？`,
      action === '恢复回复'
        ? '恢复展示，不自动恢复之前的采纳。'
        : '问题状态将同步更新，回复原文保留。',
    ))
  )
    return;
  if (
    perform(() =>
      commit((d) =>
        replyAction(
          d,
          actor.value,
          form.value.id,
          form.value.revision,
          r.id,
          action,
        ),
      ),
    )
  )
    sync();
}
function hide(name: '下架' | '下架回复', replyId?: string) {
  operation.value = { name, replyId };
  reason.value = '';
  validation.clear();
}
function confirmHide() {
  if (!operation.value) return;
  const op = operation.value;
  if (
    perform(
      () =>
        commit((d) =>
          op.replyId
            ? replyAction(
                d,
                actor.value,
                form.value.id,
                form.value.revision,
                op.replyId,
                '下架回复',
                reason.value,
              )
            : topicAction(
                d,
                actor.value,
                form.value.id,
                form.value.revision,
                '下架',
                reason.value,
              ),
        ),
      '下架已完成',
      validation.report,
    )
  ) {
    operation.value = undefined;
    sync();
  }
}
async function closeOperation() {
  if (!reason.value.trim() || (await ask('放弃下架原因？')))
    operation.value = undefined;
}
function referenceName(r: Reply) {
  if (!r.referenceId) return '主题';
  const source = current.value?.replies.find((v) => v.id === r.referenceId);
  return source?.status === '有效' ? nameOf(source.authorId) : '引用已不可用';
}
</script>
<template>
  <Modal
    open
    title="交流明细"
    width="94vw"
    class="exchange-page exchange-dialog-content"
    wrap-class-name="exchange-detail-modal"
    :style="{ top: '3vh' }"
    :body-style="{ maxHeight: '86vh', overflowY: 'auto' }"
    :footer="null"
    :mask-closable="false"
    :keyboard="
      !reply && !operation && !history && !knowledgeBusy && !previewing
    "
    @cancel="close"
  >
    <div class="detail-toolbar">
      <SourceLaunch
        v-if="showKnowledgeImportEntry && current?.status === '已发布'"
        module="exchange"
        :parent-id="current.id"
        :source-actor-id="actor.id"
        @busy="knowledgeBusy = $event"
      />
      <Button type="primary" @click="close">关闭</Button
      ><Button
        v-if="editable"
        type="primary"
        :disabled="pending > 0"
        @click="save()"
      >
        保存草稿 </Button
      ><Button type="primary" @click="reload">刷新</Button
      ><Button v-if="editable" :disabled="pending > 0" @click="save(true)">
        发布
      </Button>
      <Button
        v-if="current?.status === '已发布' && current.authorId === actor.id"
        :disabled="current.replies.length > 0"
        @click="act('撤回')"
      >
        撤回
      </Button>
      <Button
        v-if="current && editable && !hasPublished(current)"
        danger
        @click="act('删除')"
      >
        删除草稿
      </Button>
      <Button
        v-if="actor.admin && current?.status === '已发布'"
        danger
        @click="hide('下架')"
      >
        下架主题 </Button
      ><Button
        v-if="actor.admin && current?.status === '已下架'"
        @click="act('恢复')"
      >
        恢复主题
      </Button>
      <Button v-if="records.length" @click="history = true">处理记录</Button>
    </div>
    <div ref="body" class="ims-body">
      <Alert
        v-if="!allowed"
        type="warning"
        message="当前主题已不可访问或已删除，请关闭明细。"
      />
      <Tabs v-else v-model:active-key="tab">
        <TabPane key="info" tab="主题信息" force-render>
          <Section title="基本信息">
            <Form :label-col="{ style: { width: '115px' } }">
              <div class="ims-form-grid">
                <FormItem
                  label="标题"
                  class="span-two"
                  required
                  v-bind="field('title')"
                >
                  <Input
                    v-model:value="form.title"
                    :disabled="!editable"
                    placeholder="请输入"
                  /> </FormItem
                ><FormItem label="编号">
                  <Input :value="form.code" disabled />
                </FormItem>
                <FormItem label="交流类型" required v-bind="field('type')">
                  <Select
                    v-model:value="form.type"
                    :options="options(types)"
                    :disabled="!editable"
                    placeholder="发布时必填"
                  /> </FormItem
                ><FormItem label="专业分类" required v-bind="field('category')">
                  <Select
                    v-model:value="form.category"
                    :options="options(categories)"
                    :disabled="!editable"
                    placeholder="发布时必填"
                  /> </FormItem
                ><FormItem label="内容状态">
                  <Input :value="active?.status" disabled />
                </FormItem>
                <FormItem label="发布人">
                  <Input :value="nameOf(form.authorId)" disabled /> </FormItem
                ><FormItem label="部门">
                  <Input :value="form.department" disabled /> </FormItem
                ><FormItem v-if="form.type === '技术问答'" label="问题状态">
                  <Input :value="questionState(active!)" disabled />
                </FormItem>
                <FormItem label="首次发布时间">
                  <Input
                    :value="form.firstPublishedAt || '尚未发布'"
                    disabled
                  /> </FormItem
                ><FormItem label="更新时间">
                  <Input
                    :value="form.updatedAt || '尚未保存'"
                    disabled
                  /> </FormItem
                ><FormItem v-if="active?.adoptedAt" label="采纳时间">
                  <Input :value="active.adoptedAt" disabled />
                </FormItem>
                <FormItem
                  label="正文"
                  class="wide"
                  required
                  v-bind="field('body')"
                >
                  <Input.TextArea
                    v-model:value="form.body"
                    :rows="8"
                    :disabled="!editable"
                  />
                </FormItem>
              </div>
            </Form>
            <p v-if="editable" class="rule-caption">
              草稿保存仅要求标题；发布还需填写交流类型、专业分类及正文。发布后原文只读，通过回复补充。
            </p>
          </Section>
          <Section title="附件" data-field="attachments">
            <Attachments
              ref="files"
              v-model="form.attachments"
              :readonly="!editable"
              :uploader="actor.name"
              @pending="pending = $event"
              @previewing="previewing = $event"
            />
          </Section>
        </TabPane>
        <TabPane key="replies" tab="交流回复">
          <Section title="回复记录">
            <div class="ims-toolbar">
              <Button
                type="primary"
                :disabled="current?.status !== '已发布'"
                @click="openReply()"
              >
                ＋ 新增回复 </Button
              ><span class="exchange-muted"
                >已提交回复只读；补充或更正请引用原回复。</span
              >
            </div>
            <Table
              class="ims-child-table"
              bordered
              row-key="id"
              :columns="replyCols"
              :data-source="replies"
              :scroll="{ x: 1350 }"
              :pagination="{
                pageSize: 10,
                showTotal: (n: number) => `共 ${n} 条数据`,
              }"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'author'">
                  {{ nameOf(record.authorId) }} </template
                ><template v-if="column.key === 'reference'">
                  {{ referenceName(record as Reply) }}
                </template>
                <template v-if="column.key === 'status'">
                  <Tag :color="record.status === '已下架' ? 'red' : 'blue'">
                    {{ record.status }} </Tag
                  ><Tag v-if="current?.adoptedId === record.id" color="green">
                    已采纳
                  </Tag>
                </template>
                <template v-if="column.key === 'actions'">
                  <Button type="link" @click="openReply(record as Reply)">
                    明细
                  </Button>
                  <template v-if="current?.status === '已发布'">
                    <Button
                      v-if="record.status === '有效'"
                      type="link"
                      @click="openReply(undefined, record.id)"
                    >
                      引用回复
                    </Button>
                    <template
                      v-if="
                        current.authorId === actor.id &&
                        current.type === '技术问答' &&
                        record.status === '有效'
                      "
                    >
                      <Button
                        v-if="current.adoptedId === record.id"
                        type="link"
                        @click="handleReply(record as Reply, '取消采纳')"
                      >
                        取消采纳 </Button
                      ><Button
                        v-else-if="record.authorId !== actor.id"
                        type="link"
                        :disabled="!!current.adoptedId"
                        @click="handleReply(record as Reply, '采纳')"
                      >
                        采纳
                      </Button>
                    </template>
                    <Button
                      v-if="actor.admin && record.status === '有效'"
                      type="link"
                      danger
                      @click="hide('下架回复', record.id)"
                    >
                      下架 </Button
                    ><Button
                      v-if="actor.admin && record.status === '已下架'"
                      type="link"
                      @click="handleReply(record as Reply, '恢复回复')"
                    >
                      恢复
                    </Button>
                  </template>
                </template>
              </template>
            </Table>
          </Section>
        </TabPane>
      </Tabs>
    </div>
  </Modal>
  <ReplyDialog
    v-if="reply"
    :topic-id="form.id"
    :initial="reply.data"
    :revision="reply.revision"
    :create="reply.create"
    @close="reply = undefined"
    @saved="sync"
  />
  <Modal
    :open="history"
    title="处理记录"
    width="80vw"
    class="exchange-page exchange-dialog-content"
    :footer="null"
    :mask-closable="false"
    @cancel="history = false"
  >
    <Section title="处理记录">
      <Table
        class="ims-child-table"
        bordered
        row-key="id"
        :columns="historyCols"
        :data-source="records"
        :scroll="{ y: 450 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'actor'">
            {{ nameOf(record.actorId) }}
          </template>
        </template>
      </Table>
    </Section>
  </Modal>
  <Modal
    :open="!!operation"
    title="下架处理"
    class="exchange-page exchange-dialog-content"
    :mask-closable="false"
    :footer="null"
    @cancel="closeOperation"
  >
    <div ref="operationBody">
      <Section title="处理信息">
        <Form>
          <FormItem label="下架原因" required v-bind="field('reason')">
            <Input.TextArea v-model:value="reason" :rows="4" />
          </FormItem>
        </Form>
        <div class="ims-toolbar">
          <Button @click="closeOperation">取消</Button
          ><Button type="primary" @click="confirmHide">确认下架</Button>
        </div>
      </Section>
    </div>
  </Modal>
</template>
