<script setup lang="ts">
import type { Attachment } from './model';

import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { Button, message, Modal, Table, Upload } from 'ant-design-vue';

import { now, uid } from './model';
const props = defineProps<{
  modelValue: Attachment[];
  readonly?: boolean;
  uploader: string;
}>();
const emit = defineEmits<{
  'update:modelValue': [Attachment[]];
  pending: [number];
  previewing: [boolean];
}>();
const pending = ref(0);
const preview = ref<Attachment>();
let generation = 0;
let queue = Promise.resolve();
const readers = new Set<FileReader>();
function cancel() {
  generation++;
  for (const r of readers) r.abort();
  readers.clear();
  pending.value = 0;
  emit('pending', 0);
}
defineExpose({ cancel });
onBeforeUnmount(() => {
  cancel();
  emit('previewing', false);
});
watch(preview, (value) => emit('previewing', !!value), { flush: 'sync' });
watch(
  () => props.modelValue,
  () => {
    if (preview.value)
      preview.value = props.modelValue.find((f) => f.id === preview.value?.id);
  },
  { deep: true },
);
watch(
  () => props.readonly,
  (v) => {
    if (v) cancel();
  },
);
async function upload(file: File) {
  if (props.readonly) return Upload.LIST_IGNORE;
  if (!/\.(docx?|pdf|png|jpe?g)$/i.test(file.name)) {
    message.error('支持 Word、PDF、PNG、JPG');
    return Upload.LIST_IGNORE;
  }
  if (file.size > 1024 * 1024 || props.modelValue.length + pending.value >= 6) {
    message.error('原型限制：每组最多6个文件，单个不超过1 MB');
    return Upload.LIST_IGNORE;
  }
  const token = generation;
  pending.value++;
  emit('pending', pending.value);
  const reader = new FileReader();
  readers.add(reader);
  try {
    const content = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('读取失败'));
      reader.onabort = () => reject(new Error('cancel'));
      reader.readAsDataURL(file);
    });
    const add = queue.then(async () => {
      if (token !== generation || props.readonly) return;
      emit('update:modelValue', [
        ...props.modelValue,
        {
          id: uid(),
          name: file.name,
          size: file.size,
          content,
          uploader: props.uploader,
          time: now(),
        },
      ]);
      await nextTick();
    });
    queue = add.catch(() => {});
    await add;
  } catch {
    if (token === generation) message.error('附件读取失败，请重试');
  } finally {
    readers.delete(reader);
    if (token === generation) {
      pending.value--;
      emit('pending', pending.value);
    }
  }
  return Upload.LIST_IGNORE;
}
function download(f: Attachment) {
  const current = props.modelValue.find((item) => item.id === f.id);
  if (!current) return;
  const link = document.createElement('a');
  link.href = current.content;
  link.download = current.name;
  link.click();
}
const cols = [
  { title: '附件名称', dataIndex: 'name' },
  { title: '大小', key: 'size', width: 95 },
  { title: '上传时间', dataIndex: 'time', width: 180 },
  { title: '上传人', dataIndex: 'uploader', width: 110 },
  { title: '操作', key: 'actions', width: 180 },
];
</script>
<template>
  <div v-if="!readonly" class="ims-toolbar">
    <Upload
      :before-upload="upload"
      :show-upload-list="false"
      accept=".doc,.docx,.pdf,.png,.jpg,.jpeg"
      multiple
    >
      <Button type="primary">＋ 新增附件</Button> </Upload
    ><span class="exchange-muted"
      >选填；原型限制每组6个、单个1 MB，仅保存在本浏览器</span
    ><span v-if="pending">读取中 {{ pending }} 个…</span>
  </div>
  <Table
    class="ims-child-table"
    :columns="cols"
    :data-source="modelValue"
    row-key="id"
    bordered
    :pagination="false"
    :scroll="{ x: 700 }"
  >
    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'size'">
        {{ Math.max(1, Math.ceil(record.size / 1024)) }} KB </template
      ><template v-if="column.key === 'actions'">
        <Button
          v-if="/\.(pdf|png|jpe?g)$/i.test(record.name)"
          type="link"
          @click="preview = record as Attachment"
        >
          预览 </Button
        ><Button type="link" @click="download(record as Attachment)">
          下载 </Button
        ><Button
          v-if="!readonly"
          type="link"
          danger
          @click="
            emit(
              'update:modelValue',
              modelValue.filter((f) => f.id !== record.id),
            )
          "
        >
          删除
        </Button>
      </template>
    </template>
  </Table>
  <Modal
    :open="!!preview"
    title="附件预览"
    width="80vw"
    :footer="null"
    @cancel="preview = undefined"
  >
    <iframe
      v-if="preview && /\.pdf$/i.test(preview.name)"
      :src="preview.content"
      title="PDF附件"
      style="width: 100%; height: 65vh"
    ></iframe
    ><img
      v-else-if="preview"
      :src="preview.content"
      :alt="preview.name"
      style="max-width: 100%; max-height: 65vh"
    />
  </Modal>
</template>
