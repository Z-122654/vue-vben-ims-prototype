# GitHub Pages 原型演示

## 发布方式

- 仓库：`Z-122654/vue-vben-ims-prototype`，发布分支 `main`。
- 仓库 Settings → Pages → Source 选择 GitHub Actions。
- `.github/workflows/deploy-innovation.yml` 在推送 `main` 或手动触发时执行类型检查、模块测试、构建及部署。
- 仅上传 `apps/web-innovation/dist`，不会发布其他应用或本机浏览器数据。
- 地址：<https://z-122654.github.io/vue-vben-ims-prototype/>。
- 源码仓库公开，Pages 演示页面也公开；演示账号不作为访问保护。

## 经营数据大屏入口

- 独立链接：<https://z-122654.github.io/vue-vben-ims-prototype/dashboards/operation/index.html>，无需登录。
- 系统登录后点击一级菜单“经营数据大屏”，在新标签页打开同一地址。
- 文件位于 `public/dashboards/operation/`，包含原型和其使用的图片、本地 ECharts 及许可文件，随现有构建发布，无需新增服务或部署工作流。
- 所有业务值均为模拟数据，公开展示范围与现有原型站一致。

## 登录和数据

生产配置启用 `VITE_STATIC_DEMO=true`，模拟登录、用户资料及权限码由应用内代码提供，菜单使用本地路由。无需外部 Mock 接口或服务端。

选择登录页演示账号，或输入 `vben`、`admin`、`jack`，密码均为 `123456`。登录后在业务模块顶部切换管理员、员工、专家等演示身份。

演示初始数据来自仓库中的虚构示例。访客操作和上传的附件仅保存在自己的浏览器中；刷新和退出登录不删除业务数据，模块“重置演示”恢复该模块示例。不同浏览器、设备、域名之间不共享数据。本机上传的文件不会随代码部署。

开发环境继续使用本地 Nitro Mock；此静态模式仅属于原型，不适用于生产系统身份认证。

## 本地验证及后续更新

```powershell
pnpm --filter @vben/web-innovation run typecheck
pnpm exec vitest run --maxWorkers=2 apps/web-innovation/src/api/demo-auth.test.ts apps/web-innovation/src/views/competition apps/web-innovation/src/views/research apps/web-innovation/src/views/exchange apps/web-innovation/src/views/knowledge
pnpm build:innovation
pnpm --filter @vben/web-innovation exec vite preview --host 127.0.0.1 --port 4174
```

打开 `http://127.0.0.1:4174/vue-vben-ims-prototype/` 检查静态构建。资源前缀 `VITE_BASE=/vue-vben-ims-prototype/` 与仓库名一致，路由使用 hash；不能直接双击 `dist/index.html`。

后续修改按正常流程提交并执行 `git push origin-github main`，在 Actions 查看部署结果；失败的构建不会覆盖上一次成功页面。发布不要求手工提交 dist，也不需要在源码或工作流中填写个人 Token。

## 验证记录（2026-11-04）

- 新增模拟账号密码校验、刷新后身份恢复、无效会话及权限数组隔离测试。
- 应用类型检查及 416 项登录和四模块测试通过；生产构建通过。
- 静态构建在独立浏览器会话中登录，打开竞赛、课题、交流、知识库并刷新成功；阻断外部请求后仍能运行，未产生后端 API 请求或浏览器运行时异常。
- 发布页面的线上验收结果以实际完成后的交付记录为准。
