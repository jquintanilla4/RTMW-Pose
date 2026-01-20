import { useRef } from 'react'
import type { CameraLensPreset } from '../viewer/PoseViewer'
import type { AspectRatioOption } from './AspectRatioOverlay'

interface PropertiesPanelProps {
    selectionInfo: string
    hasSelection: boolean
    onClearSelection: () => void
    onAddKeyframe: () => void
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
    cameraVideoScale: number
    cameraHasVideo: boolean
    cameraVideoLabel?: string
    cameraVideoSync: boolean
    onCameraVideoScaleChange: (val: number) => void
    onCameraVideoSyncChange: (enabled: boolean) => void
    onCameraVideoUpload: (file: File) => void
    onClearCameraVideo: () => void
    aspectRatioGuide: AspectRatioOption
    onAspectRatioGuideChange: (val: AspectRatioOption) => void
    customAspectRatio?: number | null
    showRuleOfThirds: boolean
    onToggleRuleOfThirds: () => void
}

export function PropertiesPanel({
    selectionInfo,
    hasSelection,
    onClearSelection,
    onAddKeyframe,
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
    cameraVideoScale,
    cameraHasVideo,
    cameraVideoLabel,
    cameraVideoSync,
    onCameraVideoScaleChange,
    onCameraVideoSyncChange,
    onCameraVideoUpload,
    onClearCameraVideo,
    aspectRatioGuide,
    onAspectRatioGuideChange,
    customAspectRatio,
    showRuleOfThirds,
    onToggleRuleOfThirds,
}: PropertiesPanelProps) {
    const lensOptions: CameraLensPreset[] = ['18mm', '24mm', '35mm', '50mm', '85mm', 'custom']
    const aspectOptions: { value: AspectRatioOption; label: string; disabled?: boolean }[] = [
        { value: '16:9', label: '16:9' },
        { value: '1:1', label: '1:1' },
        { value: '4:3', label: '4:3' },
        { value: '9:16', label: '9:16' },
        { value: '3:4', label: '3:4' },
        { value: '2:1', label: '2:1' },
        { value: 'custom', label: customAspectRatio ? `Match Video (${customAspectRatio.toFixed(2)}:1)` : 'Match Video', disabled: !customAspectRatio },
        { value: 'none', label: 'Off' },
    ]
    const videoInputRef = useRef<HTMLInputElement | null>(null)

    return (
        <div className="side-panel">
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

                        <div className="button-row button-row-plain" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button
                                onClick={onClearSelection}
                                disabled={!hasSelection}
                                style={{ flex: 1 }}
                            >
                                Clear Select
                            </button>
                            <button
                                onClick={onAddKeyframe}
                                disabled={!hasSelection}
                                style={{ flex: 1 }}
                            >
                                Add Keyframe
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

            <div className="panel-section">
                <h4>Scene Settings</h4>
                <div className="control-group control-group-plain">
                    <label className="control-label-large">
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
                <div className="control-group control-group-plain">
                    <label className="control-label-large">
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
                <h4>Camera Settings</h4>
                <div className="control-group control-group-plain" style={{ display: 'grid', gap: 10 }}>
                    <label className="control-label-large">
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
                    <label className="control-label-large">
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

                <div className="control-group">
                    <div className="subsection-title">Camera Animation</div>
                    <div className="button-row button-row-plain" style={{ display: 'flex', gap: 8 }}>
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

                    <div className="button-row button-row-plain" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
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
                </div>

                <div className="control-group video-background" style={{ marginTop: 12 }}>
                    <div className="subsection-title">Video Background</div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                        <button
                            onClick={() => videoInputRef.current?.click()}
                            style={{ flex: 1 }}
                        >
                            {cameraHasVideo ? 'Replace Reference Video' : 'Upload Reference Video'}
                        </button>
                        <button
                            onClick={onClearCameraVideo}
                            disabled={!cameraHasVideo}
                            style={{ whiteSpace: 'nowrap' }}
                        >
                            Remove
                        </button>
                    </div>
                    <div style={{ marginBottom: 8, fontSize: 12, color: '#aaa' }}>
                        {cameraHasVideo ? (cameraVideoLabel || 'Video attached to camera') : 'Attach a rectilinear video to the camera for alignment.'}
                    </div>
                    <label>
                        Video Scale: {cameraVideoScale.toFixed(2)}x
                        <input
                            type="range"
                            min="0.25"
                            max="4"
                            step="0.01"
                            value={cameraVideoScale}
                            onChange={(e) => onCameraVideoScaleChange(Number(e.target.value))}
                            disabled={!cameraHasVideo}
                            style={{ width: '100%' }}
                        />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <input
                            type="checkbox"
                            checked={cameraVideoSync}
                            onChange={(e) => onCameraVideoSyncChange(e.target.checked)}
                            disabled={!cameraHasVideo}
                        />
                        Sync video to timeline playback
                    </label>
                    <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                                onCameraVideoUpload(file)
                            }
                            if (e.target) {
                                e.target.value = ''
                            }
                        }}
                    />
                </div>

                <div className="control-group guides-group" style={{ marginTop: 12 }}>
                    <div className="subsection-title">Guides</div>
                    <label>
                        Aspect Ratio
                        <select
                            value={aspectRatioGuide}
                            onChange={(e) => onAspectRatioGuideChange(e.target.value as AspectRatioOption)}
                            style={{ width: '100%', marginTop: 4 }}
                        >
                            {aspectOptions.map(option => (
                                <option key={option.value} value={option.value} disabled={option.disabled}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="guides-checkbox">
                        <input
                            type="checkbox"
                            checked={showRuleOfThirds}
                            onChange={onToggleRuleOfThirds}
                        />
                        Show rule of thirds grid
                    </label>
                </div>
            </div>
        </div>
    )
}
