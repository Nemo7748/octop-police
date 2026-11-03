---
name: pptx
description: "当用户需要创建、读取或编辑 PowerPoint 演示文稿（.pptx）时使用此技能。触发场景包括提到 \"PowerPoint\"、\".pptx\"、\"幻灯片\"，或要求生成可下载的 PPT 文件、提取幻灯片文本、修改版式与母版。不要用于网页展示（写 HTML）或 Word 文档（用 docx 技能）。"
metadata:
  builtin_skill_version: "1.0"
---

# PPTX 创建、读取与编辑

## 前置依赖

- **python-pptx**（`pip install python-pptx`）：新建与编辑 .pptx。
- **LibreOffice**（`soffice`，可选）：.ppt → .pptx 转换、PDF 导出。
- 依赖缺失时报告缺失项并停止，不要反复重试。

## 概述

.pptx 文件是包含 XML 文件的 ZIP 压缩包。

## 快速参考

| 任务 | 方法 |
|------|------|
| 创建新文稿 | python-pptx 脚本（版式、占位符、文本框、图片） |
| 读取文本 | python-pptx 遍历 slides/shapes，或解压取 XML |
| 编辑现有文稿 | 解压 → 改 XML → 重打包，或 python-pptx 直接改 |
| 转换格式 | `soffice --headless --convert-to pptx/pdf` |

## 操作约定

- 生成脚本放在任务目录内执行；产物写入 `outbound/<task>/`。
- 脚本生成的 .pptx 完成后写入 `outbound/<task>/artifact.json` 清单并声明主产物。
- 脚本报错时原样转述错误与失败步骤，不声称已生成文件。

## 失败处理

- python-pptx 无法处理的复杂版式：降级为基础版式重建，说明差异。
- 字体缺失：使用通用字体并在说明中注明。