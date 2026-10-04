# 01 项目目录和主要文件详解

## 1. 如何看懂一个网站项目

一个网站项目通常同时包含四类内容：

1. **内容**：文章标题、摘要、正文、日期和标签。
2. **页面结构**：主页、列表页和详情页应该显示什么。
3. **可复用组件**：导航栏、搜索、语言切换、文章列表项等反复使用的界面。
4. **样式与配置**：颜色、字体、间距、构建方式和依赖版本。

本项目的源码主要都在 `src/` 中；根目录的配置文件告诉工具如何安装、检查和构建它。

## 2. 项目目录总览

下面是经过简化的目录树。`[]` 不是实际文件名的一部分；例如 `[slug].astro` 本身确实带方括号。

```text
personal-site/
├─ .gitignore
├─ astro.config.mjs
├─ package.json
├─ pnpm-lock.yaml
├─ pnpm-workspace.yaml
├─ tsconfig.json
├─ README.md
├─ CHANGELOG.md
├─ TODO.md
├─ docs/
│  ├─ design-system.md
│  └─ learning/
├─ public/
│  └─ brand/
├─ src/
│  ├─ assets/
│  │  └─ projects/
│  ├─ components/
│  ├─ content/
│  │  ├─ blog/{zh-CN,zh-TW,en}/
│  │  ├─ projects/{zh-CN,zh-TW,en}/
│  │  └─ recipes/{zh-CN,zh-TW,en}/
│  ├─ layouts/
│  ├─ lib/
│  ├─ pages/
│  ├─ styles/
│  ├─ content.config.ts
│  └─ env.d.ts
├─ node_modules/       依赖安装后生成
├─ .astro/             Astro 运行后生成
└─ dist/               构建后生成
```

## 3. 根目录文件

### `package.json`：项目身份、命令和依赖清单

这是 Node.js 项目的核心说明文件。它记录：

- 项目名和版本号；
- 使用 ES Module；
- 可以运行哪些命令；
- Astro、TypeScript、MDX 和 Tailwind CSS 等依赖的版本。

本项目最常用的命令来自其中的 `scripts`：

| 命令 | 实际作用 | 使用场景 |
| --- | --- | --- |
| `pnpm dev` | 启动 Astro 开发服务器 | 边修改边预览 |
| `pnpm check` | 检查 Astro 和 TypeScript | 修改后发现类型、模板问题 |
| `pnpm build` | 先检查，再生成 `dist/` | 发布前必须成功 |
| `pnpm preview` | 本地预览已经构建的 `dist/` | 验证生产构建结果 |

不要随便手工修改依赖版本。升级依赖会同时影响 `package.json` 和锁文件，并可能引入兼容问题。

### `pnpm-lock.yaml`：精确依赖锁定文件

`package.json` 表示项目需要哪些依赖，锁文件记录最终安装的精确依赖树。它可以让另一台电脑和服务器尽量安装到相同版本。

- 应提交到 GitHub。
- 不要手工编辑。
- 安装或升级依赖时由 pnpm 自动更新。
- 服务器使用 `pnpm install --frozen-lockfile`，若清单与锁文件不一致会直接报错，避免悄悄安装另一套依赖。

### `astro.config.mjs`：Astro 构建配置

当前配置的关键含义：

- `output: "static"`：生成静态网页；服务器不需要长期运行 Astro 或 Node.js。
- `devToolbar: { enabled: false }`：关闭开发工具栏。
- `mdx()`：允许项目文章使用 `.mdx`，从而在正文中导入图片或组件。
- Tailwind Vite 插件：让构建工具识别 Tailwind CSS。

一般新增文章不需要修改此文件。

### `tsconfig.json`：TypeScript 检查规则

它继承 Astro 的严格规则，并排除 `dist/`。严格检查可以更早发现变量类型、组件参数和数据结构错误。

一般新增内容不需要修改。

### `pnpm-workspace.yaml`

告诉 pnpm 当前根目录是一个工作区，并允许安装构建所需的 `esbuild`。当前只有一个网站包，不需要把它理解成多个项目。

### `.gitignore`：哪些文件不上传 GitHub

该文件忽略依赖、构建产物、缓存、日志、环境变量和编辑器临时文件，例如：

- `node_modules/`
- `.astro/`
- `dist/`
- `.env`、`.env.*`
- 日志和系统临时文件

它不是删除规则；文件仍在本地，只是 Git 默认不跟踪它们。

### `README.md`、`CHANGELOG.md`、`TODO.md`

- `README.md`：项目入口说明，告诉读者项目是什么、如何运行。
- `CHANGELOG.md`：按版本记录已经完成的变化。
- `TODO.md`：记录尚未完成或以后考虑的事项。

修改功能或结构时，通常应同步更新这些文档中的相关信息。

## 4. `src/`：网站真正的源码

### 4.1 `src/pages/`：网址和页面入口

Astro 使用“基于文件的路由”：文件路径通常直接决定网址。

| 页面文件 | 生成的网址 | 用途 |
| --- | --- | --- |
| `src/pages/index.astro` | `/` | 主页 |
| `src/pages/blog/index.astro` | `/blog/` | 随笔列表 |
| `src/pages/blog/[slug].astro` | `/blog/文章名/` | 随笔详情 |
| `src/pages/projects/index.astro` | `/projects/` | 项目列表 |
| `src/pages/projects/[slug].astro` | `/projects/项目名/` | 项目详情 |
| `src/pages/recipes/index.astro` | `/recipes/` | 食谱列表 |
| `src/pages/recipes/[slug].astro` | `/recipes/食谱名/` | 食谱详情 |
| `src/pages/search-index.json.ts` | `/search-index.json` | 构建搜索数据 |

`[slug].astro` 是动态路由模板。它不是只对应一篇文章，而是在构建时为同一栏目中的每个 slug 生成详情页。例如 `palworld-dedicated-server.md` 会生成 `/blog/palworld-dedicated-server/`。

页面文件通常负责：

- 取得内容数据；
- 选择当前语言；
- 对内容排序、分页；
- 把数据交给布局和组件；
- 组合成最终页面。

它不适合存放长篇文章正文，正文应放在 `src/content/`。

### 4.2 `src/content/`：三种语言的文章

```text
src/content/
├─ blog/
│  ├─ zh-CN/
│  ├─ zh-TW/
│  └─ en/
├─ projects/
│  ├─ zh-CN/
│  ├─ zh-TW/
│  └─ en/
└─ recipes/
   ├─ zh-CN/
   ├─ zh-TW/
   └─ en/
```

- `blog` 对应随笔。
- `projects` 对应项目。
- `recipes` 对应食谱。
- `zh-CN` 是简体中文，`zh-TW` 是台湾繁体，`en` 是英文。

同一篇内容的三种语言必须使用相同文件名。例如：

```text
blog/zh-CN/palworld-dedicated-server.md
blog/zh-TW/palworld-dedicated-server.md
blog/en/palworld-dedicated-server.md
```

这个共同文件名形成稳定的 slug。当前内容配对逻辑只有在三种语言都存在时，才把该内容放入正式列表，避免切换语言后找不到对应页面。

`.md` 是 Markdown 文件；`.mdx` 除了 Markdown，还可以导入 Astro 组件和本地图片。拼豆项目使用 MDX，是因为正文需要引用 `src/assets/` 中的多张图片。

### 4.3 `src/content.config.ts`：内容字段规则

它相当于内容的“表格结构和校验规则”。每篇文章顶部 `---` 包围的 frontmatter 必须符合这些字段要求。

三类内容共有的主要字段：

- `title`：标题；
- `description`：摘要，也是搜索内容之一；
- `publishDate`：发布日期，也用于排序；
- `updatedDate`：可选的更新日期；
- `lang`：`zh-CN`、`zh-TW` 或 `en`；
- `featured`：保留的精选标记；
- `draft`：是否为草稿。

栏目特有字段：

- 随笔：`tags`、`readingTime`、可选的 `attribution`；
- 项目：`stack`、可选的 `repositoryUrl` 等；
- 食谱：`category`、`prepTime`、`servings`、`tags`。

字段拼错、类型错误或用了不允许的枚举值时，`pnpm check` 或构建会报错。这正是校验文件的价值。

### 4.4 `src/assets/`：由构建系统管理的图片

当前三语言共用的项目图片放在：

```text
src/assets/projects/fuse-bead-pattern-generator/
```

这些图片会被 MDX 导入。Astro 构建时能够读取尺寸、处理文件名并生成最终资源。

适合放在 `src/assets/` 的内容：

- 文章中通过 `import` 引用的图片；
- 希望构建系统管理和优化的媒体；
- 三种语言共同使用的项目素材。

不要把 Python 源码或项目仓库副本放在这里。拼豆生成器的代码已经有独立 GitHub 仓库，个人网站只需要文章和展示图片。

### 4.5 `src/components/`：可复用界面组件

组件把重复界面封装起来。修改一个公共组件，所有使用它的页面都会受影响。

| 文件 | 作用 | 修改时的影响范围 |
| --- | --- | --- |
| `SiteHeader.astro` | 顶部导航、移动菜单及面板协调 | 全站所有页面 |
| `ThemeSwitcher.astro` | 深浅主题按钮与扩散动画 | 全站主题切换 |
| `LanguageSwitcher.astro` | 三语言切换菜单 | 全站语言切换 |
| `SearchPanel.astro` | 全屏搜索、分类筛选、键盘操作 | 全站搜索 |
| `SiteFooter.astro` | 页脚 | 全站所有页面 |
| `PostListItem.astro` | 随笔列表项 | 随笔列表等引用位置 |
| `ProjectListItem.astro` | 项目列表项 | 项目列表等引用位置 |
| `RecipeListItem.astro` | 食谱列表项 | 食谱列表等引用位置 |
| `LatestListItem.astro` | 主页“最近更新”列表项 | 主页 |
| `ListingPagination.astro` | 每页 20 条的翻页功能 | 三个栏目列表 |
| `ListingFilters.astro` | 食谱类别等列表筛选 | 使用筛选的列表页 |
| `ProseLayout.astro` | 详情页正文、元数据和上一篇/下一篇 | 三类详情页 |
| `LocalizedText.astro` | 根据当前语言显示对应文案 | 使用它的多语言界面 |
| `CodeBlock.astro` | 项目正文中的代码块表现 | 引用它的 MDX 内容 |

新增文章通常不需要改组件。只有想改变全站界面或交互时才修改这里。

### 4.6 `src/layouts/BaseLayout.astro`：每个页面共同的外壳

它负责整个 HTML 文档的共同部分，包括：

- `<html>`、`<head>` 和 `<body>`；
- 页面标题、摘要和 favicon；
- 在页面显示前读取主题和语言，减少闪烁；
- 引入全局样式；
- 放置顶部导航和页脚；
- 用 `<slot />` 接收各页面自己的主体内容。

可以把它理解为“每个页面外面都套着的统一框架”。修改它影响全站，应谨慎检查三种语言、桌面端和移动端。

### 4.7 `src/lib/`：数据处理和国际化基础

#### `src/lib/content.ts`

它负责：

- 从内容文件路径取得 slug；
- 把相同 slug 的三语言内容配成一组；
- 排除缺少任一语言的内容；
- 按发布日期倒序排列。

这解释了为什么只新增一份简体中文文件时，文章可能不会出现在网页上。

#### `src/lib/i18n.ts`

它集中管理：

- 三种语言代码和类型；
- 语言名称和日期格式；
- 导航、搜索、筛选、空状态等通用界面文案；
- 旧语言值 `zh` 到 `zh-CN` 的迁移。

修改导航等公共文案时，应先在这里找，不要把三套文字散落到不同组件中。

### 4.8 `src/styles/`：全站视觉规则

- `tokens.css`：颜色、字体、字号、间距等设计变量，是设计系统在代码中的基础。
- `global.css`：页面、导航、列表、按钮、动画和响应式规则等全局样式。
- `prose.css`：Markdown/MDX 正文、标题、段落、列表、表格和图片的排版。

如果只是修改某篇文章内容，不应改这些文件。修改它们往往会影响多个页面或全站。

### 4.9 `src/env.d.ts`

为 Astro 的类型系统提供声明。通常不需要手工修改。

## 5. `public/` 与 `src/assets/` 有什么区别

`public/` 中的文件会基本按原样复制到网站根目录，不需要 `import`。例如：

```text
public/brand/favicon-light-nobg.svg
```

可以通过 `/brand/favicon-light-nobg.svg` 访问。

简单判断：

- favicon、robots.txt 等需要固定网址的公开静态文件放 `public/`；
- 正文图片、需要构建系统识别和管理的图片放 `src/assets/`。

## 6. `docs/`：项目文档

- `docs/design-system.md`：本网站的视觉、排版和交互规范。
- `docs/learning/`：你正在阅读的零基础维护手册。

文档不会自动显示在正式网站页面里，但会随 Git 提交保存，供维护者查阅。

## 7. 三个不要手工编辑的生成目录

### `node_modules/`

pnpm 安装的第三方依赖，体积很大。删除后可以根据 `package.json` 和锁文件重新安装。

### `.astro/`

Astro 的缓存和生成类型。工具会重建。

### `dist/`

`pnpm build` 生成的正式网站文件。部署的是它的内容，但源代码不应直接在这里维护，因为下次构建会覆盖它。

## 8. 一次页面生成的实际过程

以食谱详情页为例：

```text
src/content/recipes/三语言 Markdown
                 ↓ 由 content.config.ts 校验
src/lib/content.ts 配对语言并整理 slug
                 ↓
src/pages/recipes/[slug].astro 生成每个详情网址
                 ↓
ProseLayout.astro 组合标题、信息、正文和上一篇/下一篇
                 ↓
BaseLayout.astro 加上导航、页脚、主题和页面元数据
                 ↓
global.css + prose.css + tokens.css 决定视觉表现
                 ↓ pnpm build
dist/recipes/<slug>/index.html
```

理解这条链路后，排查问题会容易很多：

- 文章没出现：先看三语言文件名、frontmatter 和 `draft`。
- 标题或日期错误：看内容文件和内容配置。
- 所有详情页都排版异常：看 `ProseLayout.astro` 或 `prose.css`。
- 全站导航异常：看 `SiteHeader.astro` 和 `global.css`。
- 构建时报字段错误：看 `content.config.ts` 的要求。
