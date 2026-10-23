# 当前实现与复用入口

下列路径相对仓库根目录。它们是可核对的参考实现，不是要求其他 app 直接依赖竞赛业务。使用前读取当前源码，避免文档中的接口概括替代实际类型。

## 页面

| 需求 | 源码入口 | 参考重点 |
| --- | --- | --- |
| 列表、筛选与入口 | `apps/web-innovation/src/views/competition/list.vue` | 多类业务列表的筛选、操作及弹窗入口 |
| 多页签活动明细 | `apps/web-innovation/src/views/competition/activity.vue` | 操作栏、业务页签、面板、主表与子表 |
| 编辑申报明细 | `apps/web-innovation/src/views/competition/entry.vue` | 基本信息、附件、保存提交与流程图 |
| 复用材料的评审明细 | `apps/web-innovation/src/views/competition/review.vue` | 基本信息、附件、专家评分纵向分区 |
| 只读公示明细 | `apps/web-innovation/src/views/competition/result.vue` | 基本信息只读表单、获奖名单；证书独立预览 |

## 组件与状态

以下文件都位于 `apps/web-innovation/src/views/competition/`：

| 文件 | 职责与复用注意 |
| --- | --- |
| `components/DetailDialog.vue` | 大弹窗壳、内部滚动和按明细种类加载内容；种类映射含竞赛业务 |
| `detail-dialog.ts` | 父子明细上下文、返回及关闭守卫；修改时检查对应测试 |
| `components/CompetitionFrame.vue` | 页面外壳与演示身份；不是通用 IMS 权限组件 |
| `components/ImsSection.vue` | 可折叠面板标题，使用 `v-show` 保留内部内容 |
| `components/ImsTable.vue` | 基于应用 VXE 适配器的列表表格、列筛选及分页 |
| `components/ScoringTable.vue` | 基于 Ant Design Vue Table 的行内编辑子表；指标/评分模式、稳定指标 ID |
| `components/EntryInformation.vue` | 申报与评审共用基本信息，支持只读及填报人显示；字段是竞赛专属 |
| `components/AttachmentTable.vue` | 本地附件操作、受支持类型的预览和下载 |
| `components/FlowModal.vue` | 流程图及处理记录；节点定义是竞赛专属，其他业务需另定 |
| `ims.css` | 面板、操作栏、表格与响应式表单样式；选择器受 `.competition-page` 限定 |
| `model.ts`、`store.ts`、`seed.ts` | 业务类型与规则、本地持久化、虚构示例及兼容处理 |

现有 `ims-form-grid` 配合 `span-two`、`wide` 处理字段跨度。继承样式时核对外层类名和响应式规则；不要仅复制类名后另写一套近似样式。

同一模块优先复用组件。跨 app 复用先检查是否已有共享能力；确有通用需求再提取去除业务依赖的组件，不把 `EntryInformation`、评分规则或竞赛状态直接作为全仓库框架。不要为了单次设计调整无关 app 或共享包。

## 正式 IMS 的可行性调研

正式项目位于同级目录 `../ims-vue-zq`。需要确认框架承载能力时可检查：

- `src/components/ImsComponent/Group/Common/TabsItem.vue`
- `src/components/ImsComponent/Group/Form/ImsDetailMain.vue`
- `src/components/ImsComponent/Group/Form/ImsDetailModal.vue`
- `src/components/ImsComponent/Group/Table/ImsTableMain.vue`
- `src/views/sm/smDutyAttendanceRecord/config.ts` 及 `src/views/sm/smDutyAttendanceRecord/form.vue` 的页签插槽用法。

查清表单分组、子表页签和自定义业务页签的区别，不因视觉类似就认定是同一种元数据配置。原型使用自己的 Vue/Vben 组件实现对应体验；调研不自动授权修改正式 IMS 框架。正式元数据 CRUD 开发另按该仓库的 `ims-sm-metadata-crud` 技能处理，本技能不依赖它才能使用。

## 当前模块的验证入口

从仓库根目录执行，修改其他 app 时替换为该 app 的实际命令：

```powershell
pnpm --filter @vben/web-innovation run typecheck
pnpm exec vitest run apps/web-innovation/src/views/competition/model.test.ts
pnpm exec vitest run apps/web-innovation/src/views/competition/detail-dialog.test.ts
pnpm exec vitest run apps/web-innovation/src/views/competition/scoring-table.test.ts
```

按改动选择已有业务测试并遵循 app 指南，不为纯样式改动新增镜像实现的测试。浏览器重点检查实际受影响页面；本技能文档更新无需启动应用或运行这些应用检查。
