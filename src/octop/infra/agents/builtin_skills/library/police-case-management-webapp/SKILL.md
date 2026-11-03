---
name: police-case-management-webapp
description: "当用户需要一个案件管理/台账类的 Web 演示应用时使用此技能。触发场景包括：提到\"案件台账\"\"管理系统\"\"登记页\"\"筛选列表\"，或描述案件列表、详情、状态流转等界面需求。产出自包含 HTML 及源码，数据使用用户输入或标注的演示数据，不连接真实案件库。不要用于数据看板统计（用数据统计看板智能体）。"
metadata:
  builtin_skill_version: "1.0"
  octop:
    home:
      order: 5
      prompt:
        zh: "请生成一个案件管理 Web 演示应用。需要的界面（列表/详情/登记表单/状态筛选）：；字段与状态定义：；数据（粘贴样例或回复\"用演示数据\"）。完成后在 outbound/<task>/ 下生成自包含 HTML 应用；演示数据在页面明确标注。"
        en: "Please build a case-management web demo. Screens (list / detail / intake form / status filters):; fields and statuses:; data (paste sample or reply \"use demo data\"). Deliver a self-contained HTML app under outbound/<task>/; demo data clearly labeled."
      color: "#0891b2"
      icon_name: "briefcase"
---

# 案件管理 Web 应用

## 何时使用

用户需要案件台账/管理界面的可运行演示应用（列表、详情、登记、筛选）。

## 输入校验

- 界面清单：列表/详情/登记表单/筛选至少明确其一；未给时按最小可用组合（列表+详情+筛选）生成并说明。
- 字段与状态：未给时用常见字段（案号、案由、状态、承办人、时间）并在回复中说明假设。
- 数据：用户提供样例时按其内容渲染；否则用明显虚构的演示数据并在页面标注"演示数据"。禁止使用真实案号、身份证号。

## 操作步骤

1. 确认界面、字段、状态与交互（增删改查演示范围）。
2. 生成 `app.html`：单文件自包含（内联 CSS/JS），数据存内存/localStorage 演示，含增删改查与筛选交互。
3. 用户需要源码交付时拆分 `app.html` + `app.js` + `app.css`，并保持 `app.html` 单文件版可独立预览。
4. 回复说明：功能范围、演示数据范围、"对接真实后端"所需的改造点。

## 产物约定

- 主产物：`outbound/<task>/app.html`。
- 直接文本文件写入即可预览；多文件（拆分源码）产物完成后最后写 `outbound/<task>/artifact.json` 清单声明主产物。
- 页面明显位置标注"演示数据"；不使用外部 CDN，完全离线可打开。

## 失败处理

- 交互需求超出前端演示能力（权限、审批流、消息推送）：实现界面占位并说明需真实后端。
- 字段歧义：按最常见语义实现并在回复中列出假设，不反复追问。