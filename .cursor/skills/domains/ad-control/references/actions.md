# 管控动作

管控动作负责表单动作区、Job 时机和 UI 结果断言。机器权威为
`../knowledge/actions.json`。

## 当前可执行动作

`预警` 已验证：

- UI 控件：radio button。
- Job：`DataControlSchedule.process0(ruleId)`。
- 轮询：默认每 10 秒，最长 120 秒。
- HIT：记录页出现相同 `ruleId + channelCode`。
- MISS：完整观察窗口内不得出现相同 `ruleId + channelCode`。
- finally：关闭规则；按 cleanup manifest 清理事实数据。

环境入口全部由 `.env` 提供完整 URL，知识库和活动代码不保存内网地址：

- 登录页：`E2E_LOGIN_URL`
- 系统首页：`E2E_HOME_URL`
- 规则页：`E2E_RULE_URL`
- 记录页：`E2E_RECORD_URL`
- Job：`E2E_JOB_TRIGGER_URL_TEMPLATE`，其中必须包含 `{{rule_id}}` 占位符。

`暂停` 和 `调整预算` 目前只有局部代码字段或关键词证据，没有 UI、Job、记录页
闭环，因此标记为 `unknown`，禁止生成或执行。
