---
name: police-document-organizing
description: "当用户需要把零散的警务材料整理为规范文档时使用此技能。触发场景包括：提到\"整理材料\"\"归档\"\"去重\"\"汇总\"\"写个清单\"，或粘贴多段文字/多份文件内容要求分类、去重、摘要和规范化整理，产出整理清单与 DOCX/Markdown 文档。不要用于公文写作（用 police-official-drafting）或 PPT 生成。"
metadata:
  builtin_skill_version: "1.0"
  octop:
    home:
      order: 2
      prompt:
        zh: "请整理以下警务材料。材料（粘贴文本或说明文件名）：；整理目标（分类/去重/摘要/规范格式）：。完成后在 outbound/<task>/ 下生成整理清单（Markdown）与整理后的文档（DOCX 或 Markdown），并说明取舍规则。"
        en: "Please organize the following materials. Material (paste text or file names):; goal (classify / dedupe / summarize / normalize):. Deliver an inventory (Markdown) plus the organized document (DOCX or Markdown) under outbound/<task>/, and state the rules you applied."
      color: "#0ea5e9"
      icon_name: "folder-open"
---

# 警务文档整理

## 何时使用

用户要求对提供的材料做分类、去重、摘要、格式规范化，或要求产出整理清单。

## 输入校验

- 材料来源：用户粘贴的文本或工作区已有文件；不主动读取用户未指定的其他文件。
- 整理目标：分类/去重/摘要/规范化至少明确一项；全部要求时按 分类 → 去重 → 摘要 → 规范化 顺序执行。
- 保留原文：去重与摘要不得篡改关键事实（时间、地点、人名、数字），拿不准的条目保留原文并标注"待确认"。

## 操作步骤

1. 通读材料，输出整理方案（分类维度、保留/合并规则）供用户确认（用户已给规则时直接执行）。
2. 执行整理，生成 `inventory.md`：条目清单（原条目 → 处理动作 → 去向），可追溯每条取舍。
3. 生成整理后的文档：`organized.docx`（需要正式交付时，依赖 docx 技能）或 `organized.md`（默认）。
4. 回复中总结：条目数变化（原始/保留/合并/剔除）、关键待确认项。

## 产物约定

- 主产物：`outbound/<task>/organized.md` 或 `organized.docx`。
- 整理清单 `outbound/<task>/inventory.md` 一并交付。
- 直接文本文件写入即可预览；生成 DOCX 等二进制时完成后最后写 `outbound/<task>/artifact.json` 清单声明主产物。

## 失败处理

- 材料不可读（乱码/格式损坏）：列出不可读项后继续处理其余部分。
- 关键信息冲突（同一事实多个版本）：并列呈现并标注冲突，不擅自裁决。
- DOCX 依赖缺失：改交付 Markdown 并说明原因。