---
name: police-official-drafting
description: "当用户需要起草公安机关公文或内部文书时使用此技能。触发场景包括：提到\"起草\"\"拟稿\"\"通知\"\"请示\"\"报告\"\"函\"\"纪要\"等文种，或给出文种、行文对象、事实材料与语气要求生成公文草稿。产出 DOCX 或 Markdown 草稿，草稿必须标注\"人工复核\"。不要用于材料整理（用 police-document-organizing）或法规检索（用 police-legal-regulation-search）。"
metadata:
  builtin_skill_version: "1.0"
  octop:
    home:
      order: 3
      prompt:
        zh: "请起草一份公文。文种（通知/请示/报告/函/纪要等）：；行文对象：；事实与要点（粘贴材料）：；语气与篇幅要求：。完成后在 outbound/<task>/ 下生成公文草稿，并提示草稿需人工复核后才能签发。"
        en: "Please draft an official document. Type (notice / request / report / letter / minutes):; recipient:; facts and key points (paste material):; tone and length:. Deliver the draft under outbound/<task>/ and note that it requires human review before issuance."
      color: "#6366f1"
      icon_name: "pen-line"
---

# 智能公文起草

## 何时使用

用户要求按文种起草公文草稿（通知、请示、报告、函、纪要等）。

## 输入校验

- 文种：缺失时先询问；文种决定结构（请示需一文一事，报告不含请示事项）。
- 事实材料：只使用用户提供的事实；不虚构日期、数据、单位名；材料缺口在草稿中用【待补充：…】占位。
- 敏感内容：涉及个人信息用脱敏占位（如"张某某"），提醒用户定稿前按规范填写。

## 操作步骤

1. 确认文种、行文对象、事实要点与语气（用户已给全时直接起草）。
2. 按公文结构起草：标题（发文机关+事由+文种）、主送、正文、落款、日期占位。
3. 生成 `draft.md`（默认）或 `draft.docx`（用户要求 Word 交付时，依赖 docx 技能）。
4. 草稿显著位置与回复中均标注：**草稿仅供人工复核，签发前须经办人核对事实与格式**。

## 产物约定

- 主产物：`outbound/<task>/draft.md` 或 `draft.docx`。
- 直接文本文件写入即可预览；生成 DOCX 等二进制时完成后最后写 `outbound/<task>/artifact.json` 清单声明主产物。
- 修订请求更新同一文件，保留版本说明。

## 失败处理

- 文种与内容明显不匹配（如请示夹带报告事项）：先说明并建议文种，经确认再起草。
- 事实材料存在内部矛盾：列出矛盾点，不擅自取舍。
- DOCX 依赖缺失：改交付 Markdown 并说明原因。