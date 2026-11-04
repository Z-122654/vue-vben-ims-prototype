import type { Ref } from 'vue';

import { ref } from 'vue';

import { message, Modal } from 'ant-design-vue';

/** Shared by activity and entry forms; cancellation precedes restoring saved data. */
export function useAttachmentGuard(
  dirty: Ref<boolean | undefined>,
  discard: () => void,
) {
  const pendingAttachments = ref(0);
  const attachmentTable = ref<{ cancelUploads: () => void }>();

  function setAttachmentTable(value: unknown) {
    attachmentTable.value = value as undefined | { cancelUploads: () => void };
  }

  function attachmentsReady() {
    if (!pendingAttachments.value) return true;
    message.warning('附件正在读取，请等待完成后再保存或提交。');
    return false;
  }

  function confirmDiscard(refresh = false): Promise<boolean> {
    if (!dirty.value && !pendingAttachments.value) {
      if (refresh) discard();
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      Modal.confirm({
        title: pendingAttachments.value
          ? `附件正在读取，确定取消读取并${refresh ? '刷新' : '离开'}？`
          : `尚有未保存内容，确定${refresh ? '刷新' : '离开'}？`,
        content: '确认后将放弃未保存的修改和未完成的附件读取。',
        okText: refresh ? '放弃并刷新' : '放弃并离开',
        cancelText: '继续填写',
        onOk: () => {
          attachmentTable.value?.cancelUploads();
          discard();
          resolve(true);
        },
        onCancel: () => resolve(false),
      });
    });
  }

  return {
    pendingAttachments,
    attachmentTable,
    setAttachmentTable,
    attachmentsReady,
    confirmDiscard,
  };
}
