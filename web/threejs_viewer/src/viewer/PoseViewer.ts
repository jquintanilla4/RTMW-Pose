import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

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

const EDGE_PAIRS: Array<[number, number]> = [];
const EDGE_COLOR_PER_EDGE: Array<[number, number, number]> = [];




export type TransformMode = 'translate' | 'rotate' | 'scale';

type PosePoint = [number, number, number];

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
}

export interface PoseViewerOptions {
  container: HTMLDivElement;
  callbacks?: PoseViewerCallbacks;
}

type JointHandle = THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> & {
  userData: {
    baseColor: THREE.Color;
    jointIndex: number;
    personIndex: number;
    isSelected: boolean;
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
  personIndex: number;
}

interface TransformSessionEntry {
  handle: JointHandle;
  personIndex: number;
  jointIndex: number;
  startPosition: THREE.Vector3;
}

interface TransformSession {
  startMatrix: THREE.Matrix4;
  inverseStartMatrix: THREE.Matrix4;
  handles: TransformSessionEntry[];
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
  private camera: THREE.PerspectiveCamera;
  private orbitTarget = new THREE.Vector3(0, 0.1, 0);
  private orbitState = { theta: Math.PI, phi: 1.0, radius: 2.6 };
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
  private editingState = {
    enabled: false,
    selectedHandles: [] as JointHandle[],
    transformSession: null as TransformSession | null,
    transformDragging: false,
    selectionProxy: new THREE.Object3D(),
  };
  private transformControls: TransformControls;
  private selectionPointerState = {
    pointerId: null as number | null,
    startX: 0,
    startY: 0,
    moved: false,
    suppressClick: false,
  };
  private frames: PoseFrame[] = [];
  private baseFrames: PoseFrame[] = [];
  private frameKeyframes = new Map<number, Set<string>>();
  private effectiveFps = 30;
  private isPlaying = false;
  private playbackCursor = 0;
  private lastFrameTime = performance.now();
  private displayedFrame = -1;
  private animationHandle = 0;
  private depthGain = 1;
  private speedMultiplier = 1;

  constructor(options: PoseViewerOptions) {
    this.container = options.container;
    this.callbacks = options.callbacks ?? {};

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0.03, 0.03, 0.03);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    this.updateOrbitCamera();


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

    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.visible = false;
    this.transformControls.setSize(1.0);
    this.scene.add(this.transformControls.getHelper());

    this.transformControls.addEventListener('dragging-changed', (event) => {
      const value = (event as { value?: unknown }).value;
      this.editingState.transformDragging = Boolean(value);
    });
    this.transformControls.addEventListener('mouseDown', () => {
      if (this.editingState.enabled && this.editingState.selectedHandles.length) {
        this.beginTransformSession();
      }
    });
    this.transformControls.addEventListener('objectChange', () => {
      if (this.editingState.transformSession) {
        this.applyTransformSession();
      }
    });
    this.transformControls.addEventListener('mouseUp', () => {
      if (this.editingState.transformSession) {
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

    this.animate();
  }

  dispose() {
    cancelAnimationFrame(this.animationHandle);

    this.resizeObserver.disconnect();
    window.removeEventListener('resize', this.handleWindowResize);
    window.removeEventListener('resize', this.handleWindowResize);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.handleSelectionPointerDown);
    canvas.removeEventListener('pointermove', this.handleSelectionPointerMove);
    canvas.removeEventListener('pointerup', this.handleSelectionPointerUp);
    this.transformControls.dispose();
    this.renderer.dispose();
    this.container.removeChild(canvas);
  }

  private handleWindowResize = () => {
    this.resizeRenderer();
  };

  private resizeRenderer() {
    const width = this.container.clientWidth || this.container.offsetWidth || 640;
    const height = Math.max(200, (window.innerHeight || 720) - 70);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }



  private updateOrbitCamera() {
    const minPhi = 0.05;
    const maxPhi = Math.PI - 0.05;
    this.orbitState.phi = Math.min(maxPhi, Math.max(minPhi, this.orbitState.phi));
    this.orbitState.radius = Math.min(10, Math.max(0.4, this.orbitState.radius));
    const sinPhi = Math.sin(this.orbitState.phi);
    this.camera.position.set(
      this.orbitTarget.x + this.orbitState.radius * sinPhi * Math.sin(this.orbitState.theta),
      this.orbitTarget.y + this.orbitState.radius * Math.cos(this.orbitState.phi),
      this.orbitTarget.z + this.orbitState.radius * sinPhi * Math.cos(this.orbitState.theta)
    );
    this.camera.lookAt(this.orbitTarget);
  }

  private setupOrbitInput() {
    const canvas = this.renderer.domElement;
    const orbitPointer = { pointerId: null as number | null, lastX: 0, lastY: 0, active: false };

    canvas.addEventListener('pointerdown', (event: PointerEvent) => {
      if (event.button !== 0) return;
      orbitPointer.pointerId = event.pointerId;
      orbitPointer.lastX = event.clientX;
      orbitPointer.lastY = event.clientY;
      orbitPointer.active = !this.editingState.enabled;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event: PointerEvent) => {
      if (orbitPointer.pointerId !== event.pointerId) return;
      if (this.editingState.transformDragging) return;
      const dx = event.clientX - orbitPointer.lastX;
      const dy = event.clientY - orbitPointer.lastY;
      if (!orbitPointer.active) {
        const threshold = 4;
        if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
          return;
        }
        orbitPointer.active = true;
      }
      orbitPointer.lastX = event.clientX;
      orbitPointer.lastY = event.clientY;
      this.orbitState.theta -= dx * 0.005;
      this.orbitState.phi -= dy * 0.005;
      this.updateOrbitCamera();
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
    canvas.addEventListener(
      'wheel',
      (event: WheelEvent) => {
        event.preventDefault();
        const delta = event.deltaY > 0 ? 1.05 : 0.95;
        this.orbitState.radius *= delta;
        this.updateOrbitCamera();
      },
      { passive: false }
    );
  }

  private setupSelectionInput() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.handleSelectionPointerDown);
    canvas.addEventListener('pointermove', this.handleSelectionPointerMove);
    canvas.addEventListener('pointerup', this.handleSelectionPointerUp);
  }

  private handleSelectionPointerDown = (event: PointerEvent) => {
    if (!this.editingState.enabled || event.button !== 0) return;
    console.log('handleSelectionPointerDown', event.clientX, event.clientY);
    if (this.selectionPointerState.suppressClick) return;
    this.selectionPointerState.pointerId = event.pointerId;
    this.selectionPointerState.startX = event.clientX;
    this.selectionPointerState.startY = event.clientY;
    this.selectionPointerState.moved = false;
  };

  private handleSelectionPointerMove = (event: PointerEvent) => {
    if (!this.editingState.enabled) return;
    if (this.selectionPointerState.suppressClick) return;
    if (this.selectionPointerState.pointerId !== event.pointerId) return;
    if (this.selectionPointerState.moved) return;
    const dx = event.clientX - this.selectionPointerState.startX;
    const dy = event.clientY - this.selectionPointerState.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      this.selectionPointerState.moved = true;
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
    this.selectionPointerState.pointerId = null;
    this.selectionPointerState.moved = false;
    if (this.editingState.transformDragging) return;
    if (!moved) {
      const hit = this.selectJointAtEvent(event);
      if (!hit && !event.shiftKey && !event.metaKey) {
        // Only clear if not dragging transform
        if (!this.editingState.transformDragging) {
          this.clearSelection();
        }
      }
    }
  };













  private animate = () => {
    this.animationHandle = requestAnimationFrame(this.animate);
    const now = performance.now();
    const delta = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    if (this.isPlaying && this.frames.length > 0 && this.effectiveFps > 0) {
      const duration = this.frames.length / this.effectiveFps;
      if (duration > 0) {
        this.playbackCursor = (this.playbackCursor + delta * this.speedMultiplier) % duration;
        const idx = Math.min(this.frames.length - 1, Math.floor(this.playbackCursor * this.effectiveFps));
        if (idx !== this.displayedFrame) {
          this.showFrame(idx);
        }
      }
    }
    this.scene.add(this.transformControls.getHelper());
    this.renderer.render(this.scene, this.camera);
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
        const mesh = new THREE.Mesh(JOINT_HANDLE_GEOMETRY, new THREE.MeshBasicMaterial({ color: baseColor }));
        mesh.visible = false;
        mesh.userData = {
          baseColor,
          jointIndex: i,
          personIndex,
          isSelected: false,
        };
        group.add(mesh);
        jointHandles.push(mesh as JointHandle);
      }

      this.peopleObjects.push({
        group,
        lines,
        lineGeom,
        linePositions,
        points,
        pointGeom,
        pointPositions,
        jointHandles,
        personIndex,
      });
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
  }

  private updateJointHandleVisibility() {
    this.peopleObjects.forEach((obj) => {
      const shouldShow = this.editingState.enabled && obj.group.visible;
      obj.jointHandles.forEach((handle) => {
        handle.visible = shouldShow;
      });
    });
  }

  private hideUnused(activeCount: number) {
    for (let i = activeCount; i < this.peopleObjects.length; i++) {
      const obj = this.peopleObjects[i];
      obj.group.visible = false;
      obj.jointHandles.forEach((h) => (h.visible = false));
    }
  }

  private setHandleSelected(handle: JointHandle, selected: boolean) {
    if (!handle || handle.userData.isSelected === selected) return;
    handle.userData.isSelected = selected;
    if (selected) {
      console.log('setHandleSelected', handle.userData.jointIndex, selected);
      handle.material.color.copy(SELECTED_HANDLE_COLOR);
    } else {
      handle.material.color.copy(handle.userData.baseColor);
    }
    handle.scale.setScalar(selected ? HANDLE_SELECTED_SCALE : HANDLE_DEFAULT_SCALE);
  }

  clearSelection() {

    if (this.editingState.selectedHandles.length) {
      this.editingState.selectedHandles.forEach((handle) => this.setHandleSelected(handle, false));
    }
    this.editingState.selectedHandles = [];
    this.editingState.transformSession = null;
    this.editingState.selectionProxy.visible = false;
    this.transformControls.visible = false;
    this.transformControls.enabled = false;
    this.transformControls.detach();
    this.updateSelectionInfo();
  }

  private updateSelectionInfo() {
    if (!this.callbacks.onSelectionInfoChange) return;
    if (!this.editingState.enabled) {
      this.callbacks.onSelectionInfoChange({ text: 'Editing disabled.', hasSelection: false });
      return;
    }
    if (!this.editingState.selectedHandles.length) {
      this.callbacks.onSelectionInfoChange({
        text: 'Click joints to select. Shift-click to add/remove.',
        hasSelection: false,
      });
    } else {
      this.callbacks.onSelectionInfoChange({
        text: `${this.editingState.selectedHandles.length} joint(s) selected`,
        hasSelection: true,
      });
    }
  }



  private refreshSelectionProxyFromHandles() {
    if (!this.editingState.selectedHandles.length) {
      console.log('refreshSelectionProxyFromHandles: no selection');
      this.editingState.selectionProxy.visible = false;
      this.transformControls.visible = false;
      this.transformControls.detach();
      return;
    }
    const centroid = new THREE.Vector3();
    this.editingState.selectedHandles.forEach((handle) => centroid.add(handle.position));
    centroid.multiplyScalar(1 / this.editingState.selectedHandles.length);
    this.editingState.selectionProxy.position.copy(centroid);
    this.editingState.selectionProxy.quaternion.identity();
    this.editingState.selectionProxy.scale.set(1, 1, 1);
    this.editingState.selectionProxy.visible = true;
    this.transformControls.visible = true;
    this.transformControls.enabled = true;
    this.transformControls.attach(this.editingState.selectionProxy);
    console.log('refreshSelectionProxyFromHandles: attached', this.editingState.selectionProxy.position);
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
    const session: TransformSession = {
      startMatrix,
      inverseStartMatrix: new THREE.Matrix4().copy(startMatrix).invert(),
      handles: this.editingState.selectedHandles.map((handle) => ({
        handle,
        personIndex: handle.userData.personIndex,
        jointIndex: handle.userData.jointIndex,
        startPosition: handle.position.clone(),
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
      this.updateHandlePosition(entry.handle, this.tempVector3, entry.personIndex, entry.jointIndex);
    });
  }

  private finalizeTransformSession(session: TransformSession | null) {
    if (!session) return;
    const frameIndex = this.displayedFrame;
    if (frameIndex < 0) return;
    let changed = false;
    session.handles.forEach((entry) => {
      const { startPosition, handle, personIndex, jointIndex } = entry;
      if (personIndex < 0 || jointIndex < 0) return;
      if (startPosition.distanceToSquared(handle.position) < POSITION_EPSILON_SQ) return;
      if (this.syncKeyframeForJoint(frameIndex, personIndex, jointIndex, handle.position)) {
        changed = true;
      }
    });
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

  private updateHandlePosition(handle: JointHandle, vec: THREE.Vector3, personIndex: number, jointIndex: number) {
    handle.position.copy(vec);
    this.commitJointPosition(personIndex, jointIndex, vec);
  }

  private commitJointPosition(personIndex: number, jointIndex: number, displayVec: THREE.Vector3) {
    if (!this.frames.length || this.displayedFrame < 0) return;
    const frame = this.frames[this.displayedFrame];
    if (!frame || !Array.isArray(frame.people)) return;
    const person = frame.people[personIndex];
    if (!person || !Array.isArray(person.points)) return;
    const point = person.points[jointIndex];
    if (!Array.isArray(point) || point.length < 3) return;
    point[0] = displayVec.x;
    point[1] = displayVec.y;
    point[2] = this.depthGain !== 0 ? displayVec.z / this.depthGain : displayVec.z;
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
      this.clearSelection();
    } else {
      if (this.isPlaying) {
        this.setPlaying(false);
      }
    }
    this.updateJointHandleVisibility();
    this.updateSelectionInfo();
    if (this.editingState.enabled) {
      if (this.editingState.selectedHandles.length > 0) {
        this.transformControls.visible = true;
        this.transformControls.enabled = true;
      }
    } else {
      this.transformControls.visible = false;
      this.transformControls.enabled = false;
    }
  }

  setTransformMode(mode: TransformMode) {
    this.transformControls.setMode(mode);
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
    this.frameKeyframes.delete(target);
    if (this.displayedFrame === target) {
      this.showFrame(target);
    } else {
      this.emitKeyframeState();
    }
  }

  private prepareRayFromEvent(event: PointerEvent | MouseEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
  }

  private selectJointAtEvent(event: PointerEvent) {
    this.prepareRayFromEvent(event);
    const visibleHandles: JointHandle[] = [];
    this.peopleObjects.forEach((obj) => {
      if (!obj.group.visible) return;
      obj.jointHandles.forEach((handle) => {
        if (handle.visible) visibleHandles.push(handle);
      });
    });
    if (!visibleHandles.length) return false;
    const intersections = this.raycaster.intersectObjects(visibleHandles, false);
    if (!intersections.length) return false;
    const targetHandle = intersections[0].object as JointHandle;
    const additive = event.shiftKey || event.metaKey;
    this.applyHandleSelection(targetHandle, additive);
    return true;
  }

  private applyHandleSelection(handle: JointHandle, additive: boolean) {
    if (!handle) return;
    if (!additive) {
      this.editingState.selectedHandles.forEach((selected) => {
        if (selected !== handle) this.setHandleSelected(selected, false);
      });
      this.editingState.selectedHandles = [];
    }
    const existingIndex = this.editingState.selectedHandles.indexOf(handle);
    if (existingIndex >= 0) {
      if (additive) {
        this.setHandleSelected(handle, false);
        this.editingState.selectedHandles.splice(existingIndex, 1);
      }
    } else {
      this.setHandleSelected(handle, true);
      this.editingState.selectedHandles.push(handle);
    }
    this.refreshSelectionProxyFromHandles();
    this.updateSelectionInfo();
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
    this.callbacks.onFrameUpdate?.({ index, total: this.frames.length, personCount: people.length });
    this.displayedFrame = index;
    this.emitKeyframeState();
  }

  loadFromJSON(jsonText: string, sourceLabel?: string) {
    try {
      const payload: PosePayload = JSON.parse(jsonText);
      const parsedFrames = payload.frames || [];
      this.baseFrames = clonePoseFrames(parsedFrames);
      this.frames = clonePoseFrames(parsedFrames);
      this.frameKeyframes.clear();
      const meta = payload.meta || {};
      this.effectiveFps = meta.effective_fps || meta.video_fps || 30;
      this.depthGain = 1;
      this.callbacks.onStatusChange?.(
        this.frames.length
          ? `Loaded ${this.frames.length} frames from ${meta.video || sourceLabel || 'JSON'}`
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
      }
    } catch (error) {
      console.error(error);
      this.callbacks.onStatusChange?.('Failed to parse JSON file.');
    }
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

  private setPlaying(value: boolean) {
    if (this.isPlaying === value) return;
    this.isPlaying = value;
    this.callbacks.onPlaybackStateChange?.(this.isPlaying);
  }

  async captureFrame(): Promise<Blob | null> {
    return new Promise((resolve) => {
      this.renderer.render(this.scene, this.camera);
      this.renderer.domElement.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });
  }
}
