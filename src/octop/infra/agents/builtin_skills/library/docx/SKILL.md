---
name: docx
description: "当用户需要创建、读取、编辑或处理 Word 文档（.docx）时使用此技能。触发场景包括提到 \"Word 文档\"、\".docx\"，或要求生成带目录、标题、页码、信头等格式的专业文档；也包括提取或重组 .docx 内容、查找替换、处理修订或批注。不要用于 PDF（用 pdf 技能）或电子表格（用 xlsx 技能）。"
metadata:
  builtin_skill_version: "1.0"
---

# DOCX 创建、读取与编辑

## 前置依赖

- **docx**（`npm install -g docx`）：新文档创建（docx-js）。
- **LibreOffice**（`soffice`）：.doc → .docx 转换、PDF 导出。
- **pandoc**：文本提取。
- 依赖缺失时报告缺失项并停止，不要反复重试。

## 概述

.docx 文件是包含 XML 文件的 ZIP 压缩包。

## 快速参考

| 任务 | 方法 |
|------|------|
| 读取/分析内容 | `pandoc document.docx -o output.md` 或解压取 XML |
| 创建新文档 | docx-js 脚本（标题、目录、表格、页码） |
| 编辑现有文档 | 解压 → 改 XML → 重打包 |
| 格式转换 | `soffice --headless --convert-to docx/pdf` |

## 操作约定

- 生成脚本放在任务目录内执行；产物写入 `outbound/<task>/`。
- 脚本生成的 .docx 完成后写入 `outbound/<task>/artifact.json` 清单并声明主产物。
- 编辑他人文档前保留原件副本；修改点在回复中列明。

## 失败处理

- 复杂格式（嵌套域、公式）损坏：转 Markdown 交付并说明限制。
- pandoc 提取乱码：尝试解压 XML 直读，仍失败则报告不可读。