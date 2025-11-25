"""
Export RTMW3D poses to a lightweight JSON sequence for the Three.js viewer.

Usage:
    python rtmw3d_export_json.py --video input.mp4 --output exports/poses.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from rtmlib import Wholebody3d

from rtmw_shared import MODELS_DIR, center_and_scale, download_if_url


def normalize_pose(
    points: np.ndarray,
    scores: np.ndarray | None,
    min_score: float,
    z_gain: float,
) -> tuple[np.ndarray, np.ndarray, np.ndarray | None, float | None]:
    """Center/scale the pose and boost depth according to z_gain (0=auto)."""
    if scores is None:
        valid = np.ones(points.shape[0], dtype=bool)
    else:
        valid = scores > min_score

    center = None
    scale = None

    if np.all(~valid):
        centered = np.zeros_like(points)
    else:
        centered, center, scale = center_and_scale(points, valid_mask=valid, z_gain=z_gain)
        centered[:, 1] *= -1.0  # Y-up for the viewer
    return centered, valid, center, scale


def format_person(
    points: np.ndarray,
    scores: np.ndarray | None,
    min_score: float,
    z_gain: float,
) -> dict[str, Any]:
    """Convert a person's 133x3 pose into a JSON-friendly dictionary."""
    normalized, valid, center, scale = normalize_pose(points, scores, min_score, z_gain)
    data = {
        "points": normalized.tolist(),
        "valid": valid.tolist(),
    }
    if center is not None:
        data["center"] = center.tolist()
    if scale is not None:
        data["scale"] = float(scale)
    if scores is not None:
        data["scores"] = scores.astype(float).tolist()
    return data


def _unpack_outputs(outputs: object) -> tuple[np.ndarray | None, np.ndarray | None]:
    """Return (kpts3d, scores) regardless of tuple/dict layout."""
    kpts3d: np.ndarray | None = None
    scores: np.ndarray | None = None

    if isinstance(outputs, dict):
        for key in ("kpts3d", "keypoints_3d", "keypoints3d", "xyz"):
            if key in outputs:
                kpts3d = outputs[key]
                break
        scores = outputs.get("scores")
        if kpts3d is None and "keypoints" in outputs:
            k2d = outputs["keypoints"]
            z = np.zeros((*k2d.shape[:2], 1), dtype=k2d.dtype)
            kpts3d = np.concatenate([k2d[..., :2], z], axis=-1)
        return kpts3d, scores

    if isinstance(outputs, (tuple, list)):
        arrs = [a for a in outputs if isinstance(a, np.ndarray)]

        for arr in arrs:
            if arr.ndim == 2 and arr.shape[1] in (133, 91, 68, 42, 21, 17, 6):
                scores = arr
                break

        candidates = [a for a in arrs if a.ndim == 3 and a.shape[-1] == 3 and a.shape[1] >= 17]
        chosen = None
        if candidates:
            for arr in candidates:
                if scores is not None and arr.shape[:2] == scores.shape:
                    if np.allclose(arr[..., 2], scores, atol=1e-4):
                        continue
                chosen = arr
                break
        if chosen is None:
            if len(outputs) >= 3 and isinstance(outputs[2], np.ndarray):
                arr = outputs[2]
                if arr.ndim == 3 and arr.shape[-1] == 3:
                    chosen = arr
            if chosen is None and candidates:
                chosen = candidates[0]
        kpts3d = chosen
        return kpts3d, scores

    return None, None


def run(
    video_path: str,
    model_path_or_url: str,
    device: str,
    backend: str,
    step: int,
    max_edge: int,
    min_score: float,
    max_frames: int,
    output_path: Path,
    z_gain: float,
) -> None:
    """Extract RTMW3D poses and dump them into a JSON time series."""
    model_path = download_if_url(model_path_or_url, MODELS_DIR)
    pose_input_size = (288, 384)

    estimator = Wholebody3d(
        backend=backend,
        device=device,
        pose=str(model_path),
        pose_input_size=pose_input_size,
    )

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Failed to open video: {video_path}", file=sys.stderr)
        sys.exit(1)

    raw_fps = cap.get(cv2.CAP_PROP_FPS)
    video_fps = raw_fps if raw_fps and raw_fps > 1e-4 else 30.0

    frames: list[dict[str, Any]] = []
    frame_idx = 0
    print("[export] Starting inference...")
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if step > 1 and frame_idx % step != 0:
                frame_idx += 1
                continue
            if max_edge and max_edge > 0:
                frame_h, frame_w = frame.shape[:2]
                current_max = max(frame_h, frame_w)
                if current_max > max_edge:
                    scale = max_edge / current_max
                    new_w = max(1, int(round(frame_w * scale)))
                    new_h = max(1, int(round(frame_h * scale)))
                    frame = cv2.resize(frame, (new_w, new_h))

            outputs = estimator(frame)
            kpts3d, scores = _unpack_outputs(outputs)

            frame_entry = {
                "frame_index": frame_idx,
                "timestamp": frame_idx / video_fps,
                "people": [],
            }

            if kpts3d is not None and len(kpts3d) > 0:
                for idx in range(len(kpts3d)):
                    pose = kpts3d[idx]
                    conf = None if scores is None else scores[idx]
                    frame_entry["people"].append(
                        format_person(pose, conf, min_score, z_gain)
                    )

            frames.append(frame_entry)

            if len(frames) % 20 == 0:
                print(f"[export] processed {len(frames)} frames")

            frame_idx += 1
            if max_frames > 0 and len(frames) >= max_frames:
                print(f"[export] stopping early at {len(frames)} frames (max_frames hit)")
                break
    finally:
        cap.release()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    metadata = {
        "video": str(video_path),
        "model": str(model_path),
        "video_fps": video_fps,
        "sample_stride": step,
        "effective_fps": video_fps / step if step > 0 else video_fps,
        "max_edge": max_edge,
        "width": frame.shape[1] if 'frame' in locals() else 0,
        "height": frame.shape[0] if 'frame' in locals() else 0,
        "min_score": min_score,
        "frame_count": len(frames),
        "z_gain": z_gain,
    }
    payload = {"meta": metadata, "frames": frames}
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    print(f"[export] wrote {len(frames)} frames to {output_path}")


def build_argparser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Export RTMW3D poses to JSON for the Three.js viewer")
    parser.add_argument("--video", required=True, help="Path to an input video file")
    parser.add_argument(
        "--output",
        default="exports/poses.json",
        help="Path to the JSON output file",
    )
    parser.add_argument(
        "--model",
        default=(
            "https://huggingface.co/Soykaf/RTMW3D-x/resolve/main/onnx/"
            "rtmw3d-x_8xb64_cocktail14-384x288-b0a0eab7_20240626.onnx"
        ),
        help="Local path or URL to RTMW3D-x .onnx",
    )
    parser.add_argument("--device", default="cpu", choices=["cpu", "cuda"], help="onnxruntime device")
    parser.add_argument("--backend", default="onnxruntime", choices=["onnxruntime"], help="Inference backend")
    parser.add_argument("--step", type=int, default=1, help="Process every Nth frame for speed")
    parser.add_argument(
        "--max-edge",
        type=int,
        default=960,
        help="Resize video frames so the larger dimension is at most this many pixels (<=0 to disable)",
    )
    parser.add_argument(
        "--min-score",
        type=float,
        default=0.05,
        help="Minimum joint confidence retained in the JSON (values below are marked invalid)",
    )
    parser.add_argument(
        "--max-frames",
        type=int,
        default=0,
        help="Stop after exporting this many frames (0 means export the full video)",
    )
    parser.add_argument(
        "--z-gain",
        type=float,
        default=0.0,
        help="Depth amplification; 0=auto per frame, >0 manual multiplier (try 150-300)",
    )
    return parser


def main() -> None:
    parser = build_argparser()
    args = parser.parse_args()
    output = Path(args.output)
    run(
        video_path=args.video,
        model_path_or_url=args.model,
        device=args.device,
        backend=args.backend,
        step=args.step,
        max_edge=args.max_edge,
        min_score=args.min_score,
        max_frames=args.max_frames,
        output_path=output,
        z_gain=args.z_gain,
    )


if __name__ == "__main__":
    main()
