<script setup lang="ts">
import type { Attachment } from '../model';

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { Download, Plus, X as Trash2 } from '@vben/icons';

import {
  Button,
  Checkbox,
  message,
  Modal,
  Space,
  Upload,
} from 'ant-design-vue';

import { attachmentIsPublic, nowText, uid } from '../model';
import { useCompetition } from '../store';
import ImsTable from './ImsTable.vue';

const props = defineProps<{
  modelValue: Attachment[];
  readonly?: boolean;
  publicOnly?: boolean;
  activityNotice?: boolean;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: Attachment[]];
  'pending-change': [count: number];
}>();
const { actor } = useCompetition();
const preview = ref<Attachment>();
const previewText = ref('');
const pendingUploads = ref(0);
let generation = 0;
const readers = new Map<FileReader, () => void>();
let appendQueue = Promise.resolve();
function cancelUploads() {
  generation++;
  for (const [reader, cancel] of readers) {
    cancel();
    reader.abort();
  }
  readers.clear();
  pendingUploads.value = 0;
  emit('pending-change', 0);
}
defineExpose({ cancelUploads });
onBeforeUnmount(cancelUploads);
watch(
  () => props.readonly,
  (readonly) => {
    if (readonly) cancelUploads();
  },
);
const rows = computed(() =>
  props.modelValue
    .filter(
      (a) => props.activityNotice || !props.publicOnly || attachmentIsPublic(a),
    )
    .map((a) => ({
      ...a,
      sizeText: `${Math.max(1, Math.round(a.size / 1024))} KB`,
      publicText: attachmentIsPublic(a) ? '公开展示' : '仅申报与评审',
    })),
);
async function beforeUpload(file: File) {
  if (props.readonly) return Upload.LIST_IGNORE;
  if (props.activityNotice && !/\.pdf$/i.test(file.name)) {
    message.error('活动附件仅支持上传 PDF 文件。');
    return Upload.LIST_IGNORE;
  }
  if (!/\.(pdf|png|jpe?g|txt|docx?|xlsx?|pptx?)$/i.test(file.name)) {
    message.error('支持文档、PDF、图片及 TXT 文件。');
    return Upload.LIST_IGNORE;
  }
  if (file.size > 1024 * 1024) {
    message.error('演示附件请控制在 1 MB 以内。');
    return Upload.LIST_IGNORE;
  }
  if (props.modelValue.length + pendingUploads.value >= 6) {
    message.error('每条记录最多添加 6 个演示附件。');
    return Upload.LIST_IGNORE;
  }
  const startedGeneration = generation;
  pendingUploads.value++;
  emit('pending-change', pendingUploads.value);
  let reader: FileReader | undefined;
  try {
    const content = await new Promise<string>((resolve, reject) => {
      const currentReader = new FileReader();
      reader = currentReader;
      readers.set(currentReader, () => reject(new Error('cancelled')));
      currentReader.onload = () => resolve(String(currentReader.result));
      currentReader.onerror = reject;
      currentReader.onabort = reject;
      currentReader.readAsDataURL(file);
    });
    // 顺序加入，并等待父表单回传，避免并发读取完成时覆盖另一个附件。
    const append = appendQueue.then(async () => {
      if (props.readonly || startedGeneration !== generation) return;
      if (props.modelValue.length >= 6) {
        message.error('每条记录最多添加 6 个演示附件。');
        return;
      }
      emit('update:modelValue', [
        ...props.modelValue,
        {
          id: uid(),
          name: file.name,
          size: file.size,
          uploadedAt: nowText(),
          uploader: actor.value.name,
          public: false,
          content,
        },
      ]);
      await nextTick();
      if (startedGeneration !== generation) return;
      message.success('附件已加入表单，保存表单后将保存在本浏览器。');
    });
    appendQueue = append.catch(() => {});
    await append;
  } catch {
    if (startedGeneration === generation)
      message.error('文件读取失败，请重新选择。');
  } finally {
    if (reader) readers.delete(reader);
    if (startedGeneration === generation) {
      pendingUploads.value--;
      emit('pending-change', pendingUploads.value);
    }
  }
  return false;
}
function remove(id: string) {
  Modal.confirm({
    title: '移除此附件？',
    content: '保存表单后生效。',
    okText: '确定',
    cancelText: '取消',
    onOk: () =>
      emit(
        'update:modelValue',
        props.modelValue.filter((a) => a.id !== id),
      ),
  });
}
function visibility(id: string, value: boolean) {
  emit(
    'update:modelValue',
    props.modelValue.map((a) =>
      a.id === id
        ? {
            ...a,
            public: value,
          }
        : a,
    ),
  );
}
async function open(id: string) {
  const item = props.modelValue.find((a) => a.id === id);
  if (!item) return;
  preview.value = item;
  previewText.value = '';
  if (/\.txt$/i.test(item.name)) {
    try {
      previewText.value = await (await fetch(item.content)).text();
    } catch {
      previewText.value = '预览失败，请下载查看。';
    }
  }
}
</script>
<template>
  <div>
    <div v-if="!readonly" class="ims-toolbar">
      <Upload
        :before-upload="beforeUpload"
        :show-upload-list="false"
        :accept="
          activityNotice
            ? '.pdf'
            : '.pdf,.png,.jpg,.jpeg,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx'
        "
      >
        <Button type="primary"><Plus :size="16" />新增附件</Button>
      </Upload>
      <span class="muted"
        >{{ activityNotice ? '仅支持 PDF；' : '' }}每个文件不超过 1
        MB；仅保存到当前浏览器，不上传至服务器</span
      >
    </div>
    <p v-if="pendingUploads" class="rule-caption" role="status">
      正在读取 {{ pendingUploads }} 个附件，请等待完成后再保存或提交。
    </p>
    <ImsTable
      :rows="rows"
      :height="230"
      :pagination="false"
      :columns="[
        { field: 'name', title: '附件名称', minWidth: 220 },
        { field: 'sizeText', title: '附件大小', width: 110 },
        { field: 'uploadedAt', title: '上传时间', width: 180 },
        { field: 'uploader', title: '上传人', width: 110 },
        ...(activityNotice
          ? []
          : [
              {
                field: 'publicText',
                title: '展示范围',
                width: 150,
                slot: 'visibility',
                filter: false,
              },
            ]),
        {
          field: 'actions',
          title: '操作',
          width: readonly ? 150 : 200,
          slot: 'actions',
        },
      ]"
    >
      <template v-if="!activityNotice" #visibility="{ row }">
        <Checkbox
          v-if="!readonly"
          :checked="row.public"
          @change="(event) => visibility(row.id, event.target.checked)"
        >
          公开展示
        </Checkbox>
        <span v-else>{{ row.publicText }}</span>
      </template>
      <template #actions="{ row }">
        <Space>
          <Button
            v-if="/\.(pdf|png|jpe?g|txt)$/i.test(row.name)"
            type="link"
            size="small"
            @click="open(row.id)"
          >
            预览
          </Button>
          <a :href="row.content" :download="row.name" class="table-link"
            ><Download :size="14" />下载</a
          >
          <Button
            v-if="!readonly"
            type="link"
            danger
            size="small"
            @click="remove(row.id)"
          >
            <Trash2 :size="14" />
          </Button>
        </Space>
      </template>
    </ImsTable>
    <Modal
      :open="!!preview"
      :title="preview?.name"
      :footer="null"
      width="800px"
      @cancel="preview = undefined"
    >
      <img
        v-if="preview && /\.(png|jpe?g)$/i.test(preview.name)"
        :src="preview.content"
        alt="附件预览"
        style="max-height: 65vh; margin: auto"
      />
      <iframe
        v-else-if="preview && /\.pdf$/i.test(preview.name)"
        :src="preview.content"
        title="PDF 附件预览"
        style="width: 100%; height: 65vh"
      ></iframe>
      <pre
        v-else-if="preview && /\.txt$/i.test(preview.name)"
        class="attachment-text"
        >{{ previewText }}</pre>
      <div v-else class="empty-panel">
        该格式请下载后查看。<a
          :href="preview?.content"
          :download="preview?.name"
          >下载附件</a
        >
      </div>
    </Modal>
  </div>
</template>
