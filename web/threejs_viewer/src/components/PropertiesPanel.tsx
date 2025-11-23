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
}: PropertiesPanelProps) {
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
