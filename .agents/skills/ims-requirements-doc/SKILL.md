---
name: ims-requirements-doc
description: Create, update, or audit Chinese IMS requirements documents from confirmed discussions, business materials, and existing prototypes. Produce module overviews and page specifications covering fields, permissions, workflows, and acceptance criteria while separating requirements from implementation facts and open decisions. Not for implementing UI, production APIs, or generating developer task tickets.
---

# IMS 详细需求文档

为业主确认、开发实现和测试验收编写可追溯的中文需求文档。负责业务语义与规则；页面布局、组件表现和交互设计属于 `ims-prototype-design`，无需为写文档强制调用该技能。

## 工作方式

1. 阅读仓库和目标 app 的 `AGENTS.md`、`CONTEXT.md`，查找模块已有需求文档。确定用户要求生成、更新还是仅核对；仅核对时报告差异，不自动改写文档。
2. 汇集可访问的需求材料、用户已确认讨论、相关页面及业务规则源码。需要验证交互时查看运行原型；只读源码不能声称已完成浏览器验证。缺失材料明确注明，不猜测附件内容或历史结论。
3. 按 [证据判定与检查](references/evidence-and-review.md) 区分已确认需求、原型现状、待确认建议和演示限制。代码不能自动成为目标需求，助手建议未经确认不能写成既定规则。
4. 先完成有依据的草稿，集中列出歧义、缺失和实现差异。只就影响核心流程、权限或数据归属的问题提问，其余保留待确认项；已确定的内容继续整理，不等待所有问题解决才写文档。
5. 生成时采用 [模块总文档模板](assets/overview-template.md) 和 [页面明细模板](assets/page-template.md)。更新时沿用已有结构和编号，只调整受影响规则及其页面、验收引用，不机械覆盖整份文档。
6. 完成后按证据说明中的检查表核对文档，交付文件入口、主要更新、待确认项及未核验部分。

## 输出约定

- 默认写入 `apps/<app>/docs/requirements/<module>/overview.md` 和该目录下的 `pages/`。app、模块名沿用项目实际命名；已有文档原位维护，不新建平行版本。每个业务页面一个文件，一个明细弹窗及其页签放在同一文档。
- 总文档集中维护共享业务规则、流程、权限与待确认项；页面文档记录字段和操作细节。同源表单引用基础页面，只描述角色、只读和额外面板等差异。
- 正文使用业务语言。源码路径、符号、材料章节和讨论依据放在追溯说明中；不把本机绝对路径、真实个人材料或联系方式复制进演示示例。
- 模板中的 `{{…}}` 是编写提示，成稿时替换；未知内容写明待确认及对应问题编号，不用占位符冒充完整要求。不适用内容注明或省略，不为填满章节编造规则。
- 优先沿用已有需求编号。新文档按模块使用稳定编号，如 `<module>-REQ-001`、`<module>-AC-001`、`<module>-Q-001`；页面使用稳定文件名。更新不重新编号，废止条目标明替代关系，已解决问题保留结论和依据。
- 计划日期与实际时间、填报人与负责人、配置开关与生命周期状态分别定义。具体字段和流程以本模块证据为准，不照搬竞赛规则。
- 本地存储、演示身份、虚构数据及临时上传限制不得直接提升为正式系统要求。接口、数据库结构和性能指标仅记录有依据且属于本次范围的内容。

## 边界与来源

文档工作不自动修改业务代码、修正原型数据、安装技能、创建外部任务或发布文档；也不自动提交、推送。Word 导出仅在用户提出时处理，不因生成 Markdown 而要求配置外部系统。

方法参考：[mattpocock/skills 的 to-spec](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-spec/SKILL.md)。借鉴从已有讨论与源码归纳规格、明确范围和测试决策的方法；这里采用独立的 IMS 指引和模板，不引入上游的任务跟踪配置、发布动作或固定访谈流程，使用本技能不依赖安装上游技能。
