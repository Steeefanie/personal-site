# Steeefanie Personal Site

一个基于 Astro 构建的多语言个人内容网站，用于发布随笔、项目与食谱。网站采用静态生成架构，支持简体中文、繁体中文（台湾）和英文，并提供响应式布局、深浅主题、本地搜索、内容筛选及键盘操作支持。

## 功能

- 随笔、项目和食谱的分类展示与详情阅读；
- 简体中文、繁体中文（台湾）和英文内容切换；
- 基于标题、摘要、标签和技术栈的站内搜索；
- 食谱分类筛选及列表分页；
- 基于 GitHub Discussions 的主页留言与详情页评论；
- 深色与浅色主题切换；
- 响应式导航和无障碍交互；
- 站点本体采用静态构建，无自建数据库及服务端运行依赖。

## 技术栈

- [Astro](https://astro.build/) 7
- TypeScript 6
- Tailwind CSS 4
- Astro Content Collections
- Markdown / MDX

## 路由

```text
/                    主页
/blog/               随笔列表
/blog/[slug]/        随笔详情
/projects/           项目列表
/projects/[slug]/    项目详情
/recipes/            食谱列表
/recipes/[slug]/     食谱详情
/search-index.json   本地搜索索引
```

网站不设置语言路径前缀，同一路由根据当前语言展示对应内容。

## 项目结构

```text
public/                         静态资源
src/
├─ assets/                      内容引用资源
├─ components/                  页面与交互组件
├─ content/
│  ├─ blog/                     随笔内容
│  ├─ projects/                 项目内容
│  └─ recipes/                  食谱内容
├─ layouts/                     页面布局
├─ lib/                         内容与国际化工具
├─ pages/                       页面及路由
└─ styles/                      全局样式与设计令牌
docs/
└─ design-system.md             设计与交互规范
```

各内容栏目按 `zh-CN`、`zh-TW` 和 `en` 分设目录。同一内容的三种语言版本使用相同文件名，以建立稳定的内容对应关系。

## 本地运行

环境要求：Node.js 22 或更高版本、pnpm 11。

```bash
pnpm install
pnpm dev
```

默认开发地址为 `http://localhost:4321`。

## 构建与检查

```bash
pnpm check
pnpm build
pnpm preview
```

构建结果输出至 `dist/`，可部署到支持静态文件托管的 Web 服务。

## 内容规范

- 内容通过 Astro Content Collections 统一管理，并由 Schema 校验元数据；
- 同一内容应同时提供三种语言版本，且文件名保持一致；
- 正文使用 Markdown 或 MDX 编写，页面标题及公共排版由统一布局生成；
- 项目图片存放于 `src/assets/projects/`，公共静态资源存放于 `public/`；
- 密钥、密码、Token 及其他敏感配置不得写入仓库或前端代码。

留言与评论由独立的公开 GitHub Discussions 仓库承载，访客需要登录 GitHub 后发表公开内容。

完整的视觉与交互规范见 [设计系统](docs/design-system.md)。
