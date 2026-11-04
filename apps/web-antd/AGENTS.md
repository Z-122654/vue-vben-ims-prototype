# web-antd 开发指南

适用于 `apps/web-antd/`，同时遵守根目录 `../../AGENTS.md`。修改前阅读本目录 `CONTEXT.md`。

## 开发约束

- 本应用用于原型开发，不接入真实后端；所有业务数据和操作使用 Mock。
- 沿用 Ant Design Vue 和现有 Vben 组件、表单、VXE 表格适配，不另建平行组件体系。
- 功能页面放在 `src/views/`，路由放在 `src/router/routes/modules/`。
- 使用 `#/` 引用本应用源码，复用 `@vben/*` 公共能力。
- 页面文案遵循现有多语言方式，需要时同步维护 `src/locales/`。
- 本地 Mock 数据与页面展示逻辑分离，优先放在所属功能目录的独立模块中。
- 需要 HTTP 模拟时在 `../backend-mock/` 补充接口，并同步匹配前端类型与响应格式。
- 不将 `/api` 代理、请求基地址或登录流程切换到真实业务服务。
- 查询、保存、删除等操作应有可见反馈，模拟数据应支持演示所需的状态变化。
- 本应用的专属变化不自动同步到 `web-innovation`；共享包修改需检查两者影响。

## 验证与维护

- 代码修改运行 `pnpm --filter @vben/web-antd run typecheck`。
- 涉及打包或运行配置时运行 `pnpm build:antd`。
- UI 修改检查路由可达、数据展示、表单校验和操作后的模拟状态。
- 文档修改仅检查内容与格式；新增功能或数据策略变化时同步更新 `CONTEXT.md`。
