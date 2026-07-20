# Steeefanie Personal Site

一个内容优先、静态优先的个人网站，用于发布随笔、项目、菜谱和鸡尾酒配方。站点支持简体中文、台湾繁体和英文，提供深浅主题、元数据搜索、食谱筛选、响应式导航和键盘操作。简体中文栏目名称统一为“主页、随笔、项目、食谱”。

## 主要功能

- 主页只展示“最近更新”：Blog、Projects、Recipes 各取最新1条，再按发布日期排序；
- 桌面导航为 `Home / Blog / Projects / Recipes`，720px及以下改为两横线展开菜单；
- 顶部搜索索引标题、摘要、标签和技术栈，不读取 Markdown 正文；
- Blog 与 Projects 使用无筛选列表，Recipes 仅按类别筛选；三个栏目都是每页最多20条；
- 三个栏目列表页不设置重复的大字号栏目页头，进入页面后直接展示列表或筛选；
- 项目可通过 `repositoryUrl` 在详情标题后显示无背景的 GitHub 图标入口；
- 顶部导航不显示阅读进度轨道，品牌、导航文字和工具图标使用同一垂直微调；
- 食谱筛选写入 URL 查询参数，语言和主题写入 `localStorage`；
- 主题切换以可见主题 SVG 图标为圆心，按半径线性匀速扩散；
- Astro 开发工具栏已关闭，生产仍输出纯静态文件。

## 路由

```text
/                    主页
/blog/               随笔列表
/blog/[slug]/        随笔详情
/projects/           项目列表
/projects/[slug]/    项目详情
/recipes/            食谱列表
/recipes/[slug]/     食谱详情
/search-index.json   构建时生成的本地搜索索引
```

URL 不增加语言前缀，同一路由按当前语言显示对应内容。

## 技术栈

- Astro 7，纯静态输出；
- TypeScript 严格模式；
- Tailwind CSS 4（Vite 插件）；
- Astro Content Collections；
- Markdown / MDX；
- 原生 CSS 和少量原生 JavaScript。

项目不包含数据库、用户系统、评论、支付、后台管理或第三方搜索服务。

## 目录结构

```text
docs/
└─ design-system.md              项目设计与交互规范

public/
└─ brand/                        深浅主题透明标志与备用带底板图标

src/
├─ assets/
│  └─ projects/bean-pattern-generator/
│     └─ 三语言项目文章共用的原图与完整图纸
├─ components/                   页面、列表、筛选和顶部交互组件
├─ content/
│  ├─ blog/zh-CN|zh-TW|en/       三语言随笔
│  ├─ projects/zh-CN|zh-TW|en/   三语言项目
│  └─ recipes/zh-CN|zh-TW|en/    三语言食谱
├─ layouts/                      全局页面骨架
├─ lib/i18n.ts                   语言类型与通用界面文案
├─ lib/content.ts                三语言内容配对与 slug 工具
├─ pages/                        页面与搜索索引路由
└─ styles/                       主题令牌、全局样式和长文样式
```

## 本地开发与预览

需要 Node.js 22 或更高版本，以及 pnpm。

```bash
pnpm install
pnpm dev
```

开发地址通常为 `http://localhost:4321`。生产预览：

```bash
pnpm build
pnpm preview
```

生产文件输出到 `dist/`。

## 新增内容

每条内容必须在 `zh-CN`、`zh-TW`、`en` 三个目录中使用同一文件名；任一语言缺失时，该条内容不会进入正式列表、详情路由和搜索索引。

随笔、项目和食谱均可使用可选 `attribution` 字段标注AI辅助整理；随笔标签与食谱标签使用稳定 ID 和本地化标签：

```yaml
title: 标题
description: 摘要
attribution: ChatGPT 辅助整理 # 可选；会作为弱化标注显示在摘要开头
publishDate: 2026-07-18
lang: zh-CN
tags:
  - { id: astro, label: Astro }
  - { id: content-design, label: 内容设计 }
readingTime: 6 分钟
featured: false # 暂时保留，主页不再读取
draft: false
```

项目不设置状态字段；`stack` 使用三语言间一致的稳定字符串，并在界面中逐项显示为 `#标签`。复合技术名称应按独立标签拆分，例如 `[Astro, TypeScript, Tailwind, CSS]` 显示为 `#Astro #TypeScript #Tailwind #CSS`。项目可填写 `repositoryUrl`，详情页会在标题后显示 GitHub 图标；项目详情使用 MDX 导入 `src/assets/projects/` 下的共用图片，图片必须提供准确替代文本，非首屏图片使用懒加载。食谱的 `category` 使用 `home-cooking`、`flour` 或 `cocktail`。

内容文件只在 frontmatter 中填写 `title`，正文从二级标题 `##` 开始，不重复添加一级标题。详情页标题、日期/标签对齐和上一篇/下一篇布局由公共模板统一控制；三种语言的顶层正文段落统一使用固定 `2rem` 首行缩进，表格水平居中且单元格不缩进，后续替换或新增 Markdown / MDX 时不需要复制任何排版样式。家常菜和面食的做法直接使用 Markdown 有序列表，公共正文样式会显示十进制序号。

鸡尾酒正文不指定高球杯、古典杯等盛装杯型，需要描述容器时使用通用的“杯中／glass”。`prepTime` 按完成一杯的实际操作时长填写，不计入不存在的静置步骤或宽松预留时间；当前直接调和类约2分钟、摇和或分层类约3分钟，奶洗等过滤类按实际流程单独估算。

鸡尾酒标签必须逐项覆盖材料中实际使用的全部基酒，并在三语言间复用稳定ID，例如 `vodka`、`gin`、`rum`、`tequila`、`whiskey`。简体中文 `gin` 统一显示为“金酒”，台湾繁体显示为“琴酒”；仅有某种基酒风味但无法确认实际成分时，不据此推断标签。`cocktail` 仅作为食谱类别，不再重复显示泛化的 `#鸡尾酒 / #調酒 / #Cocktail` 标签。食谱列表只按 frontmatter 的 `publishDate`（实际记录日期）倒序，不读取文件上传或修改时间。

## 语言机制

语言类型固定为：

```text
zh-CN  简体中文
zh-TW  繁體中文（台湾用语）
en     English
```

语言菜单靠右排列，不显示勾选；当前语言使用当前主题生效的品牌色表示，并继续通过 `aria-pressed` 提供语义状态。语言菜单与移动导航的共同右侧基线约距手机视口45px。切换时保持当前路由和滚动位置，同步更新 `<html lang>`、页面标题、描述、日期、搜索结果、筛选标签和无障碍标签。选择写入 `localStorage.language`，旧值 `zh` 会自动迁移为 `zh-CN`。

## 搜索与筛选

`/search-index.json` 在构建阶段从内容集合生成，不引入运行时依赖。搜索先做 NFKC 归一化，再进行不区分英文大小写的包含匹配；标题权重高于摘要，摘要高于标签和技术栈。搜索不再限制8条，会显示全部匹配结果和结果数，超出视口时在搜索层内独立滚动。输入框提示统一为“搜索标题、摘要或标签”及对应语言版本，技术栈仍作为标签类关键词参与检索。

搜索栏目标签随当前语言同步：简体中文为“全部、随笔、项目、食谱”，台湾繁体为“全部、隨筆、專案、食譜”，英文为“All、Blog、Projects、Recipes”。首页打开搜索时默认“全部”，从随笔、项目、食谱页面打开时默认相应栏目，并在每次重新打开时复位。搜索期间正文固定在原滚动位置，滚轮、触控与惯性滚动只作用于搜索面板；关闭时临时绕过全局平滑滚动并立即恢复正文位置。顶部公共材质覆盖完整动态视口，结果区在导航以下独立滚动，确保任何数量的搜索结果都有连续背景。搜索面板不显示输入前的说明文案，键盘选择能力仍保留；搜索输入区不使用圆角矩形背景框，直接融入顶部公共材质。

食谱筛选仅显示“全部、家常菜、面食、鸡尾酒”，不显示可见的“类别”标题，四项在所有终端保持同一行且不换行。筛选和分页都写入 URL，筛选后先对结果重新计算分页，更换筛选会回到第1页：

```text
/recipes/?category=home-cooking
/blog/?page=2
/recipes/?category=cocktail&page=2
```

## 主题机制

主品牌基准色固定为 `#63065F`，深色主题使用可读性备用色 `#C979C4`。主题按钮使用无整圆外框的右下月相图标，由月牙轮廓与人眼视觉补齐共同形成圆形感。主题切换使用 View Transitions API：旧主题快照始终保持不透明且不加滤镜；新主题快照从主题 SVG 图标中心裁剪显现。根快照按完整 `window.innerWidth × window.innerHeight` 冻结，页面使用 `scrollbar-gutter: stable` 保留经典滚动条沟槽，避免 Windows Chrome 动画快照被压窄后横向抖动。

扩散使用 `r(t)=Rt`，圆半径随时间线性增长。总时长按覆盖半径计算：`clamp(280ms, radius / 3.3, 440ms)`。不支持 View Transitions 时降级为短暂淡出淡入；`prefers-reduced-motion` 下直接切换。

浅色页面使用中性浅灰 `#F5F5F5`，导航公共层以纯白为色源并使用 `rgba(255, 255, 255, 0.64)`；深色页面为 `#141414`，导航公共层使用 `rgba(8, 8, 8, 0.64)`。公共层参考 Apple 语义材质和 WWDC25 网页示例，使用偏清透的 `blur(20px)`；相较此前0.72的底色透明度，0.64会让下层内容透出更多，同时仍由20px模糊抑制细节干扰。搜索、语言和移动导航面板展开时，在移动下边沿以内保留96px完全无文字区，并向上设置80px透明羽化；材质层和安全遮罩均在320ms同时完成。每行文字另以200ms交叠渐显，避免遮罩经过行间空白产生停顿。收起时先用48ms建立相同安全区和羽化，随后文字遮罩与材质层使用同一320ms缓动同步上收，保证文字可见边界始终落后材质边界至少96px。浅色主题使用主品牌色 `#63065F`；深色主题全局切换为备用品牌色 `#C979C4`。

## 部署

执行 `pnpm build` 后，将 `dist/` 内文件部署到任意静态 Web 服务器。生产环境还应配置 HTTPS、安全响应头、缓存策略和日志轮转，不要在仓库或页面脚本中写入密钥、密码或 Token。

完整视觉、交互和验收要求见 [设计规范](docs/design-system.md)。
