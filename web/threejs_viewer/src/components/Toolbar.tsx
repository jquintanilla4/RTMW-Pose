import { MoveIcon, RotateIcon, ScaleIcon } from './Icons'
import type { TransformMode } from '../viewer/PoseViewer'

interface ToolbarProps {
    activeMode: TransformMode
    onModeChange: (mode: TransformMode) => void
    enabled: boolean
}

export function Toolbar({ activeMode, onModeChange, enabled }: ToolbarProps) {
    if (!enabled) return null

    return (
        <div className="overlay-controls">
            <button
                className={`tool-btn ${activeMode === 'translate' ? 'active' : ''}`}
                onClick={() => onModeChange('translate')}
                title="Move (W)"
            >
                <MoveIcon />
            </button>
            <button
                className={`tool-btn ${activeMode === 'rotate' ? 'active' : ''}`}
                onClick={() => onModeChange('rotate')}
                title="Rotate (E)"
            >
                <RotateIcon />
            </button>
            <button
                className={`tool-btn ${activeMode === 'scale' ? 'active' : ''}`}
                onClick={() => onModeChange('scale')}
                title="Scale (R)"
            >
                <ScaleIcon />
            </button>
        </div>
    )
}
