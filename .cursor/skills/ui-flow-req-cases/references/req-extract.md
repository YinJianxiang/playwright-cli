# req-extract.md 模板

路径：`{root}/explore/req-extract.md`

```markdown
# 需求抽取

- domain: <biz>
- 批次: {yyyyMMdd-HHmmss}
- 需求文件: <path/to/prd.md>
- 抽取时间: <ISO 或本地时间>

## REQ-001

- 选择因:
  - 维度: …
  - 业务线: …
- 变更点: 指标新增/调整为 …
- 期望 options（若有）:
  - …
- 触发条件（若有）:
  - 时间 / 聚合 / 指标 / 运算符 / 阈值: …
- 来源:
  - 正文: L12–L20（或章节标题）
  - 图片: `images/xxx.png`（无则写无）
- 建议 suite: ui | flow | both
- conflict: false
- 备注: …

## REQ-002
…
```

## 规则

- `建议 suite=ui`：仅有枚举/显隐/options，无可跑触发条件  
- `建议 suite=flow`：文档已给齐触发条件（或用户已补充）→ 落 `cases-flow` 时必须 **HIT+MISS 成对**  
- `建议 suite=both`：同一上下文既要验 options，又有可写的触发条件 → UI CASE（可多条）+ Flow **成对**（`-HIT`/`-MISS`），**不要**把 UI 与 flow 合成一个 test  
- `conflict: true` 时必须先询问再定稿 cases  
