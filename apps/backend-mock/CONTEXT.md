# backend-mock 应用上下文

## 定位

`@vben/backend-mock` 是基于 Nitro、H3 的本地 Mock 服务，用于支持前端原型开发。尽管目录名称包含 backend，本应用仅模拟 HTTP 接口，不是真实业务后端。不连接数据库、不接入真实后端或外部业务系统，所有业务数据均为 Mock。项目整体背景见 `../../CONTEXT.md`。

## 当前结构

- `api/`：登录、用户、菜单、表格、字典、部门等模拟接口。
- `utils/mock-data.ts`：公共演示数据。
- `utils/response.ts`：成功、错误、分页响应与延迟模拟工具。
- `utils/jwt-utils.ts`、`utils/cookie-utils.ts`：模拟认证相关工具。
- `middleware/`、`routes/`、`error.ts`：中间件、兜底路由和错误处理。
- `nitro.config.ts`：Nitro 与模拟接口响应配置。

成功响应使用 `{ code: 0, data, error: null, message: 'ok' }`，分页响应的 `data` 包含 `items` 和 `total`，错误使用已有工具生成。认证、权限和 Token 只服务于前端交互演示，不代表生产认证能力。

## 启动与数据生命周期

两个前端应用开发时通过 Vite 插件自动启动本应用，默认端口为 `5320`。通常直接执行 `pnpm dev:antd` 或 `pnpm dev:innovation` 即可。手动启动时可从根目录执行 `pnpm --filter @vben/backend-mock run start -- --port 5320`，确保实际监听地址与前端代理一致，避免重复占用端口。构建命令为 `pnpm --filter @vben/backend-mock run build`。

数据为代码内的模拟数据或运行时生成数据；内存修改可能在重启或热更新后重置。新增场景应记录初始化与重置方式，保证演示可以重复。当前 package.json 仅提供 `start`、`build` 脚本，没有独立的 `typecheck` 或测试脚本。

原 README 的真实数据对接建议属于上游通用说明，本仓库当前仍执行纯原型、Mock 策略。
