"""
RTMW3D whole-body video viewer driven by rtmlib and Open3D.

Usage:
    python rtmw3d_video_viewer.py --video path/to/movie.mp4
"""

from __future__ import annotations

import argparse
import sys
import time
import cv2
import numpy as np
import open3d as o3d
from rtmlib import Wholebody3d

from rtmw_shared import MODELS_DIR, center_and_scale, download_if_url


def coco_body17_edges() -> np.ndarray:
    """Edges for the 17 COCO body joints (indices 0..16 in COCO-WholeBody)."""
    return np.array(
        [
            [5, 6],
            [5, 7],
            [7, 9],
            [6, 8],
            [8, 10],
            [5, 11],
            [6, 12],
            [11, 12],
            [11, 13],
            [13, 15],
            [12, 14],
            [14, 16],
            [0, 5],
            [0, 6],
            [0, 1],
            [0, 2],
            [1, 3],
            [2, 4],
        ],
        dtype=np.int32,
    )


def foot6_edges() -> np.ndarray:
    """Edges for the 6 foot keypoints (indices 17..22)."""
    return np.array(
        [
            [15, 17],
            [15, 18],
            [15, 19],
            [16, 20],
            [16, 21],
            [16, 22],
        ],
        dtype=np.int32,
    )


def hand21_edges(base: int) -> np.ndarray:
    """5 finger chains for a 21-keypoint hand, starting at index 'base'."""
    chains = [
        [0, 1, 2, 3, 4],  # thumb
        [0, 5, 6, 7, 8],  # index
        [0, 9, 10, 11, 12],  # middle
        [0, 13, 14, 15, 16],  # ring
        [0, 17, 18, 19, 20],  # pinky
    ]
    edges = []
    for chain in chains:
        for a, b in zip(chain[:-1], chain[1:]):
            edges.append([base + a, base + b])
    return np.array(edges, dtype=np.int32)


def face68_edges(base: int) -> np.ndarray:
    """Closed loops and chains for the classic 68-landmark face, starting at 'base'."""
    edges = []
    for i in range(0, 16):
        edges.append([base + i, base + i + 1])
    for i in range(17, 21):
        edges.append([base + i, base + i + 1])
    for i in range(22, 26):
        edges.append([base + i, base + i + 1])
    for i in range(27, 30):
        edges.append([base + i, base + i + 1])
    for i in range(31, 35):
        edges.append([base + i, base + i + 1])
    right_eye = [36, 37, 38, 39, 40, 41, 36]
    left_eye = [42, 43, 44, 45, 46, 47, 42]
    for a, b in zip(right_eye[:-1], right_eye[1:]):
        edges.append([base + a, base + b])
    for a, b in zip(left_eye[:-1], left_eye[1:]):
        edges.append([base + a, base + b])
    mouth_o = list(range(48, 60)) + [48]
    for a, b in zip(mouth_o[:-1], mouth_o[1:]):
        edges.append([base + a, base + b])
    mouth_i = list(range(60, 68)) + [60]
    for a, b in zip(mouth_i[:-1], mouth_i[1:]):
        edges.append([base + a, base + b])
    return np.array(edges, dtype=np.int32)


def build_edges_wholebody() -> tuple[np.ndarray, np.ndarray]:
    """
    Build a single edge list over all 133 keypoints.
    COCO-WholeBody index ranges:
      0..16 body, 17..22 foot, 23..90 face, 91..111 left hand, 112..132 right hand
    """
    body = coco_body17_edges()
    foot = foot6_edges()
    face = face68_edges(23)
    lhand = hand21_edges(91)
    rhand = hand21_edges(112)
    edges = np.vstack([body, foot, lhand, rhand, face])
    colors = np.vstack(
        [
            np.tile([0.10, 0.80, 0.95], (len(body), 1)),
            np.tile([0.40, 0.90, 0.30], (len(foot), 1)),
            np.tile([0.85, 0.30, 0.30], (len(lhand), 1)),
            np.tile([0.60, 0.30, 0.85], (len(rhand), 1)),
            np.tile([0.90, 0.60, 0.20], (len(face), 1)),
        ]
    )
    return edges.astype(np.int32), colors.astype(np.float64)


def make_lineset(points: np.ndarray, edges: np.ndarray, color=(0.2, 0.8, 0.9)) -> o3d.geometry.LineSet:
    """Create an Open3D LineSet for a skeleton."""
    ls = o3d.geometry.LineSet()
    ls.points = o3d.utility.Vector3dVector(points.astype(np.float64))
    ls.lines = o3d.utility.Vector2iVector(edges.astype(np.int32))
    colors = np.tile(np.array(color, dtype=np.float64), (edges.shape[0], 1))
    ls.colors = o3d.utility.Vector3dVector(colors)
    return ls


def _unpack_outputs(outputs: object) -> tuple[np.ndarray | None, np.ndarray | None]:
    """Robustly extract (kpts3d, scores) from Wholebody3d outputs."""
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
                        continue  # (x, y, score) masquerading as 3D
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
    z_gain: float,
) -> None:
    """Execute RTMW3D inference and stream 3D poses via Open3D."""
    model_path = download_if_url(model_path_or_url, MODELS_DIR)
    pose_input_size = (288, 384)  # (H, W) expected by RTMW3D-x

    estimator = Wholebody3d(
        backend=backend,
        device=device,
        pose=str(model_path),
        pose_input_size=pose_input_size,
    )

    print("[viewer] Space toggles pause/resume; close the window or press 'Q' to quit.")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Failed to open video: {video_path}", file=sys.stderr)
        sys.exit(1)

    edges_all, edge_colors = build_edges_wholebody()
    vis = o3d.visualization.VisualizerWithKeyCallback()
    vis.create_window("RTMW3D-x viewer (133 pts, wired face+hands)", width=960, height=720)
    render_opts = vis.get_render_option()
    render_opts.background_color = np.asarray([0.02, 0.02, 0.02])
    render_opts.line_width = 4.0
    render_opts.point_size = 6.0
    axes = o3d.geometry.TriangleMesh.create_coordinate_frame(size=0.4)
    vis.add_geometry(axes, reset_bounding_box=True)
    camera = vis.get_view_control()
    try:
        camera.set_front([0.0, 0.0, -1.0])
        camera.set_lookat([0.0, 0.0, 0.0])
        camera.set_up([0.0, 1.0, 0.0])
        camera.set_zoom(0.8)
    except AttributeError:
        pass
    geom_per_person: list[dict] = []

    is_paused = {"value": False}

    def _toggle_pause(_):
        is_paused["value"] = not is_paused["value"]
        return False

    vis.register_key_callback(ord(" "), _toggle_pause)

    frame_idx = 0
    try:
        while True:
            if is_paused["value"]:
                vis.poll_events()
                vis.update_renderer()
                time.sleep(0.01)
                continue

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

            if kpts3d is None or len(kpts3d) == 0:
                vis.poll_events()
                vis.update_renderer()
                frame_idx += 1
                continue

            if frame_idx % 60 == 0:
                z_vals = kpts3d[0][..., 2]
                print(
                    f"[sanity] frame {frame_idx} z range: "
                    f"{float(np.min(z_vals)):.5f} .. {float(np.max(z_vals)):.5f}"
                )

            if frame_idx % 30 == 0:
                print(f"[frame {frame_idx}] detections: {len(kpts3d)}")

            while len(geom_per_person) < len(kpts3d):
                lines = make_lineset(np.zeros((133, 3)), edges_all)
                lines.colors = o3d.utility.Vector3dVector(edge_colors)
                vis.add_geometry(lines, reset_bounding_box=len(geom_per_person) == 0)

                points = o3d.geometry.PointCloud()
                points.points = o3d.utility.Vector3dVector(np.zeros((133, 3)))
                vis.add_geometry(points)

                geom_per_person.append({"lines": lines, "points": points})

            for idx in range(len(kpts3d)):
                pose3d = kpts3d[idx]
                conf = None if scores is None else scores[idx]
                valid_mask = np.ones(133, dtype=bool) if conf is None else (conf > 0.05)

                if np.all(~valid_mask):
                    full_pts = np.zeros((133, 3), dtype=np.float32)
                else:
                    full_pts, _, _ = center_and_scale(pose3d, valid_mask=valid_mask, z_gain=z_gain)
                    full_pts[:, 1] *= -1.0

                pc = geom_per_person[idx]["points"]
                pc.points = o3d.utility.Vector3dVector(full_pts.astype(np.float64))
                colors = np.zeros((133, 3), dtype=np.float32)
                colors[0:17] = [0.10, 0.80, 0.95]
                colors[17:23] = [0.40, 0.90, 0.30]
                colors[23:91] = [0.90, 0.60, 0.20]
                colors[91:112] = [0.85, 0.30, 0.30]
                colors[112:133] = [0.60, 0.30, 0.85]
                pc.colors = o3d.utility.Vector3dVector(colors.astype(np.float64))
                vis.update_geometry(pc)

                ls = geom_per_person[idx]["lines"]
                ls.points = o3d.utility.Vector3dVector(full_pts.astype(np.float64))
                vis.update_geometry(ls)

            vis.poll_events()
            vis.update_renderer()
            frame_idx += 1
    finally:
        cap.release()
        vis.destroy_window()


def build_argparser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="RTMW3D-x video -> 3D viewer (133 keypoints wired across face + hands)"
    )
    parser.add_argument("--video", required=True, help="Path to an input video file")
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
        "--z-gain",
        type=float,
        default=0.0,
        help="Depth amplification; 0=auto per frame, >0 manual multiplier (try 150-300)",
    )
    parser.add_argument(
        "--max-edge",
        type=int,
        default=960,
        help="Resize video frames so the larger dimension is at most this many pixels (<=0 to disable)",
    )
    return parser


def main() -> None:
    parser = build_argparser()
    args = parser.parse_args()
    run(args.video, args.model, args.device, args.backend, args.step, args.max_edge, args.z_gain)


if __name__ == "__main__":
    main()
