# 拼豆图纸生成接口

该服务是网页表单与 `fuse-bead-pattern-generator` 之间的轻量包装层，不重复实现图像量化和图纸绘制算法。

## 本地启动

1. 克隆生成器仓库，或通过环境变量指定已有脚本：

```powershell
$env:FUSE_BEAD_GENERATOR_PATH = "C:\path\to\fuse_bead_pattern_generator.py"
```

2. 在独立 Python 虚拟环境中安装依赖并启动：

```powershell
python -m pip install -r services/fuse_bead_api/requirements.txt
python -m uvicorn services.fuse_bead_api.app:app --host 127.0.0.1 --port 8100
```

3. 另开终端运行 `pnpm dev`。Astro 开发服务会将 `/api/v1/fuse-bead` 请求代理到 `127.0.0.1:8100`。

## 生产约束

- Uvicorn 只监听本机地址，由 Nginx 反向代理。
- 使用单工作进程。HEIF 预览和图纸生成共用一个处理队列：同时只执行 1 个图像处理任务，最多允许 5 个请求等待；队列已满时返回 HTTP 429。等待中的上传由 `UploadFile` 暂存，不会在业务代码中被整体读入内存。
- HEIF 选择后会先上传一次用于生成透明 PNG 预览，原始字节不落盘且在响应后释放；点击生成时与其他格式一样重新上传。
- HEIF 在生成前统一转为 PNG；带透明通道的图片按可见内容外接矩形裁边后再交给生成器，避免透明区在不同解码链路中被填成黑色。
- Nginx 的 `proxy_read_timeout` 建议不少于 `210s`，覆盖 1 个执行中任务和最多 5 个等待任务的最坏超时时间。
- 通过 systemd 配置内存上限、CPU 配额和重启策略。
- Nginx 需另行配置请求体限制和按 IP 限流。
- `FUSE_BEAD_GENERATOR_PATH` 应指向经过确认的固定 Git commit，不应在每次请求时下载代码。
