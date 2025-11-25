"""
Shared helpers for RTMW scripts: download utilities and pose normalization.
"""

from __future__ import annotations

import os
import urllib.request
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parent
MODELS_DIR = REPO_ROOT / "models"
RTMLIB_CACHE = REPO_ROOT / ".rtmlib_cache"

# Ensure checkpoints stay within the repo (no ~/.cache writes).
os.environ["TORCH_HOME"] = str(RTMLIB_CACHE)
RTMLIB_CACHE.mkdir(parents=True, exist_ok=True)


def download_if_url(src: str, dst_dir: Path) -> Path:
    """Return a local path for src, downloading to dst_dir when src is a URL."""
    src = str(src)
    if src.startswith("http://") or src.startswith("https://"):
        dst_dir.mkdir(parents=True, exist_ok=True)
        target = dst_dir / Path(src).name
        if not target.exists():
            print(f"[download] {src} -> {target}")
            urllib.request.urlretrieve(src, target)
        return target
    return Path(src)


def center_and_scale(
    points3d: np.ndarray,
    valid_mask: np.ndarray | None = None,
    ref_pairs: tuple[tuple[int, int], ...] = ((11, 12), (5, 6)),
    z_gain: float = 0.0,
) -> tuple[np.ndarray, np.ndarray, float]:
    """Normalize a 3D skeleton for consistent viewing.

    The pose is centered using hip midpoint (fallback to shoulders or nose), X/Y
    are scaled so shoulder width is roughly 0.4 units, and Z is amplified using
    either automatic gain (z_gain <= 0) or a manual multiplier (z_gain > 0).
    """
    normalized = points3d.copy()
    if valid_mask is None:
        valid_mask = np.ones(points3d.shape[0], dtype=bool)

    def _midpoint(a: int, b: int):
        if valid_mask[a] and valid_mask[b]:
            return (normalized[a] + normalized[b]) * 0.5
        return None

    center = None
    for pair in ref_pairs:
        mid = _midpoint(*pair)
        if mid is not None:
            center = mid
            break
    if center is None:
        center = normalized[0]
    normalized = normalized - center

    xy_scale = None
    if valid_mask[5] and valid_mask[6]:
        xy_scale = np.linalg.norm(normalized[5, :2] - normalized[6, :2])
    if not xy_scale or xy_scale <= 1e-6:
        vis_xy = normalized[valid_mask, :2]
        if vis_xy.size:
            x_span = float(vis_xy[:, 0].max() - vis_xy[:, 0].min())
            y_span = float(vis_xy[:, 1].max() - vis_xy[:, 1].min())
            xy_scale = max(x_span, y_span)
    if not xy_scale or xy_scale <= 1e-6:
        xy_scale = 1.0

    target_shoulder = 0.4
    normalized[:, :2] /= (xy_scale / target_shoulder)

    vis_pts = normalized[valid_mask]
    if z_gain <= 0.0:
        if vis_pts.size:
            z_span = float(vis_pts[:, 2].max() - vis_pts[:, 2].min())
        else:
            z_span = 0.0
        if z_span > 1e-8:
            x_span = float(vis_pts[:, 0].max() - vis_pts[:, 0].min()) if vis_pts.size else target_shoulder
            y_span = float(vis_pts[:, 1].max() - vis_pts[:, 1].min()) if vis_pts.size else target_shoulder
            xy_span = max(x_span, y_span, target_shoulder)
            auto_gain = float(np.clip(xy_span / z_span, 50.0, 400.0))
        else:
            auto_gain = 200.0
        normalized[:, 2] *= auto_gain
    else:
        normalized[:, 2] *= z_gain

    return normalized, center, xy_scale
