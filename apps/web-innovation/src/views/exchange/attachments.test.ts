import type { Attachment } from './model';

import { createApp, defineComponent, h, nextTick, ref } from 'vue';

import { afterEach, expect, it, vi } from 'vitest';

import Attachments from './Attachments.vue';

const ui = vi.hoisted(() => ({ upload: undefined as any, error: vi.fn() }));
vi.mock('ant-design-vue', async (original) => {
  const actual = await original<typeof import('ant-design-vue')>();
  const { defineComponent, h } = await import('vue');
  return {
    ...actual,
    message: { error: ui.error },
    Upload: Object.assign(
      defineComponent({
        props: ['beforeUpload'],
        setup(props, { slots }) {
          ui.upload = props.beforeUpload;
          return () => h('div', slots.default?.());
        },
      }),
      { LIST_IGNORE: 'ignore' },
    ),
  };
});
class Reader {
  static reads: Reader[] = [];
  onabort?: () => void;
  abort = vi.fn(() => this.onabort?.());
  onerror?: () => void;
  onload?: () => void;
  result = 'data:application/msword;base64,YWJj';
  readAsDataURL() {
    Reader.reads.push(this);
  }
}
const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).forEach((fn) => fn());
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  ui.error.mockClear();
});
async function flush() {
  for (let n = 0; n < 8; n++) await nextTick();
}
function file(id: string): Attachment {
  return {
    id,
    name: `${id}.doc`,
    size: 3,
    content: 'data:application/msword;base64,YWJj',
    uploader: '演示人员',
    time: '2026-10-30 09:00:00',
  };
}
async function setup(count = 0) {
  Reader.reads = [];
  vi.stubGlobal('FileReader', Reader);
  const rows = ref(Array.from({ length: count }, (_, i) => file(String(i))));
  const readonly = ref(false);
  const pending = ref(0);
  const instance = ref<InstanceType<typeof Attachments>>();
  const app = createApp(
    defineComponent({
      setup: () => () =>
        h(Attachments, {
          ref: instance,
          modelValue: rows.value,
          readonly: readonly.value,
          uploader: '演示人员',
          'onUpdate:modelValue': (value) => {
            rows.value = value;
          },
          onPending: (value) => {
            pending.value = value;
          },
        }),
    }),
  );
  const host = document.createElement('div');
  document.body.append(host);
  app.mount(host);
  cleanup.push(() => app.unmount());
  await flush();
  const upload = (name = '新增.doc') =>
    ui.upload(new File(['abc'], name)) as Promise<unknown>;
  return { rows, readonly, pending, instance, upload };
}
it('读取占用附件名额，失败释放名额且可重试', async () => {
  const s = await setup(5);
  const first = s.upload();
  expect(s.pending.value).toBe(1);
  await s.upload('超出名额.doc');
  expect(Reader.reads).toHaveLength(1);
  Reader.reads[0]!.onerror?.();
  await first;
  expect(s.pending.value).toBe(0);
  const retry = s.upload();
  Reader.reads[1]!.onload?.();
  await retry;
  expect(s.rows.value).toHaveLength(6);
  expect(s.pending.value).toBe(0);
});
it('并发读取按最新附件合并，不复活读取期间已删除的附件', async () => {
  const s = await setup(1);
  const a = s.upload('甲.doc');
  const b = s.upload('乙.pdf');
  s.rows.value = [];
  await flush();
  Reader.reads[1]!.onload?.();
  Reader.reads[0]!.onload?.();
  await Promise.all([a, b]);
  expect(s.rows.value.map((f) => f.name).sort()).toEqual(
    ['乙.pdf', '甲.doc'].sort(),
  );
  expect(s.pending.value).toBe(0);
});
it.each(['关闭', '只读'] as const)(
  '%s时取消读取，迟到回调不能加入附件',
  async (mode) => {
    const s = await setup();
    const work = s.upload();
    if (mode === '关闭') s.instance.value!.cancel();
    else {
      s.readonly.value = true;
      await flush();
    }
    Reader.reads[0]!.onload?.();
    await work;
    expect(Reader.reads[0]!.abort).toHaveBeenCalled();
    expect(s.rows.value).toEqual([]);
    expect(s.pending.value).toBe(0);
    expect(ui.error).not.toHaveBeenCalled();
  },
);
it('只读 Word 附件仅提供原文件下载，不显示预览及修改入口', async () => {
  const s = await setup(1);
  s.readonly.value = true;
  await flush();
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('0.doc');
      expect(this.href).toBe(s.rows.value[0]!.content);
    });
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('button')];
  expect(buttons.map((b) => b.textContent?.trim())).toEqual(['下载']);
  buttons[0]!.click();
  expect(click).toHaveBeenCalledOnce();
});

it('预览中的附件从当前可见清单移除时立即关闭预览', async () => {
  const s = await setup(1);
  s.rows.value[0]!.name = '示例.png';
  s.readonly.value = true;
  await flush();
  [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find((b) => b.textContent?.trim() === '预览')!
    .click();
  await flush();
  expect(document.querySelector('img[alt="示例.png"]')).not.toBeNull();
  s.rows.value = [];
  await flush();
  expect(document.querySelector('img[alt="示例.png"]')).toBeNull();
});
