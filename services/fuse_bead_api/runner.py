from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

from pillow_heif import register_heif_opener


register_heif_opener()


def load_generator(path: Path) -> ModuleType:
    spec = importlib.util.spec_from_file_location("fuse_bead_pattern_generator", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load the fuse-bead generator module")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--generator", type=Path, required=True)
    parser.add_argument("--input", required=True)
    parser.add_argument("--width", required=True)
    parser.add_argument("--height", required=True)
    parser.add_argument("--mode", choices=("cm", "cms", "cs", "bw"), required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    generator = load_generator(args.generator.resolve())
    result: dict[str, Any] = {"colour_count": 0}
    original_draw_chart = generator.draw_chart

    def capture_draw_chart(
        quantised: Any,
        counts: dict[str, int],
        palette: Any,
        palette_order: Any,
        grid_spec: Any,
        output_path: str,
        mode: str,
    ) -> None:
        result["colour_count"] = sum(1 for count in counts.values() if count > 0)
        original_draw_chart(
            quantised,
            counts,
            palette,
            palette_order,
            grid_spec,
            output_path,
            mode,
        )

    generator.draw_chart = capture_draw_chart
    output_path, _ = generator.generate_pixel_art(
        input_path=args.input,
        width_px=args.width,
        height_px=args.height,
        quant_mode=args.mode,
        pure=False,
        output_dir=args.output_dir,
    )
    result["output_path"] = str(Path(output_path).resolve())
    print(json.dumps(result, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
