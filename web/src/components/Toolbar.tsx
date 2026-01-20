import { MoveIcon, RotateIcon, ScaleIcon } from './Icons'
import type { TransformMode } from '../viewer/PoseViewer'

interface ToolbarProps {
    activeMode: TransformMode
    onModeChange: (mode: TransformMode) => void
    enabled: boolean
    scaleDisabled?: boolean
}

export function Toolbar({ activeMode, onModeChange, enabled, scaleDisabled = false }: ToolbarProps) {
    if (!enabled) return null

    return (
        <div className="overlay-controls">
            <button
                className={`tool-btn ${activeMode === 'translate' ? 'active' : ''}`}
                onClick={() => onModeChange('translate')}
                title="Move (W)"
            >
                <span className="hover-label">Move</span>
                <MoveIcon />
            </button>
            <button
                className={`tool-btn ${activeMode === 'rotate' ? 'active' : ''}`}
                onClick={() => onModeChange('rotate')}
                title="Rotate (R)"
            >
                <span className="hover-label">Rotate</span>
                <RotateIcon />
            </button>
            <button
                className={`tool-btn ${activeMode === 'scale' ? 'active' : ''}`}
                onClick={() => onModeChange('scale')}
                title="Scale (S)"
                disabled={scaleDisabled}
            >
                <span className="hover-label">Scale</span>
                <ScaleIcon />
            </button>
        </div>
    )
}
