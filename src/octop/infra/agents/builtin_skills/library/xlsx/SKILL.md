---
name: xlsx
description: "当用户需要创建、读取、编辑或分析 Excel 表格（.xlsx/.csv）时使用此技能。触发场景包括提到 \"Excel\"、\"表格\"、\".xlsx\"、\".csv\"，或要求生成带公式/样式的表格、汇总统计、多工作表报表、数据清洗与转换。不要用于文档写作（用 docx 技能）或数据库查询（生成 SQL 交付）。"
metadata:
  builtin_skill_version: "1.0"
---

# XLSX 创建、读取与分析

## 前置依赖

- **openpyxl**（`pip install openpyxl`）：读写 .xlsx（公式、样式、多表）。
- **pandas**（`pip install pandas`）：批量数据清洗与统计（配合 openpyxl 输出）。
- 依赖缺失时报告缺失项并停止，不要反复重试。

## 概述

.xlsx 文件是包含 XML 文件的 ZIP 压缩包；.csv 是纯文本。

## 快速参考

| 任务 | 方法 |
|------|------|
| 读取数据 | pandas `read_excel` / `read_csv` |
| 创建带样式表格 | openpyxl（表头、边框、数字格式、列宽） |
| 汇总统计 | pandas 聚合后写新工作表 |
| 多表报表 | openpyxl 建多 sheet 并加目录页 |

## 操作约定

- 产物写入 `outbound/<task>/`；脚本生成的 .xlsx 完成后写 `outbound/<task>/artifact.json` 清单声明主产物。
- 修改用户表格前保留原件；修改点（新增列/清洗规则）在回复中列明。
- 统计口径（过滤条件、聚合方式）在交付说明中写清，不隐瞒假设。

## 失败处理

- 公式引用外部工作簿失效：改写为静态值并标注来源。
- 大文件内存不足：分块处理或改用 CSV 中间格式，说明取舍。