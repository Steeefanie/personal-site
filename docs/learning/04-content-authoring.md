# 04 新增内容和更新网站

## 1. 最常见的维护任务

以后维护网站大致分成两类：

1. **内容更新**：新增或修改随笔、项目、食谱和图片。
2. **程序修改**：改变导航、搜索、主题动画、排版、字段结构等。

内容更新通常只需要修改 `src/content/` 和相应图片；程序修改才需要动 `src/pages/`、`src/components/`、`src/lib/` 或 `src/styles/`。

## 2. 新增内容的固定规则

### 三种语言必须成组

同一篇文章在三个语言目录中使用完全相同的文件名：

```text
zh-CN/example-slug.md
zh-TW/example-slug.md
en/example-slug.md
```

文件名建议使用小写英文，单词之间用短横线，不使用空格。发布后尽量不要修改，因为文件名决定网址。不同栏目可以有相同 slug，但同一栏目内不能重复。

如果缺少任一语言，当前配对逻辑不会把该内容放入正式列表。

### frontmatter 和正文

每份 Markdown/MDX 都由两部分组成：

```md
---
这里是 frontmatter 元数据
---

这里是正文
```

frontmatter 必须符合 `src/content.config.ts`。详情页模板已经显示文章标题，正文不要再写一个 `# 一级标题`，正文小节通常从 `##` 开始。

## 3. 新增随笔

目录：

```text
src/content/blog/zh-CN/
src/content/blog/zh-TW/
src/content/blog/en/
```

简体中文示例：

```md
---
title: 示例技术笔记
description: 说明这篇笔记解决什么问题、涉及什么环境。
publishDate: 2026-07-21
lang: zh-CN
featured: false
draft: false
readingTime: 8 分钟
tags:
  - id: astro
    label: "#Astro"
  - id: deployment
    label: "#部署"
---

开头说明背景、适用环境和目标。

## 准备工作

列出操作系统、软件版本、权限和需要提前取得的资料。

## 操作过程

1. 第一步。
2. 第二步。

## 常见问题

记录故障现象、原因和解决方法。
```

另外两份文件需要：

- `lang` 分别改为 `zh-TW` 和 `en`；
- 标题、摘要、阅读时间和标签文字按语言翻译；
- 标签 `id` 保持一致，例如三种语言都使用 `deployment`；
- 正文人工整理为对应语言，不依赖运行时自动翻译。

## 4. 新增项目文章

目录：

```text
src/content/projects/zh-CN/
src/content/projects/zh-TW/
src/content/projects/en/
```

不导入图片或组件时可以使用 `.md`；需要从 `src/assets/` 导入图片时使用 `.mdx`。

MDX 示例：

```mdx
---
title: 示例项目
description: 简要说明项目用途、实现思路和结果。
publishDate: 2026-07-21
lang: zh-CN
featured: false
draft: false
stack:
  - Python
repositoryUrl: https://github.com/Steeefanie/example-project
---

import resultImage from '../../../assets/projects/example-project/result.png';

先说明它解决什么问题以及适用场景。

## 实现思路

说明数据流、关键算法和主要取舍。

## 测试结果

<figure>
  <img src={resultImage.src} alt="示例项目输出结果" />
  <figcaption>测试输出结果。</figcaption>
</figure>
```

图片建议统一放在：

```text
src/assets/projects/<与文章对应的 slug>/
```

三语言可以引用同一组图片，不需要复制三份。图片的 `alt` 和图注应按语言分别写在各自 MDX 中。

`stack` 使用稳定、标准的技术名称，例如 `Astro`、`TypeScript`、`Python`。如果仓库尚未创建，不要先填不存在的 `repositoryUrl`；创建并确认地址后再补充。

## 5. 新增食谱

目录：

```text
src/content/recipes/zh-CN/
src/content/recipes/zh-TW/
src/content/recipes/en/
```

示例：

```md
---
title: 示例食谱
description: 一句话说明风味、做法重点或适用场景。
publishDate: 2026-07-21
lang: zh-CN
featured: false
draft: false
category: home-cooking
prepTime: 25 分钟
servings: 2 份
tags:
  - id: chicken
    label: "#鸡肉"
---

## 材料

- 鸡肉 300 g
- 调味料适量

## 做法

1. 处理原材料。
2. 按顺序烹饪。
3. 根据实际状态调整火候。

## 下次调整

- 记录下一次希望修改的比例或步骤。
```

`category` 只能使用稳定枚举：

| 值 | 简体中文页面分类 |
| --- | --- |
| `home-cooking` | 家常菜 |
| `flour` | 面食 |
| `cocktail` | 鸡尾酒 |

类别的内部值不要翻译，三语言文件都使用同一个值，页面再根据语言显示对应文字。

鸡尾酒标签应标注实际使用的全部基酒，不再重复添加 `#鸡尾酒`。家常菜和面食的步骤使用 Markdown 有序列表，即每项以 `1.`、`2.` 开头。

## 6. 标签怎样写

标签结构：

```yaml
tags:
  - id: gin
    label: "#金酒"
```

- `id` 用于跨语言对应和程序筛选，应使用稳定的小写英文。
- `label` 是读者看到的文字，可以按语言翻译。
- `#` 直接写进 `label`；标签间距由页面样式处理，不需要塞多个空格。

三语言示例：

```yaml
# zh-CN
- id: gin
  label: "#金酒"

# zh-TW
- id: gin
  label: "#琴酒"

# en
- id: gin
  label: "#Gin"
```

## 7. 日期、排序和上一篇/下一篇

- `publishDate` 是文章的实际发布日期。
- 列表按 `publishDate` 从新到旧排序，不按文件复制时间排序。
- 主页最近更新也依赖内容日期。
- 详情页上一篇/下一篇来自同栏目内容的日期顺序。
- 项目日期在页面上使用年月日格式。

修改日期会改变列表位置和相邻文章关系，所以应填写实际时间，不要为了排到最上面填写虚假日期。

## 8. 草稿

准备期间可设置：

```yaml
draft: true
```

正式发布前改为：

```yaml
draft: false
```

三语言状态应保持一致。即使草稿不进入正式列表，也不要把敏感资料推送到公开仓库，Git 历史可能长期保留它。

## 9. 搜索会搜索什么

构建时，`src/pages/search-index.json.ts` 会从内容元数据生成 `/search-index.json`。当前搜索主要使用：

- 标题；
- 摘要；
- 标签；
- 项目技术栈；
- 栏目和筛选元数据。

它不搜索 Markdown 正文。因此摘要和标签应准确概括内容。修改后必须重新构建，搜索索引才会更新。

## 10. 分页和筛选

- 随笔、项目和食谱列表每页最多显示 20 条。
- 超过 20 条后由列表分页组件处理。
- 食谱保留“全部、家常菜、面食、鸡尾酒”分类。
- 筛选和页码写入 URL 查询参数后，刷新和分享链接仍可恢复状态。

新增第 21 条内容时不需要手工创建第二页。

## 11. 正文排版规则

详情页正文统一由 `ProseLayout.astro` 和 `prose.css` 控制：

- 普通正文使用自然段，不要手工插入全角空格模拟首行缩进；
- 两端对齐和首行缩进交给统一 CSS；
- 表格本身不做首行缩进；
- 步骤使用 Markdown 有序列表；
- 材料可使用无序列表；
- 不要用大量 `<br>` 强制换行；
- 标题后不要堆叠空白段落；
- 代码使用 Markdown 代码块并标明语言。

手工添加两个空格会与不同字号、浏览器字体和 CSS 叠加，容易造成看似不一致，因此应交给样式统一控制。

## 12. 修改已有文章

1. 找到栏目和 slug 对应的三语言文件。
2. 同步修改三种语言内容。
3. 如果有实质更新，可填写或更新 `updatedDate`。
4. 不要随意改文件名，否则网址会改变，旧链接可能 404。
5. 标签 `id` 不要因为翻译文字变化而改变。
6. 运行检查、构建，并实际打开详情页。

如果必须改 slug，还要考虑旧网址重定向；当前静态结构没有自动重定向机制，不能只改文件名就结束。

## 13. 删除文章

1. 删除同一 slug 的三语言文件。
2. 删除只被该文章使用的图片。
3. 保留仍被其他文章引用的公共图片。
4. 搜索全项目确认没有残留引用。
5. 检查主页、栏目分页、搜索和上一篇/下一篇。
6. 考虑是否需要为旧网址设置重定向。

正式发布过的内容不应随意删除，因为旧网址会失效。

## 14. 本地验证清单

```powershell
cd C:\Code\Website\personal-site
pnpm check
pnpm build
pnpm preview
```

浏览器至少检查：

- 三语言标题、摘要、正文和标签是否对应；
- 主页最近更新是否正确；
- 栏目排序和分页是否正确；
- 搜索能否通过标题、摘要或标签找到；
- 图片是否加载，替代文本是否合理；
- 日期和上一篇/下一篇是否正确；
- 桌面端和手机端是否溢出；
- 深浅主题下是否可读。

## 15. 从内容到正式网站的完整流程

```text
准备三语言 Markdown/MDX 和共用图片
              ↓
放入 src/content 和 src/assets
              ↓
pnpm dev 本地查看
              ↓
pnpm check + pnpm build
              ↓
预演并同步到 personal-site-git
              ↓
git status / diff 检查范围
              ↓
git add、commit、push
              ↓
创建并合并 GitHub Pull Request
              ↓
服务器 pull main、安装依赖、build
              ↓
复制到新 release 并切换 current
              ↓
正式域名复查
```

Git 命令见 [03-github-maintenance.md](./03-github-maintenance.md)，服务器命令见 [02-deployment.md](./02-deployment.md)。

## 16. 哪些情况应先停下来确认

- 准备新增依赖或升级 Astro、Node.js、pnpm；
- 准备修改 `content.config.ts` 的字段结构；
- 准备改变文章 slug 或正式网址；
- 准备删除已经发布的内容；
- 文件中出现账号、Token、密钥或隐私信息；
- 构建失败但原因不清楚；
- Git 显示大量意外删除或合并冲突；
- 修改会影响全站组件、布局或主题动画。

这些操作影响范围较大，先查明原因比强行继续更安全。
