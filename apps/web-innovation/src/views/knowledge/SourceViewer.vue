<script setup lang="ts">
import type { Person } from './model';
import type { SourceSelection } from './source-types';

import { computed, ref } from 'vue';

import {
  Alert,
  Button,
  Form,
  FormItem,
  Input,
  Modal,
  Table,
} from 'ant-design-vue';

import Section from './Section.vue';
import { useSourceData } from './source-state';
import { readSources, resolveSource } from './sources';
const props = defineProps<{ selection: SourceSelection; actor: Person }>();
defineEmits<{ close: [] }>();
const { data, refresh } = useSourceData();
const error = ref('');
const result = computed(() =>
  resolveSource(props.selection, props.actor, data.value),
);
function download(id: string) {
  const latest = resolveSource(props.selection, props.actor, readSources());
  const file =
    latest.state === 'ok'
      ? latest.record.files.find((f) => f.id === id)
      : undefined;
  if (!file) {
    error.value = '原附件已不可访问，请刷新来源';
    refresh();
    return;
  }
  const a = document.createElement('a');
  a.href = file.content;
  a.download = file.name;
  a.click();
}
</script>
<template>
  <Modal
    open
    title="来源资料"
    width="90vw"
    class="knowledge-page knowledge-dialog-content"
    :footer="null"
    :mask-closable="false"
    :body-style="{ maxHeight: '80vh', overflowY: 'auto' }"
    @cancel="$emit('close')"
  >
    <div class="detail-toolbar">
      <Button type="primary" @click="$emit('close')">关闭</Button
      ><Button type="primary" @click="refresh">刷新</Button>
    </div>
    <div class="ims-body">
      <Alert v-if="error" type="error" :message="error" /><Alert
        v-if="result.state !== 'ok'"
        type="warning"
        :message="result.message"
      />
      <template v-else>
        <Section title="基本信息">
          <Form :label-col="{ style: { width: '125px' } }">
            <div class="ims-form-grid">
              <FormItem label="来源名称" class="span-two">
                <Input :value="result.record.title" disabled /> </FormItem
              ><FormItem label="编号">
                <Input :value="result.record.code" disabled /> </FormItem
              ><FormItem label="作者／负责人">
                <Input :value="result.record.author" disabled /> </FormItem
              ><FormItem label="部门">
                <Input :value="result.record.department" disabled /> </FormItem
              ><FormItem label="来源状态">
                <Input :value="result.record.status" disabled /> </FormItem
              ><FormItem label="所属主题／活动" class="span-two">
                <Input :value="result.record.parentTitle" disabled /> </FormItem
              ><FormItem label="来源时间">
                <Input :value="result.record.time || '历史未记录'" disabled />
              </FormItem>
            </div>
            <FormItem
              v-for="part in result.record.parts"
              :key="part.id"
              :label="part.label"
            >
              <Input.TextArea
                :value="part.text"
                :auto-size="{ minRows: 3, maxRows: 12 }"
                disabled
              />
            </FormItem>
          </Form>
        </Section>
        <Section title="当前可访问的原附件">
          <Table
            bordered
            class="ims-child-table"
            row-key="id"
            :data-source="result.record.files"
            :pagination="false"
            :columns="[
              { title: '附件名称', dataIndex: 'name' },
              { title: '原上传人', dataIndex: 'uploader' },
              { title: '原上传时间', dataIndex: 'time' },
              { title: '操作', key: 'action' },
            ]"
          >
            <template #bodyCell="{ column, record }">
              <Button
                v-if="column.key === 'action'"
                type="link"
                @click="download(record.id)"
              >
                下载原文件
              </Button>
            </template>
          </Table>
        </Section>
      </template>
    </div>
  </Modal>
</template>
