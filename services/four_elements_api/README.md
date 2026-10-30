# 测评 AI 解读接口

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

启动命令启用 Node.js 24 的 `--use-env-proxy`，使用运行环境中已经配置的 `HTTP_PROXY`、`HTTPS_PROXY`、`NO_PROXY`。不内置代理地址；没有代理配置时保持直连。本地运行时应将 `localhost` 和 `127.0.0.1` 列入 `NO_PROXY`，避免本地接口流量绕经代理。上游连接中断不自动重试生成请求。

需要真实联调时，复制 `.env.example` 为同目录下被 Git 忽略的 `.env`，填写密钥，并把 `FOUR_ELEMENTS_ORIGINS` 改成实际本地来源，例如 `http://localhost:4322,http://127.0.0.1:4322`，本地 `FOUR_ELEMENTS_TRUST_PROXY=false`。

`pnpm dev` 和 `pnpm preview` 均将 `/api/v1/four-elements` 与 `/api/v1/seven-traits` 代理到该服务。已有预览进程需要重启才能读取新代理配置。

### 本地 502 与来源检查

前端预览和报告 API 是两个独立进程。只有页面能打开，不代表报告服务已启动。开始联调前，分别检查 `http://127.0.0.1:8101/api/v1/seven-traits/health` 和当前预览来源下的 `/api/v1/seven-traits/health`；两者均应返回 200，且 `configured` 为 true。四元素使用对应的 `four-elements` 路径。

直连 8101 被拒绝而页面代理返回 502 时，先恢复 `npm run ai:dev`。健康接口正常后，再确认当前实际来源（含端口）已列入 `FOUR_ELEMENTS_ORIGINS`；预览自动换端口时须同步补充，不放开任意来源。可以携带当前 Origin 向报告接口发送空对象：返回参数校验错误 400 表示来源检查通过；403 表示来源尚未允许。空对象不会调用模型。恢复服务后保留浏览器中的作答，通过页面“重试”重新生成，排查过程不自动重发完整作答。

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
- AI 写整体画像、各元素具体表现、六组情境取舍和综合描述。数值和图表由程序控制；AI 正文不输出分数。每段附来源题号；接口和浏览器均校验字段、长度、四个元素、六组对照及题号归属，显示时只用文本节点。
- 默认模型 `deepseek-flash`，JSON 输出、关闭思考、最多 9,000 输出 token，单次上游超时 90 秒；不自动重试付费请求。两套测试共用该模型配置，已有本地或部署环境须同时核对显式的 `DEEPSEEK_MODEL`，修改默认值不会覆盖已设置的值。
- 默认每 IP 每小时最多 5 次请求、全服务每日最多 100 次上游尝试，同时最多 2 次生成。日界线按上海时区。修改环境变量可调整。
- 仅合并正在处理的同答案请求；响应结束后不缓存答案或报告，不落盘、不记录原始作答或完整上游响应日志。限流计数不包含作答内容。API 错误不回传密钥或上游原文。
- 客户端只保留与当前答案完全匹配的 AI 解读；提交后锁定作答，生成失败可按原答案重试；清除数据同时清除 AI 缓存并解除锁定。取消后的迟到响应不会覆盖新答案。已经发出的上游调用仍可能计费。
- 末页提交时，作答会离开浏览器，经本站服务发送至 DeepSeek；不能继续宣称“所有答案永不上传”。
- 网页和文字 PDF 使用同一份 AI 内容。PDF 自带中文字体覆盖常见汉字；若包含极少见的不支持字符会明确提示重新生成，避免静默缺字。


## 七宗罪与七美德复用

同一进程另提供 `/api/v1/seven-traits/health` 与 `/api/v1/seven-traits/report`。复用已有 `DEEPSEEK_API_KEY`、来源白名单、小时/每日额度和并发上限；两套测试共享调用额度，但合并请求的键包含测试名称，不会混用报告。已有环境变量名称保持不变，无需新建密钥或进程。

七宗罪接口从 V1.2 原题重建完整 56 题、量表含义及原始回答，自行核算十四维及反向计分。输出采用 `seven-traits-deepseek-v2`：十四个维度、七组对应关系、总览提炼句、综合内容卡片、收尾反思及两至三项观察建议。每个维度携带该维全部四题，每组对照携带对应八题；输入显式提供允许题号，双端检查完整性和归属。正文不写数值，分数、章节顺序和配对由程序决定。网页与 PDF 将两侧维度合并为七章，避免重复展开。旧报告缓存失效，保留答案和提交锁定，不自动生成。

七宗罪编辑提示词区分总览、维度卡片、关系分析、跨组综合及收尾的职责，避免将选择逐题改写或反复总结。综合卡片的证据必须跨至少两组对应维度。缓存采用 `seven-traits-ai-v3`，协议仍为 v2；旧报告删除后由用户手动触发生成。两套测试的提示词共用强调长度与密度限制，程序在原文上确定强调范围，网页与 PDF 不各自重新选择。

建议篇幅与实际校验边界分开：支持合理短段落、合并段落与依据去重；无效字面强调直接忽略。缺失维度、无关依据、空正文、超长报告和危险文本仍拒绝。两套测试继续使用同一模型配置，默认 `deepseek-flash`，不自动重试付费请求；日志不记录答案、生成正文或密钥。

七宗罪最长输出为 14,000 token，保留 90 秒上游超时；报告更长，实际耗时和费用需真实接入后评估。自动化测试使用模拟上游，不产生真实模型费用。

部署时除更新前后端源码及重启现有 API 服务，还需在 HTTPS server 块中为新路径增加同样的代理：

```nginx
location /api/v1/seven-traits/ {
    client_max_body_size 4k;
    proxy_pass http://127.0.0.1:8101;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Origin $http_origin;
    proxy_read_timeout 110s;
}
```

不要只更新静态文件而遗漏此路径。测试使用独立来源或端口时，应把实际来源加入现有 `FOUR_ELEMENTS_ORIGINS`；开发预览不会自动放开任意来源。

四元素新生成采用 v4 卡片协议：后端比较整体分布后发送确定的 readingPlan 和 presentation，模型提供短段落、卡片正文、提炼句和字面强调词；程序控制实际字体、卡片、坐标和分页，不执行模型生成的排版代码。前后端需同时部署并重启接口服务。浏览器仍可读取和下载既有 v3 报告，保持旧分组与原文；不自动重新生成，使用新版必须清除数据后重新作答。密钥和计分规则不变。

## 生成格式兼容

输入提供各元素和章节的 allowedEvidenceIds，以及各情境对照的 requiredEvidenceIds，模型应按显式集合选择依据，不猜测连续题号。元素解读可引用自身评分题和相关的两两选择题；无关题号仍拒绝。校验保留一至三段的原文，允许简短补充说明并去重依据题号，不补写结论或替换错误依据。依据数量以允许集合大小为上限，避免有效引用因任意数量限制而整份失败。章节、卡片、总体篇幅和文本安全限制保持有效。

若浏览器只显示通用 HTTP 502，而服务日志出现 invalid-report，检查 Nginx 是否拦截上游错误；可在四元素 API 的 location 中配置 proxy_intercept_errors off，保留后端 JSON 错误提示。健康接口正常仅说明服务和配置可用，不代表报告已生成成功。
