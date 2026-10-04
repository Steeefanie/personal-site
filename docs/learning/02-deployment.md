# 02 网站部署全流程

## 1. “部署”到底是什么

开发目录里的源码不能直接作为完整网页交给访问者。部署是把源码转换成生产文件，再放到公网服务器上，由 Web 服务器对外提供访问的过程。

本项目的部署链路是：

```text
本地开发目录
  ↓ 检查、构建、提交
GitHub 的 main 分支
  ↓ 服务器 git pull
服务器 /opt/personal-site 源码
  ↓ pnpm install + pnpm build
服务器 dist/ 静态文件
  ↓ rsync 到版本目录并切换 current
/var/www/steeefanie/current
  ↓ Nginx
https://steeefanie.top
```

当前没有配置 GitHub Actions 自动部署。因此，“合并 GitHub Pull Request”和“让正式网站更新”是两个步骤，合并后还需要登录服务器部署。

## 2. 浏览器访问网站时发生了什么

访问者在浏览器输入 `https://steeefanie.top/projects/` 后，大致经过以下过程：

```text
浏览器
  ↓ 查询 steeefanie.top 的 DNS A 记录
得到服务器 IPv4 地址
  ↓ 连接服务器 TCP 443 端口
UFW 防火墙允许 443
  ↓ TLS 握手，Nginx 出示 HTTPS 证书
Nginx 根据 server_name 选择 steeefanie.top 站点
  ↓ 在 root 指向的目录中寻找文件
/var/www/steeefanie/current/projects/index.html
  ↓ 返回 HTML，并继续请求 CSS、JavaScript、图片
浏览器渲染成页面
```

各部分的职责：

| 部分 | 可以怎样理解 | 本项目中的作用 |
| --- | --- | --- |
| 域名 | 便于记忆的名字 | `steeefanie.top`、`www.steeefanie.top` |
| DNS | 域名到 IP 地址的目录 | A 记录指向服务器公网 IPv4 |
| IP 地址 | 公网服务器的网络地址 | 让数据包找到服务器 |
| TCP 端口 | 同一主机上不同服务的入口 | 22 为 SSH，80 为 HTTP，443 为 HTTPS |
| UFW | 主机防火墙 | 只允许需要的入站端口 |
| Nginx | Web 服务器 | 接收 HTTP(S) 请求并返回静态文件 |
| TLS 证书 | 证明域名身份并建立加密连接 | 由 Let’s Encrypt/Certbot 申请和续期 |
| Astro | 静态站点生成器 | 在部署时把源码构建成 HTML/CSS/JS |

关键点：生产环境中不需要一直运行 `pnpm dev`。Node.js 和 Astro只在构建时工作；构建结束后，由 Nginx 直接读取静态文件。

## 3. 当前服务器基础

根据服务器检查记录，当前环境为：

- Ubuntu 24.04.4 LTS；
- Nginx 1.24.0，已经运行并开机启动；
- Git、curl、rsync、snapd 已安装；
- NVM 0.40.6、Node.js 24.18.0、pnpm 11.15.0 已安装；
- UFW 已放行 22、80、443，且不要删除现有 SSH 规则；
- 域名 A 记录已经指向服务器公网 IPv4；
- 服务器内存约 1.9 GiB、未配置 Swap，只有构建确实发生内存不足时再考虑增加 1—2 GiB Swap；
- 前次检查时仍是 Nginx 默认站点，HTTPS 尚未配置。

服务器 IP、主机名等运维信息不应写进公开仓库。命令中优先使用域名。

## 4. 首次部署前的条件

请先确认：

1. GitHub 仓库 `Steeefanie/personal-site` 已经包含准备发布的 `main` 分支。
2. 服务器可以访问 GitHub。若仓库为公开仓库，克隆不需要 GitHub Token。
3. 域名 A 记录指向当前服务器，并且 DNS 已生效。
4. 22、80、443 的 UFW 规则保留。
5. 本地已经成功执行 `pnpm check` 和 `pnpm build`。

## 5. 第一次把网站部署到服务器

下面命令都在服务器 SSH 终端中执行，不是在 Windows PowerShell 中执行。

### 5.1 连接服务器

在 Windows PowerShell 中：

```powershell
ssh root@steeefanie.top
```

连接后，提示符和命令都属于 Ubuntu 服务器。不要把服务器命令误在本地执行。

### 5.2 克隆源码

在服务器中：

```bash
cd /opt
git clone https://github.com/Steeefanie/personal-site.git personal-site
cd /opt/personal-site
git status
git branch --show-current
```

预期当前分支为 `main`，工作区没有未提交改动。

目录职责：

- `/opt/personal-site`：服务器上的源码和构建工作目录；
- `/var/www/steeefanie/releases/时间戳`：每次部署生成的不可变网页版本；
- `/var/www/steeefanie/current`：指向当前生效版本的符号链接。

不要直接在 `/opt/personal-site` 修改正式内容，否则下一次拉取容易产生冲突，也不会留下规范的 GitHub 历史。

### 5.3 加载 Node.js 环境

Node.js 由 NVM 安装。在非交互式脚本中必须主动加载；手工部署时也建议明确执行：

```bash
export NVM_DIR="/root/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 24
node --version
pnpm --version
```

### 5.4 安装依赖并构建

```bash
cd /opt/personal-site
pnpm install --frozen-lockfile
pnpm build
```

成功后会产生 `/opt/personal-site/dist/`。

- `--frozen-lockfile` 要求严格按照锁文件安装。
- `pnpm build` 已包含 Astro 检查；任何错误都应先解决，不要带错发布。
- 若真的出现进程因内存不足被终止，再评估 Swap；不要因为“可能需要”就先改系统。

### 5.5 创建首个版本并切换

```bash
release="$(date +%Y%m%d%H%M%S)"
mkdir -p "/var/www/steeefanie/releases/$release"
rsync -a --delete /opt/personal-site/dist/ "/var/www/steeefanie/releases/$release/"
ln -sfn "/var/www/steeefanie/releases/$release" /var/www/steeefanie/current
find "/var/www/steeefanie/releases/$release" -maxdepth 2 -type f | head
```

这里采用版本目录而不是直接覆盖网页：

- 构建和复制未完成时，旧网站仍然可用；
- `ln -sfn` 切换很快，减少更新到一半的状态；
- 出现问题时可以把 `current` 指回上一个版本。

`rsync --delete` 只在新建的版本目录中同步 `dist/`，不要把路径随意改成系统目录。

### 5.6 创建 Nginx 站点配置

创建 `/etc/nginx/sites-available/steeefanie.top`，HTTP 阶段可先使用：

```nginx
server {
    listen 80;
    listen [::]:80;

    server_name steeefanie.top www.steeefanie.top;
    root /var/www/steeefanie/current;
    index index.html;

    location / {
        try_files $uri $uri/ $uri/index.html =404;
    }

    location ~ ^/giscus-(?:light|dark)\.css$ {
        try_files $uri =404;
        default_type text/css;
        expires 7d;
        add_header Cache-Control "public";
        add_header Access-Control-Allow-Origin "https://giscus.app" always;
    }

    location ~* \.(?:css|js|svg|png|jpg|jpeg|webp|avif|ico|woff2?)$ {
        try_files $uri =404;
        expires 7d;
        add_header Cache-Control "public";
    }
}
```

解释：

- `listen`：接收 IPv4/IPv6 的 80 端口请求；有监听地址不等于域名已经有 AAAA 记录。
- `server_name`：只处理这两个域名。
- `root`：网页根目录使用 `current` 链接，所以切换版本不需要改 Nginx 配置。
- `try_files`：依次寻找请求文件、目录和目录中的 `index.html`。
- `giscus-*.css` 专用规则：允许 giscus iframe 跨域读取本站托管的评论主题；该规则必须放在通用静态资源正则规则之前。

启用站点：

```bash
ln -s /etc/nginx/sites-available/steeefanie.top /etc/nginx/sites-enabled/steeefanie.top
nginx -t
systemctl reload nginx
```

先测试新站点：

```bash
curl -I -H 'Host: steeefanie.top' http://127.0.0.1
curl -I http://steeefanie.top
```

确认返回正常网页后，再禁用默认站点：

```bash
unlink /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

`nginx -t` 必须成功后才能 reload。不要删除 `/etc/nginx/sites-available/default`，只需取消启用链接。

### 5.7 申请 HTTPS 证书

域名 HTTP 已经能访问后，再安装 Certbot。以 Certbot 官方针对 Nginx + Snap 的当前说明为准：

[Certbot 官方安装页面](https://certbot.eff.org/instructions?ws=nginx&os=snap)

典型命令如下：

```bash
snap install --classic certbot
ln -s /snap/bin/certbot /usr/bin/certbot
certbot --nginx -d steeefanie.top -d www.steeefanie.top --redirect
```

Certbot 会验证域名、申请证书并修改 Nginx 配置。选择重定向后，HTTP 请求会转到 HTTPS。

完成后检查：

```bash
nginx -t
systemctl reload nginx
curl -I https://steeefanie.top
curl -I https://www.steeefanie.top
curl -I -H 'Origin: https://giscus.app' https://steeefanie.top/giscus-light.css
certbot renew --dry-run
```

主题 CSS 的响应应包含 `Content-Type: text/css` 和 `Access-Control-Allow-Origin: https://giscus.app`。

不要把证书私钥复制进网站仓库。证书文件由服务器上的 Certbot 管理。

## 6. 以后每次更新网站的服务器操作

只有 GitHub 的 `main` 已经合并并且本地构建通过后，才执行：

```bash
ssh root@steeefanie.top
cd /opt/personal-site

git status --short
git switch main
git pull --ff-only origin main

export NVM_DIR="/root/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 24

pnpm install --frozen-lockfile
pnpm build

release="$(date +%Y%m%d%H%M%S)"
mkdir -p "/var/www/steeefanie/releases/$release"
rsync -a --delete /opt/personal-site/dist/ "/var/www/steeefanie/releases/$release/"
ln -sfn "/var/www/steeefanie/releases/$release" /var/www/steeefanie/current

curl -I http://127.0.0.1
curl -I https://steeefanie.top
```

为什么先看 `git status --short`：服务器源码目录原则上应干净。如果出现本地修改，不要直接 pull 或覆盖，先查明来源。

为什么使用 `git pull --ff-only`：它只接受清晰的快进更新，不会在服务器上自动制造意外合并提交。

## 7. 如何确认部署成功

至少检查以下项目：

1. `pnpm build` 没有错误。
2. `readlink -f /var/www/steeefanie/current` 指向刚创建的版本目录。
3. `nginx -t` 成功。
4. `systemctl is-active nginx` 返回 `active`。
5. `curl -I https://steeefanie.top` 返回 200 或合理的重定向。
6. 浏览器无痕窗口打开主页和本次修改的具体页面。
7. 切换三种语言和深浅主题。
8. 检查移动端菜单、搜索、图片、上一篇/下一篇和相关链接。

浏览器可能缓存 CSS 和图片。怀疑缓存时，可先用无痕窗口或强制刷新，不要立即判断服务器没有更新。

## 8. 回滚到上一个网页版本

先列出版本：

```bash
ls -la /var/www/steeefanie/releases
readlink -f /var/www/steeefanie/current
```

确认目标确实是一个以前成功的版本后：

```bash
ln -sfn /var/www/steeefanie/releases/上一版本时间戳 /var/www/steeefanie/current
curl -I https://steeefanie.top
```

静态文件版本切换不需要重启 Nginx，因为 Nginx 的 `root` 始终指向 `current`。

回滚网页只能暂时恢复服务，仍应在 GitHub 修复代码并重新部署，保证源码历史和线上状态最终一致。

## 9. 常见故障与排查顺序

### 域名打不开

依次检查：

1. DNS A 记录是否仍指向正确公网 IPv4；
2. 服务器是否在线；
3. UFW 是否放行 80/443；
4. Nginx 是否 active；
5. Nginx 配置是否通过 `nginx -t`；
6. 云服务商是否还有独立安全组限制。

### HTTP 可以，HTTPS 不可以

检查：

- Certbot 是否成功申请两个域名的证书；
- Nginx 是否监听 443；
- 443 是否被 UFW 和云安全组允许；
- `certbot certificates` 显示的证书是否有效；
- 域名是否解析到了申请证书的这台服务器。

### 首页正常，详情页 404

检查：

- `dist/` 中是否确实生成对应的 `目录/index.html`；
- Nginx `try_files` 是否包含 `$uri/` 或 `$uri/index.html`；
- 文章三语言文件是否齐全；
- slug 是否和网址一致。

### GitHub 已更新，网站没变

这是最常见的误解。依次检查：

1. PR 是否真的合并到 `main`；
2. 服务器 `/opt/personal-site` 是否执行过 pull；
3. 服务器构建是否成功；
4. 是否把新的 `dist/` 复制到新版本；
5. `current` 是否指向新版本；
6. 浏览器是否还在使用缓存。

### 构建突然被终止

先查看系统日志和内存，不要直接断定是内存不足。若确认发生 OOM，再考虑创建 1—2 GiB Swap。Swap 是磁盘上的缓慢补充空间，不能替代真实内存。

## 10. 当前方案的边界

- 这是手工部署流程，优点是步骤清晰、便于学习和控制；缺点是每次合并后需要登录服务器操作。
- 以后可以增加 GitHub Actions 自动部署，但这会引入 SSH 密钥、Secrets、失败恢复和权限边界，建议先熟练手工流程。
- 当前没有原生 AAAA 记录，因此域名主要通过 IPv4 访问；服务器监听 IPv6 不代表互联网会通过 IPv6 找到该域名。

## 11. 官方参考

- [Astro 部署指南](https://docs.astro.build/en/guides/deploy/)
- [Astro 开发与构建](https://docs.astro.build/en/develop-and-build/)
- [Nginx 请求处理](https://nginx.org/en/docs/http/request_processing.html)
- [Nginx try_files](https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files)
- [Certbot：Nginx + Snap](https://certbot.eff.org/instructions?ws=nginx&os=snap)
