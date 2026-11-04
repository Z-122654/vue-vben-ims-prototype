# 项目上下文

## 项目定位

本仓库 `vue-vben-ims-prototype` 用于 IMS 前端原型开发、交互验证和演示。当前阶段不接入真实后端；页面、登录、权限和业务流程需要的数据统一使用 Mock。原型中的保存、提交、审批等行为仅模拟状态变化，不执行真实业务操作。

## 技术与目录

项目基于 Vue Vben Admin，使用 Vue 3、TypeScript、Vite、Pinia 和 Vue Router，通过 pnpm workspace 与 Turborepo 管理多应用和共享包。

| 路径 | 当前职责 |
| --- | --- |
| `apps/web-antd/` | 使用 Ant Design Vue 的前端应用，包含仪表盘和组件示例 |
| `apps/web-innovation/` | 独立的前端原型应用，当前同样使用 Ant Design Vue |
| `apps/backend-mock/` | 基于 Nitro 的本地 Mock 服务，为前端提供模拟响应 |
| `packages/` | 共享组件、布局、状态、工具及核心能力 |
| `internal/` | Vite、TypeScript、样式和代码检查配置 |
| `playground/` | 组件与功能示例、试验场 |
| `docs/` | 框架文档 |
| `scripts/` | 仓库开发与构建工具 |

各应用的细节见其 `CONTEXT.md`，开发约束见根目录及所属应用的 `AGENTS.md`。

## 数据与运行方式

- 优先使用页面所属模块的本地 Mock 数据；需要模拟 HTTP 行为时使用 `apps/backend-mock`。
- 两个前端应用当前均在开发环境启用 `VITE_NITRO_MOCK=true`，由 Vite 插件启动本地服务。
- 开发代理将 `/api` 转发到 `http://localhost:5320/api`；这属于模拟数据服务。
- Mock 可使用内存状态；需要跨刷新保存演示状态时，可使用带应用前缀的浏览器存储。
- 构建后的静态页面不会自动获得开发期 Mock 服务。演示交付需选择本地数据方案，或明确配套 Mock 服务的启动方式，不能改接真实后端来补齐数据。
- 上游 README 中关于真实接口接入的说明不代表本项目当前的开发目标。

## 常用命令

以下命令从仓库根目录执行，具体版本与脚本以 `package.json` 为准。当前要求 Node.js `^22.18.0 || ^24.12.0`，包管理器固定为 `pnpm@11.16.0`。

| 命令                    | 用途                 |
| ----------------------- | -------------------- |
| `pnpm install`          | 安装工作区依赖       |
| `pnpm dev:antd`         | 启动 web-antd        |
| `pnpm dev:innovation`   | 启动 web-innovation  |
| `pnpm build:antd`       | 构建 web-antd        |
| `pnpm build:innovation` | 构建 web-innovation  |
| `pnpm check:type`       | 工作区类型检查       |
| `pnpm test:unit`        | 运行 Vitest 单元测试 |
| `pnpm lint`             | 运行仓库代码检查脚本 |

## 维护约定

本文件记录项目事实与背景，`AGENTS.md` 记录执行规则。应用职责、启动方式、数据策略发生变化时，同步更新相关上下文文件。
