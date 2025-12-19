# RTMW Pose Editor

This project helps you turn a video into a “stick‑figure” 3D pose animation (body + face + hands), then tweak the motion in a simple web editor.

If you’re an artist: think “rough mocap you can clean up”.

## What you can do
- Extract poses from a video into a `.json` file (optional; requires Python).
- Open that `.json` in the web editor, scrub the timeline, and adjust joints.
- Export:
  - an edited `.json` (to share or iterate)
  - a ZIP of PNG frames + a `render.sh` helper to make an `.mp4` with ffmpeg

## Fast path: run the web editor (no Python needed)
You only need this if you already have a pose `.json` file to open (made by you, a friend, or the exporter in this repo).

1) Install Node.js (version 18 or newer): https://nodejs.org/
2) In a Terminal, from the repo folder:
```bash
cd web/threejs_viewer
npm install
npm run dev
```
3) Open the local URL that prints in the terminal (usually `http://localhost:5173`).
4) Click `Open JSON` and pick your pose file.

## Share the editor with others (no installs)
If you want to share this with a community, you can build it once and host it like a normal website.

```bash
cd web/threejs_viewer
npm install
npm run build
```

Then upload everything inside `web/threejs_viewer/dist/` to any static host (GitHub Pages, Netlify, etc.).

## Make a pose JSON from a video (Python)
This step runs the RTMW3D‑x model on your video and writes a `.json` the editor can read.

1) Install Python 3.10+.
2) Install the Python packages:
```bash
python3 -m pip install rtmlib opencv-python numpy onnxruntime
```
3) Run the exporter:
```bash
python3 rtmw3d_export_json.py --video path/to/video.mp4 --output exports/poses.json
```

(On Windows, try `python` or `py` instead of `python3`.)

Notes:
- The first run downloads a model file into `models/` (so it needs internet).
- If your video is long, start with fewer frames:
  - `--step 2` processes every other frame (faster, smaller file)
  - `--max-frames 300` stops early

## Using the editor (the basics)
- **Load**: `Open JSON`
- **Play / pause**: Spacebar
- **Scrub**: drag the timeline slider
- **Move the camera** (when editing is off): left‑drag orbit, right‑drag pan, scroll zoom
- **Edit joints**:
  - click `Start Editing`
  - click a joint handle to select (Shift/Cmd‑click to multi‑select)
  - use `W` / `E` / `R` for move / rotate / scale
  - `Reset Frame` undoes changes for the current frame

## Export a video
1) Click `Export Video` (it downloads a `.zip`).
2) Unzip it, then run `render.sh` (requires ffmpeg):
```bash
bash render.sh
```
That produces `output.mp4`.

Important Note: Must have FFMPEG installed on local host to run .sh file and produce an output.mp4 file.

## Troubleshooting
- “**Blank / nothing shows up**”: the JSON may have zero detected people for those frames; try a clearer clip, higher resolution, or lower `--min-score`.
- “**It’s slow / browser crashes during export**”: export fewer frames (shorter clip, higher `--step`) or lower your playback FPS before exporting.
- “**Python can’t find a package**”: make sure you’re using the same `python3` you installed packages into (`python3 -m pip ...`).

## Advanced / reference
<details>
  <summary>JSON format (what the editor loads)</summary>

```json
{
  "meta": { "effective_fps": 15.0 },
  "frames": [
    {
      "frame_index": 0,
      "timestamp": 0.0,
      "people": [
        {
          "points": [[0, 0, 0], "... 133 entries total ..."],
          "valid": [true, false, "..."]
        }
      ]
    }
  ]
}
```

</details>

<details>
  <summary>Other scripts in this repo</summary>

- `rtmw3d_export_json.py`: exports a pose `.json` from a video.
- `rtmw_shared.py`: shared helpers (model download, pose normalization).
- `legacy/rtmw3d_video_viewer.py`: optional Open3D live viewer (more technical).

</details>
