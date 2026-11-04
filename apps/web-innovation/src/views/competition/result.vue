<script setup lang="ts">
import type { PublishedWinner } from './model';

import { computed, ref } from 'vue';

import { Download } from '@vben/icons';

import { Button, Form, FormItem, Input, Modal, Tag } from 'ant-design-vue';

import SourceLaunch from '../knowledge/SourceLaunch.vue';
import { createCertificateSvg } from './certificate';
import CompetitionFrame from './components/CompetitionFrame.vue';
import ImsSection from './components/ImsSection.vue';
import ImsTable from './components/ImsTable.vue';
import { useDetailDialog } from './detail-dialog';
import {
  canDownloadCertificate,
  currentPublication,
  projectLeader,
} from './model';
import { useCompetition } from './store';
import { download, exportCsv } from './ui';
const { data, actor } = useCompetition();
const winnersTable = ref<InstanceType<typeof ImsTable>>();
const { recordId, openDetail, close } = useDetailDialog();
const knowledgeBusy = ref(false);
useDetailDialog().onBeforeClose?.(() => !knowledgeBusy.value);
const sourceActivity = computed(() =>
  data.value.activities.find(
    (a) => a.id === recordId.value && ['已公示', '已结束'].includes(a.status),
  ),
);
const activity = computed(() => {
  const a = sourceActivity.value;
  if (!a) return undefined;
  const p = currentPublication(a);
  return p
    ? {
        ...a,
        name: p.activityName,
        department: p.department,
        contact: p.contact,
        phone: p.phone,
        noticeTitle: p.title,
        noticeBody: p.body,
        noticeDate: p.noticeDate,
      }
    : a;
});
const winners = computed(() =>
  (activity.value
    ? (currentPublication(activity.value)?.winners ?? [])
    : []
  ).map((e) => ({
    ...e,
    applicant: projectLeader(e)?.name ?? '—',
    department: projectLeader(e)?.department ?? '—',
  })),
);
const certificate = ref<PublishedWinner>();
function certificateAllowed(id: string) {
  const winner = winners.value.find((e) => e.id === id);
  return (
    !!activity.value &&
    !!winner &&
    canDownloadCertificate(activity.value, winner, actor.value)
  );
}
const certificateSvg = computed(() => {
  const entry = certificate.value;
  const a = activity.value;
  if (!entry || !a || !canDownloadCertificate(a, entry, actor.value)) return '';
  return createCertificateSvg({
    recipient: projectLeader(entry)?.name ?? '—',
    projectName: entry.name,
    activityName: a.name,
    award: entry.award,
    department: a.department,
    date: a.noticeDate,
    code: entry.code,
  });
});
function downloadCertificate() {
  const entry = certificate.value;
  const a = activity.value;
  if (!entry || !a || !canDownloadCertificate(a, entry, actor.value)) return;
  download(
    certificateSvg.value,
    `${entry.name}-${entry.award}-演示证书.svg`,
    'image/svg+xml;charset=utf-8',
  );
}
</script>
<template>
  <CompetitionFrame>
    <template v-if="activity">
      <div class="detail-toolbar">
        <Button type="primary" @click="close">关闭</Button>
        <Button
          type="primary"
          @click="
            exportCsv(
              winnersTable?.filtered ?? winners,
              [
                { field: 'name', title: '项目名称' },
                { field: 'category', title: '项目类别' },
                { field: 'applicant', title: '项目负责人' },
                { field: 'department', title: '部门' },
                { field: 'award', title: '奖项' },
              ],
              '获奖名单',
            )
          "
        >
          <Download :size="16" />导出名单
        </Button>
      </div>
      <div class="ims-body">
        <ImsSection title="基本信息">
          <Form disabled :label-col="{ style: { width: '125px' } }">
            <div class="ims-form-grid">
              <FormItem label="公示标题" class="wide">
                <Input :value="activity.noticeTitle" />
              </FormItem>
              <FormItem label="活动名称" class="wide">
                <div class="flex items-center gap-2">
                  <Input :value="activity.name" />
                  <Button
                    type="link"
                    :disabled="false"
                    @click="openDetail({ kind: 'activity', id: activity.id })"
                  >
                    查看活动
                  </Button>
                </div>
              </FormItem>
              <FormItem label="组织单位">
                <Input :value="activity.department" />
              </FormItem>
              <FormItem label="公示日期">
                <Input :value="activity.noticeDate" />
              </FormItem>
              <FormItem label="当前状态">
                <Input :value="activity.status" />
              </FormItem>
              <FormItem label="异议反馈联系人">
                <Input :value="activity.contact" />
              </FormItem>
              <FormItem label="联系电话">
                <Input :value="activity.phone" />
              </FormItem>
              <FormItem label="公示正文" class="wide">
                <Input.TextArea
                  :value="activity.noticeBody"
                  :auto-size="{ minRows: 4 }"
                />
              </FormItem>
            </div>
          </Form>
        </ImsSection>
        <ImsSection title="获奖名单">
          <p v-if="!winners.length" class="rule-caption">
            本次公示无获奖项目，具体说明见公示正文。
          </p>
          <ImsTable
            ref="winnersTable"
            :rows="winners"
            :height="350"
            :columns="[
              { field: 'name', title: '项目名称', minWidth: 280 },
              { field: 'category', title: '类别', width: 130 },
              { field: 'applicant', title: '项目负责人', minWidth: 180 },
              { field: 'department', title: '部门', width: 130 },
              { field: 'award', title: '奖项', width: 130, slot: 'award' },
              { field: 'actions', title: '操作', width: 280, slot: 'actions' },
            ]"
          >
            <template #award="{ row }">
              <Tag color="gold">{{ row.award }}</Tag>
            </template>
            <template #actions="{ row }">
              <Button
                type="link"
                @click="openDetail({ kind: 'entry', id: row.id })"
              >
                项目明细 </Button
              ><Button
                v-if="certificateAllowed(row.id)"
                type="link"
                @click="certificate = winners.find((e) => e.id === row.id)"
              >
                证书 </Button
              ><SourceLaunch
                v-if="activity"
                module="competition"
                :parent-id="activity.id"
                :object-id="row.id"
                :source-actor-id="actor.id"
                @busy="knowledgeBusy = $event"
              />
            </template>
          </ImsTable>
        </ImsSection>
      </div>
    </template>
    <div v-else class="empty-panel">
      该活动尚未公示或不存在。<Button type="link" @click="close">
        返回公示列表
      </Button>
    </div>
    <Modal
      :open="!!certificate"
      title="电子证书预览"
      width="790px"
      :footer="null"
      @cancel="certificate = undefined"
    >
      <div v-if="certificateSvg" style="max-height: 65vh; overflow-y: auto">
        <img
          :src="`data:image/svg+xml;charset=utf-8,${encodeURIComponent(certificateSvg)}`"
          alt="荣誉证书预览（与下载文件一致）"
          style="display: block; width: 100%; height: auto"
        />
      </div>
      <div style="margin-top: 18px; text-align: right">
        <Button type="primary" @click="downloadCertificate">
          下载证书（SVG）
        </Button>
      </div>
    </Modal>
  </CompetitionFrame>
</template>
