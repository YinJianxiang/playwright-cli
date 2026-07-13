# Raw 录制目录

codegen 原始录制保存在此目录，**默认不提交到 git**（见根目录 `.gitignore`）。

## 注意

- 录制时可能包含明文密码、验证码、Authorization / uToken 等敏感信息
- 整理成 `specs/` 后，凭证应改从 `.env` 读取
- 如需共享录制素材，先脱敏再提交

## 本地录制示例

```bash
playwright codegen --channel=chrome --target=playwright-test \
  -o tests/e2e/raw/<slug>.raw.spec.ts \
  "http://192.168.0.215/newdz/home#/newdz/adcreate/projectdeleteout"
```
