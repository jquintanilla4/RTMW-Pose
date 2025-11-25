
import math
import cv2
import numpy as np
import matplotlib
import matplotlib.colors

class AAPoseMeta:
    def __init__(self, meta=None, kp2ds=None):
        self.image_id = ""
        self.height = 0
        self.width = 0

        self.kps_body: np.ndarray = None
        self.kps_lhand: np.ndarray = None
        self.kps_rhand: np.ndarray = None
        self.kps_face: np.ndarray = None
        self.kps_body_p: np.ndarray = None
        self.kps_lhand_p: np.ndarray = None
        self.kps_rhand_p: np.ndarray = None
        self.kps_face_p: np.ndarray = None

    @staticmethod
    def from_pixel_kps(kps_body, kps_lhand, kps_rhand, kps_face, width, height):
        """Create AAPoseMeta from pixel coordinates (N, 3) where 3 is (x, y, score)."""
        pose_meta = AAPoseMeta()
        pose_meta.width = width
        pose_meta.height = height
        
        pose_meta.kps_body = kps_body[:, :2]
        pose_meta.kps_body_p = kps_body[:, 2]
        
        pose_meta.kps_lhand = kps_lhand[:, :2]
        pose_meta.kps_lhand_p = kps_lhand[:, 2]
        
        pose_meta.kps_rhand = kps_rhand[:, :2]
        pose_meta.kps_rhand_p = kps_rhand[:, 2]
        
        pose_meta.kps_face = kps_face[:, :2]
        pose_meta.kps_face_p = kps_face[:, 2]
        
        return pose_meta

def split_pose2d_kps_to_aa(kp2ds: np.ndarray):
    """Convert the 133 keypoints from pose2d to body and hands keypoints.
    
    Args:
        kp2ds (np.ndarray): [133, 3] (x, y, score)
        
    Returns:
        tuple: (kp2ds_body, kp2ds_lhand, kp2ds_rhand, kp2ds_face)
    """
    # Body: 20 keypoints (averaging left/right for some)
    # Indices based on COCO-WholeBody
    kp2ds_body = (
        kp2ds[[0, 6, 6, 8, 10, 5, 7, 9, 12, 14, 16, 11, 13, 15, 2, 1, 4, 3, 17, 20]]
        + kp2ds[[0, 5, 6, 8, 10, 5, 7, 9, 12, 14, 16, 11, 13, 15, 2, 1, 4, 3, 18, 21]]
    ) / 2
    
    kp2ds_lhand = kp2ds[91:112]
    kp2ds_rhand = kp2ds[112:133]
    
    # Face: 68 points + 2 eyes (indices 1, 2 in COCO-WholeBody are eyes?)
    # Kijai's code: np.concatenate([kp2ds[23:23+68], kp2ds[1:3]], axis=0)
    # COCO-WholeBody: 23-90 are face (68 points). 1 is left eye, 2 is right eye.
    kp2ds_face = np.concatenate([kp2ds[23:91], kp2ds[1:3]], axis=0)
    
    return kp2ds_body.copy(), kp2ds_lhand.copy(), kp2ds_rhand.copy(), kp2ds_face.copy()

def draw_handpose_new(canvas, keypoints, stickwidth_type='v2', hand_score_th=0.6, hand_stick_width=4):
    eps = 0.01
    H, W, C = canvas.shape
    
    if hand_stick_width == -1:
        stickwidth = max(max(int(min(H, W) / 200) - 1, 1) // 2, 1)
    else:
        stickwidth = hand_stick_width

    edges = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [0, 9], [9, 10], [10, 11], [11, 12],
        [0, 13], [13, 14], [14, 15], [15, 16],
        [0, 17], [17, 18], [18, 19], [19, 20],
    ]

    for ie, (e1, e2) in enumerate(edges):
        k1 = keypoints[e1]
        k2 = keypoints[e2]
        if k1[2] < hand_score_th or k2[2] < hand_score_th:
            continue

        x1 = int(k1[0])
        y1 = int(k1[1])
        x2 = int(k2[0])
        y2 = int(k2[1])
        if x1 > eps and y1 > eps and x2 > eps and y2 > eps:
            cv2.line(
                canvas,
                (x1, y1),
                (x2, y2),
                matplotlib.colors.hsv_to_rgb([ie / float(len(edges)), 1.0, 1.0]) * 255,
                thickness=stickwidth,
            )

    for keypoint in keypoints:
        if keypoint[2] < hand_score_th:
            continue
        x, y = int(keypoint[0]), int(keypoint[1])
        if x > eps and y > eps:
            cv2.circle(canvas, (x, y), stickwidth, (0, 0, 255), thickness=-1)
    return canvas

def draw_aapose_new(
    img,
    kp2ds,
    threshold=0.6,
    kp2ds_lhand=None,
    kp2ds_rhand=None,
    draw_hand=False,
    stickwidth_type='v2',
    body_stick_width=-1,
    hand_stick_width=-1,
    draw_head=True
):
    kp2ds = kp2ds.copy()
    if not draw_head:
        kp2ds[[0,14,15,16,17], 2] = 0
    kp2ds_body = kp2ds

    limbSeq = [
        [2, 3], [2, 6], [3, 4], [4, 5], 
        [6, 7], [7, 8], [2, 9], [9, 10], 
        [10, 11], [2, 12], [12, 13], [13, 14], 
        [2, 1], [1, 15], [15, 17], [1, 16], 
        [16, 18], [14, 19], [11, 20]
    ]

    colors = [
        [255, 0, 0], [255, 85, 0], [255, 170, 0], [255, 255, 0],
        [170, 255, 0], [85, 255, 0], [0, 255, 0], [0, 255, 85],
        [0, 255, 170], [0, 255, 255], [0, 170, 255], [0, 85, 255],
        [0, 0, 255], [85, 0, 255], [170, 0, 255], [255, 0, 255],
        [255, 0, 170], [255, 0, 85], [200, 200, 0], [100, 100, 0],
    ]

    H, W, C = img.shape

    if body_stick_width == -1:
        stickwidth = max(int(min(H, W) / 200) - 1, 1)
    else:
        stickwidth = body_stick_width

    for _idx, ((k1_index, k2_index), color) in enumerate(zip(limbSeq, colors)):
        if k1_index > len(kp2ds_body) or k2_index > len(kp2ds_body): continue
        
        keypoint1 = kp2ds_body[k1_index - 1]
        keypoint2 = kp2ds_body[k2_index - 1]

        if keypoint1[-1] < threshold or keypoint2[-1] < threshold:
            continue

        Y = np.array([keypoint1[0], keypoint2[0]])
        X = np.array([keypoint1[1], keypoint2[1]])
        mX = np.mean(X)
        mY = np.mean(Y)
        length = ((X[0] - X[1]) ** 2 + (Y[0] - Y[1]) ** 2) ** 0.5
        angle = math.degrees(math.atan2(X[0] - X[1], Y[0] - Y[1]))
        polygon = cv2.ellipse2Poly((int(mY), int(mX)), (int(length / 2), stickwidth), int(angle), 0, 360, 1)
        cv2.fillConvexPoly(img, polygon, [int(float(c) * 0.6) for c in color])

    for _idx, (keypoint, color) in enumerate(zip(kp2ds_body, colors)):
        if keypoint[-1] < threshold:
            continue
        x, y = int(keypoint[0]), int(keypoint[1])
        cv2.circle(img, (x, y), stickwidth, color, thickness=-1)

    if draw_hand:
        if kp2ds_lhand is not None:
            img = draw_handpose_new(img, kp2ds_lhand, stickwidth_type=stickwidth_type, hand_score_th=threshold, hand_stick_width=hand_stick_width)
        if kp2ds_rhand is not None:
            img = draw_handpose_new(img, kp2ds_rhand, stickwidth_type=stickwidth_type, hand_score_th=threshold, hand_stick_width=hand_stick_width)

    return img

def draw_aapose_by_meta_new(img, meta: AAPoseMeta, threshold=0.5, stickwidth_type='v2', body_stick_width=-1, draw_hand=True, draw_head=True, hand_stick_width=4):
    kp2ds = np.concatenate([meta.kps_body, meta.kps_body_p[:, None]], axis=1)
    kp2ds_lhand = np.concatenate([meta.kps_lhand, meta.kps_lhand_p[:, None]], axis=1)
    kp2ds_rhand = np.concatenate([meta.kps_rhand, meta.kps_rhand_p[:, None]], axis=1)
    
    pose_img = draw_aapose_new(
        img, 
        kp2ds, 
        threshold, 
        kp2ds_lhand=kp2ds_lhand, 
        kp2ds_rhand=kp2ds_rhand, 
        body_stick_width=body_stick_width,
        stickwidth_type=stickwidth_type, 
        draw_hand=draw_hand, 
        draw_head=draw_head, 
        hand_stick_width=hand_stick_width
    )
    return pose_img
