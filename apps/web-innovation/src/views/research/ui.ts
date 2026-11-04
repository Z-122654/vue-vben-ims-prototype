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
export function confirmAction(
  title: string,
  action: () => void,
  content = '此操作仅更新当前浏览器中的演示数据。',
) {
  Modal.confirm({
    title,
    content,
    okText: '确定',
    cancelText: '取消',
    onOk: () => {
      perform(action);
    },
  });
}
export function download(
  content: BlobPart,
  name: string,
  type = 'text/plain;charset=utf-8',
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportCsv(
  rows: Record<string, unknown>[],
  columns: { field: string; title: string }[],
  name: string,
) {
  const escape = (value: unknown) => {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  download(
    `\uFEFF${[
      columns.map((c) => escape(c.title)).join(','),
      ...rows.map((r) => columns.map((c) => escape(r[c.field])).join(',')),
    ].join('\r\n')}`,
    `${name}.csv`,
    'text/csv;charset=utf-8',
  );
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
