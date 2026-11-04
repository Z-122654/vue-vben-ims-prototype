<script setup lang="ts">
import type { Activity, Entry } from '../model';

import { computed } from 'vue';

import { AutoComplete, Form, FormItem, Input, Select } from 'ant-design-vue';

import {
  categories,
  entrySubmissionTime,
  fieldLimits,
  leaderOptionsForActivity,
  person,
  projectLeader,
} from '../model';
import ImsSection from './ImsSection.vue';

const props = withDefaults(
  defineProps<{
    activity?: Activity;
    leaderDepartment?: string;
    activityOptions?: { label: string; value: string }[];
    isNew?: boolean;
    readonly?: boolean;
    showSubmitter?: boolean;
    statusLabel?: string;
  }>(),
  {
    activityOptions: () => [],
    statusLabel: '当前状态',
  },
);
const form = defineModel<Entry>({ required: true });
const leaderOptions = computed(() =>
  leaderOptionsForActivity(props.leaderDepartment, props.activity),
);
</script>
<template>
  <Form :disabled="readonly" :label-col="{ style: { width: '125px' } }">
    <ImsSection title="基本信息">
      <div class="ims-form-grid">
        <FormItem label="所属活动" required class="span-two">
          <Input :value="activity?.name" disabled />
        </FormItem>
        <FormItem label="申报编号">
          <Input :value="form.code" disabled />
        </FormItem>
        <FormItem label="项目名称" required class="span-two">
          <Input
            v-model:value="form.name"
            placeholder="请输入项目名称"
            :maxlength="fieldLimits.entryName"
          />
        </FormItem>
        <FormItem label="项目类别">
          <AutoComplete
            v-model:value="form.category"
            :options="categories.map((value) => ({ value }))"
            placeholder="选填，请选择或输入项目类别"
          >
            <Input :maxlength="fieldLimits.category" />
          </AutoComplete>
        </FormItem>
        <FormItem label="项目负责人" required>
          <Input
            v-if="readonly"
            :value="
              projectLeader(form)
                ? `${projectLeader(form).name} · ${projectLeader(form).department}`
                : '—'
            "
            disabled
          />
          <Select
            v-else
            v-model:value="form.leaderId"
            :options="leaderOptions"
            placeholder="请选择项目负责人"
            show-search
            option-filter-prop="label"
          />
        </FormItem>
        <FormItem label="部门" required>
          <Input
            :value="
              (readonly ? projectLeader(form) : person(form.leaderId))
                ?.department || ''
            "
            disabled
          />
        </FormItem>
        <FormItem :label="statusLabel">
          <Input :value="form.status" disabled />
        </FormItem>
        <FormItem label="最近提交时间">
          <Input :value="entrySubmissionTime(form) || '尚未提交'" disabled />
        </FormItem>
        <FormItem label="首次提交时间">
          <Input :value="form.firstSubmittedAt || '尚未记录'" disabled />
        </FormItem>
        <FormItem v-if="showSubmitter" label="填报人">
          <Input :value="person(form.ownerId).name" disabled />
        </FormItem>
        <FormItem label="项目简介" required class="wide">
          <Input.TextArea
            v-model:value="form.summary"
            :rows="4"
            :maxlength="fieldLimits.summary"
            show-count
            placeholder="请输入项目简介（1000字以内），可通过附件补充申报材料"
          />
        </FormItem>
        <FormItem label="获得成果／专利" class="wide">
          <Input.TextArea
            v-model:value="form.achievements"
            :rows="3"
            placeholder="选填：成果名称、鉴定编号、专利名称及编号等"
          />
        </FormItem>
        <FormItem v-if="activity" label="申报要求" class="wide">
          <Input.TextArea
            :value="activity.requirements"
            :auto-size="{ minRows: 2, maxRows: 6 }"
            disabled
          />
        </FormItem>
      </div>
    </ImsSection>
  </Form>
</template>
