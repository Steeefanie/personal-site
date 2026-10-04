# 个人网站零基础学习手册

这套手册不是通用教程，而是专门解释当前这个个人网站。命令、目录和示例都以本项目为准。

## 建议阅读顺序

1. [01-project-structure.md](./01-project-structure.md)：先认识项目中的目录和主要文件。
2. [02-deployment.md](./02-deployment.md)：理解浏览器如何访问网站，以及代码如何部署到服务器。
3. [03-github-maintenance.md](./03-github-maintenance.md)：理解 Git、GitHub、提交、分支和 Pull Request。
4. [04-content-authoring.md](./04-content-authoring.md)：学习如何新增随笔、项目和食谱，以及如何更新网站。

## 先建立一个总的认识

这个网站不是一个始终运行着 Node.js 程序的动态网站，而是一个由 Astro 生成的静态网站：

```text
Markdown / MDX 内容 + Astro 页面和组件 + CSS
                    ↓ pnpm build
             HTML + CSS + JavaScript + 图片
                    ↓ 复制到服务器
                 Nginx 对外提供文件
```

因此，需要把四个位置分清楚：

| 位置 | 当前路径或地址 | 主要用途 |
| --- | --- | --- |
| 开发目录 | `C:\Code\Website\personal-site` | 平时编辑、预览和构建网站；这是主要工作目录 |
| Git 工作目录 | `C:\Code\Website\personal-site-git` | 检查改动范围、提交 Git、推送 GitHub |
| GitHub 远程仓库 | `Steeefanie/personal-site` | 保存公开版本和完整提交历史 |
| 服务器 | 源码 `/opt/personal-site`；网页 `/var/www/steeefanie/` | 拉取 GitHub 上的代码、构建网站并由 Nginx 对外发布 |

这四处是同一项目在不同阶段的副本，不会自动同步：

- 在开发目录修改文件，不等于已经提交到 GitHub。
- 推送分支到 GitHub，不等于已经合并到 `main`。
- 合并到 GitHub 的 `main`，也不等于服务器已经部署新版本。
- 服务器完成拉取、构建和切换版本后，访问者才会看到更新。

## 最常用的完整流程

```text
1. 在 personal-site 编辑
2. 本地预览并执行检查、构建
3. 将需要发布的文件同步到 personal-site-git
4. 在 personal-site-git 检查差异
5. 创建分支、提交、推送
6. 在 GitHub 创建并合并 Pull Request
7. 登录服务器，拉取 main、重新构建并发布
8. 打开正式域名复查
```

每一步的命令和故障处理都在后续手册中展开。

## 几条重要原则

- 不直接编辑 `node_modules/`、`.astro/` 和 `dist/`，它们都是生成目录。
- 不把密码、Token、SSH 私钥、真实服务器凭据或 `.env` 文件提交到 GitHub。
- 同一次提交只处理一个清晰主题，提交前一定看 `git status` 和 `git diff`。
- `robocopy /MIR` 会删除目标中源目录不存在的文件，必须先加 `/L` 预演。
- 部署前必须成功执行 `pnpm check` 和 `pnpm build`。
- 不理解时不要使用 `git reset --hard`、`git push --force` 或递归删除命令。

## 权威参考

- [Astro：开发与构建](https://docs.astro.build/en/develop-and-build/)
- [Astro：部署指南](https://docs.astro.build/en/guides/deploy/)
- [GitHub：Using Git](https://docs.github.com/en/get-started/using-git)
- [Nginx：请求处理](https://nginx.org/en/docs/http/request_processing.html)
- [Certbot：Nginx + Snap 安装说明](https://certbot.eff.org/instructions?ws=nginx&os=snap)
