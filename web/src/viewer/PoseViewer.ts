import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { renderKijaiPoseFrame } from '../utils/KijaiPoseRenderer';
import type { AspectRatioOption } from '../components/AspectRatioOverlay';

const COLORS = {
  body: [0.1, 0.8, 0.95],
  feet: [0.4, 0.9, 0.3],
  face: [0.9, 0.6, 0.2],
  leftHand: [0.85, 0.3, 0.3],
  rightHand: [0.6, 0.3, 0.85],
} as const;

const JOINT_COUNT = 133;
const JOINT_COLOR_RANGES = [
  { end: 17, color: COLORS.body },
  { end: 23, color: COLORS.feet },
  { end: 91, color: COLORS.face },
  { end: 112, color: COLORS.leftHand },
  { end: JOINT_COUNT, color: COLORS.rightHand },
];
const JOINT_HANDLE_GEOMETRY = new THREE.SphereGeometry(0.01, 12, 12);
const SELECTED_HANDLE_COLOR = new THREE.Color(1, 1, 1);
const HANDLE_DEFAULT_SCALE = 1;
const HANDLE_SELECTED_SCALE = 1.5;
const CAMERA_RIG_LAYER = 1;
const RIG_HANDLE_COLOR = new THREE.Color(0.95, 0.35, 0.2);
const RIG_HANDLE_GEOMETRY = new THREE.RingGeometry(0.11, 0.16, 32);
RIG_HANDLE_GEOMETRY.rotateX(-Math.PI / 2);

const EDGE_PAIRS: Array<[number, number]> = [];
const EDGE_COLOR_PER_EDGE: Array<[number, number, number]> = [];

export type ViewMode = 'viewport' | 'camera';
export type CameraLensPreset = '18mm' | '24mm' | '35mm' | '50mm' | '85mm' | 'custom';

const CAMERA_LENS_FOV: Record<CameraLensPreset, number> = {
  '18mm': 90,
  '24mm': 73,
  '35mm': 54,
  '50mm': 40,
  '85mm': 24,
  custom: 45,
};

export type TransformMode = 'translate' | 'rotate' | 'scale';
export type ViewPreset = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

export type PosePoint = [number, number, number];

type JointEdit = {
  personIndex: number;
  jointIndex: number;
  base: THREE.Vector3;
  edited: THREE.Vector3;
};

export interface PosePerson {
  points: PosePoint[];
  valid?: Array<boolean | number>;
  [key: string]: unknown;
}

export interface PoseFrame {
  people: PosePerson[];
  frame_index?: number;
  timestamp?: number;
  [key: string]: unknown;
}

export interface PosePayload {
  frames?: PoseFrame[];
  meta?: {
    effective_fps?: number;
    video_fps?: number;
    video?: string;
  };
}

export interface PoseViewerCallbacks {
  onStatusChange?: (text: string) => void;
  onFrameUpdate?: (info: { index: number; total: number; personCount: number }) => void;
  onPlaybackStateChange?: (playing: boolean) => void;
  onSelectionInfoChange?: (info: { text: string; hasSelection: boolean }) => void;
  onKeyframeStateChange?: (info: { framesWithKeyframes: number[]; hasKeyframeAtCurrent: boolean }) => void;
  onCameraKeyframeStateChange?: (info: { framesWithKeyframes: number[]; hasKeyframeAtCurrent: boolean }) => void;
  onCameraSettingsChange?: (info: {
    fov: number;
    lens: CameraLensPreset;
    locked: boolean;
    viewMode: ViewMode;
    videoScale?: number;
    hasCameraVideo?: boolean;
    cameraVideoLabel?: string;
    syncVideoToTimeline?: boolean;
    cameraAspectRatio?: number;
    cameraVideoAspect?: number;
  }) => void;
  onTransformTargetChange?: (info: { target: 'camera' | 'joints' | 'none' }) => void;
}

export interface PoseViewerOptions {
  container: HTMLDivElement;
  callbacks?: PoseViewerCallbacks;
}

type JointHandle = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> & {
  userData: {
    baseColor: THREE.Color;
    jointIndex: number;
    personIndex: number;
    isSelected: boolean;
    isRig?: boolean;
  };
};

interface PersonObject {
  group: THREE.Group;
  lines: THREE.LineSegments;
  lineGeom: THREE.BufferGeometry;
  linePositions: Float32Array;
  points: THREE.Points;
  pointGeom: THREE.BufferGeometry;
  pointPositions: Float32Array;
  jointHandles: JointHandle[];
  rigHandle: JointHandle;
  rigHandleHasPosition: boolean;
  personIndex: number;
}

interface TransformSessionEntry {
  handle: JointHandle;
  personIndex: number;
  jointIndex: number;
  startPosition: THREE.Vector3;
  skipKeyframe?: boolean;
}

interface TransformSession {
  startMatrix: THREE.Matrix4;
  inverseStartMatrix: THREE.Matrix4;
  handles: TransformSessionEntry[];
}

interface CameraSnapshot {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  fov: number;
  lens: CameraLensPreset;
}

interface RigTransform {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}

function addEdges(edgeList: Array<[number, number]>, colorKey: keyof typeof COLORS) {
  const color = COLORS[colorKey];
  edgeList.forEach((edge) => {
    EDGE_PAIRS.push(edge);
    EDGE_COLOR_PER_EDGE.push([color[0], color[1], color[2]]);
  });
}

function buildBodyEdges(): Array<[number, number]> {
  return [
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
  ];
}

function buildFootEdges(): Array<[number, number]> {
  return [
    [15, 17],
    [15, 18],
    [15, 19],
    [16, 20],
    [16, 21],
    [16, 22],
  ];
}

function buildHandEdges(base: number): Array<[number, number]> {
  const chains = [
    [0, 1, 2, 3, 4],
    [0, 5, 6, 7, 8],
    [0, 9, 10, 11, 12],
    [0, 13, 14, 15, 16],
    [0, 17, 18, 19, 20],
  ];
  const edges: Array<[number, number]> = [];
  chains.forEach((chain) => {
    for (let i = 0; i < chain.length - 1; i++) {
      edges.push([base + chain[i], base + chain[i + 1]]);
    }
  });
  return edges;
}

function buildFaceEdges(base: number): Array<[number, number]> {
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < 16; i++) edges.push([base + i, base + i + 1]);
  for (let i = 17; i < 21; i++) edges.push([base + i, base + i + 1]);
  for (let i = 22; i < 26; i++) edges.push([base + i, base + i + 1]);
  for (let i = 27; i < 30; i++) edges.push([base + i, base + i + 1]);
  for (let i = 31; i < 35; i++) edges.push([base + i, base + i + 1]);
  const rightEye = [36, 37, 38, 39, 40, 41, 36];
  const leftEye = [42, 43, 44, 45, 46, 47, 42];
  for (let i = 0; i < rightEye.length - 1; i++) {
    edges.push([base + rightEye[i], base + rightEye[i + 1]]);
  }
  for (let i = 0; i < leftEye.length - 1; i++) {
    edges.push([base + leftEye[i], base + leftEye[i + 1]]);
  }
  const mouthOuter = [...Array(12).keys()].map((i) => 48 + i);
  mouthOuter.push(48);
  for (let i = 0; i < mouthOuter.length - 1; i++) {
    edges.push([base + mouthOuter[i], base + mouthOuter[i + 1]]);
  }
  const mouthInner = [...Array(8).keys()].map((i) => 60 + i);
  mouthInner.push(60);
  for (let i = 0; i < mouthInner.length - 1; i++) {
    edges.push([base + mouthInner[i], base + mouthInner[i + 1]]);
  }
  return edges;
}

addEdges(buildBodyEdges(), 'body');
addEdges(buildFootEdges(), 'feet');
addEdges(buildHandEdges(91), 'leftHand');
addEdges(buildHandEdges(112), 'rightHand');
addEdges(buildFaceEdges(23), 'face');

function buildEdgeColorArray() {
  const arr = new Float32Array(EDGE_COLOR_PER_EDGE.length * 2 * 3);
  EDGE_COLOR_PER_EDGE.forEach((color, idx) => {
    const offset = idx * 6;
    arr[offset + 0] = color[0];
    arr[offset + 1] = color[1];
    arr[offset + 2] = color[2];
    arr[offset + 3] = color[0];
    arr[offset + 4] = color[1];
    arr[offset + 5] = color[2];
  });
  return arr;
}







function buildPointColorArray() {
  const arr = new Float32Array(JOINT_COUNT * 3);
  const ranges = [
    { start: 0, end: 17, color: COLORS.body },
    { start: 17, end: 23, color: COLORS.feet },
    { start: 23, end: 91, color: COLORS.face },
    { start: 91, end: 112, color: COLORS.leftHand },
    { start: 112, end: JOINT_COUNT, color: COLORS.rightHand },
  ];
  ranges.forEach(({ start, end, color }) => {
    for (let i = start; i < end; i++) {
      const offset = i * 3;
      arr[offset + 0] = color[0];
      arr[offset + 1] = color[1];
      arr[offset + 2] = color[2];
    }
  });
  return arr;
}

function buildJointEdgeLookup() {
  const lookup: Array<Array<{ edgeIndex: number; offset: number }>> = Array.from({ length: JOINT_COUNT }, () => []);
  EDGE_PAIRS.forEach(([a, b], idx) => {
    lookup[a].push({ edgeIndex: idx, offset: 0 });
    lookup[b].push({ edgeIndex: idx, offset: 3 });
  });
  return lookup;
}

const JOINT_EDGE_LOOKUP = buildJointEdgeLookup();

const POSITION_EPSILON = 1e-5;
const POSITION_EPSILON_SQ = POSITION_EPSILON * POSITION_EPSILON;

function clonePosePoint(point: PosePoint | undefined): PosePoint {
  if (!point) return [0, 0, 0];
  return [point[0], point[1], point[2]];
}

function clonePosePerson(person: PosePerson | undefined): PosePerson {
  const points = (person?.points ?? []).map((point) => clonePosePoint(point));
  const validSource = person?.valid;
  const valid = Array.isArray(validSource) ? [...validSource] : undefined;
  return { ...(person ?? {}), points, valid } as PosePerson;
}

function clonePoseFrame(frame: PoseFrame | undefined): PoseFrame {
  const people = (frame?.people ?? []).map((person) => clonePosePerson(person));
  return { ...(frame ?? { people: [] }), people } as PoseFrame;
}

function clonePoseFrames(frames: PoseFrame[]): PoseFrame[] {
  return frames.map((frame) => clonePoseFrame(frame));
}

function makeJointKey(personIndex: number, jointIndex: number) {
  return `${personIndex}:${jointIndex}`;
}

function identityRigTransform(): RigTransform {
  return {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    scale: new THREE.Vector3(1, 1, 1),
  };
}

function cloneRigTransform(transform: RigTransform): RigTransform {
  return {
    position: transform.position.clone(),
    quaternion: transform.quaternion.clone(),
    scale: transform.scale.clone(),
  };
}

function rigTransformToMatrix(transform: RigTransform): THREE.Matrix4 {
  return new THREE.Matrix4().compose(transform.position.clone(), transform.quaternion.clone(), transform.scale.clone());
}

function matrixToRigTransform(matrix: THREE.Matrix4): RigTransform {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matrix.decompose(position, quaternion, scale);
  quaternion.normalize();
  return { position, quaternion, scale };
}

function interpolateRigTransforms(a: RigTransform, b: RigTransform, t: number): RigTransform {
  const clamped = Math.min(1, Math.max(0, t));
  const position = a.position.clone().lerp(b.position, clamped);
  const quaternion = a.quaternion.clone().slerp(b.quaternion, clamped);
  const scale = a.scale.clone().lerp(b.scale, clamped);
  return { position, quaternion, scale };
}

function isIdentityMatrix(matrix: THREE.Matrix4) {
  return matrix.elements.every((val, idx) => {
    const target = idx % 5 === 0 ? 1 : 0;
    return Math.abs(val - target) < 1e-9;
  });
}

function getJointBaseColor(index: number) {
  for (const range of JOINT_COLOR_RANGES) {
    if (index < range.end) return range.color;
  }
  return COLORS.body;
}

export class PoseViewer {
  private container: HTMLDivElement;
  private callbacks: PoseViewerCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private viewportCamera: THREE.PerspectiveCamera;
  private shotCamera: THREE.PerspectiveCamera;
  private viewMode: ViewMode = 'viewport';
  private currentAspectRatioGuide: AspectRatioOption = '16:9';
  private cameraAspectOverride: number | null = null;
  private cameraAspectFromVideo: number | null = null;
  private cameraViewport = { x: 0, y: 0, width: 1, height: 1, aspect: 1 };
  private canvasWidth = 1;
  private canvasHeight = 1;
  private orbitTarget = new THREE.Vector3(0, 0.1, 0);
  private orbitState = { theta: Math.PI, phi: 1.0, radius: 2.6 };
  private cameraOrbitState = { theta: Math.PI, phi: 1.0, radius: 2.6 };
  private cameraLocked = false;
  private cameraLens: CameraLensPreset = 'custom';
  private shotRig: THREE.Group;
  private cameraVideoElement: HTMLVideoElement | null = null;
  private cameraVideoTexture: THREE.VideoTexture | null = null;
  private cameraVideoMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;
  private cameraVideoPlaneDistance = 1.5;
  private cameraVideoScale = 1;
  private cameraVideoAspect = 16 / 9;
  private cameraVideoLabel = '';
  private cameraVideoUrl: string | null = null;
  private cameraVideoDuration = 0;
  private cameraVideoSyncToTimeline = true;
  private cameraKeyframes = new Map<number, CameraSnapshot>();
  private currentCameraState: CameraSnapshot | null = null;
  private ambient: THREE.AmbientLight;
  private dir: THREE.DirectionalLight;
  private grid: THREE.GridHelper;
  private axes: THREE.AxesHelper;
  private resizeObserver: ResizeObserver;
  private peopleObjects: PersonObject[] = [];
  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();
  private tempMatrixA = new THREE.Matrix4();
  private tempVector3 = new THREE.Vector3();
  private tempVectorA = new THREE.Vector3();
  private tempVectorB = new THREE.Vector3();
  private editingState = {
    enabled: false,
    selectedHandles: [] as JointHandle[],
    transformSession: null as TransformSession | null,
    transformDragging: false,
    selectionProxy: new THREE.Object3D(),
  };
  private transformControls: TransformControls;
  private transformTarget: 'camera' | 'joints' | null = null;
  private currentTransformMode: TransformMode = 'translate';
  private controlsDragging = false;
  private selectionPointerState = {
    pointerId: null as number | null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    moved: false,
    marqueeActive: false,
    suppressClick: false,
  };
  private cameraPointerState = {
    pointerId: null as number | null,
    startX: 0,
    startY: 0,
    moved: false,
  };
  private lastVideoSyncFrame = -1;
  private marqueeElement: HTMLDivElement;
  private frames: PoseFrame[] = [];
  private baseFrames: PoseFrame[] = [];
  private rigBaseFrames: PoseFrame[] = [];
  private rigKeyframes = new Map<number, Map<number, RigTransform>>();
  private frameKeyframes = new Map<number, Set<string>>();
  private effectiveFps = 30;
  private isPlaying = false;
  private playbackDirection: 'forward' | 'reverse' = 'forward';
  private playbackCursor = 0;
  private lastFrameTime = performance.now();
  private displayedFrame = -1;
  private animationHandle = 0;
  private depthGain = 1;
  private speedMultiplier = 1;
  private meta: any = {};
  private viewTransition: {
    active: boolean;
    startTime: number;
    duration: number;
    startTheta: number;
    startPhi: number;
    startRadius: number;
    endTheta: number;
    endPhi: number;
    endRadius: number;
  } | null = null;

  constructor(options: PoseViewerOptions) {
    this.container = options.container;
    this.callbacks = options.callbacks ?? {};
    // Raycaster must see both default layer and the camera rig layer for selection.
    this.raycaster.layers.enable(CAMERA_RIG_LAYER);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);

    this.marqueeElement = document.createElement('div');
    this.marqueeElement.className = 'marquee-box';
    this.marqueeElement.style.display = 'none';
    this.container.appendChild(this.marqueeElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0.03, 0.03, 0.03);

    this.viewportCamera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    this.shotCamera = new THREE.PerspectiveCamera(CAMERA_LENS_FOV[this.cameraLens], 1, 0.01, 100);
    this.updateOrbitCamera(this.orbitState, this.viewportCamera);
    this.updateOrbitCamera(this.cameraOrbitState, this.shotCamera);
    this.scene.add(this.viewportCamera);
    this.scene.add(this.shotCamera);
    this.currentCameraState = this.captureCameraSnapshot(this.shotCamera);

    this.shotRig = this.createCameraRig();
    this.scene.add(this.shotRig);
    this.updateShotRigVisibility();


    this.ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambient);
    this.dir = new THREE.DirectionalLight(0xffffff, 0.6);
    this.dir.position.set(2, 4, 2);
    this.scene.add(this.dir);
    this.grid = new THREE.GridHelper(6, 12, 0x222222, 0x333333);
    this.grid.position.y = -0.8;
    this.scene.add(this.grid);
    this.axes = new THREE.AxesHelper(0.4);
    this.scene.add(this.axes);
    this.axes = new THREE.AxesHelper(0.4);
    this.scene.add(this.axes);

    this.editingState.selectionProxy.visible = false;
    this.scene.add(this.editingState.selectionProxy);
    // DEBUG: Add a visible box to selectionProxy
    const debugBox = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    this.editingState.selectionProxy.add(debugBox);

    this.transformControls = new TransformControls(this.getActiveCamera(), this.renderer.domElement);
    this.transformControls.visible = false;
    this.transformControls.setSize(1.0);
    this.scene.add(this.transformControls.getHelper());
    this.enforceTransformModeForTarget(this.currentTransformMode);

    this.transformControls.addEventListener('dragging-changed', (event) => {
      const value = (event as { value?: unknown }).value;
      const active = Boolean(value);
      this.editingState.transformDragging = active;
      this.controlsDragging = active;
    });
    this.transformControls.addEventListener('mouseDown', () => {
      if (this.transformTarget === 'camera') {
        this.applyCameraRigTransform();
      } else if (this.editingState.enabled && this.editingState.selectedHandles.length) {
        this.beginTransformSession();
      }
    });
    this.transformControls.addEventListener('objectChange', () => {
      if (this.transformTarget === 'camera') {
        this.applyCameraRigTransform();
      } else if (this.editingState.transformSession) {
        this.applyTransformSession();
      }
    });
    this.transformControls.addEventListener('mouseUp', () => {
      if (this.transformTarget === 'camera') {
        this.applyCameraRigTransform();
      } else if (this.editingState.transformSession) {
        const session = this.editingState.transformSession;
        this.editingState.transformSession = null;
        this.finalizeTransformSession(session);
        this.refreshSelectionProxyFromHandles();
      }
    });

    this.resizeRenderer();
    this.resizeObserver = new ResizeObserver(() => this.resizeRenderer());
    this.resizeObserver.observe(this.container);
    window.addEventListener('resize', this.handleWindowResize);

    this.setupOrbitInput();
    this.setupSelectionInput();

    this.updateCameraRigFromShotCamera();
    this.emitCameraSettings();
    this.emitCameraKeyframeState();

    this.animate();
  }

  dispose() {
    cancelAnimationFrame(this.animationHandle);

    this.resizeObserver.disconnect();
    window.removeEventListener('resize', this.handleWindowResize);
    window.removeEventListener('resize', this.handleWindowResize);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.handleCameraPointerDown);
    canvas.removeEventListener('pointermove', this.handleCameraPointerMove);
    canvas.removeEventListener('pointerup', this.handleCameraPointerUp);
    canvas.removeEventListener('pointerleave', this.handleCameraPointerCancel);
    canvas.removeEventListener('pointercancel', this.handleCameraPointerCancel);
    canvas.removeEventListener('pointerdown', this.handleSelectionPointerDown);
    canvas.removeEventListener('pointermove', this.handleSelectionPointerMove);
    canvas.removeEventListener('pointerup', this.handleSelectionPointerUp);
    canvas.removeEventListener('pointerleave', this.handleSelectionPointerCancel);
    canvas.removeEventListener('pointercancel', this.handleSelectionPointerCancel);
    this.transformControls.dispose();
    this.disposeCameraVideo();
    this.renderer.dispose();
    this.container.removeChild(canvas);
    if (this.marqueeElement.parentElement === this.container) {
      this.container.removeChild(this.marqueeElement);
    }
  }

  private handleWindowResize = () => {
    this.resizeRenderer();
  };

  private resizeRenderer() {
    const width = this.container.clientWidth || this.container.offsetWidth || 640;
    const rectHeight = this.container.getBoundingClientRect?.().height || 0;
    const fallbackHeight = (window.innerHeight || 720) - 70;
    const height = Math.max(200, this.container.clientHeight || this.container.offsetHeight || rectHeight || fallbackHeight);
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.renderer.setSize(width, height);
    this.viewportCamera.aspect = width / height;
    this.viewportCamera.updateProjectionMatrix();
    this.cameraViewport = this.computeCameraViewport(width, height);
    this.shotCamera.aspect = this.cameraViewport.aspect;
    this.shotCamera.updateProjectionMatrix();
    this.updateCameraVideoPlane();
  }



  private updateOrbitCamera(state = this.orbitState, camera = this.viewportCamera) {
    const minPhi = 0.05;
    const maxPhi = Math.PI - 0.05;
    state.phi = Math.min(maxPhi, Math.max(minPhi, state.phi));
    state.radius = Math.min(10, Math.max(0.4, state.radius));
    const sinPhi = Math.sin(state.phi);
    camera.position.set(
      this.orbitTarget.x + state.radius * sinPhi * Math.sin(state.theta),
      this.orbitTarget.y + state.radius * Math.cos(state.phi),
      this.orbitTarget.z + state.radius * sinPhi * Math.cos(state.theta)
    );
    camera.lookAt(this.orbitTarget);
    if (camera === this.shotCamera) {
      this.afterShotCameraChanged(false);
    }
  }

  private panOrbit(deltaX: number, deltaY: number) {
    const camera = this.getActiveCamera();
    camera.updateMatrixWorld();
    const offset = this.tempVector3.copy(camera.position).sub(this.orbitTarget);
    const targetDistance = offset.length() * Math.tan((camera.fov * Math.PI) / 360);
    const panX = (2 * deltaX * targetDistance) / this.renderer.domElement.clientHeight;
    const panY = (2 * deltaY * targetDistance) / this.renderer.domElement.clientHeight;

    this.tempVectorA.setFromMatrixColumn(camera.matrix, 0).multiplyScalar(-panX);
    this.tempVectorB.setFromMatrixColumn(camera.matrix, 1).multiplyScalar(panY);
    this.orbitTarget.add(this.tempVectorA);
    this.orbitTarget.add(this.tempVectorB);
    this.updateOrbitCamera(this.getActiveOrbitState(), this.getActiveCamera());
    if (this.viewMode === 'camera') {
      this.afterShotCameraChanged();
    }
  }

  private getActiveCamera() {
    return this.viewMode === 'camera' ? this.shotCamera : this.viewportCamera;
  }

  private getActiveOrbitState() {
    return this.viewMode === 'camera' ? this.cameraOrbitState : this.orbitState;
  }

  private deriveLensFromFov(fov: number): CameraLensPreset {
    let closest: CameraLensPreset = 'custom';
    let smallest = Number.POSITIVE_INFINITY;
    (Object.keys(CAMERA_LENS_FOV) as CameraLensPreset[]).forEach((lens) => {
      const diff = Math.abs(CAMERA_LENS_FOV[lens] - fov);
      if (diff < smallest) {
        smallest = diff;
        closest = lens;
      }
    });
    return smallest < 1 ? closest : 'custom';
  }

  private captureCameraSnapshot(camera: THREE.PerspectiveCamera, lens: CameraLensPreset = this.cameraLens): CameraSnapshot {
    const resolvedLens = lens ?? this.cameraLens;
    return {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      fov: camera.fov,
      lens: resolvedLens,
    };
  }

  private syncOrbitStateFromCamera(camera: THREE.PerspectiveCamera, state = this.cameraOrbitState) {
    const offset = this.tempVector3.copy(camera.position).sub(this.orbitTarget);
    state.radius = Math.max(1e-3, offset.length());
    state.theta = Math.atan2(offset.x, offset.z);
    const normalizedY = Math.max(-1, Math.min(1, offset.y / state.radius));
    state.phi = Math.acos(normalizedY);
  }

  private createCameraRig() {
    const rig = new THREE.Group();
    const bodyGeom = new THREE.BoxGeometry(0.06, 0.04, 0.08);
    const body = new THREE.Mesh(bodyGeom, new THREE.MeshBasicMaterial({ color: 0x6ab0ff, transparent: true, opacity: 0.9 }));
    body.position.z = -0.04;
    rig.add(body);

    const coneGeom = new THREE.ConeGeometry(0.08, 0.16, 4, 1);
    const helper = new THREE.LineSegments(new THREE.WireframeGeometry(coneGeom), new THREE.LineBasicMaterial({ color: 0xffc857 }));
    helper.rotateX(Math.PI / 2);
    helper.position.z = -0.1;
    rig.add(helper);

    rig.traverse((obj) => obj.layers.set(CAMERA_RIG_LAYER));
    rig.visible = true;
    return rig;
  }

  private updateCameraRigFromShotCamera() {
    if (!this.shotRig) return;
    this.shotRig.position.copy(this.shotCamera.position);
    this.shotRig.quaternion.copy(this.shotCamera.quaternion);
    const dist = Math.max(0.2, this.shotCamera.position.distanceTo(this.orbitTarget));
    const scale = Math.min(1.2, Math.max(0.2, dist * 0.12));
    this.shotRig.scale.setScalar(scale);
    this.updateShotRigVisibility();
  }

  private updateShotRigVisibility() {
    if (!this.shotRig) return;
    this.shotRig.visible = true;
    this.shotRig.layers.set(CAMERA_RIG_LAYER);
    this.viewportCamera.layers.enable(CAMERA_RIG_LAYER);
    this.shotCamera.layers.disable(CAMERA_RIG_LAYER);
  }

  private getTargetCameraAspect(containerAspect: number) {
    if (this.cameraAspectOverride && this.cameraAspectOverride > 0) return this.cameraAspectOverride;
    if (this.cameraAspectFromVideo && this.cameraAspectFromVideo > 0) return this.cameraAspectFromVideo;
    return containerAspect;
  }

  private computeCameraViewport(width: number, height: number) {
    const safeWidth = Math.max(1, width);
    const safeHeight = Math.max(1, height);
    const containerAspect = safeWidth / safeHeight;
    const targetAspect = this.getTargetCameraAspect(containerAspect);
    let viewWidth = safeWidth;
    let viewHeight = safeHeight;
    if (Math.abs(targetAspect - containerAspect) > 1e-4) {
      if (targetAspect > containerAspect) {
        viewHeight = safeWidth / targetAspect;
      } else {
        viewWidth = safeHeight * targetAspect;
      }
    }
    const viewportWidth = Math.max(1, Math.round(viewWidth));
    const viewportHeight = Math.max(1, Math.round(viewHeight));
    const x = Math.round((safeWidth - viewportWidth) / 2);
    const y = Math.round((safeHeight - viewportHeight) / 2);
    return { x, y, width: viewportWidth, height: viewportHeight, aspect: targetAspect };
  }

  private applyViewportForRender() {
    this.renderer.setViewport(0, 0, this.canvasWidth, this.canvasHeight);
    this.renderer.setScissorTest(false);
    if (this.scene.background instanceof THREE.Color) {
      this.renderer.setClearColor(this.scene.background);
    }
    this.renderer.clear();
    if (this.viewMode === 'camera') {
      const vp = this.cameraViewport;
      this.renderer.setViewport(vp.x, vp.y, vp.width, vp.height);
      this.renderer.setScissor(vp.x, vp.y, vp.width, vp.height);
      this.renderer.setScissorTest(true);
    }
  }

  private updateCameraVideoPlane() {
    if (!this.cameraVideoMesh) return;
    const distance = Math.max(0.05, this.cameraVideoPlaneDistance);
    this.cameraVideoPlaneDistance = distance;
    this.cameraVideoMesh.position.set(0, 0, -distance);

    const aspect = this.cameraVideoAspect > 0 ? this.cameraVideoAspect : 1;
    const viewHeight = 2 * distance * Math.tan((this.shotCamera.fov * Math.PI) / 360);
    const viewWidth = viewHeight * (this.cameraViewport.aspect || this.shotCamera.aspect || 1);
    const scale = Math.max(0.05, this.cameraVideoScale);
    const planeWidth = viewWidth * scale;
    const planeHeight = planeWidth / aspect;
    this.cameraVideoMesh.scale.set(planeWidth, planeHeight, 1);
    this.cameraVideoMesh.visible = true;
  }

  private disposeCameraVideo() {
    if (this.cameraVideoMesh) {
      this.shotCamera.remove(this.cameraVideoMesh);
      this.cameraVideoMesh.geometry.dispose();
      this.cameraVideoMesh.material.dispose();
      this.cameraVideoMesh = null;
    }
    if (this.cameraVideoTexture) {
      this.cameraVideoTexture.dispose();
      this.cameraVideoTexture = null;
    }
    if (this.cameraVideoElement) {
      this.cameraVideoElement.pause();
      this.cameraVideoElement.src = '';
      this.cameraVideoElement.load();
      this.cameraVideoElement = null;
    }
    if (this.cameraVideoUrl) {
      URL.revokeObjectURL(this.cameraVideoUrl);
      this.cameraVideoUrl = null;
    }
    this.cameraVideoLabel = '';
    this.cameraVideoScale = 1;
    this.cameraVideoAspect = 16 / 9;
    this.cameraVideoDuration = 0;
    this.cameraAspectFromVideo = null;
    this.lastVideoSyncFrame = -1;
  }

  private afterShotCameraChanged(emitSettings = true) {
    this.currentCameraState = this.captureCameraSnapshot(this.shotCamera, this.cameraLens);
    this.syncOrbitStateFromCamera(this.shotCamera, this.cameraOrbitState);
    this.updateCameraRigFromShotCamera();
    this.updateCameraVideoPlane();
    if (emitSettings) {
      this.emitCameraSettings();
    }
  }

  private updateCameraVideoForFrame(frameIndex: number, force = false) {
    if (!this.cameraVideoElement || !this.cameraVideoSyncToTimeline) return;
    if (frameIndex < 0) return;
    if (!force && frameIndex === this.lastVideoSyncFrame) return;
    const video = this.cameraVideoElement;
    const duration = this.cameraVideoDuration || video.duration || 0;
    if (!(duration > 0) || !(this.effectiveFps > 0)) return;
    const timeRaw = frameIndex / this.effectiveFps;
    let targetTime = duration > 0 ? timeRaw % duration : timeRaw;
    if (targetTime < 0) targetTime += duration;
    if (Math.abs(video.currentTime - targetTime) > 0.02) {
      video.currentTime = targetTime;
    }
    this.lastVideoSyncFrame = frameIndex;
  }

  private updateCameraVideoPlayback() {
    if (!this.cameraVideoElement) return;
    if (this.isPlaying) {
      if (this.cameraVideoSyncToTimeline && this.displayedFrame >= 0) {
        this.updateCameraVideoForFrame(this.displayedFrame, true);
      }
      this.cameraVideoElement.play().catch(() => undefined);
    } else {
      this.cameraVideoElement.pause();
    }
  }

  private setupOrbitInput() {
    const canvas = this.renderer.domElement;
    const orbitPointer = { pointerId: null as number | null, lastX: 0, lastY: 0, active: false, mode: 'rotate' as 'rotate' | 'pan' };

    canvas.addEventListener('pointerdown', (event: PointerEvent) => {
      if (event.button !== 0 && event.button !== 2) return;
      if (this.viewMode === 'camera' && this.cameraLocked) return;
      orbitPointer.mode = event.button === 2 ? 'pan' : 'rotate';
      orbitPointer.pointerId = event.pointerId;
      orbitPointer.lastX = event.clientX;
      orbitPointer.lastY = event.clientY;
      orbitPointer.active = orbitPointer.mode === 'rotate' ? (this.viewMode === 'camera' ? true : !this.editingState.enabled) : true;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event: PointerEvent) => {
      if (orbitPointer.pointerId !== event.pointerId) return;
      if (this.viewMode === 'camera' && this.cameraLocked) return;
      if (this.editingState.transformDragging) return;
      if (this.editingState.enabled && this.selectionPointerState.pointerId !== null) return;
      const dx = event.clientX - orbitPointer.lastX;
      const dy = event.clientY - orbitPointer.lastY;
      if (orbitPointer.mode === 'rotate') {
        if (!orbitPointer.active) {
          const threshold = 4;
          if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
            return;
          }
          orbitPointer.active = true;
        }
        orbitPointer.lastX = event.clientX;
        orbitPointer.lastY = event.clientY;
        const orbitState = this.getActiveOrbitState();
        orbitState.theta -= dx * 0.005;
        orbitState.phi -= dy * 0.005;
        this.updateOrbitCamera(orbitState, this.getActiveCamera());
        if (this.viewMode === 'camera') {
          this.afterShotCameraChanged();
        }
      } else {
        orbitPointer.lastX = event.clientX;
        orbitPointer.lastY = event.clientY;
        this.panOrbit(dx, dy);
      }
    });
    canvas.addEventListener('pointerup', (event: PointerEvent) => {
      if (orbitPointer.pointerId === event.pointerId) {
        orbitPointer.pointerId = null;
        orbitPointer.active = false;
        canvas.releasePointerCapture(event.pointerId);
      }
    });
    canvas.addEventListener('pointerleave', () => {
      if (orbitPointer.pointerId !== null) {
        orbitPointer.pointerId = null;
        orbitPointer.active = false;
      }
    });
    canvas.addEventListener('contextmenu', (event: MouseEvent) => {
      event.preventDefault();
    });
    canvas.addEventListener(
      'wheel',
      (event: WheelEvent) => {
        event.preventDefault();
        if (this.viewMode === 'camera' && this.cameraLocked) return;
        const delta = event.deltaY > 0 ? 1.05 : 0.95;
        const orbitState = this.getActiveOrbitState();
        orbitState.radius *= delta;
        this.updateOrbitCamera(orbitState, this.getActiveCamera());
        if (this.viewMode === 'camera') {
          this.afterShotCameraChanged();
        }
      },
      { passive: false }
    );
  }

  private setupSelectionInput() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.handleCameraPointerDown);
    canvas.addEventListener('pointermove', this.handleCameraPointerMove);
    canvas.addEventListener('pointerup', this.handleCameraPointerUp);
    canvas.addEventListener('pointerleave', this.handleCameraPointerCancel);
    canvas.addEventListener('pointercancel', this.handleCameraPointerCancel);
    canvas.addEventListener('pointerdown', this.handleSelectionPointerDown);
    canvas.addEventListener('pointermove', this.handleSelectionPointerMove);
    canvas.addEventListener('pointerup', this.handleSelectionPointerUp);
    canvas.addEventListener('pointerleave', this.handleSelectionPointerCancel);
    canvas.addEventListener('pointercancel', this.handleSelectionPointerCancel);
  }

  private handleCameraPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey) return;
    if (this.controlsDragging) return;
    if (this.cameraLocked) return;
    if (this.viewMode !== 'viewport') return;
    this.cameraPointerState.pointerId = event.pointerId;
    this.cameraPointerState.startX = event.clientX;
    this.cameraPointerState.startY = event.clientY;
    this.cameraPointerState.moved = false;
  };

  private handleCameraPointerMove = (event: PointerEvent) => {
    if (this.cameraPointerState.pointerId !== event.pointerId) return;
    const dx = event.clientX - this.cameraPointerState.startX;
    const dy = event.clientY - this.cameraPointerState.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      this.cameraPointerState.moved = true;
    }
  };

  private handleCameraPointerUp = (event: PointerEvent) => {
    if (event.button !== 0) return;
    if (this.cameraPointerState.pointerId !== event.pointerId) return;
    const moved = this.cameraPointerState.moved;
    this.cameraPointerState.pointerId = null;
    if (this.selectionPointerState.pointerId !== null) return;
    if (this.controlsDragging) return;
    if (moved) return;
    if (this.selectCameraAtEvent(event)) return;
    if (this.transformTarget === 'camera') {
      this.clearCameraSelection();
    }
  };

  private handleCameraPointerCancel = (event: PointerEvent) => {
    if (this.cameraPointerState.pointerId !== null && event.pointerId !== this.cameraPointerState.pointerId) {
      return;
    }
    this.cameraPointerState.pointerId = null;
    this.cameraPointerState.moved = false;
  };

  private handleSelectionPointerDown = (event: PointerEvent) => {
    if (!this.editingState.enabled || event.button !== 0) return;
    if (!(event.metaKey || event.ctrlKey)) return;
    if (this.selectionPointerState.suppressClick) return;
    this.selectionPointerState.pointerId = event.pointerId;
    this.selectionPointerState.startX = event.clientX;
    this.selectionPointerState.startY = event.clientY;
    this.selectionPointerState.currentX = event.clientX;
    this.selectionPointerState.currentY = event.clientY;
    this.selectionPointerState.moved = false;
    this.selectionPointerState.marqueeActive = false;
    this.updateMarqueeVisual();
    this.renderer.domElement.setPointerCapture(event.pointerId);
  };

  private handleSelectionPointerMove = (event: PointerEvent) => {
    if (!this.editingState.enabled) return;
    if (this.selectionPointerState.suppressClick) return;
    if (this.selectionPointerState.pointerId !== event.pointerId) return;
    if (this.editingState.transformDragging) return;
    this.selectionPointerState.currentX = event.clientX;
    this.selectionPointerState.currentY = event.clientY;
    const dx = event.clientX - this.selectionPointerState.startX;
    const dy = event.clientY - this.selectionPointerState.startY;
    if (!this.selectionPointerState.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      this.selectionPointerState.moved = true;
      this.selectionPointerState.marqueeActive = true;
    }
    if (this.selectionPointerState.marqueeActive) {
      this.updateMarqueeVisual();
    }
  };

  private handleSelectionPointerUp = (event: PointerEvent) => {
    if (!this.editingState.enabled || event.button !== 0) return;
    if (this.selectionPointerState.suppressClick) {
      this.selectionPointerState.suppressClick = false;
      return;
    }
    if (this.selectionPointerState.pointerId !== event.pointerId) return;
    const moved = this.selectionPointerState.moved;
    const wasMarquee = this.selectionPointerState.marqueeActive;
    this.selectionPointerState.pointerId = null;
    this.selectionPointerState.moved = false;
    this.stopMarquee();
    this.renderer.domElement.releasePointerCapture(event.pointerId);
    if (this.editingState.transformDragging) return;
    if (wasMarquee) {
      const additive = event.shiftKey;
      this.selectHandlesInMarquee(additive);
    } else if (!moved) {
      const hit = this.selectJointAtEvent(event);
      const hasModifier = event.metaKey || event.ctrlKey;
      if (!hit && hasModifier && !event.shiftKey && !this.editingState.transformDragging) {
        this.clearSelection();
      }
    }
  };

  private handleSelectionPointerCancel = (event: PointerEvent) => {
    if (this.selectionPointerState.pointerId !== null && this.selectionPointerState.pointerId !== event.pointerId) {
      return;
    }
    this.selectionPointerState.pointerId = null;
    this.selectionPointerState.moved = false;
    this.stopMarquee();
    this.renderer.domElement.releasePointerCapture(event.pointerId);
  };

  private stopMarquee() {
    this.selectionPointerState.marqueeActive = false;
    this.updateMarqueeVisual();
  }

  private updateMarqueeVisual() {
    if (!this.selectionPointerState.marqueeActive) {
      this.marqueeElement.style.display = 'none';
      return;
    }
    const rect = this.container.getBoundingClientRect();
    const x1 = this.selectionPointerState.startX;
    const y1 = this.selectionPointerState.startY;
    const x2 = this.selectionPointerState.currentX;
    const y2 = this.selectionPointerState.currentY;
    const left = Math.min(x1, x2) - rect.left;
    const top = Math.min(y1, y2) - rect.top;
    const width = Math.abs(x1 - x2);
    const height = Math.abs(y1 - y2);
    this.marqueeElement.style.display = 'block';
    this.marqueeElement.style.left = `${left}px`;
    this.marqueeElement.style.top = `${top}px`;
    this.marqueeElement.style.width = `${width}px`;
    this.marqueeElement.style.height = `${height}px`;
  }

  private selectHandlesInMarquee(additive: boolean) {
    const x1 = this.selectionPointerState.startX;
    const y1 = this.selectionPointerState.startY;
    const x2 = this.selectionPointerState.currentX;
    const y2 = this.selectionPointerState.currentY;
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const rect = this.renderer.domElement.getBoundingClientRect();
    const selected: JointHandle[] = [];
    const activeCamera = this.getActiveCamera();
    this.peopleObjects.forEach((obj) => {
      if (!obj.group.visible) return;
      const handles = obj.rigHandle ? [...obj.jointHandles, obj.rigHandle] : obj.jointHandles;
      handles.forEach((handle) => {
        if (!handle.visible) return;
        handle.getWorldPosition(this.tempVector3);
        this.tempVector3.project(activeCamera);
        const screenX = (this.tempVector3.x * 0.5 + 0.5) * rect.width + rect.left;
        const screenY = (this.tempVector3.y * -0.5 + 0.5) * rect.height + rect.top;
        if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY) {
          selected.push(handle);
        }
      });
    });
    this.applySelectionForHandles(selected, additive);
  }

  private expandHandlesForSelection(handles: JointHandle[]) {
    return handles.filter(Boolean) as JointHandle[];
  }

  private applySelectionForHandles(handles: JointHandle[], additive: boolean) {
    this.clearCameraSelection();
    const expanded = this.expandHandlesForSelection(handles);
    const unique = Array.from(new Set(expanded));
    if (!additive) {
      if (this.editingState.selectedHandles.length) {
        this.editingState.selectedHandles.forEach((selected) => {
          if (!unique.includes(selected)) this.setHandleSelected(selected, false);
        });
      }
      this.editingState.selectedHandles = [];
      unique.forEach((handle) => {
        this.setHandleSelected(handle, true);
        this.editingState.selectedHandles.push(handle);
      });
    } else {
      unique.forEach((handle) => {
        const existingIndex = this.editingState.selectedHandles.indexOf(handle);
        if (existingIndex >= 0) {
          this.setHandleSelected(handle, false);
          this.editingState.selectedHandles.splice(existingIndex, 1);
        } else {
          this.setHandleSelected(handle, true);
          this.editingState.selectedHandles.push(handle);
        }
      });
    }
    this.refreshSelectionProxyFromHandles();
    this.updateSelectionInfo();
  }

  private enforceTransformModeForTarget(mode?: TransformMode) {
    const desired = mode ?? this.currentTransformMode;
    const resolved = this.transformTarget === 'camera' && desired === 'scale' ? 'translate' : desired;
    this.currentTransformMode = resolved;
    this.transformControls.setMode(resolved);
  }

  private setTransformTarget(target: 'camera' | 'joints' | null) {
    let resolved: 'camera' | 'joints' | null = target;
    if (resolved === 'joints' && (!this.editingState.enabled || !this.editingState.selectedHandles.length)) {
      resolved = null;
    }
    if (this.transformTarget === resolved) {
      this.enforceTransformModeForTarget();
      return;
    }
    this.transformTarget = resolved;
    if (resolved === 'camera') {
      this.editingState.selectionProxy.visible = false;
      this.transformControls.attach(this.shotRig);
      this.transformControls.visible = true;
      this.transformControls.enabled = true;
    } else if (resolved === 'joints') {
      if (this.editingState.selectionProxy.visible) {
        this.transformControls.attach(this.editingState.selectionProxy);
        this.transformControls.visible = true;
        this.transformControls.enabled = true;
      }
    } else {
      this.editingState.selectionProxy.visible = false;
      this.transformControls.detach();
      this.transformControls.visible = false;
      this.transformControls.enabled = false;
    }
    this.callbacks.onTransformTargetChange?.({ target: resolved ?? 'none' });
    this.updateSelectionInfo();
    this.enforceTransformModeForTarget();
  }

  private clearCameraSelection() {
    if (this.transformTarget === 'camera') {
      this.setTransformTarget(null);
    }
  }

  private clearJointSelection() {
    if (this.editingState.selectedHandles.length) {
      this.editingState.selectedHandles.forEach((handle) => this.setHandleSelected(handle, false));
    }
    this.editingState.selectedHandles = [];
    this.editingState.transformSession = null;
    this.editingState.selectionProxy.visible = false;
  }

  private selectCameraAtEvent(event: PointerEvent) {
    if (this.viewMode !== 'viewport') return false;
    if (this.cameraLocked) return false;
    if (!this.shotRig || this.controlsDragging) return false;
    if (event.metaKey || event.ctrlKey) return false;
    this.prepareRayFromEvent(event);
    const intersections = this.raycaster.intersectObject(this.shotRig, true);
    if (!intersections.length) return false;
    this.clearJointSelection();
    this.setTransformTarget('camera');
    return true;
  }

  private applyCameraRigTransform() {
    if (this.cameraLocked) return;
    if (!this.shotRig) return;
    this.shotCamera.position.copy(this.shotRig.position);
    this.shotCamera.quaternion.copy(this.shotRig.quaternion);
    this.currentCameraState = this.captureCameraSnapshot(this.shotCamera, this.cameraLens);
    this.syncOrbitStateFromCamera(this.shotCamera, this.cameraOrbitState);
    const dist = Math.max(0.2, this.shotCamera.position.distanceTo(this.orbitTarget));
    const scale = Math.min(1.2, Math.max(0.2, dist * 0.12));
    this.shotRig.scale.setScalar(scale);
    this.emitCameraSettings();
  }












  setViewMode(view: ViewMode) {
    if (view !== 'viewport' && view !== 'camera') return;
    if (this.viewMode === view) return;
    this.viewMode = view;
    this.transformControls.camera = this.getActiveCamera();
    this.transformControls.updateMatrixWorld();
    this.updateCameraRigFromShotCamera();
    this.updateShotRigVisibility();
    this.updateCameraVideoPlane();
    this.emitCameraSettings();
  }

  private parseAspectRatioOption(option: AspectRatioOption, customAspectRatio?: number | null) {
    if (option === 'none') return null;
    if (option === 'custom') {
      if (customAspectRatio && customAspectRatio > 0) return customAspectRatio;
      return this.cameraVideoAspect > 0 ? this.cameraVideoAspect : null;
    }
    const [w, h] = option.split(':').map(Number);
    return w > 0 && h > 0 ? w / h : null;
  }

  setAspectRatioGuide(option: AspectRatioOption, customAspectRatio?: number | null) {
    this.currentAspectRatioGuide = option;
    this.cameraAspectOverride = this.parseAspectRatioOption(option, customAspectRatio);
    this.resizeRenderer();
    this.updateCameraVideoPlane();
    this.emitCameraSettings();
  }

  setCameraLocked(locked: boolean) {
    this.cameraLocked = locked;
    if (this.cameraLocked && this.transformTarget === 'camera') {
      this.clearCameraSelection();
    }
    this.emitCameraSettings();
  }

  setCameraFov(fov: number, lens: CameraLensPreset = 'custom') {
    if (this.cameraLocked) return;
    const clamped = Math.min(110, Math.max(15, Number.isFinite(fov) ? fov : this.shotCamera.fov));
    this.cameraLens = lens;
    this.shotCamera.fov = clamped;
    this.shotCamera.updateProjectionMatrix();
    this.afterShotCameraChanged();
  }

  setCameraLens(lens: CameraLensPreset) {
    if (lens === 'custom') {
      this.setCameraFov(this.shotCamera.fov, 'custom');
      return;
    }
    const targetFov = CAMERA_LENS_FOV[lens] ?? this.shotCamera.fov;
    this.setCameraFov(targetFov, lens);
  }

  syncCameraFromViewport() {
    if (this.cameraLocked) return;
    this.shotCamera.position.copy(this.viewportCamera.position);
    this.shotCamera.quaternion.copy(this.viewportCamera.quaternion);
    this.shotCamera.fov = this.viewportCamera.fov;
    this.shotCamera.updateProjectionMatrix();
    this.cameraLens = this.deriveLensFromFov(this.shotCamera.fov);
    this.afterShotCameraChanged();
  }

  animateToView(preset: ViewPreset) {
    // View presets define theta (horizontal angle) and phi (vertical angle from top)
    // theta: 0 = looking from +Z, PI = looking from -Z, PI/2 = looking from +X
    // phi: 0 = looking from top, PI = looking from bottom, PI/2 = looking from side
    const presets: Record<ViewPreset, { theta: number; phi: number }> = {
      front: { theta: Math.PI, phi: Math.PI / 2 },           // Looking from -Z towards origin
      back: { theta: 0, phi: Math.PI / 2 },                  // Looking from +Z towards origin
      left: { theta: Math.PI / 2, phi: Math.PI / 2 },        // Looking from +X towards origin
      right: { theta: -Math.PI / 2, phi: Math.PI / 2 },      // Looking from -X towards origin
      top: { theta: Math.PI, phi: 0.05 },                    // Looking from above (small phi to avoid gimbal lock)
      bottom: { theta: Math.PI, phi: Math.PI - 0.05 },       // Looking from below
    };

    const target = presets[preset];
    if (!target) return;

    const orbitState = this.getActiveOrbitState();

    // Normalize current theta to find shortest rotation path
    let startTheta = orbitState.theta;
    let endTheta = target.theta;

    // Normalize to [-PI, PI] range for shortest path calculation
    while (startTheta > Math.PI) startTheta -= 2 * Math.PI;
    while (startTheta < -Math.PI) startTheta += 2 * Math.PI;
    while (endTheta > Math.PI) endTheta -= 2 * Math.PI;
    while (endTheta < -Math.PI) endTheta += 2 * Math.PI;

    // Find shortest rotation direction
    let deltaTheta = endTheta - startTheta;
    if (deltaTheta > Math.PI) deltaTheta -= 2 * Math.PI;
    if (deltaTheta < -Math.PI) deltaTheta += 2 * Math.PI;
    endTheta = startTheta + deltaTheta;

    this.viewTransition = {
      active: true,
      startTime: performance.now(),
      duration: 400, // 400ms for smooth transition
      startTheta: startTheta,
      startPhi: orbitState.phi,
      startRadius: orbitState.radius,
      endTheta: endTheta,
      endPhi: target.phi,
      endRadius: orbitState.radius, // Keep current distance
    };
  }

  async setCameraReferenceVideo(file: File | null) {
    if (!file) {
      this.disposeCameraVideo();
      this.cameraAspectOverride = this.parseAspectRatioOption(this.currentAspectRatioGuide, null);
      this.resizeRenderer();
      this.emitCameraSettings();
      this.callbacks.onStatusChange?.('Camera reference video cleared.');
      return;
    }

    this.callbacks.onStatusChange?.('Loading camera reference video...');
    this.disposeCameraVideo();
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.loop = true;
    video.muted = true;
    video.preload = 'auto';
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.src = url;

    try {
      await new Promise<void>((resolve, reject) => {
        const handleLoaded = () => {
          cleanup();
          resolve();
        };
        const handleError = () => {
          cleanup();
          reject(new Error('Video failed to load'));
        };
        const cleanup = () => {
          video.removeEventListener('loadedmetadata', handleLoaded);
          video.removeEventListener('error', handleError);
        };
        video.addEventListener('loadedmetadata', handleLoaded);
        video.addEventListener('error', handleError);
        video.load();
      });
      await video.play().catch(() => undefined);

      const aspect = video.videoWidth > 0 && video.videoHeight > 0 ? video.videoWidth / video.videoHeight : 16 / 9;
      this.cameraVideoAspect = aspect;
      this.cameraVideoScale = 1;
      this.cameraAspectFromVideo = aspect;
      this.cameraAspectOverride = aspect;
      this.currentAspectRatioGuide = 'custom';
      this.resizeRenderer();
      this.cameraVideoElement = video;
      this.cameraVideoUrl = url;
      this.cameraVideoLabel = file.name || 'Reference video';
      this.cameraVideoDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      this.lastVideoSyncFrame = -1;

      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      this.cameraVideoTexture = texture;

      const material = new THREE.MeshBasicMaterial({
        map: texture,
        toneMapped: false,
        depthTest: false,
        depthWrite: false,
        transparent: false,
      });
      const geometry = new THREE.PlaneGeometry(1, 1);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = -100;
      mesh.name = 'CameraReferenceVideo';
      this.cameraVideoMesh = mesh;
      this.shotCamera.add(mesh);

      this.updateCameraVideoPlane();
      if (this.displayedFrame >= 0) {
        this.updateCameraVideoForFrame(this.displayedFrame, true);
      }
      this.updateCameraVideoPlayback();
      this.emitCameraSettings();
      this.callbacks.onStatusChange?.(`Loaded camera video: ${this.cameraVideoLabel}`);
    } catch (error) {
      URL.revokeObjectURL(url);
      this.callbacks.onStatusChange?.('Failed to load camera reference video.');
      console.error('Failed to load camera video', error);
    }
  }

  clearCameraReferenceVideo() {
    this.disposeCameraVideo();
    this.cameraAspectOverride = this.parseAspectRatioOption(this.currentAspectRatioGuide, null);
    this.resizeRenderer();
    this.emitCameraSettings();
    this.callbacks.onStatusChange?.('Camera reference video cleared.');
    this.updateCameraVideoPlayback();
  }

  setCameraVideoScale(scale: number) {
    const clamped = Number.isFinite(scale) ? Math.min(4, Math.max(0.25, scale)) : this.cameraVideoScale;
    this.cameraVideoScale = clamped;
    this.updateCameraVideoPlane();
    this.emitCameraSettings();
  }

  setCameraVideoSync(enabled: boolean) {
    this.cameraVideoSyncToTimeline = Boolean(enabled);
    this.lastVideoSyncFrame = -1;
    if (this.cameraVideoSyncToTimeline && this.displayedFrame >= 0) {
      this.updateCameraVideoForFrame(this.displayedFrame, true);
    }
    this.updateCameraVideoPlayback();
    this.emitCameraSettings();
  }

  addCameraKeyframe(frameIndex?: number) {
    const target = typeof frameIndex === 'number' ? frameIndex : this.displayedFrame;
    if (target == null || target < 0) return;
    const snapshot = this.captureCameraSnapshot(this.shotCamera, this.cameraLens);
    this.cameraKeyframes.set(target, snapshot);
    this.emitCameraKeyframeState(target);
  }

  clearCameraKeyframe(frameIndex?: number) {
    const target = typeof frameIndex === 'number' ? frameIndex : this.displayedFrame;
    if (target == null || target < 0) return;
    if (!this.cameraKeyframes.has(target)) return;
    this.cameraKeyframes.delete(target);
    if (this.displayedFrame === target) {
      this.applyCameraForFrame(target);
    } else {
      this.emitCameraKeyframeState(target);
    }
  }

  private cloneCameraSnapshot(snapshot?: CameraSnapshot | null): CameraSnapshot | null {
    if (!snapshot) return null;
    return {
      position: snapshot.position.clone(),
      quaternion: snapshot.quaternion.clone(),
      fov: snapshot.fov,
      lens: snapshot.lens,
    };
  }

  private getCameraStateForFrame(frameIndex: number) {
    if (this.cameraKeyframes.has(frameIndex)) {
      return this.cloneCameraSnapshot(this.cameraKeyframes.get(frameIndex));
    }
    if (!this.cameraKeyframes.size) return this.cloneCameraSnapshot(this.currentCameraState);
    const frames = Array.from(this.cameraKeyframes.keys()).sort((a, b) => a - b);
    let prev = -1;
    let next = -1;
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      if (frame < frameIndex) prev = frame;
      if (frame > frameIndex) {
        next = frame;
        break;
      }
    }
    if (prev < 0 && next < 0) return this.cloneCameraSnapshot(this.currentCameraState);
    if (prev < 0) return this.cloneCameraSnapshot(this.cameraKeyframes.get(next));
    if (next < 0) return this.cloneCameraSnapshot(this.cameraKeyframes.get(prev));
    const a = this.cameraKeyframes.get(prev);
    const b = this.cameraKeyframes.get(next);
    if (!a || !b) return this.cloneCameraSnapshot(this.currentCameraState);
    const t = (frameIndex - prev) / (next - prev);
    return {
      position: a.position.clone().lerp(b.position, t),
      quaternion: a.quaternion.clone().slerp(b.quaternion, t),
      fov: THREE.MathUtils.lerp(a.fov, b.fov, t),
      lens: t < 0.5 ? a.lens : b.lens,
    };
  }

  private applyCameraSnapshot(snapshot: CameraSnapshot | null, emitSettings = true) {
    const target = snapshot || this.currentCameraState || this.captureCameraSnapshot(this.shotCamera, this.cameraLens);
    if (!target) return;
    this.shotCamera.position.copy(target.position);
    this.shotCamera.quaternion.copy(target.quaternion);
    this.shotCamera.fov = target.fov;
    this.shotCamera.updateProjectionMatrix();
    this.cameraLens = target.lens ?? this.deriveLensFromFov(target.fov);
    this.afterShotCameraChanged(emitSettings);
  }

  private applyCameraForFrame(frameIndex: number) {
    const snapshot = this.getCameraStateForFrame(frameIndex);
    this.applyCameraSnapshot(snapshot, false);
    this.emitCameraSettings();
    this.emitCameraKeyframeState(frameIndex);
  }

  private emitCameraKeyframeState(frameIndex = this.displayedFrame) {
    const framesWithKeyframes = Array.from(this.cameraKeyframes.keys()).sort((a, b) => a - b);
    const hasKeyframeAtCurrent = frameIndex >= 0 ? this.cameraKeyframes.has(frameIndex) : false;
    this.callbacks.onCameraKeyframeStateChange?.({ framesWithKeyframes, hasKeyframeAtCurrent });
  }

  private emitCameraSettings() {
    this.callbacks.onCameraSettingsChange?.({
      fov: this.shotCamera.fov,
      lens: this.cameraLens,
      locked: this.cameraLocked,
      viewMode: this.viewMode,
      videoScale: this.cameraVideoScale,
      hasCameraVideo: Boolean(this.cameraVideoTexture),
      cameraVideoLabel: this.cameraVideoLabel,
      syncVideoToTimeline: this.cameraVideoSyncToTimeline,
      cameraAspectRatio: this.cameraViewport.aspect,
      cameraVideoAspect: this.cameraVideoAspect,
    });
  }

  private animate = () => {
    this.animationHandle = requestAnimationFrame(this.animate);
    const now = performance.now();
    const delta = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;

    // Handle view transition animation
    if (this.viewTransition?.active) {
      const elapsed = now - this.viewTransition.startTime;
      const t = Math.min(1, elapsed / this.viewTransition.duration);
      // Ease-out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - t, 3);

      const orbitState = this.getActiveOrbitState();
      const newTheta = this.viewTransition.startTheta + (this.viewTransition.endTheta - this.viewTransition.startTheta) * eased;
      const newPhi = this.viewTransition.startPhi + (this.viewTransition.endPhi - this.viewTransition.startPhi) * eased;
      const newRadius = this.viewTransition.startRadius + (this.viewTransition.endRadius - this.viewTransition.startRadius) * eased;

      orbitState.theta = newTheta;
      orbitState.phi = newPhi;
      orbitState.radius = newRadius;
      this.updateOrbitCamera(orbitState, this.getActiveCamera());

      if (t >= 1) {
        // Normalize theta to [-PI, PI] range when animation completes
        while (orbitState.theta > Math.PI) orbitState.theta -= 2 * Math.PI;
        while (orbitState.theta < -Math.PI) orbitState.theta += 2 * Math.PI;
        this.viewTransition = null;

        // If in camera mode, update the camera state
        if (this.viewMode === 'camera') {
          this.afterShotCameraChanged();
        }
      }
    }

    if (this.isPlaying && this.frames.length > 0 && this.effectiveFps > 0) {
      const duration = this.frames.length / this.effectiveFps;
      if (duration > 0) {
        const deltaTime = delta * this.speedMultiplier * (this.playbackDirection === 'reverse' ? -1 : 1);
        this.playbackCursor = this.playbackCursor + deltaTime;

        // Handle looping
        if (this.playbackCursor < 0) {
          this.playbackCursor = duration + this.playbackCursor;
        } else if (this.playbackCursor >= duration) {
          this.playbackCursor = this.playbackCursor % duration;
        }

        const idx = Math.min(this.frames.length - 1, Math.floor(this.playbackCursor * this.effectiveFps));
        if (idx !== this.displayedFrame) {
          this.showFrame(idx);
        }
      }
    }
    this.scene.add(this.transformControls.getHelper());
    this.applyViewportForRender();
    this.renderer.render(this.scene, this.getActiveCamera());
    if (this.editingState.selectedHandles.length > 0 && Math.random() < 0.01) {
      console.log('TransformControls:', this.transformControls);
    }
  };

  private ensurePersonCount(count: number) {
    while (this.peopleObjects.length < count) {
      const personIndex = this.peopleObjects.length;
      const group = new THREE.Group();
      this.scene.add(group);

      const lineGeom = new THREE.BufferGeometry();
      const linePositions = new Float32Array(EDGE_PAIRS.length * 2 * 3);
      lineGeom.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
      lineGeom.setAttribute('color', new THREE.BufferAttribute(buildEdgeColorArray(), 3));
      const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 2 });
      const lines = new THREE.LineSegments(lineGeom, lineMat);
      lines.renderOrder = 10;
      group.add(lines);

      const pointGeom = new THREE.BufferGeometry();
      const pointPositions = new Float32Array(JOINT_COUNT * 3);
      pointGeom.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3));
      pointGeom.setAttribute('color', new THREE.BufferAttribute(buildPointColorArray(), 3));
      const pointMat = new THREE.PointsMaterial({ size: 0.04, vertexColors: true });
      const points = new THREE.Points(pointGeom, pointMat);
      points.renderOrder = 11;
      group.add(points);

      const jointHandles: JointHandle[] = [];
      for (let i = 0; i < JOINT_COUNT; i++) {
        const baseColorArr = getJointBaseColor(i);
        const baseColor = new THREE.Color(baseColorArr[0], baseColorArr[1], baseColorArr[2]);
        const mesh = new THREE.Mesh(JOINT_HANDLE_GEOMETRY, new THREE.MeshBasicMaterial({ color: baseColor })) as unknown as JointHandle;
        mesh.visible = false;
        mesh.userData = {
          baseColor,
          jointIndex: i,
          personIndex,
          isSelected: false,
        };
        group.add(mesh);
        jointHandles.push(mesh);
      }

      const rigHandle = new THREE.Mesh(RIG_HANDLE_GEOMETRY, new THREE.MeshBasicMaterial({ color: RIG_HANDLE_COLOR, transparent: true, opacity: 0.9, side: THREE.DoubleSide })) as unknown as JointHandle;
      rigHandle.visible = false;
      rigHandle.renderOrder = 8;
      rigHandle.userData = {
        baseColor: RIG_HANDLE_COLOR.clone(),
        jointIndex: -1,
        personIndex,
        isSelected: false,
        isRig: true,
      };
      group.add(rigHandle);

      this.peopleObjects.push({
        group,
        lines,
        lineGeom,
        linePositions,
        points,
        pointGeom,
        pointPositions,
        jointHandles,
        rigHandle,
        rigHandleHasPosition: false,
        personIndex,
      });
    }
  }

  private computeRigHandlePosition(person: PosePerson) {
    const points = Array.isArray(person.points) ? person.points : [];
    const collect = (indices: number[]) => {
      const picked: PosePoint[] = [];
      indices.forEach((idx) => {
        const p = points[idx];
        if (Array.isArray(p) && p.length >= 3 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2])) {
          picked.push(p as PosePoint);
        }
      });
      return picked;
    };
    let candidates = collect([15, 16, 17, 18, 19, 20, 21, 22]);
    if (!candidates.length) {
      candidates = collect([11, 12, 13, 14, 5, 6]);
    }
    if (!candidates.length) {
      candidates = collect(points.map((_, idx) => idx));
    }
    if (!candidates.length) return null;
    let sumX = 0;
    let sumZ = 0;
    let minY = Number.POSITIVE_INFINITY;
    candidates.forEach((p) => {
      sumX += p[0];
      sumZ += p[2];
      if (p[1] < minY) minY = p[1];
    });
    const inv = 1 / candidates.length;
    return new THREE.Vector3(sumX * inv, minY, sumZ * inv);
  }

  private computeRigHandleScale(person: PosePerson) {
    const points = Array.isArray(person.points) ? person.points : [];
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let count = 0;
    points.forEach((p) => {
      if (Array.isArray(p) && p.length >= 3 && Number.isFinite(p[1])) {
        minY = Math.min(minY, p[1]);
        maxY = Math.max(maxY, p[1]);
        count++;
      }
    });
    if (!count || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
      return 1;
    }
    const height = Math.max(1e-3, maxY - minY);
    return Math.min(1.6, Math.max(0.7, height * 0.5));
  }

  private makeRigKey(personIndex: number) {
    return `rig:${personIndex}`;
  }

  private setRigKeyframeTransform(frameIndex: number, personIndex: number, transform: RigTransform) {
    let personMap = this.rigKeyframes.get(frameIndex);
    if (!personMap) {
      personMap = new Map<number, RigTransform>();
      this.rigKeyframes.set(frameIndex, personMap);
    }
    personMap.set(personIndex, cloneRigTransform(transform));
  }

  private clearRigKeyframe(frameIndex: number, personIndex?: number) {
    if (!this.rigKeyframes.has(frameIndex)) return;
    if (typeof personIndex === 'number') {
      const personMap = this.rigKeyframes.get(frameIndex);
      personMap?.delete(personIndex);
      if (!personMap?.size) {
        this.rigKeyframes.delete(frameIndex);
      }
      return;
    }
    this.rigKeyframes.delete(frameIndex);
  }

  private getRigKeyframeTransform(frameIndex: number, personIndex: number): RigTransform | null {
    const personMap = this.rigKeyframes.get(frameIndex);
    const transform = personMap?.get(personIndex);
    return transform ? cloneRigTransform(transform) : null;
  }

  private getRigKeyframeFramesForPerson(personIndex: number) {
    const frames: number[] = [];
    this.rigKeyframes.forEach((personMap, frameIdx) => {
      if (personMap.has(personIndex)) {
        frames.push(frameIdx);
      }
    });
    return frames.sort((a, b) => a - b);
  }

  private getRigTransformForFrame(frameIndex: number, personIndex: number): RigTransform {
    const frames = this.getRigKeyframeFramesForPerson(personIndex);
    if (!frames.length) return identityRigTransform();
    if (frames.includes(frameIndex)) {
      const exact = this.getRigKeyframeTransform(frameIndex, personIndex);
      return exact ?? identityRigTransform();
    }
    let prev = -1;
    let next = -1;
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      if (frame < frameIndex) prev = frame;
      if (frame > frameIndex) {
        next = frame;
        break;
      }
    }
    if (prev < 0) {
      return this.getRigKeyframeTransform(next, personIndex) ?? identityRigTransform();
    }
    if (next < 0) {
      return this.getRigKeyframeTransform(prev, personIndex) ?? identityRigTransform();
    }
    const a = this.getRigKeyframeTransform(prev, personIndex) ?? identityRigTransform();
    const b = this.getRigKeyframeTransform(next, personIndex) ?? identityRigTransform();
    const t = (frameIndex - prev) / (next - prev);
    return interpolateRigTransforms(a, b, t);
  }

  private getDisplayToDataMatrices() {
    const gain = this.depthGain || 1;
    const toDisplay = new THREE.Matrix4().makeScale(1, 1, gain);
    const toData = new THREE.Matrix4().makeScale(1, 1, gain !== 0 ? 1 / gain : 1);
    return { toDisplay, toData };
  }

  private displayMatrixToDataSpace(matrix: THREE.Matrix4) {
    const { toDisplay, toData } = this.getDisplayToDataMatrices();
    return new THREE.Matrix4().copy(toData).multiply(matrix).multiply(toDisplay);
  }

  private getRigMatrixForFrame(frameIndex: number, personIndex: number) {
    const transform = this.getRigTransformForFrame(frameIndex, personIndex);
    return rigTransformToMatrix(transform);
  }

  private applyRigTransformsToFrames(refreshDisplay = true) {
    if (!this.rigBaseFrames.length) {
      this.rigBaseFrames = clonePoseFrames(this.frames);
    }
    const newFrames = clonePoseFrames(this.rigBaseFrames);
    for (let frameIndex = 0; frameIndex < newFrames.length; frameIndex++) {
      const frame = newFrames[frameIndex];
      const people = frame.people || [];
      people.forEach((person, personIndex) => {
        const matrix = this.getRigMatrixForFrame(frameIndex, personIndex);
        if (isIdentityMatrix(matrix)) return;
        person.points = (person.points || []).map((point) => {
          if (!Array.isArray(point) || point.length < 3) return point;
          const vec = new THREE.Vector3(point[0], point[1], point[2]).applyMatrix4(matrix);
          return [vec.x, vec.y, vec.z];
        });
      });
    }
    this.frames = newFrames;
    if (refreshDisplay && this.displayedFrame >= 0) {
      this.showFrame(this.displayedFrame);
    } else if (refreshDisplay) {
      this.emitKeyframeState();
    }
  }

  private updatePersonObject(obj: PersonObject, person: PosePerson, personIndex: number) {
    obj.personIndex = personIndex;
    const pts = person.points;
    const validMask = Array.isArray(person.valid) ? person.valid : null;
    const hasValid = Array.isArray(validMask) && validMask.length === JOINT_COUNT;
    const pointArray = obj.pointPositions;
    for (let i = 0; i < JOINT_COUNT; i++) {
      const p = pts[i];
      const offset = i * 3;
      pointArray[offset + 0] = p[0];
      pointArray[offset + 1] = p[1];
      pointArray[offset + 2] = p[2] * this.depthGain;
      const handle = obj.jointHandles[i];
      handle.position.set(p[0], p[1], p[2] * this.depthGain);
      handle.userData.personIndex = personIndex;
      handle.visible = this.editingState.enabled;
    }
    obj.pointGeom.attributes.position.needsUpdate = true;

    const lineArray = obj.linePositions;
    for (let i = 0; i < EDGE_PAIRS.length; i++) {
      const [a, b] = EDGE_PAIRS[i];
      const offset = i * 6;
      const pa = pts[a];
      const pb = pts[b];
      const drawEdge = !hasValid || ((validMask?.[a] ? 1 : 0) && (validMask?.[b] ? 1 : 0));
      if (drawEdge) {
        lineArray[offset + 0] = pa[0];
        lineArray[offset + 1] = pa[1];
        lineArray[offset + 2] = pa[2] * this.depthGain;
        lineArray[offset + 3] = pb[0];
        lineArray[offset + 4] = pb[1];
        lineArray[offset + 5] = pb[2] * this.depthGain;
      } else {
        const collapse = pa || [0, 0, 0];
        lineArray[offset + 0] = collapse[0];
        lineArray[offset + 1] = collapse[1];
        lineArray[offset + 2] = collapse[2] * this.depthGain;
        lineArray[offset + 3] = collapse[0];
        lineArray[offset + 4] = collapse[1];
        lineArray[offset + 5] = collapse[2] * this.depthGain;
      }
    }
    obj.lineGeom.attributes.position.needsUpdate = true;
    obj.group.visible = true;
    obj.jointHandles.forEach((handle) => {
      handle.visible = this.editingState.enabled;
    });
    const rigHandle = obj.rigHandle;
    if (rigHandle) {
      rigHandle.userData.personIndex = personIndex;
      rigHandle.userData.jointIndex = -1;
      const rigPosition = this.computeRigHandlePosition(person);
      obj.rigHandleHasPosition = Boolean(rigPosition);
      if (rigPosition) {
        rigHandle.position.set(rigPosition.x, rigPosition.y, rigPosition.z * this.depthGain);
        const rigScale = this.computeRigHandleScale(person) * 2;
        rigHandle.scale.setScalar(rigScale);
      }
      rigHandle.visible = this.editingState.enabled && obj.group.visible && obj.rigHandleHasPosition;
    }
  }

  private updateJointHandleVisibility() {
    this.peopleObjects.forEach((obj) => {
      const shouldShow = this.editingState.enabled && obj.group.visible;
      obj.jointHandles.forEach((handle) => {
        handle.visible = shouldShow;
      });
      if (obj.rigHandle) {
        obj.rigHandle.visible = shouldShow && obj.rigHandleHasPosition;
      }
    });
  }

  private hideUnused(activeCount: number) {
    for (let i = activeCount; i < this.peopleObjects.length; i++) {
      const obj = this.peopleObjects[i];
      obj.group.visible = false;
      obj.jointHandles.forEach((h) => (h.visible = false));
      if (obj.rigHandle) {
        obj.rigHandle.visible = false;
        obj.rigHandleHasPosition = false;
      }
    }
  }

  private setHandleSelected(handle: JointHandle, selected: boolean) {
    if (!handle || handle.userData.isSelected === selected) return;
    handle.userData.isSelected = selected;
    if (selected) {
      handle.material.color.copy(SELECTED_HANDLE_COLOR);
    } else {
      handle.material.color.copy(handle.userData.baseColor);
    }
    handle.scale.setScalar(selected ? HANDLE_SELECTED_SCALE : HANDLE_DEFAULT_SCALE);
  }

  clearSelection() {

    this.clearJointSelection();
    this.clearCameraSelection();
    this.setTransformTarget(null);
    this.updateSelectionInfo();
  }

  private updateSelectionInfo() {
    if (!this.callbacks.onSelectionInfoChange) return;
    if (this.transformTarget === 'camera') {
      this.callbacks.onSelectionInfoChange({
        text: 'Camera selected. Use Move or Rotate. Scale is disabled.',
        hasSelection: true,
      });
      return;
    }
    if (!this.editingState.enabled) {
      this.callbacks.onSelectionInfoChange({ text: 'Editing disabled.', hasSelection: false });
      return;
    }
    if (!this.editingState.selectedHandles.length) {
      this.callbacks.onSelectionInfoChange({
        text: 'Hold cmd/ctrl + click or drag to select. Shift adds/removes.',
        hasSelection: false,
      });
    } else {
      const rigHandles = this.editingState.selectedHandles.filter((h) => h.userData.isRig);
      if (rigHandles.length) {
        const persons = Array.from(new Set(rigHandles.map((h) => h.userData.personIndex + 1))).sort((a, b) => a - b);
        const label = persons.length === 1 ? `Rig selected (Person ${persons[0]})` : `Rig selected (People ${persons.join(', ')})`;
        this.callbacks.onSelectionInfoChange({
          text: `${label}. Transforms move every joint for that person.`,
          hasSelection: true,
        });
        return;
      }
      this.callbacks.onSelectionInfoChange({
        text: `${this.editingState.selectedHandles.length} joint(s) selected`,
        hasSelection: true,
      });
    }
  }



  private refreshSelectionProxyFromHandles() {
    if (!this.editingState.selectedHandles.length) {
      this.editingState.selectionProxy.visible = false;
      if (this.transformTarget === 'joints') {
        this.setTransformTarget(null);
      }
      return;
    }
    const centroid = new THREE.Vector3();
    this.editingState.selectedHandles.forEach((handle) => centroid.add(handle.position));
    centroid.multiplyScalar(1 / this.editingState.selectedHandles.length);
    this.editingState.selectionProxy.position.copy(centroid);
    this.editingState.selectionProxy.quaternion.identity();
    this.editingState.selectionProxy.scale.set(1, 1, 1);
    this.editingState.selectionProxy.visible = true;
    this.setTransformTarget('joints');
  }

  private pruneSelectionAfterFrame() {
    if (!this.editingState.selectedHandles.length) return;
    const remaining: JointHandle[] = [];
    this.editingState.selectedHandles.forEach((handle) => {
      const visible = handle.visible && handle.userData.personIndex >= 0 && handle.parent && handle.parent.visible;
      if (visible) {
        remaining.push(handle);
      } else {
        this.setHandleSelected(handle, false);
      }
    });
    if (remaining.length !== this.editingState.selectedHandles.length) {
      this.editingState.selectedHandles = remaining;
      this.refreshSelectionProxyFromHandles();
      this.updateSelectionInfo();
    }
  }

  private beginTransformSession() {
    if (!this.editingState.selectedHandles.length) return;
    const positionStart = this.editingState.selectionProxy.position.clone();
    const quaternionStart = this.editingState.selectionProxy.quaternion.clone();
    const scaleStart = this.editingState.selectionProxy.scale.clone();
    const startMatrix = new THREE.Matrix4().compose(positionStart, quaternionStart, scaleStart);
    const rigPersons = new Set<number>();
    this.editingState.selectedHandles.forEach((handle) => {
      if (handle.userData.isRig) {
        rigPersons.add(handle.userData.personIndex);
      }
    });
    const extraHandles: TransformSessionEntry[] = [];
    rigPersons.forEach((personIndex) => {
      const obj = this.peopleObjects[personIndex];
      if (!obj) return;
      obj.jointHandles.forEach((h) => {
        extraHandles.push({
          handle: h,
          personIndex,
          jointIndex: h.userData.jointIndex,
          startPosition: h.position.clone(),
          skipKeyframe: true,
        });
      });
    });
    const combinedEntries: TransformSessionEntry[] = [
      ...this.editingState.selectedHandles.map((handle) => ({
        handle,
        personIndex: handle.userData.personIndex,
        jointIndex: handle.userData.jointIndex,
        startPosition: handle.position.clone(),
      })),
      ...extraHandles,
    ];
    const session: TransformSession = {
      startMatrix,
      inverseStartMatrix: new THREE.Matrix4().copy(startMatrix).invert(),
      handles: combinedEntries.map((entry) => ({
        handle: entry.handle,
        personIndex: entry.personIndex,
        jointIndex: entry.jointIndex,
        startPosition: entry.startPosition.clone(),
        skipKeyframe: entry.skipKeyframe,
      })),
    };
    this.editingState.transformSession = session;
  }

  private applyTransformSession() {
    const session = this.editingState.transformSession;
    if (!session) return;
    const currentMatrix = new THREE.Matrix4().compose(
      this.editingState.selectionProxy.position.clone(),
      this.editingState.selectionProxy.quaternion.clone(),
      this.editingState.selectionProxy.scale.clone()
    );
    this.tempMatrixA.copy(currentMatrix).multiply(session.inverseStartMatrix);
    session.handles.forEach((entry) => {
      this.tempVector3.copy(entry.startPosition).applyMatrix4(this.tempMatrixA);
      const commit = !entry.skipKeyframe && !entry.handle.userData.isRig;
      this.updateHandlePosition(entry.handle, this.tempVector3, entry.personIndex, entry.jointIndex, commit);
    });
  }

  private finalizeTransformSession(session: TransformSession | null) {
    if (!session) return;
    const frameIndex = this.displayedFrame;
    if (frameIndex < 0) return;
    let changed = false;
    let rigChanged = false;
    session.handles.forEach((entry) => {
      const { startPosition, handle, personIndex, jointIndex } = entry;
      if (personIndex < 0) return;
      if (handle.userData.isRig) {
        if (startPosition.distanceToSquared(handle.position) >= POSITION_EPSILON_SQ) {
          rigChanged = true;
        }
        return;
      }
      if (jointIndex < 0) return;
      if (entry.skipKeyframe) return;
      if (startPosition.distanceToSquared(handle.position) < POSITION_EPSILON_SQ) return;
      if (this.syncKeyframeForJoint(frameIndex, personIndex, jointIndex, handle.position)) {
        changed = true;
      }
    });
    if (rigChanged) {
      const rigPersons = new Set<number>();
      session.handles.forEach((entry) => {
        if (entry.handle.userData.isRig && entry.personIndex >= 0) {
          rigPersons.add(entry.personIndex);
        }
      });
      const endMatrix = new THREE.Matrix4().compose(
        this.editingState.selectionProxy.position.clone(),
        this.editingState.selectionProxy.quaternion.clone(),
        this.editingState.selectionProxy.scale.clone()
      );
      const deltaDisplay = new THREE.Matrix4().copy(endMatrix).multiply(session.inverseStartMatrix);
      const deltaData = this.displayMatrixToDataSpace(deltaDisplay);
      rigPersons.forEach((personIndex) => {
        const key = this.makeRigKey(personIndex);
        let frameEntry = this.frameKeyframes.get(frameIndex);
        if (!frameEntry) {
          frameEntry = new Set<string>();
          this.frameKeyframes.set(frameIndex, frameEntry);
        }
        frameEntry.add(key);
        const prevTransform = this.getRigKeyframeTransform(frameIndex, personIndex) ?? identityRigTransform();
        const prevMatrix = rigTransformToMatrix(prevTransform);
        const nextMatrix = new THREE.Matrix4().copy(deltaData).multiply(prevMatrix);
        const nextTransform = matrixToRigTransform(nextMatrix);
        this.setRigKeyframeTransform(frameIndex, personIndex, nextTransform);
      });
      this.applyRigTransformsToFrames();
      changed = true;
    }
    if (changed) {
      this.emitKeyframeState();
    }
  }

  private syncKeyframeForJoint(frameIndex: number, personIndex: number, jointIndex: number, currentVec: THREE.Vector3) {
    const basePoint = this.getBasePosePoint(personIndex, jointIndex, frameIndex);
    if (!basePoint) return false;
    const currentPoint = this.displayVectorToPosePoint(currentVec);
    const matchesBase =
      Math.abs(currentPoint[0] - basePoint[0]) < POSITION_EPSILON &&
      Math.abs(currentPoint[1] - basePoint[1]) < POSITION_EPSILON &&
      Math.abs(currentPoint[2] - basePoint[2]) < POSITION_EPSILON;
    const key = makeJointKey(personIndex, jointIndex);
    if (matchesBase) {
      const existing = this.frameKeyframes.get(frameIndex);
      if (existing?.has(key)) {
        existing.delete(key);
        if (!existing.size) {
          this.frameKeyframes.delete(frameIndex);
        }
        return true;
      }
      return false;
    }
    let frameEntry = this.frameKeyframes.get(frameIndex);
    if (!frameEntry) {
      frameEntry = new Set<string>();
      this.frameKeyframes.set(frameIndex, frameEntry);
    }
    if (!frameEntry.has(key)) {
      frameEntry.add(key);
      return true;
    }
    return false;
  }

  private getBasePosePoint(personIndex: number, jointIndex: number, frameIndex = this.displayedFrame): PosePoint | null {
    if (frameIndex < 0) return null;
    const frame = this.baseFrames[frameIndex];
    if (!frame) return null;
    const person = frame.people?.[personIndex];
    if (!person) return null;
    const point = person.points?.[jointIndex];
    return point ?? null;
  }

  private displayVectorToPosePoint(vec: THREE.Vector3): PosePoint {
    const z = this.depthGain !== 0 ? vec.z / this.depthGain : vec.z;
    return [vec.x, vec.y, z];
  }

  private emitKeyframeState() {
    const framesWithKeyframes = Array.from(this.frameKeyframes.keys()).sort((a, b) => a - b);
    const hasKeyframeAtCurrent = this.displayedFrame >= 0 ? this.frameKeyframes.has(this.displayedFrame) : false;
    this.callbacks.onKeyframeStateChange?.({ framesWithKeyframes, hasKeyframeAtCurrent });
  }

  private updateHandlePosition(handle: JointHandle, vec: THREE.Vector3, personIndex: number, jointIndex: number, commitToFrame = true) {
    handle.position.copy(vec);
    if (handle.userData.isRig || jointIndex < 0) return;
    if (commitToFrame) {
      this.commitJointPosition(personIndex, jointIndex, vec);
    } else {
      this.updateGeometryForJoint(personIndex, jointIndex, vec);
    }
  }

  private commitJointPosition(personIndex: number, jointIndex: number, displayVec: THREE.Vector3) {
    if (!this.frames.length || this.displayedFrame < 0) return;
    const frameIndex = this.displayedFrame;
    const frame = this.frames[frameIndex];
    if (!frame || !Array.isArray(frame.people)) return;
    const person = frame.people[personIndex];
    if (!person || !Array.isArray(person.points)) return;
    const point = person.points[jointIndex];
    if (!Array.isArray(point) || point.length < 3) return;
    const dataVec = new THREE.Vector3(displayVec.x, displayVec.y, this.depthGain !== 0 ? displayVec.z / this.depthGain : displayVec.z);
    point[0] = dataVec.x;
    point[1] = dataVec.y;
    point[2] = dataVec.z;
    if (frameIndex >= 0) {
      if (!this.rigBaseFrames[frameIndex]) {
        this.rigBaseFrames[frameIndex] = clonePoseFrame(frame);
      }
      const baseFrame = this.rigBaseFrames[frameIndex];
      const basePerson = baseFrame?.people?.[personIndex];
      const basePoint = basePerson?.points?.[jointIndex];
      if (basePoint) {
        const rigMatrix = this.getRigMatrixForFrame(frameIndex, personIndex);
        const baseVec = dataVec.clone();
        if (!isIdentityMatrix(rigMatrix)) {
          const inv = this.tempMatrixA.copy(rigMatrix);
          const det = inv.determinant();
          if (Math.abs(det) > 1e-12) {
            inv.invert();
            baseVec.applyMatrix4(inv);
          }
        }
        basePoint[0] = baseVec.x;
        basePoint[1] = baseVec.y;
        basePoint[2] = baseVec.z;
      }
    }
    this.updateGeometryForJoint(personIndex, jointIndex, displayVec);
  }

  private updateGeometryForJoint(personIndex: number, jointIndex: number, displayVec: THREE.Vector3) {
    const obj = this.peopleObjects[personIndex];
    if (!obj) return;
    const offset = jointIndex * 3;
    obj.pointPositions[offset + 0] = displayVec.x;
    obj.pointPositions[offset + 1] = displayVec.y;
    obj.pointPositions[offset + 2] = displayVec.z;
    obj.pointGeom.attributes.position.needsUpdate = true;
    const references = JOINT_EDGE_LOOKUP[jointIndex] || [];
    references.forEach(({ edgeIndex, offset: edgeOffset }) => {
      const base = edgeIndex * 6 + edgeOffset;
      obj.linePositions[base + 0] = displayVec.x;
      obj.linePositions[base + 1] = displayVec.y;
      obj.linePositions[base + 2] = displayVec.z;
    });
    obj.lineGeom.attributes.position.needsUpdate = true;
  }

  setEditingEnabled(enabled: boolean) {
    if (this.editingState.enabled === enabled) return;
    this.editingState.enabled = enabled;
    if (!enabled) {
      const preserveCamera = this.transformTarget === 'camera';
      this.clearJointSelection();
      this.setTransformTarget(preserveCamera ? 'camera' : null);
    } else {
      if (this.isPlaying) {
        this.setPlaying(false);
      }
      if (this.editingState.selectedHandles.length) {
        this.setTransformTarget('joints');
      }
    }
    this.updateJointHandleVisibility();
    this.updateSelectionInfo();
  }

  setTransformMode(mode: TransformMode) {
    this.enforceTransformModeForTarget(mode);
  }

  setSpeed(value: number) {
    this.speedMultiplier = Number.isFinite(value) && value > 0 ? value : 1;
  }

  setDepthGain(value: number) {
    this.depthGain = Number.isFinite(value) && value > 0 ? value : 1;
    if (this.frames.length && this.displayedFrame >= 0) {
      this.showFrame(this.displayedFrame);
    }
  }

  clearFrameKeyframes(frameIndex?: number) {
    const target = typeof frameIndex === 'number' ? frameIndex : this.displayedFrame;
    if (target == null || target < 0 || target >= this.frames.length) return;
    if (!this.frameKeyframes.has(target)) return;
    const baseFrame = this.baseFrames[target];
    if (!baseFrame) return;
    this.frames[target] = clonePoseFrame(baseFrame);
    this.rigBaseFrames[target] = clonePoseFrame(baseFrame);
    this.clearRigKeyframe(target);
    this.frameKeyframes.delete(target);
    this.applyRigTransformsToFrames(false);
    if (this.displayedFrame === target) {
      this.showFrame(target);
    } else {
      this.emitKeyframeState();
    }
  }

  addKeyframeForSelection() {
    if (!this.editingState.enabled) return false;
    const frameIndex = this.displayedFrame;
    if (frameIndex < 0 || frameIndex >= this.frames.length) return false;
    if (!this.editingState.selectedHandles.length) return false;
    let frameEntry = this.frameKeyframes.get(frameIndex);
    if (!frameEntry) {
      frameEntry = new Set<string>();
      this.frameKeyframes.set(frameIndex, frameEntry);
    }
    this.editingState.selectedHandles.forEach((handle) => {
      const personIndex = handle.userData.personIndex;
      const jointIndex = handle.userData.jointIndex;
      if (personIndex < 0) return;
      if (handle.userData.isRig) {
        frameEntry?.add(this.makeRigKey(personIndex));
        if (!this.getRigKeyframeTransform(frameIndex, personIndex)) {
          this.setRigKeyframeTransform(frameIndex, personIndex, identityRigTransform());
        }
        return;
      }
      if (jointIndex < 0) return;
      frameEntry?.add(makeJointKey(personIndex, jointIndex));
    });
    this.emitKeyframeState();
    return true;
  }

  private prepareRayFromEvent(event: PointerEvent | MouseEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;
    let width = rect.width;
    let height = rect.height;

    if (this.viewMode === 'camera' && this.cameraViewport.width > 0 && this.cameraViewport.height > 0) {
      x -= this.cameraViewport.x;
      y -= this.cameraViewport.y;
      width = this.cameraViewport.width;
      height = this.cameraViewport.height;
      x = Math.max(0, Math.min(width, x));
      y = Math.max(0, Math.min(height, y));
    }

    if (!(width > 0) || !(height > 0)) return;
    this.pointerNdc.x = (x / width) * 2 - 1;
    this.pointerNdc.y = -(y / height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.getActiveCamera());
  }

  private selectJointAtEvent(event: PointerEvent) {
    this.prepareRayFromEvent(event);
    const visibleHandles: JointHandle[] = [];
    this.peopleObjects.forEach((obj) => {
      if (!obj.group.visible) return;
      const handles = obj.rigHandle ? [...obj.jointHandles, obj.rigHandle] : obj.jointHandles;
      handles.forEach((handle) => {
        if (handle.visible) visibleHandles.push(handle);
      });
    });
    if (!visibleHandles.length) return false;
    const intersections = this.raycaster.intersectObjects(visibleHandles, false);
    if (!intersections.length) return false;
    const targetHandle = intersections[0].object as JointHandle;
    const additive = event.shiftKey;
    this.applyHandleSelection(targetHandle, additive);
    return true;
  }

  private applyHandleSelection(handle: JointHandle, additive: boolean) {
    if (!handle) return;
    this.applySelectionForHandles([handle], additive);
  }

  private showFrame(index: number) {
    if (!this.frames.length) return;
    const frame = this.frames[index];
    const people = frame.people || [];
    this.ensurePersonCount(people.length);
    for (let i = 0; i < people.length; i++) {
      this.updatePersonObject(this.peopleObjects[i], people[i], i);
    }
    this.hideUnused(people.length);
    if (this.editingState.enabled) {
      this.updateJointHandleVisibility();
      this.pruneSelectionAfterFrame();
      this.refreshSelectionProxyFromHandles();
    }
    this.displayedFrame = index;
    this.updateCameraVideoForFrame(index, true);
    this.applyCameraForFrame(index);
    this.callbacks.onFrameUpdate?.({ index, total: this.frames.length, personCount: people.length });
    this.emitKeyframeState();
  }

  loadFromJSON(jsonText: string, sourceLabel?: string) {
    try {
      const payload: PosePayload = JSON.parse(jsonText);
      const parsedFrames = payload.frames || [];
      this.baseFrames = clonePoseFrames(parsedFrames);
      this.rigBaseFrames = clonePoseFrames(parsedFrames);
      this.frames = clonePoseFrames(parsedFrames);
      this.frameKeyframes.clear();
      this.rigKeyframes.clear();
      this.cameraKeyframes.clear();
      this.cameraLocked = false;
      this.lastVideoSyncFrame = -1;
      this.meta = payload.meta || {};
      this.effectiveFps = this.meta.effective_fps || this.meta.video_fps || 30;
      this.depthGain = 1;
      this.callbacks.onStatusChange?.(
        this.frames.length
          ? `Loaded ${this.frames.length} frames from ${this.meta.video || sourceLabel || 'JSON'}`
          : 'JSON file contains no frames.'
      );
      this.resetPlayback();
      if (this.editingState.enabled) {
        this.clearSelection();
      }
      if (this.frames.length) {
        this.setPlaying(true);
        this.showFrame(0);
      } else {
        this.setPlaying(false);
        this.emitKeyframeState();
        this.emitCameraKeyframeState();
        this.emitCameraSettings();
      }
    } catch (error) {
      console.error(error);
      this.callbacks.onStatusChange?.('Failed to parse JSON file.');
    }
  }

  exportJSON(): string {
    const payload: PosePayload = {
      meta: this.meta,
      frames: this.frames,
    };
    return JSON.stringify(payload, null, 2);
  }

  private resetPlayback() {
    this.playbackCursor = 0;
    this.displayedFrame = -1;
    this.callbacks.onFrameUpdate?.({ index: 0, total: this.frames.length, personCount: 0 });
  }

  seekFrame(index: number) {
    if (!this.frames.length) return;
    const clamped = Math.min(this.frames.length - 1, Math.max(0, index));
    const fps = this.effectiveFps || 30;
    const duration = this.frames.length / fps;
    this.playbackCursor = duration > 0 ? Math.min(duration, clamped / fps) : 0;
    this.setPlaying(false);
    this.showFrame(clamped);
  }

  togglePlayback() {
    this.setPlaying(!this.isPlaying);
    return this.isPlaying;
  }

  toggleReversePlayback() {
    this.playbackDirection = 'reverse';
    this.setPlaying(!this.isPlaying);
    return this.isPlaying;
  }

  setReversePlayback(reverse: boolean) {
    this.playbackDirection = reverse ? 'reverse' : 'forward';
  }

  private setPlaying(value: boolean) {
    if (this.isPlaying === value) return;
    this.isPlaying = value;
    this.callbacks.onPlaybackStateChange?.(this.isPlaying);
    this.updateCameraVideoPlayback();
  }

  async captureFrame(): Promise<Blob | null> {
    return new Promise((resolve) => {
      this.applyViewportForRender();
      this.renderer.render(this.scene, this.getActiveCamera());
      this.renderer.domElement.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });
  }

  async captureKijaiFrame(frameIndex = this.displayedFrame, width?: number, height?: number, stickWidth?: number): Promise<Blob | null> {
    const idx = frameIndex >= 0 ? frameIndex : this.displayedFrame;
    const frame = idx >= 0 ? this.frames[idx] : null;
    if (!frame) return null;
    const metaWidth = typeof this.meta?.width === 'number' && this.meta.width > 0 ? this.meta.width : null;
    const metaHeight = typeof this.meta?.height === 'number' && this.meta.height > 0 ? this.meta.height : null;
    const targetWidth = width || metaWidth || metaHeight || 1024;
    const targetHeight = height || metaHeight || metaWidth || targetWidth;
    const bodyStickWidth = stickWidth && stickWidth > 0 ? stickWidth : undefined;
    const handStickWidth = bodyStickWidth ? Math.max(1, bodyStickWidth * 0.65) : undefined;
    return renderKijaiPoseFrame(frame, {
      width: targetWidth,
      height: targetHeight,
      drawHands: true,
      drawHead: true,
      bodyStickWidth,
      handStickWidth,
    });
  }

  private collectJointEditsForFrame(frameIndex: number): JointEdit[] {
    const keys = this.frameKeyframes.get(frameIndex);
    if (!keys || !keys.size) return [];
    const edits: JointEdit[] = [];
    const baseFrame = this.baseFrames[frameIndex];
    const currentFrame = this.frames[frameIndex];
    if (!baseFrame || !currentFrame) return [];

    keys.forEach((key) => {
      if (key.startsWith('rig:')) return;
      const [personIndexStr, jointIndexStr] = key.split(':');
      const personIndex = parseInt(personIndexStr, 10);
      const jointIndex = parseInt(jointIndexStr, 10);
      const basePerson = baseFrame.people?.[personIndex];
      const currentPerson = currentFrame.people?.[personIndex];
      const basePoint = basePerson?.points?.[jointIndex];
      const editedPoint = currentPerson?.points?.[jointIndex];
      if (!basePoint || !editedPoint) return;
      edits.push({
        personIndex,
        jointIndex,
        base: new THREE.Vector3(basePoint[0], basePoint[1], basePoint[2]),
        edited: new THREE.Vector3(editedPoint[0], editedPoint[1], editedPoint[2]),
      });
    });

    return edits;
  }

  private computeTransformFromEdits(edits: JointEdit[]) {
    if (!edits.length) return null;
    const centroidBase = new THREE.Vector3();
    const centroidEdited = new THREE.Vector3();
    edits.forEach(({ base, edited }) => {
      centroidBase.add(base);
      centroidEdited.add(edited);
    });
    centroidBase.multiplyScalar(1 / edits.length);
    centroidEdited.multiplyScalar(1 / edits.length);

    const centeredBase: THREE.Vector3[] = [];
    const centeredEdited: THREE.Vector3[] = [];
    edits.forEach(({ base, edited }) => {
      centeredBase.push(base.clone().sub(centroidBase));
      centeredEdited.push(edited.clone().sub(centroidEdited));
    });

    let denom = 0;
    centeredBase.forEach((v) => {
      denom += v.lengthSq();
    });

    // Default to translation-only if points collapse.
    const rotation = new THREE.Quaternion();
    let scale = 1;
    if (denom < 1e-12) {
      return {
        rotation,
        scale,
        translation: centroidEdited.clone().sub(centroidBase),
      };
    }

    // Horn's method to get best-fit rotation without SVD.
    let Sxx = 0;
    let Sxy = 0;
    let Sxz = 0;
    let Syx = 0;
    let Syy = 0;
    let Syz = 0;
    let Szx = 0;
    let Szy = 0;
    let Szz = 0;
    for (let i = 0; i < centeredBase.length; i++) {
      const b = centeredBase[i];
      const e = centeredEdited[i];
      Sxx += b.x * e.x;
      Sxy += b.x * e.y;
      Sxz += b.x * e.z;
      Syx += b.y * e.x;
      Syy += b.y * e.y;
      Syz += b.y * e.z;
      Szx += b.z * e.x;
      Szy += b.z * e.y;
      Szz += b.z * e.z;
    }

    const n00 = Sxx + Syy + Szz;
    const n01 = Syz - Szy;
    const n02 = Szx - Sxz;
    const n03 = Sxy - Syx;
    const n11 = Sxx - Syy - Szz;
    const n12 = Sxy + Syx;
    const n13 = Szx + Sxz;
    const n22 = -Sxx + Syy - Szz;
    const n23 = Syz + Szy;
    const n33 = -Sxx - Syy + Szz;

    let q0 = 1;
    let q1 = 0;
    let q2 = 0;
    let q3 = 0;
    for (let i = 0; i < 30; i++) {
      const nq0 = n00 * q0 + n01 * q1 + n02 * q2 + n03 * q3;
      const nq1 = n01 * q0 + n11 * q1 + n12 * q2 + n13 * q3;
      const nq2 = n02 * q0 + n12 * q1 + n22 * q2 + n23 * q3;
      const nq3 = n03 * q0 + n13 * q1 + n23 * q2 + n33 * q3;
      const norm = Math.hypot(nq0, nq1, nq2, nq3);
      if (norm < 1e-12) break;
      const invNorm = 1 / norm;
      const nextQ0 = nq0 * invNorm;
      const nextQ1 = nq1 * invNorm;
      const nextQ2 = nq2 * invNorm;
      const nextQ3 = nq3 * invNorm;
      const dot = Math.abs(nextQ0 * q0 + nextQ1 * q1 + nextQ2 * q2 + nextQ3 * q3);
      q0 = nextQ0;
      q1 = nextQ1;
      q2 = nextQ2;
      q3 = nextQ3;
      if (1 - dot < 1e-7) break;
    }
    rotation.set(q1, q2, q3, q0).normalize();

    let numer = 0;
    for (let i = 0; i < centeredBase.length; i++) {
      const rotated = centeredBase[i].clone().applyQuaternion(rotation);
      numer += rotated.dot(centeredEdited[i]);
    }
    scale = numer / denom;

    return {
      rotation,
      scale,
      translation: centroidEdited.clone().sub(centroidBase),
    };
  }

  private computePivotForFrame(frameIndex: number, edits: JointEdit[]) {
    const frame = this.frames[frameIndex];
    if (!frame) return null;
    const pivot = new THREE.Vector3();
    let count = 0;
    edits.forEach(({ personIndex, jointIndex }) => {
      const person = frame.people?.[personIndex];
      const point = person?.points?.[jointIndex];
      if (!point) return;
      pivot.add(new THREE.Vector3(point[0], point[1], point[2]));
      count++;
    });
    if (!count) return null;
    pivot.multiplyScalar(1 / count);
    return pivot;
  }

  private applyTransformToFrame(frameIndex: number, edits: JointEdit[], transform: { rotation: THREE.Quaternion; scale: number; translation: THREE.Vector3 }) {
    const frame = this.frames[frameIndex];
    if (!frame) return;
    const pivot = this.computePivotForFrame(frameIndex, edits);
    if (!pivot) return;

    edits.forEach(({ personIndex, jointIndex }) => {
      const person = frame.people?.[personIndex];
      const point = person?.points?.[jointIndex];
      if (!person || !point) return;

      const current = new THREE.Vector3(point[0], point[1], point[2]);
      const relative = current.sub(pivot);
      relative.applyQuaternion(transform.rotation);
      relative.multiplyScalar(transform.scale);
      const result = relative.add(pivot).add(transform.translation);
      person.points[jointIndex] = [result.x, result.y, result.z];

      const key = makeJointKey(personIndex, jointIndex);
      let frameEntry = this.frameKeyframes.get(frameIndex);
      if (!frameEntry) {
        frameEntry = new Set<string>();
        this.frameKeyframes.set(frameIndex, frameEntry);
      }
      frameEntry.add(key);
    });
  }

  propagateCurrentFrameBackwards() {
    if (this.displayedFrame <= 0) return;
    const currentFrame = this.displayedFrame;
    const edits = this.collectJointEditsForFrame(currentFrame);
    if (!edits.length) return;
    const transform = this.computeTransformFromEdits(edits);
    if (!transform) return;

    for (let frameIndex = 0; frameIndex < currentFrame; frameIndex++) {
      this.applyTransformToFrame(frameIndex, edits, transform);
    }

    this.emitKeyframeState();
    // Refresh current frame display if needed
    if (this.displayedFrame === currentFrame) {
      this.showFrame(currentFrame);
    }
  }

  propagateCurrentFrameForwards() {
    if (this.displayedFrame < 0 || this.displayedFrame >= this.frames.length - 1) return;
    const currentFrame = this.displayedFrame;
    const edits = this.collectJointEditsForFrame(currentFrame);
    if (!edits.length) return;
    const transform = this.computeTransformFromEdits(edits);
    if (!transform) return;

    for (let frameIndex = currentFrame + 1; frameIndex < this.frames.length; frameIndex++) {
      this.applyTransformToFrame(frameIndex, edits, transform);
    }

    this.emitKeyframeState();
    // Refresh current frame display if needed
    if (this.displayedFrame === currentFrame) {
      this.showFrame(currentFrame);
    }
  }
}
