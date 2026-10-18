# Steeefanie 个人网站

[English](README.md)

一个基于 Astro 构建的多语言个人内容网站，用于发布随笔、项目、食谱和轻量在线工具。网站采用静态生成架构，分别生成简体中文、台湾繁体和英文页面。

## 功能

- 使用 Astro Content Collections 管理随笔、项目和食谱；
- 简体中文、台湾繁体和英文分别使用 `/zh-cn/`、`/zh-tw/`、`/en/` 独立路由；
- 裸域 `/` 依次按照用户主动选择、浏览器语言、简体中文兜底进行分流；
- 同时匹配三语言标题、摘要、标签和项目技术栈的站内搜索，支持受限英文模糊匹配，结果保持当前语言；
- 食谱类别筛选、简洁的图标／列表视图切换、保存一年的视图偏好 Cookie 和前端列表分页；上下篇沿用进入时的类别范围，按从新到旧的顺序导航；
- 图标、列表和详情页共用 256×256 透明 WebP 配图，详情页按 Alpha 可见边界对齐；
- 标题、正文、辅助文字、导航和工具页共用响应式字号基准；
- 响应式导航、深浅主题、随主题切换的 VS Code Light+／Dark+ 代码高亮、键盘焦点和减少动态效果支持；
- 随笔和项目长文提供悬浮、可调宽度目录；空间足够时正文随目录居中移动，空间不足时目录以覆盖模式打开；
- 使用 GitHub Discussions 提供主页留言和详情页评论，同一内容的三种语言共用讨论；
- 浏览器内拼豆图纸生成器，包含异步图片任务版本保护和网络请求取消逻辑；
- 网站主体完全静态生成，不依赖应用数据库或服务端运行时；拼豆生成接口独立部署。

## 技术栈

- [Astro](https://astro.build/) 7
- TypeScript 6
- Tailwind CSS 4
- Astro Content Collections
- Markdown / MDX

## 路由和语言偏好

```text
/                                 语言分流入口
/zh-cn/                           简体中文主页
/zh-cn/blog/                      简体中文随笔
/zh-cn/projects/                  简体中文项目
/zh-cn/recipes/                   简体中文食谱
/zh-cn/services/fuse-bead-generator/
/zh-tw/...                        台湾繁体对应页面
/en/...                           英文对应页面
/search-index.json                三语言共用的本地搜索索引
```

所有公开内容页面都必须带语言前缀。旧的无前缀内容路由不再生成，也不设置重定向。

裸域按以下顺序选择语言：

1. 用户通过语言菜单主动选择后写入的第一方 Cookie `steeefanie_locale`；
2. `navigator.languages` 提供的浏览器语言偏好；
3. 无法匹配时进入 `/zh-cn/`。

浏览器自动判断的结果不会写入 Cookie。明确的语言地址始终优先，例如直接打开 `/en/...` 时，即使此前保存的是简体中文偏好，也仍然显示英文。Cookie 只保存 `zh-cn`、`zh-tw` 或 `en`，作用于全站，使用 `SameSite=Lax`，有效期为一年。

每个语言页面分别输出自身 canonical、互相对应的 `hreflang`、当前语言的 Open Graph 元数据和 HTML `lang`。各语言主页以裸域作为 `x-default`，其他内容以简体中文页面作为兜底版本。

## 项目结构

```text
public/                         原样复制的公共静态资源
src/
├─ assets/                      由构建系统管理的正文资源
├─ components/                  可复用界面和交互组件
├─ content/
│  ├─ blog/{zh-CN,zh-TW,en}/
│  ├─ projects/{zh-CN,zh-TW,en}/
│  └─ recipes/{zh-CN,zh-TW,en}/
├─ layouts/                     公共 HTML 页面外壳
├─ lib/                         内容配对、路由和通用工具
├─ pages/                       裸域入口、多语言路由生成器和 JSON 接口
├─ scripts/                     前端交互和工具逻辑
├─ styles/                      设计令牌与公共样式
└─ views/                       由各语言路由复用的页面实现
services/                       独立部署的服务代码
docs/                           设计规范和维护手册
```

同一内容的三种语言文件必须使用相同文件名。该文件名是配对不同语言内容和生成对应网址的稳定 slug。

## 本地运行

环境要求：Node.js 22.12 或更高版本、pnpm 11。

```bash
pnpm install
pnpm dev
```

默认开发地址为 `http://localhost:4321`。打开 `/` 会执行与正式环境一致的语言分流；需要直接查看指定语言时，可访问 `/zh-cn/`、`/zh-tw/` 或 `/en/`。

## 检查与构建

```bash
pnpm check
pnpm build
pnpm preview
```

静态构建结果输出到 `dist/`。正确的构建结果应包含三种语言目录，不应再生成无前缀的 `blog`、`projects`、`recipes` 或 `services` 页面。

## 食谱配图与维护

- 原始 PNG 和临时编辑文档保存在项目外；项目仅保存 `public/images/recipes/` 中的 256×256 透明 WebP。
- 三语言的 `cover` 引用同一张图片，图标视图、列表和详情页共用。
- 图片更新后同步 `src/lib/recipe-image-left-insets.json` 的 Alpha 左右边界；详情页可见右边界到文字固定 32px。
- 鸡尾酒杯型推荐放在材料之前，做法使用有序列表，提示放在做法后且不缩进。

## 内容规范

- 内容元数据由 Astro Content Collections 统一校验；
- 每项正式内容必须同时提供文件名一致的 `zh-CN`、`zh-TW` 和 `en` 版本；
- 台湾繁体应根据当地表达人工整理，不通过运行时机械转换生成；
- 页面标题由视图模板统一生成，Markdown/MDX 正文通常从二级标题开始；
- 项目共用图片放在 `src/assets/projects/`，固定网址的静态资源放在 `public/`；
- 密码、访问令牌、隐私数据和生产环境密钥不得写入仓库。

留言和评论存储在公开的 GitHub Discussions 中。讨论标识会移除语言前缀，因此同一内容的三种语言页面共用一个讨论主题。

完整约定见[设计规范](docs/design-system.md)和[维护手册](docs/learning/README.md)。
