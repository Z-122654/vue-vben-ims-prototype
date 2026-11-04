import { message, Modal } from 'ant-design-vue';

export function perform(
  action: () => void,
  success = '操作成功，已保存到本地演示数据。',
  onError?: (error: unknown) => void,
) {
  try {
    action();
    message.success(success);
    return true;
  } catch (error) {
    onError?.(error);
    message.error(
      error instanceof Error ? error.message : '操作失败，请重试。',
    );
    return false;
  }
}
export function ask(
  title: string,
  content = '有未保存内容，是否放弃并继续？',
): Promise<boolean> {
  return new Promise((resolve) =>
    Modal.confirm({
      title,
      content,
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        resolve(true);
      },
      onCancel: () => resolve(false),
    }),
  );
}
