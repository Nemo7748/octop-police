---
name: pdf
description: "当用户需要读取、生成、拆分、合并或转换 PDF 文件时使用此技能。触发场景包括提到 \"PDF\"、\".pdf\"，或要求提取 PDF 文本/表格、生成 PDF 报告、合并拆分页面、PDF 转 Word/图片。不要用于编辑 Word（用 docx 技能）或网页展示（写 HTML）。"
metadata:
  builtin_skill_version: "1.0"
---

# PDF 读取、生成与转换

## 前置依赖

- **pypdf**（`pip install pypdf`）：合并、拆分、元数据。
- **pdfplumber**（`pip install pdfplumber`）：文本与表格提取。
- **LibreOffice**（`soffice`）/ **pandoc**（可选）：文档转 PDF。
- **pdftoppm**（poppler-utils，可选）：PDF 转图片。
- 依赖缺失时报告缺失项并停止，不要反复重试。

## 概述

PDF 是页面描述格式；文本层可能缺失（扫描件）。

## 快速参考

| 任务 | 方法 |
|------|------|
| 提取文本 | pdfplumber `extract_text` |
| 提取表格 | pdfplumber `extract_tables` |
| 合并/拆分 | pypdf PdfWriter |
| 生成 PDF | Markdown/HTML → pandoc/soffice 转 PDF |
| 转图片 | `pdftoppm -jpeg -r 150 file.pdf page` |

## 操作约定

- 产物写入 `outbound/<task>/`；脚本生成的 PDF 完成后写 `outbound/<task>/artifact.json` 清单并声明主产物。
- 扫描件无文本层时明确告知需 OCR，不伪造提取结果。
- 页码范围、提取字段等假设在交付说明中列明。

## 失败处理

- 加密/损坏 PDF：报告不可读，请求用户提供可读版本。
- 提取乱码或版面错乱：改用转图片方式说明，不硬凑文本。