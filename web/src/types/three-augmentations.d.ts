import * as THREE from 'three'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'

declare module 'three/examples/jsm/controls/TransformControls.js' {
  interface TransformControls extends THREE.Object3D<THREE.Object3DEventMap> {}
}
