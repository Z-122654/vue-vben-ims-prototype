<script setup lang="ts">
import { inject } from 'vue';

import { Alert, Button, Select, Tag } from 'ant-design-vue';

import { detailContextKey } from '../detail-dialog';
import { people, roleNames } from '../model';
import { useCompetition } from '../store';
import { confirmAction } from '../ui';

import '../ims.css';

const { actorId, actor, switchActor, reset, storageWarning } = useCompetition();
const detail = inject(detailContextKey, undefined);
const options = people.map((p) => ({
  value: p.id,
  label: `${roleNames[p.role]} · ${p.name}`,
}));
</script>

<template>
  <div
    class="competition-page"
    :class="{ 'competition-dialog-content': !!detail }"
  >
    <div v-if="!detail" class="demo-bar">
      <div>
        <Tag color="blue">原型演示</Tag
        ><span>虚构数据 · 操作保存在本浏览器，刷新不丢失</span>
      </div>
      <div class="demo-controls">
        <span>演示身份</span>
        <Select
          :value="actorId"
          :options="options"
          aria-label="演示身份"
          style="width: 218px"
          @change="(value) => switchActor(String(value))"
        />
        <Button
          type="link"
          @click="
            confirmAction(
              '恢复初始演示数据？',
              reset,
              '本模块内新增的活动、作品、评分和附件将清空，恢复预置示例。',
            )
          "
        >
          重置演示
        </Button>
      </div>
    </div>
    <Alert
      v-if="storageWarning"
      :message="storageWarning"
      type="warning"
      show-icon
    />
    <main class="ims-surface" :data-demo-role="actor.role"><slot></slot></main>
  </div>
</template>
