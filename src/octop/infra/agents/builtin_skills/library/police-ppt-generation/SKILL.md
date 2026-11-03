---
name: police-ppt-generation
description: "当用户需要生成警务汇报、培训、宣讲或评审用 PPT（.pptx）时使用此技能。触发场景包括：提到\"做 PPT\"\"汇报材料\"\"演示文稿\"\"pptx\"，或给出主题、受众、页数与素材要求生成可下载的 PPT 文件。也适用于把已有大纲、报告或数据要点转成幻灯片。不要用于纯网页展示（用 HTML 生成）或 Word 文档（用 docx 技能）。"
metadata:
  builtin_skill_version: "1.0"
  octop:
    home:
      order: 1
      prompt:
        zh: "请生成一份警务 PPT。主题：；受众（如所领导/全局民警/上级检查组）：；页数：；素材（粘贴要点或说明文件名）：。完成后在 outbound/<task>/ 下生成可下载的 PPTX 文件，并在回复中给出文件路径。"
        en: "Please build a police briefing deck. Topic:; audience (command staff / officers / inspectors):; slides:; material (paste points or file names):. Deliver a downloadable PPTX under outbound/<task>/ and share the file path."
      color: "#f97316"
      icon_name: "presentation"
---

# 警务 PPT 生成

## 何时使用

用户明确要求生成 PPT/演示文稿/pptx 文件，或要求把大纲、汇报材料转成幻灯片。

## 输入校验

- 主题与用途：缺失时先询问（汇报/培训/宣讲/评审）。
- 受众与页数：未给出时默认 10 页左右并在回复中说明假设。
- 素材：用户提供的要点、文档或表格；无素材时先列大纲征求确认，不虚构数据。
- 引用的数字必须来自用户素材；样例数据在备注页标注"演示数据"。

## 操作步骤

1. 根据主题与受众列出大纲（标题页、目录、内容页、总结页），页数对齐用户要求。
2. 大纲经用户确认（或用户已给大纲时跳过）。
3. 使用 pptx 技能的脚本链生成 `.pptx`（依赖见 pptx 技能；依赖缺失时报告并停止，不要反复重试）。
4. 生成完成后将文件写入 `outbound/<task>/`，回复中给出文件路径与页数清单。

## 产物约定

- 主产物：`outbound/<task>/<名称>.pptx`。
- 大纲等文本产物（Markdown）同样写入 `outbound/<task>/`。
- 由脚本生成的二进制 PPTX 属于多文件/二进制产物：全部文件完成后最后写 `outbound/<task>/artifact.json` 清单，`primary` 指向 PPTX 文件。

## 失败处理

- 依赖缺失（python-pptx/LibreOffice 等）：报告缺失项与安装建议后停止。
- 生成脚本报错：原样转述错误与失败步骤，不声称已生成文件。
- 素材不足以支撑页数：减少页数并说明，不用空话凑页。