import type { Attachment } from './model';

import { computed, createApp, defineComponent, h, nextTick, ref } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { useAttachmentGuard } from './attachment-guard';
import AttachmentTable from './components/AttachmentTable.vue';

const ui = vi.hoisted(() => ({
  error: vi.fn(),
  warning: vi.fn(),
  confirm: vi.fn(),
  success: vi.fn(),
  upload: undefined as unknown,
}));
vi.mock('./store', () => ({
  useCompetition: () => ({ actor: { value: { name: '演示填报人' } } }),
}));
vi.mock('ant-design-vue', async () => {
  const { defineComponent, h } = await import('vue');
  const container = defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  });
  const Upload = Object.assign(
    defineComponent({
      props: ['beforeUpload'],
      setup(props) {
        ui.upload = props.beforeUpload;
        return () => h('div');
      },
    }),
    { LIST_IGNORE: 'ignore' },
  );
  return {
    Upload,
    Button: container,
    Checkbox: container,
    Modal: Object.assign(container, { confirm: ui.confirm }),
    Space: container,
    message: ui,
  };
});
vi.mock('./components/ImsTable.vue', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    default: defineComponent({
      props: ['rows', 'columns'],
      setup:
        (props, { slots }) =>
        () =>
          h('table', [
            h(
              'thead',
              props.columns.map((column: { title: string }) =>
                h('th', column.title),
              ),
            ),
            h(
              'tbody',
              props.rows.map((row: Attachment) =>
                h(
                  'tr',
                  props.columns.map(
                    (column: { field: keyof Attachment; slot?: string }) =>
                      h(
                        'td',
                        column.slot
                          ? slots[column.slot]?.({ row })
                          : String(row[column.field] ?? ''),
                      ),
                  ),
                ),
              ),
            ),
          ]),
    }),
  };
});

class PendingReader {
  static reads: PendingReader[] = [];
  abort = vi.fn();
  onerror?: () => void;
  onload?: () => void;
  result = 'data:text/plain;base64,YQ==';
  readAsDataURL() {
    PendingReader.reads.push(this);
  }
}
const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
function setup(count = 0, activityNotice = false, publicOnly = false) {
  PendingReader.reads = [];
  vi.stubGlobal('FileReader', PendingReader);
  const rows = ref<Attachment[]>(
    Array.from({ length: count }, (_, i) => ({
      id: String(i),
      name: `${i}.txt`,
      size: 1,
      uploadedAt: '',
      uploader: '演示填报人',
      public: false,
      content: 'data:text/plain;base64,YQ==',
    })),
  );
  const readonly = ref(false);
  const saved = ref(JSON.stringify(rows.value));
  const guard = useAttachmentGuard(
    computed(() => JSON.stringify(rows.value) !== saved.value),
    () => {
      rows.value = JSON.parse(saved.value);
    },
  );
  const app = createApp(
    defineComponent({
      setup: () => () =>
        h(AttachmentTable, {
          ref: guard.attachmentTable,
          modelValue: rows.value,
          onPendingChange: (count: number) => {
            guard.pendingAttachments.value = count;
          },
          readonly: readonly.value,
          activityNotice,
          publicOnly,
          'onUpdate:modelValue': (value) => {
            rows.value = value;
          },
        }),
    }),
  );
  const host = document.createElement('div');
  app.mount(host);
  cleanups.push(() => app.unmount());
  const upload = (name: string) =>
    (ui.upload as (file: File) => Promise<unknown>)(new File(['a'], name));
  return {
    host,
    rows,
    readonly,
    upload,
    saved,
    guard,
    unmount: () => app.unmount(),
  };
}

describe('活动附件不单独限制查看，申报附件保留展示范围', () => {
  it.each([false, true])(
    '活动只读=%s：忽略旧公开标记，展示全部文件和下载入口，无展示范围列',
    async (readOnly) => {
      const { host, rows, readonly } = setup(2, true, true);
      rows.value[0]!.name = '历史内部.pdf';
      rows.value[1]!.name = '历史公开.pdf';
      rows.value[1]!.public = true;
      readonly.value = readOnly;
      await nextTick();
      expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
      expect(host.textContent).not.toContain('展示范围');
      expect(host.textContent).not.toContain('公开展示');
      expect(
        [...host.querySelectorAll('a[download]')].map((a) =>
          a.getAttribute('download'),
        ),
      ).toEqual(['历史内部.pdf', '历史公开.pdf']);
      expect(host.querySelectorAll('[danger]')).toHaveLength(readOnly ? 0 : 2);
      expect(host.textContent?.match(/预览/g)).toHaveLength(2);
      expect(rows.value.map((a) => a.public)).toEqual([false, true]);
      if (readOnly) expect(host.textContent).not.toContain('新增附件');
    },
  );
  it.each([false, true])(
    '申报公开浏览=%s：继续按公开标记过滤，保留展示范围列',
    async (publicOnly) => {
      const { host, rows, readonly } = setup(2, false, publicOnly);
      rows.value[1]!.public = true;
      readonly.value = true;
      await nextTick();
      expect(host.querySelectorAll('tbody tr')).toHaveLength(
        publicOnly ? 1 : 2,
      );
      expect(host.textContent).toContain('展示范围');
      expect(
        [...host.querySelectorAll('a[download]')].map((a) =>
          a.getAttribute('download'),
        ),
      ).toEqual(publicOnly ? ['1.txt'] : ['0.txt', '1.txt']);
      expect(host.querySelectorAll('[danger]')).toHaveLength(0);
    },
  );
});

describe('附件读取并发与数量限制', () => {
  it.each([false, true])(
    '活动通知=%s：已有5份时待完成读取占名额，第7份不读取、不加入',
    async (notice) => {
      const { rows, upload } = setup(5, notice);
      const filename = notice ? 'six.pdf' : 'six.txt';
      const pending = upload(filename);
      expect(await upload(notice ? 'seven.pdf' : 'seven.txt')).toBe('ignore');
      expect(PendingReader.reads).toHaveLength(1);
      PendingReader.reads[0]!.onload!();
      await pending;
      expect(rows.value).toHaveLength(6);
      expect(rows.value.at(-1)?.name).toBe(filename);
      expect(ui.error).toHaveBeenCalledWith('每条记录最多添加 6 个演示附件。');
    },
  );
  it('同时读完的附件全部保留，不因父组件更新时序覆盖', async () => {
    const { rows, upload } = setup();
    const tasks = ['a.txt', 'b.txt', 'c.txt'].map(upload);
    PendingReader.reads.forEach((reader) => reader.onload!());
    await Promise.all(tasks);
    expect(rows.value.map((row) => row.name)).toEqual([
      'a.txt',
      'b.txt',
      'c.txt',
    ]);
    expect(new Set(rows.value.map((row) => row.id)).size).toBe(3);
    expect(rows.value.every((row) => !row.public)).toBe(true);
  });
  it('读取失败释放名额，重新上传可以成功', async () => {
    const { rows, upload } = setup(5);
    const failed = upload('failed.txt');
    PendingReader.reads[0]!.onerror!();
    await failed;
    expect(rows.value).toHaveLength(5);
    const retried = upload('retry.txt');
    PendingReader.reads[1]!.onload!();
    await retried;
    expect(rows.value).toHaveLength(6);
    expect(rows.value.at(-1)?.name).toBe('retry.txt');
  });
  it('读取期间表单已达到上限，完成时再次拦截', async () => {
    const { rows, upload } = setup(5);
    const pending = upload('late.txt');
    rows.value = [
      ...rows.value,
      { ...rows.value[0]!, id: 'other', name: 'other.txt' },
    ];
    await nextTick();
    PendingReader.reads[0]!.onload!();
    await pending;
    expect(rows.value).toHaveLength(6);
    expect(rows.value.some((row) => row.name === 'late.txt')).toBe(false);
  });
  it('读取期间转只读，不再写入附件', async () => {
    const { rows, readonly, upload } = setup();
    const pending = upload('late.txt');
    readonly.value = true;
    await nextTick();
    PendingReader.reads[0]!.onload!();
    await pending;
    expect(rows.value).toHaveLength(0);
    expect(ui.success).not.toHaveBeenCalled();
  });
});

describe('附件读取与表单操作衔接', () => {
  it.each([false, true])(
    '活动通知=%s：读取期间拦截保存和提交，全部完成后可以保存全部附件',
    async (notice) => {
      const { upload, rows, saved, guard } = setup(0, notice);
      const first = upload(notice ? 'a.pdf' : 'a.doc');
      const second = upload(notice ? 'b.PDF' : 'b.docx');
      expect(guard.pendingAttachments.value).toBe(2);
      expect(guard.attachmentsReady()).toBe(false);
      expect(saved.value).toBe('[]');
      PendingReader.reads[0]!.onload!();
      await first;
      expect(guard.pendingAttachments.value).toBe(1);
      expect(guard.attachmentsReady()).toBe(false);
      PendingReader.reads[1]!.onload!();
      await second;
      expect(guard.attachmentsReady()).toBe(true);
      saved.value = JSON.stringify(rows.value);
      expect(JSON.parse(saved.value)).toHaveLength(2);
    },
  );

  it.each([false, true])(
    '刷新=%s：只选择附件也提示，继续填写保留读取和已有内容',
    async (refresh) => {
      const { upload, rows, guard } = setup(1);
      const pending = upload('continue.doc');
      const leaving = guard.confirmDiscard(refresh);
      expect(ui.confirm).toHaveBeenCalledOnce();
      ui.confirm.mock.calls[0]![0].onCancel();
      expect(await leaving).toBe(false);
      expect(guard.pendingAttachments.value).toBe(1);
      expect(PendingReader.reads[0]!.abort).not.toHaveBeenCalled();
      PendingReader.reads[0]!.onload!();
      await pending;
      expect(rows.value).toHaveLength(2);
    },
  );

  it.each([false, true])(
    '刷新=%s：确认放弃取消读取，迟到回调不写回；重新选择仍可成功',
    async (refresh) => {
      const { upload, rows, guard } = setup(1);
      const pending = upload('discard.doc');
      const lateReader = PendingReader.reads[0]!;
      const leaving = guard.confirmDiscard(refresh);
      ui.confirm.mock.calls[0]![0].onOk();
      expect(await leaving).toBe(true);
      expect(lateReader.abort).toHaveBeenCalledOnce();
      expect(guard.pendingAttachments.value).toBe(0);
      const next = upload('new.doc');
      lateReader.onload!();
      await pending;
      expect(guard.pendingAttachments.value).toBe(1);
      expect(rows.value).toHaveLength(1);
      expect(ui.error).not.toHaveBeenCalled();
      PendingReader.reads[1]!.onload!();
      await next;
      expect(rows.value.map((row) => row.name)).toEqual(['0.txt', 'new.doc']);
      expect(guard.pendingAttachments.value).toBe(0);
    },
  );

  it('读完但尚未合并时取消，同样禁止迟到合并', async () => {
    const { upload, rows, guard } = setup();
    const pending = upload('queued.doc');
    PendingReader.reads[0]!.onload!();
    guard.attachmentTable.value!.cancelUploads();
    await pending;
    expect(rows.value).toHaveLength(0);
    expect(ui.success).not.toHaveBeenCalled();
  });

  it('组件卸载取消读取，不再更新表单或弹成功消息', async () => {
    const { upload, rows, unmount, guard } = setup();
    const pending = upload('unmounted.doc');
    unmount();
    PendingReader.reads[0]!.onload!();
    await pending;
    expect(rows.value).toHaveLength(0);
    expect(guard.pendingAttachments.value).toBe(0);
    expect(ui.success).not.toHaveBeenCalled();
    expect(ui.error).not.toHaveBeenCalled();
  });

  it('读取失败解除保存拦截，零附件仍可继续；无修改时关闭无需提示', async () => {
    const { upload, guard } = setup();
    const pending = upload('error.doc');
    PendingReader.reads[0]!.onerror!();
    await pending;
    expect(guard.attachmentsReady()).toBe(true);
    expect(await guard.confirmDiscard()).toBe(true);
    expect(ui.confirm).not.toHaveBeenCalled();
  });
});

describe('活动附件仅允许 PDF，申报附件保留原范围', () => {
  it.each([
    '通知.doc',
    '通知.docx',
    '图片.png',
    '说明.txt',
    '通知.pdf.exe',
    '通知',
  ])('活动拒绝 %s，不开始读取或改变已有附件', async (name) => {
    const { rows, upload, guard } = setup(1, true);
    const before = JSON.stringify(rows.value);
    expect(await upload(name)).toBe('ignore');
    expect(PendingReader.reads).toHaveLength(0);
    expect(guard.pendingAttachments.value).toBe(0);
    expect(JSON.stringify(rows.value)).toBe(before);
    expect(ui.error).toHaveBeenCalledWith('活动附件仅支持上传 PDF 文件。');
  });
  it.each(['通知.pdf', '通知.PDF'])(
    '活动接受 %s，保留原文件名和已有历史附件',
    async (name) => {
      const { rows, upload } = setup(1, true);
      const pending = upload(name);
      expect(PendingReader.reads).toHaveLength(1);
      PendingReader.reads[0]!.onload!();
      await pending;
      expect(rows.value.map((a) => a.name)).toEqual(['0.txt', name]);
      expect(rows.value[1]!.public).toBe(false);
    },
  );
  it.each(['材料.doc', '材料.docx', '图片.png', '说明.txt', '材料.pdf'])(
    '申报仍接受 %s',
    async (name) => {
      const { rows, upload } = setup();
      const pending = upload(name);
      PendingReader.reads[0]!.onload!();
      await pending;
      expect(rows.value[0]!.name).toBe(name);
      expect(ui.error).not.toHaveBeenCalled();
    },
  );
  it('活动 PDF 仍受 1 MB 大小限制', async () => {
    const { rows, guard } = setup(0, true);
    const result = await (ui.upload as (file: File) => Promise<unknown>)(
      new File([new Uint8Array(1024 * 1024 + 1)], '过大.pdf'),
    );
    expect(result).toBe('ignore');
    expect(rows.value).toHaveLength(0);
    expect(PendingReader.reads).toHaveLength(0);
    expect(guard.pendingAttachments.value).toBe(0);
    expect(ui.error).toHaveBeenCalledWith('演示附件请控制在 1 MB 以内。');
  });
});
