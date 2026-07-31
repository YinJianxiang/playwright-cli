# 广告管控 · 执行接口

## 触发数据管控 Job

- **Method**: `GET`
- **URL 模板**:

```text
http://192.168.0.215:9099/market-job/api/doJob/DATACONTROL/com.dz.glory.job.schedule.DataControlSchedule%23process0:{ruleId}
```

- `{ruleId}`：规则创建成功后，在**规则列表页**取得的广告规则 ID  
- **成功判定**：HTTP 2xx。若响应 body 含明确失败码，explore/首跑后补记本文件  

## 调用时机（用例内）

1. 建规则成功并读到 `ruleId`  
2. 规则开关已打开  
3. DB 造数（`ui-flow-db`：plan → 确认 → seed）  
4. 再 `GET` 上述 URL  
5. 前往管控记录页轮询断言  

## 记录页轮询

| 项 | 值 |
|----|-----|
| 间隔 | 10s |
| 最长 | 120s（最多约 12 次） |
| 通过条件 | 记录页出现本条新建规则的 ID |

## 代码拼装示例

```ts
const url =
  `http://192.168.0.215:9099/market-job/api/doJob/DATACONTROL/` +
  `com.dz.glory.job.schedule.DataControlSchedule%23process0:${ruleId}`;
const res = await request.get(url);
expect(res.ok()).toBeTruthy();
```
