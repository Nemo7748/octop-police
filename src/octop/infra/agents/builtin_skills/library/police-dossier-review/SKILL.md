---
name: police-dossier-review
description: "当用户需要审查电子卷宗材料时使用此技能。触发场景包括：提到\"审卷\"\"卷宗审查\"\"材料齐不齐\"\"证据链\"，或上传/指定卷宗文件（目录、文档、扫描件说明）要求按完整性、一致性和引用位置出具审查报告。结论仅供人工复核，不作为定案或执法依据。不要用于一般文档整理（用 police-document-organizing）。"
metadata:
  builtin_skill_version: "1.0"
  octop:
    home:
      order: 6
      prompt:
        zh: "请审查以下卷宗材料。材料位置（工作区路径或粘贴内容）：；审查重点（完整性/一致性/引用位置，可多选）：。完成后在 outbound/<task>/ 下生成审查报告，逐项列出问题与位置；结论仅供人工复核。"
        en: "Please review the following dossier materials. Location (workspace paths or pasted content):; focus (completeness / consistency / citation positions):. Deliver a review report under outbound/<task>/ itemizing issues with locations; conclusions are for human review only."
      color: "#dc2626"
      icon_name: "scan-text"
---

# 电子卷宗审查

## 何时使用

用户要求对卷宗材料做完整性、一致性或引用位置的审查并出具报告。

## 输入校验

- 材料范围：用户指定的工作区路径或粘贴内容；只读指定范围，不扩大。
- 审查重点：完整性（要件缺失）、一致性（时间/人名/数字矛盾）、引用位置（引文可回溯）至少明确其一。
- 不可读文件（扫描件/加密件）：列入"无法审查"清单，不猜测内容。

## 操作步骤

1. 按用户指定的审查重点建立检查项清单。
2. 逐项核对：缺失要件、前后矛盾（时间线、身份信息、数字对不上）、引用与原文不符；每项记录所在文件与位置。
3. 生成 `dossier-review.md`（或用户要求时 `dossier-review.html`）：总体结论（问题分级：关键/一般/提示）、问题明细（位置+描述+建议）、无法审查项。
4. 报告显著位置标注：**审查结论仅供人工复核，不作为定案或执法依据**。

## 产物约定

- 主产物：`outbound/<task>/dossier-review.md`。
- 直接文本文件写入即可预览；多文件产物完成后最后写 `outbound/<task>/artifact.json` 清单声明主产物。
- 报告中引用原文时标注文件名与位置，可回溯。

## 失败处理

- 材料不完整导致无法覆盖某检查项：在报告中明确该维度未覆盖及原因。
- 关键矛盾影响整体判断：报告头部显著提示，而非埋在明细里。
- 审查需求超出材料能力（如要求鉴定真伪）：说明边界并停止该项。