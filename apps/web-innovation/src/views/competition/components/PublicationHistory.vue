<script setup lang="ts">
import type { Publication } from '../model';

import { Form, FormItem, Input, Modal } from 'ant-design-vue';

import { projectLeader } from '../model';
import ImsSection from './ImsSection.vue';
import ImsTable from './ImsTable.vue';
defineProps<{ publication?: Publication }>();
defineEmits<{ close: [] }>();
</script>
<template>
  <Modal
    class="competition-page competition-dialog-content"
    :style="{ top: '24px', paddingBottom: 0 }"
    :body-style="{ maxHeight: 'calc(100dvh - 120px)', overflowY: 'auto' }"
    :open="!!publication"
    title="公示历史版本"
    width="min(1100px, calc(100vw - 48px))"
    :footer="null"
    @cancel="$emit('close')"
  >
    <template v-if="publication">
      <ImsSection title="版本信息">
        <Form disabled :label-col="{ style: { width: '110px' } }">
          <FormItem label="版本">
            <Input
              :value="`第 ${publication.version} 版${publication.legacy ? '（旧资料兼容快照）' : ''}`"
            />
          </FormItem>
          <FormItem label="公示标题">
            <Input :value="publication.title" />
          </FormItem>
          <FormItem label="发布时间">
            <Input :value="publication.publishedAt || '历史未记录'" />
          </FormItem>
          <FormItem label="发布人">
            <Input :value="publication.publishedBy" />
          </FormItem>
          <FormItem label="更正原因">
            <Input.TextArea
              :value="publication.reason || '首次发布／历史版本'"
            />
          </FormItem>
          <FormItem label="公示正文">
            <Input.TextArea :value="publication.body" :rows="4" />
          </FormItem>
        </Form>
      </ImsSection>
      <ImsSection title="该版本获奖名单">
        <ImsTable
          :rows="
            publication.winners.map((e) => ({
              ...e,
              applicant: projectLeader(e)?.name,
              department: projectLeader(e)?.department,
            }))
          "
          :height="260"
          :columns="[
            { field: 'name', title: '项目名称', minWidth: 220 },
            { field: 'applicant', title: '项目负责人', width: 120 },
            { field: 'department', title: '部门', width: 120 },
            { field: 'award', title: '奖项', width: 100 },
            { field: 'awardReason', title: '确认依据', minWidth: 200 },
          ]"
        />
      </ImsSection>
    </template>
  </Modal>
</template>
