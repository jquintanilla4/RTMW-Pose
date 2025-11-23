import { PlayIcon, PauseIcon, SkipNextIcon, SkipPrevIcon, PlayBackwardIcon } from './Icons'

interface TimelineProps {
    currentFrame: number
    totalFrames: number
    isPlaying: boolean
    onPlayPause: () => void
    onPlayBackward?: () => void
    onSeek: (frame: number) => void
    keyframes: number[]
    onPropagateBackwards?: () => void
    onPropagateForwards?: () => void
    currentFrameHasKeyframe?: boolean
}

export function Timeline({
    currentFrame,
    totalFrames,
    isPlaying,
    onPlayPause,
    onPlayBackward,
    onSeek,
    keyframes,
    onPropagateBackwards,
    onPropagateForwards,
    currentFrameHasKeyframe = false,
}: TimelineProps) {
    const maxFrame = Math.max(0, totalFrames - 1)
    const progress = maxFrame > 0 ? (currentFrame / maxFrame) * 100 : 0
    const frameMarkers = maxFrame > 0 ? Array.from({ length: totalFrames }, (_, i) => i) : []

    return (
        <div className="bottom-panel">
            <div className="timeline-controls" style={{
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-color)'
            }}>
                {/* Left: Playback controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button className="icon-btn" onClick={() => onSeek(Math.max(0, currentFrame - 1))}>
                        <SkipPrevIcon />
                    </button>
                    <button className="icon-btn" onClick={onPlayBackward} title="Play backward (J)">
                        <PlayBackwardIcon />
                    </button>
                    <button className="icon-btn" onClick={onPlayPause}>
                        {isPlaying ? <PauseIcon /> : <PlayIcon />}
                    </button>
                    <button className="icon-btn" onClick={() => onSeek(Math.min(maxFrame, currentFrame + 1))}>
                        <SkipNextIcon />
                    </button>
                </div>

                {/* Center: Propagation buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                        className="icon-btn"
                        onClick={onPropagateBackwards}
                        disabled={!currentFrameHasKeyframe || currentFrame === 0}
                        title="Propagate edits to all previous frames"
                        style={{ fontSize: '0.85em', padding: '4px 8px' }}
                    >
                        ← Propagate Back
                    </button>
                    <button
                        className="icon-btn"
                        onClick={onPropagateForwards}
                        disabled={!currentFrameHasKeyframe || currentFrame >= maxFrame}
                        title="Propagate edits to all following frames"
                        style={{ fontSize: '0.85em', padding: '4px 8px' }}
                    >
                        Propagate Forward →
                    </button>
                </div>

                {/* Right: Time display */}
                <div className="time-display" style={{ fontFamily: 'monospace', fontSize: '1.1em', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                        type="number"
                        value={currentFrame}
                        onChange={(e) => {
                            const value = parseInt(e.target.value, 10)
                            if (!isNaN(value)) {
                                onSeek(Math.max(0, Math.min(maxFrame, value)))
                            }
                        }}
                        onFocus={(e) => e.target.select()}
                        style={{
                            width: '50px',
                            fontFamily: 'monospace',
                            fontSize: '1.1em',
                            textAlign: 'right',
                            background: 'transparent',
                            border: '1px solid transparent',
                            color: 'inherit',
                            padding: '2px 4px',
                            borderRadius: '2px',
                            outline: 'none'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
                        onMouseLeave={(e) => {
                            if (document.activeElement !== e.currentTarget) {
                                e.currentTarget.style.borderColor = 'transparent'
                            }
                        }}
                        onBlur={(e) => {
                            e.currentTarget.style.borderColor = 'transparent'
                        }}
                    />
                    <span style={{ color: '#666' }}>/ {maxFrame}</span>
                </div>
            </div>

            <div className="timeline-track-container" style={{
                flex: 1,
                position: 'relative',
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center'
            }}>
                <div className="timeline-track" style={{
                    position: 'relative',
                    width: '100%',
                    height: 32,
                    backgroundColor: 'var(--timeline-bg)',
                    borderRadius: 4,
                    overflow: 'hidden'
                }}>
                    {/* Per-frame markers */}
                    {frameMarkers.map(frame => (
                        <div
                            key={`frame-${frame}`}
                            style={{
                                position: 'absolute',
                                left: `${(frame / maxFrame) * 100}%`,
                                top: 4,
                                width: 1,
                                height: 24,
                                backgroundColor: 'var(--frame-marker-color)',
                                opacity: 0.5,
                                transform: 'translateX(-50%)',
                                pointerEvents: 'none'
                            }}
                        />
                    ))}

                    {/* Keyframe markers */}
                    {keyframes.map(frame => (
                        <div
                            key={frame}
                            style={{
                                position: 'absolute',
                                left: `${(frame / maxFrame) * 100}%`,
                                top: 8,
                                width: 4,
                                height: 16,
                                backgroundColor: 'var(--keyframe-color)',
                                transform: 'translateX(-50%)',
                                pointerEvents: 'none'
                            }}
                        />
                    ))}

                    {/* Playhead */}
                    <div
                        style={{
                            position: 'absolute',
                            left: `${progress}%`,
                            top: 0,
                            bottom: 0,
                            width: 2,
                            backgroundColor: 'var(--accent-color)',
                            zIndex: 10,
                            pointerEvents: 'none'
                        }}
                    />

                    <input
                        type="range"
                        min={0}
                        max={maxFrame}
                        value={currentFrame}
                        onChange={(e) => onSeek(Number(e.target.value))}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            opacity: 0,
                            cursor: 'pointer',
                            margin: 0
                        }}
                    />
                </div>
            </div>
        </div>
    )
}
