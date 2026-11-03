---
name: police-legal-regulation-search
description: "当用户需要检索法律法规、公安规章或条文依据时使用此技能。触发场景包括：提到\"法条\"\"依据\"\"规定\"\"检索法规\"，或要求为案情、文书、报告寻找适用的法律条款。输出必须带来源与检索日期；无可靠来源时明确说明知识截止与不确定性。不要用于起草公文（用 police-official-drafting）。"
metadata:
  builtin_skill_version: "1.0"
  octop:
    home:
      order: 4
      prompt:
        zh: "请检索与以下事项相关的法律法规条文。事项或案情要点：；需要的规范层级（法律/行政法规/部门规章/地方规定）：。输出结果必须逐条附来源名称、条文号与检索日期；无法核实的条目明确标注不确定性。"
        en: "Please find legal provisions relevant to the following. Matter or case points:; level needed (statute / regulation / rule / local provision):. Every result must cite source, article number and retrieval date; flag anything that cannot be verified."
      color: "#16a34a"
      icon_name: "scale"
---

# 法律法规检索

## 何时使用

用户需要为案情、文书或报告寻找适用的法律法规条文与依据。

## 输入校验

- 检索事项：明确要解决的法律问题或案情要点。
- 规范层级与地域：未给出时覆盖常用层级并说明范围；地方性规定提醒用户核实本地版本。
- 用户已绑定检索连接器（web 检索/MCP）时优先使用；未绑定时基于模型知识作答并明确声明。

## 操作步骤

1. 拆解检索问题为具体条目（罪名/行为/程序环节对应的规范）。
2. 有检索工具：逐条检索并记录来源 URL、名称、条文号、访问日期；无检索工具：基于训练知识给出，并标注"基于模型知识（截止日期有限），使用前请核对现行有效版本"。
3. 生成 `legal-notes.md`（或用户要求时 `legal-notes.html`）：问题 → 条文原文摘录 → 来源与日期 → 适用性说明。
4. 每条结果必须含：规范名称、条文号、来源（URL 或"模型知识"）、检索日期；无法核实有效性的条目标注"未验证"。

## 产物约定

- 主产物：`outbound/<task>/legal-notes.md`。
- 直接文本文件写入即可预览；多文件产物完成后最后写 `outbound/<task>/artifact.json` 清单声明主产物。
- 交付说明中固定提示：**检索结果仅供人工复核，不构成法律意见**。

## 失败处理

- 检索工具不可用：改用模型知识并显著标注不确定性，不伪装成在线检索结果。
- 来源冲突（新旧版本/上下位规范）：并列呈现并提示效力判断需人工确认。
- 找不到相关条文：明确说"未检索到"，不编造条文号。