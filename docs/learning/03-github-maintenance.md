# 03 Git、GitHub 与日常维护

## 1. Git 和 GitHub 不是一回事

Git 是安装在电脑上的版本管理程序，负责比较文件变化、创建提交、建立分支和保留历史。GitHub 是托管 Git 仓库的网站，负责保存远程副本、协作审查和 Pull Request。

简单说：Git 是本地工具，GitHub 是远程平台。

## 2. 必须理解的名词

| 名词 | 含义 | 在本项目中是什么 |
| --- | --- | --- |
| 仓库 repository | 被 Git 管理的一组文件和历史 | `personal-site-git` 及 GitHub 仓库 |
| 工作区 working tree | 当前看到并修改的文件 | Git 工作目录中的文件 |
| 暂存区 staging area | 被选入下一次提交的变化 | 执行 `git add` 后的内容 |
| 提交 commit | 带说明的一次本地快照 | 例如“新增食谱” |
| 分支 branch | 一条独立修改线 | `main`、`update/recipes` |
| `main` | 正式主分支 | 准备部署的稳定代码 |
| 远程 remote | 远程仓库的简称和地址 | `origin` 通常指 GitHub 仓库 |
| push | 把本地提交上传到远程 | 分支从电脑传到 GitHub |
| pull | 取得远程变化并更新当前分支 | 让本地 `main` 跟上 GitHub |
| Pull Request / PR | 请求把一个分支合并进另一个分支 | 把 `update/...` 合并进 `main` |

最容易混淆的是：

- `git add` 只选择下一次提交的内容，不会上传。
- `git commit` 只在本地保存快照，不会上传。
- `git push` 才会把提交上传到 GitHub。
- PR 合并到 `main` 后，服务器仍要另行部署。

## 3. 为什么现在有两个本地目录

```text
C:\Code\Website\personal-site
    日常开发、Codex 修改、本地预览

C:\Code\Website\personal-site-git
    Git 提交、推送 GitHub、创建 PR
```

只有含 `.git` 目录的 `personal-site-git` 是 Git 仓库。开发目录中的修改不会自动进入 Git 仓库，必须主动同步。

## 4. 每次开始工作前

### 4.1 更新 Git 工作目录的 `main`

在 Windows PowerShell 中：

```powershell
cd C:\Code\Website\personal-site-git
git status -sb
git switch main
git pull --ff-only origin main
```

如果 `git status` 显示未提交改动，不要直接切分支或 pull，先确认这些改动属于哪项工作。

### 4.2 创建本次工作的分支

```powershell
git switch -c update/简短英文说明
```

例如：

```powershell
git switch -c update/add-new-recipes
git switch -c update/improve-navigation
git switch -c update/learning-docs
```

分支名建议全部小写、使用短横线、能看出修改主题，并避免空格和中文。

## 5. 在开发目录修改和检查

```powershell
cd C:\Code\Website\personal-site
pnpm dev
```

浏览器打开终端显示的地址，通常是 `http://127.0.0.1:4321`。完成修改后可按 `Ctrl+C` 停止，再运行：

```powershell
pnpm check
pnpm build
pnpm preview
```

`pnpm preview` 用来查看生产构建结果，不是正式部署服务。

如果要让同一局域网内的手机或 iPad 预览：

```powershell
pnpm dev --host
```

然后在移动设备中打开电脑的局域网 IP 和终端显示的端口。必要时允许 Windows 防火墙中的本地网络访问。不要把开发服务器直接暴露到公网。

如果 Astro 提示已有开发服务器，可先确认旧进程，再运行：

```powershell
pnpm exec astro dev stop
```

## 6. 同步到 Git 工作目录

当前使用 `robocopy`。`/MIR` 会让目标镜像源目录，目标中多出的文件可能被删除，所以必须先预演。

### 6.1 预演，不写入

```powershell
robocopy "C:\Code\Website\personal-site" "C:\Code\Website\personal-site-git" /MIR /L /R:2 /W:1 /XD ".git" "node_modules" ".astro" "dist" ".pnpm-store" /XF ".env" ".env.*" "*.log"
```

`/L` 只列出计划复制、更新和删除的内容。必须确认没有误删个人文件或 Git 元数据。

参数含义：

- `/MIR`：镜像目录；
- `/L`：只预演；
- `/R:2`：失败后最多重试 2 次；
- `/W:1`：重试等待 1 秒；
- `/XD`：排除目录；
- `/XF`：排除文件。

### 6.2 实际同步

确认预演正确后，只去掉 `/L`：

```powershell
robocopy "C:\Code\Website\personal-site" "C:\Code\Website\personal-site-git" /MIR /R:2 /W:1 /XD ".git" "node_modules" ".astro" "dist" ".pnpm-store" /XF ".env" ".env.*" "*.log"
```

不要把源和目标写反：源是 `personal-site`，目标是 `personal-site-git`。

## 7. 确定提交范围

```powershell
cd C:\Code\Website\personal-site-git
git status -sb
git diff --stat
git diff
git diff --check
```

这些命令分别用于：

- 查看当前分支和新增、修改、删除的文件；
- 查看改动规模；
- 逐行检查实际变化；
- 检查基础空白符问题。

逐项确认：

1. 所有文件都属于本次主题；
2. 没有意外删除；
3. 没有 `node_modules/`、`dist/`、`.astro/`；
4. 没有 `.env`、Token、密码、私钥、隐私和服务器敏感信息；
5. 三语言内容同步；
6. `package.json` 和锁文件的变化确有必要。

状态中的 `M` 是修改，`A` 是新增，`D` 是删除，`??` 是未跟踪的新文件。

## 8. 暂存并提交

如果全部变化都属于本次任务：

```powershell
git add -A
git status -sb
git diff --cached --stat
git diff --cached
```

`git diff --cached` 是真正将进入提交的内容，应作为提交前最后一次核对。

确认后：

```powershell
git commit -m "Add beginner maintenance guides"
git status -sb
git log -1 --oneline
```

提交信息应说明完成了什么，不要只写 `update`、`fix` 或日期。

## 9. 推送分支

```powershell
git push -u origin update/learning-docs
```

第一次推送该分支使用 `-u`，以后可直接 `git push`。如果实际分支名不同，命令也要对应。查看当前分支：

```powershell
git branch --show-current
```

## 10. 创建 Pull Request

```powershell
gh auth status
gh pr create --base main --head update/learning-docs --title "Add beginner maintenance guides" --body "Add project structure, deployment, GitHub workflow, and content authoring guides."
```

也可先创建草稿：

```powershell
gh pr create --base main --head update/learning-docs --fill --draft
```

在 PR 中再次确认：

- 合并方向是工作分支到 `main`；
- `Files changed` 只有预期文件；
- 自动检查如果存在，应全部通过；
- 标题和说明能概括本次修改。

打开当前 PR：

```powershell
gh pr view --web
```

## 11. 合并 Pull Request

可以在 GitHub 网页操作，也可执行：

```powershell
gh pr merge --squash --delete-branch
```

`--squash` 把工作分支的多个提交整理成 `main` 上的一个提交；`--delete-branch` 删除已合并的远程工作分支。

合并后更新本地：

```powershell
git switch main
git pull --ff-only origin main
git fetch --prune
git status -sb
```

此时 GitHub 已更新，但正式网站还没有自动更新。下一步按部署手册登录服务器发布。

## 12. PR 尚未合并时继续修改

1. 保持同一工作分支；
2. 在开发目录继续修改并检查；
3. 再同步到 Git 工作目录；
4. 检查差异；
5. 新建提交并 `git push`。

新提交会自动加入同一个 PR，不需要再开一个 PR。

## 13. 常见错误

### `git add` 后发现不应提交某文件

```powershell
git restore --staged 路径\文件名
```

它只把文件移出暂存区，不删除本地修改。

### 已提交但尚未推送

初学阶段最稳妥的是继续修正并新建一个提交，不必急于改写历史。

### 已推送后发现问题

不要强制推送，继续提交修复即可。

### 出现合并冲突

停止随机操作，保存当前分支、`git status` 输出和冲突文件，再判断双方内容应如何组合。

### 误提交密码或 Token

立即停止推送。如果已经推送，仅从当前文件删除并不能清除 Git 历史；先吊销或轮换凭据，再处理历史。

## 14. 初学阶段不要使用

在没有完全理解影响范围前，不要使用：

```text
git reset --hard
git clean -fd
git push --force
git push --force-with-lease
```

它们可能丢失修改、删除未跟踪文件或改写远程历史。

## 15. 推荐的提交粒度

一次提交或 PR 只处理一个主题，例如新增一组食谱、修改导航交互、更新项目文章或增加维护文档。不要把无关的内容更新、样式重构、依赖升级和服务器配置混在一起。

## 16. GitHub 到正式网站的关系

```text
工作分支 push 到 GitHub
        ↓
Pull Request 合并到 main
        ↓
服务器 git pull origin main
        ↓
服务器重新 build
        ↓
切换 current 后正式网页更新
```

服务器只应部署 `main`，不要部署尚未审查的临时分支。

## 17. 官方参考

- [GitHub：Using Git](https://docs.github.com/en/get-started/using-git)
- [GitHub：克隆仓库](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository)
- [GitHub：从远程取得变化](https://docs.github.com/en/get-started/using-git/getting-changes-from-a-remote-repository)
- [GitHub：推送提交](https://docs.github.com/en/get-started/using-git/pushing-commits-to-a-remote-repository)
- [GitHub：创建 Pull Request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request)
- [GitHub：合并 Pull Request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/merging-a-pull-request)
- [GitHub CLI 文档](https://docs.github.com/en/github-cli)
