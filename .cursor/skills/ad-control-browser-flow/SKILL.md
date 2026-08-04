---
name: ad-control-browser-flow
description: 使用 Browser Use、Python Seed、pytest 和 Allure 串联广告管控端到端流程。用于编译规则用例、准备测试库数据、创建规则、触发 Job、验证 HIT/MISS、收集录屏截图和动作历史并清理数据。
---

# 广告管控 Browser Use 总流程

先读取 `../domains/ad-control/SKILL.md`，涉及造数时再读取 `../ui-flow-db/SKILL.md`。执行命令与交付物契约见 [references/workflow.md](references/workflow.md)。

## 流程

1. 运行知识校验和用例编译，确认媒体、产品、投放范围、维度、日期与指标完整。
2. 校验 SiliconFlow 模型和视觉能力：`uv run ad-control model validate`。
3. 为每个用例生成 Seed plan 和本地 run 记录，执行只读 DB preflight。
4. 展示 plan，等待用户明确确认；确认后 approve/apply。
5. 使用项目独立 Browser Profile 执行规则创建。只访问 `.env` 声明的允许域名。
6. 提取数字规则 ID，并通过配置的接口或数据库进行确定性复核。
7. 触发 Job，按规则 ID 和业务键验证 HIT/MISS，不能只判断页面提示。
8. 将计划、断言、Browser Use 动作历史、录屏和失败截图附加到 Allure。
9. 在 `finally` 中清理 Seed 数据；中断后使用 recover。

## 停止条件

- 知识不完整、模型不可用、目标域名不在白名单、数据库不是 test、计划未审批或无法提取规则 ID 时立即停止。
- 不记录 API Key、数据库密码、Cookie、Token 或完整敏感请求头。
- 不自动改变模型、环境或条件语义。

