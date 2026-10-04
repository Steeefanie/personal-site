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
- 使用单工作进程，接口内还有全局生成锁。
- 通过 systemd 配置内存上限、CPU 配额和重启策略。
- Nginx 需另行配置请求体限制和按 IP 限流。
- `FUSE_BEAD_GENERATOR_PATH` 应指向经过确认的固定 Git commit，不应在每次请求时下载代码。
