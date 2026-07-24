# 范围模式（scope-modes）

## 判定顺序

```text
IF 用户要求全量/全覆盖/full → mode=full
ELSE IF 用户提供了字段选项 → mode=scoped
ELSE → mode=default（冒烟）
```

## 模式行为

| mode | 触发词 | 矩阵 |
|------|--------|------|
| default | 冒烟、smoke、未加选项 | **严格 1 行**，整表用 defaults ∩ explore |
| full | 全量、全覆盖 | domain 声明的**覆盖轴** options 笛卡尔积；其余字段 defaults ∩ explore |
| scoped | 点名选项 | 点名字段选项集笛卡尔积；未点名字段 defaults ∩ explore |

例（scoped）：某轴 A=`a1,a2` 且 B=`b1` → **2×1 = 2 行**。

## 全量覆盖轴

**以当前 domain 为准**（见 `domains/<biz>/ui.md` 覆盖轴声明）。  
通用 Skill 不写死轴名称。

## 生成约束

- helper 不写死业务枚举；每行 `form` 来自矩阵  
- 轴字段 / 用户点名覆盖 defaults 中的同名默认值  
- **运行时必须按 form 取值**；禁止 helper 再用全局「优先不限」覆盖已写入 form 的具体选项  
