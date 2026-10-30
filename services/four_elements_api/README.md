# 星象测试 AI 解读接口

保留 Astro 静态站点，独立 Node.js 24 服务只监听 `127.0.0.1:8101`。无新增服务端依赖，使用内置 HTTP、fetch 及项目原有计分模块。

## 密钥与 GitHub 配置入口

仓库只提交 `.env.example`，真实密钥使用部署环境变量 `DEEPSEEK_API_KEY`。不要使用 `PUBLIC_` 前缀，不在网页表单、源码、提交或日志中保存密钥。

如果使用 GitHub Actions，在仓库 Settings → Secrets and variables → Actions 添加名为 `DEEPSEEK_API_KEY` 的 Repository secret。在部署步骤通过以下变量映射读取：

```yaml
env:
  DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
```

当前项目仍采用手工部署，没有自动发布工作流；仅添加 GitHub secret 不会自动传到服务器。部署时将该值注入下述服务环境文件，或由后续发布流程把它写入环境文件。禁止回显、上传为构建产物或写进静态 `dist/`。

## 本地运行

无密钥时仍可启动服务，生成接口会明确返回“尚未配置”，不伪造 AI 报告。

```powershell
npm run ai:dev
```

开发命令仅通过文件时间戳轮询监听本地环境文件，避免 Windows 目录通知将相邻文件编辑误作配置变更；填入密钥并保存后自动重启后端，无需重建前端。修改后端代码需手动重启，避免开发其他模块时中断正在生成的报告。常规运行也可使用 `npm run ai:start`，修改配置后手动重启。

需要真实联调时，复制 `.env.example` 为同目录下被 Git 忽略的 `.env`，填写密钥，并把 `FOUR_ELEMENTS_ORIGINS` 改成实际本地来源，例如 `http://localhost:4322,http://127.0.0.1:4322`，本地 `FOUR_ELEMENTS_TRUST_PROXY=false`。

`pnpm dev` 和 `pnpm preview` 均将 `/api/v1/four-elements` 代理到该服务。已有预览进程需要重启才能读取新代理配置。

## 生产部署

1. 运行全部测评测试、Astro 检查及构建，按现有静态站点流程发布。
2. 用独立服务环境文件 `/etc/personal-site/four-elements-api.env` 保存 `.env.example` 中的变量，权限只允许服务用户和管理员读取，例如 `root:www-data`、`0640`。
3. 参照 `four-elements-api.service.example` 配置 systemd。`ExecStart` 必须指向服务用户可执行的 Node.js 24 绝对路径；不要假定 `/usr/bin/node` 存在。先确认运行时路径及目录访问权限，再启用服务。
4. 在现有 HTTPS server 块中添加：

```nginx
location /api/v1/four-elements/ {
    client_max_body_size 4k;
    proxy_pass http://127.0.0.1:8101;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Origin $http_origin;
    proxy_read_timeout 110s;
}
```

5. 检查 `nginx -t` 后重载；通过 `/api/v1/four-elements/health` 确认 configured 为 true，再完成一份匿名样例的真实生成。不要把 API 端口暴露到公网。

## 数据、成本与输出

- 在末页点击提交后，浏览器只提交完整答案数组和同意标志。后端从固定题库重建全部 48 道题的原文、选项、实际回答和选中内容；评分题带完整量表含义；后端自行算分，再一起发送给 DeepSeek。
- AI 按 v3 卡片协议生成总览、分组解读、协同建议与收束文字，并提供可追溯的作答依据和字面强调词。后端发送确定的 readingPlan；接口和浏览器校验字段、长度、元素、题号及强调词。数值、图表、字体、卡片和分页由程序控制，不执行模型生成的 HTML 或排版代码。
- 默认模型 `deepseek-v4-pro`，JSON 输出、关闭思考、最多 9,000 输出 token，单次上游超时 90 秒；不自动重试付费请求。真实调用效果和成本仍需接入密钥后评估。
- 默认每 IP 每小时最多 5 次请求、全服务每日最多 100 次上游尝试，同时最多 2 次生成。日界线按上海时区。修改环境变量可调整。
- 仅合并正在处理的同答案请求；响应结束后不缓存答案或报告，不落盘、不记录原始作答或完整上游响应日志。限流计数不包含作答内容。API 错误不回传密钥或上游原文。
- 客户端只保留与当前答案完全匹配的 AI 解读；提交后锁定作答，生成失败可按原答案重试；清除数据同时清除 AI 缓存并解除锁定。取消后的迟到响应不会覆盖新答案。已经发出的上游调用仍可能计费。
- 末页提交时，作答会离开浏览器，经本站服务发送至 DeepSeek；不能继续宣称“所有答案永不上传”。
- 网页和文字 PDF 使用同一份 AI 内容。PDF 自带中文字体覆盖常见汉字；若包含极少见的不支持字符会明确提示重新生成，避免静默缺字。
