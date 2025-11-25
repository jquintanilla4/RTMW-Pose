
import argparse
import json
import os
import sys
from pathlib import Path

import cv2
import numpy as np
from tqdm import tqdm

from wan_visualizer import AAPoseMeta, draw_aapose_by_meta_new, split_pose2d_kps_to_aa

def denormalize_pose(points, center, scale, target_shoulder=0.4):
    """
    Reverse the normalization applied in rtmw_shared.py:
    1. Y-flip (if it was flipped)
    2. Scale back
    3. Add center back
    """
    # points: [N, 3] (x, y, z)
    denorm = points.copy()
    
    # 1. Y-flip (The viewer expects Y-up, so export flipped Y. We flip back to Y-down for image)
    denorm[:, 1] *= -1.0
    
    # 2. Scale back
    # normalized[:, :2] /= (xy_scale / target_shoulder)
    # So: denorm = normalized * (xy_scale / target_shoulder)
    if scale is not None and scale > 1e-6:
        denorm[:, :2] *= (scale / target_shoulder)
        
    # 3. Add center back
    if center is not None:
        denorm += center
        
    return denorm

def render_frames(json_path, output_dir, width_override=None, height_override=None):
    with open(json_path, 'r') as f:
        data = json.load(f)
        
    meta = data.get('meta', {})
    frames = data.get('frames', [])
    
    # Determine output resolution
    width = meta.get('width', 0)
    height = meta.get('height', 0)
    
    if width_override:
        width = width_override
    if height_override:
        height = height_override
        
    if width == 0 or height == 0:
        print("Warning: Frame dimensions not found in metadata. Defaulting to 1024x1024.")
        width = 1024
        height = 1024
        
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"Rendering {len(frames)} frames to {output_dir} ({width}x{height})...")
    
    for i, frame in enumerate(tqdm(frames)):
        # Create black canvas
        canvas = np.zeros((height, width, 3), dtype=np.uint8)
        
        people = frame.get('people', [])
        
        # We can handle multiple people, but usually Wan-Animate expects one main subject?
        # We'll draw all of them.
        
        for person in people:
            points = np.array(person['points'])
            scores = np.array(person.get('scores', []))
            
            # If scores are missing, assume 1.0 (valid)
            if len(scores) == 0:
                scores = np.ones(len(points))
                
            # Combine points and scores for denormalization/processing
            # points is [N, 3], scores is [N]
            # We need [N, 3] for denormalization (x, y, z)
            
            center = person.get('center')
            scale = person.get('scale')
            
            if center:
                center = np.array(center)
            
            # Denormalize
            # Note: The 'points' in JSON are [x, y, z].
            # The z coordinate is also scaled, but we only care about x, y for drawing.
            # However, denormalize_pose handles 3D.
            
            denorm_pts = denormalize_pose(points, center, scale)
            
            # Prepare for AAPoseMeta
            # We need [N, 3] where 3 is (x, y, score)
            kps_with_score = np.zeros((len(denorm_pts), 3))
            kps_with_score[:, :2] = denorm_pts[:, :2]
            kps_with_score[:, 2] = scores
            
            # Split into body parts
            kp2ds_body, kp2ds_lhand, kp2ds_rhand, kp2ds_face = split_pose2d_kps_to_aa(kps_with_score)
            
            # Create Meta
            pose_meta = AAPoseMeta.from_pixel_kps(
                kp2ds_body, kp2ds_lhand, kp2ds_rhand, kp2ds_face, width, height
            )
            
            # Draw
            canvas = draw_aapose_by_meta_new(
                canvas, 
                pose_meta, 
                threshold=0.3, # Adjust threshold as needed
                draw_hand=True,
                draw_head=True
            )
            
        # Save frame
        frame_idx = frame.get('frame_index', i)
        out_path = output_dir / f"frame_{frame_idx:05d}.png"
        cv2.imwrite(str(out_path), canvas)
        
    print("Done.")

def main():
    parser = argparse.ArgumentParser(description="Render exported RTMW3D JSON to Wan-Animate image sequence")
    parser.add_argument("--json", required=True, help="Path to the exported JSON file")
    parser.add_argument("--output", required=True, help="Directory to save output images")
    parser.add_argument("--width", type=int, help="Override output width")
    parser.add_argument("--height", type=int, help="Override output height")
    
    args = parser.parse_args()
    
    render_frames(args.json, args.output, args.width, args.height)

if __name__ == "__main__":
    main()
