# 广告管控 · 站点环境

本业务 URL / 入口文案。通用鉴权变量与登录策略见 [`../../ui-flow-codegen/env.md`](../../ui-flow-codegen/env.md)。

## 站点 URL

| 用途 | URL |
|------|-----|
| 登录 | http://192.168.0.215/market-admin/login |
| 业务壳 | http://192.168.0.215/newdz/home |
| 规则列表 | http://192.168.0.215/newdz/home#/newdz/admonitorbyte/rule |
| 管控记录 | http://192.168.0.215/newdz/home#/newdz/admonitorbyte/record |

可选：`E2E_BASE_HOST` 用于拼接相对路径。

## 导航（本业务）

1. **优先直达**：上表 URL / hash  
2. **成功标准**：[ui.md](ui.md) 写明的特征控件，不以 URL 单独判定  
3. **直达失败**：菜单 **exact** — `广告管控规则` / `广告管控记录`  
4. 真实路由不符 → 回写本文件与 [ui.md](ui.md)  

## 登录页文案（本环境）

「账户登录」、邮箱/用户名、密码、验证码（以实探为准）。

## Job

见 [apis.md](apis.md)。
