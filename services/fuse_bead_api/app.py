from __future__ import annotations

import asyncio
import io
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image, ImageOps, UnidentifiedImageError
from pillow_heif import register_heif_opener


register_heif_opener()


MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MIN_FIXED_SIZE = 1
MAX_GRID_CELLS = 20_000
MAX_GRID_EDGE = 400
GENERATION_TIMEOUT_SECONDS = 30
ALLOWED_MODES = {"cm", "cms", "cs", "bw"}
ALLOWED_FORMATS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp", "HEIF": ".heif"}

DEFAULT_GENERATOR_PATH = (
    Path(__file__).resolve().parents[2]
    / "vendor"
    / "fuse-bead-pattern-generator"
    / "fuse_bead_pattern_generator.py"
)

app = FastAPI(title="Fuse-bead Pattern API", docs_url=None, redoc_url=None)
generation_lock = threading.Lock()


def generator_path() -> Path:
    configured = os.environ.get("FUSE_BEAD_GENERATOR_PATH")
    return Path(configured).expanduser().resolve() if configured else DEFAULT_GENERATOR_PATH


def python_executable() -> str:
    configured = os.environ.get("FUSE_BEAD_PYTHON")
    if configured:
        candidate = Path(configured).expanduser().resolve()
        if candidate.is_file():
            return str(candidate)
        raise HTTPException(status_code=503, detail="生成器 Python 解释器配置无效。")
    if sys.executable and Path(sys.executable).is_file():
        return sys.executable
    discovered = shutil.which("python3") or shutil.which("python")
    if discovered:
        return discovered
    raise HTTPException(status_code=503, detail="未找到可用的 Python 解释器。")


def inspect_image(data: bytes) -> tuple[str, int, int, bool]:
    try:
        with Image.open(io.BytesIO(data)) as image:
            if getattr(image, "is_animated", False) and getattr(image, "n_frames", 1) > 1:
                raise HTTPException(status_code=400, detail="不支持动画或多帧图片。")
            image_format = (image.format or "").upper()
            if image_format not in ALLOWED_FORMATS:
                raise HTTPException(status_code=400, detail="仅支持 JPEG、PNG、WebP 和 HEIF 图片。")
            orientation = image.getexif().get(274, 1)
            oriented_image = ImageOps.exif_transpose(image)
            source_width, source_height = oriented_image.size
            effective_width, effective_height = source_width, source_height
            if "A" in oriented_image.getbands():
                alpha = oriented_image.getchannel("A")
                visible_bounds = alpha.point(lambda value: 255 if value > 1 else 0).getbbox()
                if visible_bounds:
                    effective_width = visible_bounds[2] - visible_bounds[0]
                    effective_height = visible_bounds[3] - visible_bounds[1]
            return (
                ALLOWED_FORMATS[image_format],
                effective_width,
                effective_height,
                orientation not in (None, 1),
            )
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise HTTPException(status_code=400, detail="无法读取这张图片。") from exc


def resolve_grid(fixed_side: str, size: int, source_width: int, source_height: int) -> tuple[int, int]:
    if fixed_side == "width":
        width = size
        height = max(1, math.floor(source_height * size / source_width + 0.5))
    else:
        height = size
        width = max(1, math.floor(source_width * size / source_height + 0.5))

    if width > MAX_GRID_EDGE or height > MAX_GRID_EDGE:
        raise HTTPException(status_code=400, detail="图纸任一边不能超过 400 格。")
    if width * height > MAX_GRID_CELLS:
        raise HTTPException(status_code=400, detail="按当前比例计算后超出图纸尺寸限制，请减小格数。")
    return width, height


def run_generator(
    source_data: bytes,
    suffix: str,
    normalise_orientation: bool,
    fixed_side: str,
    size: int,
    mode: str,
    resolved_width: int,
    resolved_height: int,
) -> tuple[bytes, int]:
    script = generator_path()
    if not script.is_file():
        raise HTTPException(status_code=503, detail="生成器源码尚未配置。")
    if not generation_lock.acquire(blocking=False):
        raise HTTPException(status_code=429, detail="当前有图纸正在生成，请稍后重试。")

    try:
        with tempfile.TemporaryDirectory(prefix="fuse-bead-") as temp_dir_name:
            temp_dir = Path(temp_dir_name)
            input_path = temp_dir / f"source{suffix}"
            output_dir = temp_dir / "output"
            if normalise_orientation:
                input_path = temp_dir / "source.png"
                with Image.open(io.BytesIO(source_data)) as image:
                    ImageOps.exif_transpose(image).save(input_path, format="PNG")
            else:
                input_path.write_bytes(source_data)
            width_arg = str(size) if fixed_side == "width" else "auto"
            height_arg = str(size) if fixed_side == "height" else "auto"
            runner = Path(__file__).with_name("runner.py")
            command = [
                python_executable(),
                str(runner),
                "--generator",
                str(script),
                "--input",
                str(input_path),
                "--width",
                width_arg,
                "--height",
                height_arg,
                "--mode",
                mode,
                "--output-dir",
                str(output_dir),
            ]
            try:
                completed = subprocess.run(
                    command,
                    cwd=script.parent,
                    capture_output=True,
                    text=True,
                    timeout=GENERATION_TIMEOUT_SECONDS,
                    check=False,
                    shell=False,
                )
            except subprocess.TimeoutExpired as exc:
                raise HTTPException(status_code=504, detail="生成超时，请减小图纸尺寸。") from exc

            if completed.returncode != 0:
                raise HTTPException(status_code=500, detail="生成器执行失败。")
            try:
                metadata = json.loads(completed.stdout.strip().splitlines()[-1])
                colour_count = int(metadata["colour_count"])
                output_path = Path(metadata["output_path"])
            except (IndexError, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
                raise HTTPException(status_code=500, detail="无法读取生成结果统计。") from exc
            if not output_path.is_file():
                raise HTTPException(status_code=500, detail="未找到生成结果。")
            return output_path.read_bytes(), colour_count
    finally:
        generation_lock.release()


@app.get("/api/v1/fuse-bead/health")
def health() -> dict[str, str]:
    return {"status": "ok", "generator": "ready" if generator_path().is_file() else "missing"}


@app.post("/api/v1/fuse-bead/generate")
async def generate(
    image: UploadFile = File(...),
    fixed_side: str = Form(...),
    size: int = Form(...),
    mode: str = Form(...),
) -> Response:
    if fixed_side not in {"width", "height"}:
        raise HTTPException(status_code=400, detail="固定边参数无效。")
    if size < MIN_FIXED_SIZE:
        raise HTTPException(status_code=400, detail=f"图纸尺寸不能小于 {MIN_FIXED_SIZE} 格。")
    mode = mode.lower()
    if mode not in ALLOWED_MODES:
        raise HTTPException(status_code=400, detail="颜色模式仅支持 CM、CMS、CS 和 BW。")

    source_data = await image.read(MAX_UPLOAD_BYTES + 1)
    if len(source_data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="图片不能超过 20 MB。")
    if not source_data:
        raise HTTPException(status_code=400, detail="上传图片为空。")

    suffix, source_width, source_height, normalise_orientation = inspect_image(source_data)
    resolved_width, resolved_height = resolve_grid(
        fixed_side,
        size,
        source_width,
        source_height,
    )
    output_data, colour_count = await asyncio.to_thread(
        run_generator,
        source_data,
        suffix,
        normalise_orientation,
        fixed_side,
        size,
        mode,
        resolved_width,
        resolved_height,
    )
    headers = {
        "Cache-Control": "no-store",
        "Content-Disposition": f'attachment; filename="fuse-bead-{resolved_width}x{resolved_height}-{mode}.png"',
        "X-Pattern-Width": str(resolved_width),
        "X-Pattern-Height": str(resolved_height),
        "X-Grid-Cell-Count": str(resolved_width * resolved_height),
        "X-Colour-Count": str(colour_count),
    }
    return Response(content=output_data, media_type="image/png", headers=headers)
