# 命令与交付物

```powershell
uv sync --extra dev
uv run ad-control knowledge validate
uv run ad-control cases compile --expected miss --threshold 10 --output .local/generated-cases/today-miss.json
uv run ad-control model validate
uv run ad-control seed plan .local/generated-cases/today-miss.json --destination .local/generated-cases/today-miss-runs.json
uv run ad-control db preflight <run-id>
uv run ad-control seed approve <run-id> <approved-by>
# flow run 内部顺序：先 create_rule，确认 rule_id 后再 seed apply，最后验证
uv run ad-control flow run <run-id> --confirmed
uv run pytest
allure generate allure-results --clean -o allure-report
```

每次完整执行必须产生：run ID、Seed plan、规则 ID、确定性断言、清理状态、Browser Use 动作历史、录屏或失败截图，以及 Allure 结果。

首次执行使用有头浏览器，在 `.local/browser-profile` 中完成人工登录。之后复用该项目 Profile；不要连接个人 Chrome Profile。
