import type { CameraLensPreset } from '../viewer/PoseViewer'
import type { AspectRatioOption } from './AspectRatioOverlay'

interface PropertiesPanelProps {
    selectionInfo: string
    hasSelection: boolean
    onClearSelection: () => void
    onResetFrame: () => void
    canResetFrame: boolean
    depthGain: number
    onDepthGainChange: (val: number) => void
    speed: number
    onSpeedChange: (val: number) => void
    editingEnabled: boolean
    onToggleEditing: () => void
    cameraFov: number
    cameraLens: CameraLensPreset
    onCameraFovChange: (val: number) => void
    onCameraLensChange: (lens: CameraLensPreset) => void
    onCameraSyncFromViewport: () => void
    onAddCameraKeyframe: () => void
    onClearCameraKeyframe: () => void
    currentFrameHasCameraKeyframe?: boolean
    cameraLocked: boolean
    onCameraLockToggle: () => void
    aspectRatioGuide: AspectRatioOption
    onAspectRatioGuideChange: (val: AspectRatioOption) => void
    showRuleOfThirds: boolean
    onToggleRuleOfThirds: () => void
}

export function PropertiesPanel({
    selectionInfo,
    hasSelection,
    onClearSelection,
    onResetFrame,
    canResetFrame,
    depthGain,
    onDepthGainChange,
    speed,
    onSpeedChange,
    editingEnabled,
    onToggleEditing,
    cameraFov,
    cameraLens,
    onCameraFovChange,
    onCameraLensChange,
    onCameraSyncFromViewport,
    onAddCameraKeyframe,
    onClearCameraKeyframe,
    currentFrameHasCameraKeyframe = false,
    cameraLocked,
    onCameraLockToggle,
    aspectRatioGuide,
    onAspectRatioGuideChange,
    showRuleOfThirds,
    onToggleRuleOfThirds,
}: PropertiesPanelProps) {
    const lensOptions: CameraLensPreset[] = ['18mm', '24mm', '35mm', '50mm', '85mm', 'custom']
    const aspectOptions: AspectRatioOption[] = ['16:9', '1:1', '4:3', '9:16', '3:4', '2:1', 'none']

    return (
        <div className="side-panel">
            <h3>Properties</h3>

            <div className="panel-section">
                <h4>Scene Settings</h4>
                <div className="control-group">
                    <label>
                        Playback Speed: {speed}x
                        <input
                            type="range"
                            min="0.25"
                            max="3"
                            step="0.25"
                            value={speed}
                            onChange={(e) => onSpeedChange(Number(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    </label>
                </div>
                <div className="control-group">
                    <label>
                        Depth Gain: {depthGain.toFixed(1)}
                        <input
                            type="range"
                            min="0.2"
                            max="5"
                            step="0.1"
                            value={depthGain}
                            onChange={(e) => onDepthGainChange(Number(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    </label>
                </div>
            </div>

            <div className="panel-section">
                <h4>Camera</h4>
                <div className="control-group" style={{ display: 'flex', gap: 8 }}>
                    <label style={{ flex: 1 }}>
                        Lens Type
                        <select
                            value={cameraLens}
                            onChange={(e) => onCameraLensChange(e.target.value as CameraLensPreset)}
                            disabled={cameraLocked}
                            style={{ width: '100%', marginTop: 4 }}
                        >
                            {lensOptions.map((lens) => (
                                <option key={lens} value={lens}>
                                    {lens === 'custom' ? 'Custom' : lens}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label style={{ flex: 1 }}>
                        FOV: {cameraFov.toFixed(0)}°
                        <input
                            type="range"
                            min={20}
                            max={110}
                            step={1}
                            value={cameraFov}
                            onChange={(e) => onCameraFovChange(Number(e.target.value))}
                            disabled={cameraLocked}
                            style={{ width: '100%' }}
                        />
                    </label>
                </div>

                <div className="button-row" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                        onClick={onCameraSyncFromViewport}
                        disabled={cameraLocked}
                        title="Copy what you see in the viewport into the camera view"
                        style={{ flex: 1 }}
                    >
                        Set From Viewport
                    </button>
                    <button
                        onClick={onCameraLockToggle}
                        className={cameraLocked ? 'active' : ''}
                        style={{ flex: 1 }}
                    >
                        {cameraLocked ? 'Camera Locked' : 'Lock Camera'}
                    </button>
                </div>

                <div className="button-row" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={onAddCameraKeyframe} style={{ flex: 1 }}>
                        Keyframe Camera
                    </button>
                    <button
                        onClick={onClearCameraKeyframe}
                        disabled={!currentFrameHasCameraKeyframe}
                        style={{ flex: 1 }}
                    >
                        Clear Camera Key
                    </button>
                </div>

                <div className="control-group" style={{ marginTop: 12 }}>
                    <label>
                        Aspect Guides
                        <select
                            value={aspectRatioGuide}
                            onChange={(e) => onAspectRatioGuideChange(e.target.value as AspectRatioOption)}
                            style={{ width: '100%', marginTop: 4 }}
                        >
                            {aspectOptions.map(option => (
                                <option key={option} value={option}>
                                    {option === 'none' ? 'Off' : option}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <input
                            type="checkbox"
                            checked={showRuleOfThirds}
                            onChange={onToggleRuleOfThirds}
                        />
                        Show rule of thirds grid
                    </label>
                </div>
            </div>

            <div className="panel-section">
                <h4>Editing</h4>
                <button
                    onClick={onToggleEditing}
                    style={{ width: '100%', marginBottom: 12 }}
                    className={editingEnabled ? 'active' : ''}
                >
                    {editingEnabled ? 'Stop Editing' : 'Start Editing'}
                </button>

                {editingEnabled && (
                    <>
                        <div className="info-box">
                            {selectionInfo}
                        </div>

                        <div className="button-row" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button
                                onClick={onClearSelection}
                                disabled={!hasSelection}
                                style={{ flex: 1 }}
                            >
                                Clear Select
                            </button>
                            <button
                                onClick={onResetFrame}
                                disabled={!canResetFrame}
                                style={{ flex: 1 }}
                            >
                                Reset Frame
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
