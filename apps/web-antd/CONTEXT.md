# web-antd 应用上下文

## 定位

`@vben/web-antd` 是仓库中的 Ant Design Vue 前端应用，当前用于 IMS 原型开发。不接入真实后端；页面和交互所需数据使用 Mock，业务操作只模拟结果与状态。项目整体背景见 `../../CONTEXT.md`。

## 当前结构

- `src/main.ts`、`src/bootstrap.ts`、`src/app.vue`：应用入口和初始化。
- `src/views/`：仪表盘、组件示例和核心页面。
- `src/router/routes/modules/`：功能路由模块。
- `src/api/`：请求封装及登录、用户、菜单等接口入口。
- `src/adapter/`：Ant Design Vue 组件、表单和 VXE 表格适配。
- `src/store/`：应用状态；`src/layouts/`：应用布局。
- `src/locales/`、`src/preferences.ts`：多语言和应用偏好配置。
- `vite.config.ts`：应用构建与开发代理配置。

源码内部别名为 `#/`，共享能力通过 `@vben/*` 引用。目前包含 analytics、workspace 仪表盘及 Ant Design Vue 示例，新增原型功能应归入本应用自己的页面与路由模块。

## Mock 方式

开发环境已启用 Nitro Mock 插件，`/api` 代理目标为 `http://localhost:5320/api`。模拟接口位于 `../backend-mock/`，页面也可使用所属模块的本地 Mock 数据。现有请求封装不代表需要对接真实后端；新增数据需求仍按原型方式实现。构建预览时需另行确保本地数据或配套 Mock 服务可用。

## 根目录执行命令

- 开发：`pnpm dev:antd`
- 类型检查：`pnpm --filter @vben/web-antd run typecheck`
- 构建：`pnpm build:antd`
- 预览：`pnpm --filter @vben/web-antd run preview`
