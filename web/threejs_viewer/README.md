# RTMW Pose Editor (React + Three.js)

Interactive viewer and lightweight editor for RTMW3D whole-body pose sequences. Load the JSON exported by `rtmw3d_export_json.py`, scrub and preview in 3D, tweak joints with transform gizmos, and export frames for ffmpeg.

## Quick start
- Prereqs: Node 18+ (for Vite), npm, Python 3.10+ with `rtmlib`, `opencv-python`, `numpy`, `open3d` (for the Open3D viewer), and `onnxruntime`; `ffmpeg` is needed only when turning exported PNGs into a video.
- Generate a pose JSON from a video:
  ```bash
  python3 rtmw3d_export_json.py \
    --video path/to/video.mp4 \
    --output exports/poses.json \
    --step 2 --max-edge 960 --z-gain 200
  ```
  The script downloads the RTMW3D-x ONNX checkpoint into `models/` on first run. Tune `--min-score`, `--max-frames`, or `--z-gain` to control confidence filtering, early stopping, and depth amplification.
- Run the web editor:
  ```bash
  cd web/threejs_viewer
  npm install
  npm run dev   # open the printed localhost URL
  ```
  For a production build, use `npm run build && npm run preview`.

## Using the editor
- Load data: click `Open JSON` and select the export from `rtmw3d_export_json.py`. The status line shows frame count and source info.
- Navigation: orbit with left-drag, pan with right-drag, and zoom with scroll when editing is disabled. Editing mode hides orbit controls so selection stays precise.
- Playback & timeline: play/pause, step prev/next frame, or scrub the slider. Yellow ticks mark frames where joints were edited; the counter shows the current frame and total.
- Scene settings: `Playback Speed` scales the effective FPS; `Depth Gain` rescales Z so the pose reads cleanly.
- Editing mode: click `Start Editing` to reveal per-joint handles. Click a handle to select, Shift/Cmd-click to multi-select, and use the toolbar (or `W`/`E`/`R`) to translate/rotate/scale the selection. Playback pauses while editing.
- Resetting: `Clear Select` deselects all joints. `Reset Frame` restores the current frame to the original export and clears its keyframe marker.
- Export video: `Export Video` captures every frame at the current depth/speed into a ZIP containing `frames/*.png` and `render.sh`. Unzip and run `bash render.sh` (requires ffmpeg) to produce `output.mp4`. Large exports will take time and memory in the browser.

## JSON format (viewer input)
```json
{
  "meta": {
    "video": "path/to/video.mp4",
    "effective_fps": 15.0,
    "video_fps": 30.0,
    "sample_stride": 2,
    "z_gain": 200.0
  },
  "frames": [
    {
      "frame_index": 0,
      "timestamp": 0.0,
      "people": [
        {
          "points": [[x, y, z], "... 133 entries ..."],
          "valid": [true, false, "..."],
          "scores": [0.93, 0.85, "..."]
        }
      ]
    }
  ]
}
```
The viewer assumes 133 joints in COCO-WholeBody order. Depth values are already amplified by the exporter; `effective_fps` drives playback speed.

## Python helpers in this repo
- `rtmw3d_export_json.py`: runs RTMW3D-x inference over a video and emits the JSON consumed by the web editor. Keeps model downloads inside `models/` and caches under `.rtmlib_cache`.
- `rtmw3d_video_viewer.py`: Open3D visualization of live inference (space toggles pause; close/Q to quit). Useful for quick sanity checks without exporting.
- `rtmw_shared.py`: shared download + pose normalization utilities (centering, XY scaling, optional Z gain).
- Sample exports live in `exports/poses*.json` if you need a quick file to load into the editor.

## Notes
- Editing handles are hidden when editing is off; toggle editing off to orbit the camera easily.
- Timeline keyframe markers reflect frames where at least one joint differs from the original export.
- The video exporter uses JSZip entirely in-browser; prefer shorter clips or lower FPS if your browser runs out of memory.
