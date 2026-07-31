# 来源登记 SOURCES

## 测试 SQL 文档（2026-07-22 已消化进 01–06）

原路径（用户本机 Downloads）：

| 文件 |
|------|
| `c:\Users\DZ\Downloads\新媒体-付费短剧-管控指标测试SQL.md` |
| `c:\Users\DZ\Downloads\新媒体-短篇-管控指标测试SQL.md` |
| `c:\Users\DZ\Downloads\客户端-免费短剧-管控指标测试SQL.md` |
| `c:\Users\DZ\Downloads\端原生-免费-管控指标测试SQL.md` |
| `c:\Users\DZ\Downloads\端原生-付费-管控指标测试SQL.md` |
| `c:\Users\DZ\Downloads\新媒体-免费小说-管控指标测试SQL.md` |
| `c:\Users\DZ\Downloads\新媒体-免费短剧-管控指标测试SQL.md` |

可选：将上述文件复制到本 `_inbox/` 目录留档。

## Job 源码（权威）

| 路径 | 用途 |
|------|------|
| `d:\Project\market-job\market-job\src\main\java\com\dz\glory\job\schedule\DataControlSchedule.java` | 入口 process0 |
| `...\service\DataControlService.java` | calTableDimension、状态过滤、跑规则 |
| `...\mapper\xml\DataControlMapper.xml` | 扫数 SQL / 指标 |
| `...\utils\PlineEnum.java` | 业务线 desc↔alias |
| `...\model\DataControlRule.java` | 规则模型、TimeType、ColumnEnum |

## 连接层（本仓库）

| 路径 | 用途 |
|------|------|
| `tests/e2e/helpers/db.ts` | mysql2 连接池 |
| `tests/e2e/helpers/seed/engine.ts` | 通用造数引擎 |
| `tests/e2e/helpers/seed/ad-control.ts` | ad-control 适配 |
| `domains/ad-control/db/seed-capability.json` | 白名单 allowed |
| `domains/ad-control/db/table-map.json` | pline×维度×grain×(releaseVer)→表 |
| `domains/ad-control/db/metric-map.json` | column→写列 |
| `scripts/regen-ad-control-maps-from-job.mjs` | 自 market-job 重生 maps |
| `scripts/seed-resolve-check.mjs` | 无库校验 resolve |
| `_inbox/job-extract-20260729.json` | 最近一次 JobMap/Column 抽取快照 |
| `scripts/db-ping.mjs` | `npm run db:ping` |
| `.cursor/skills/ui-flow-db/env-db.md` | 环境变量 |
