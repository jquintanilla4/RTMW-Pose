import { PlayIcon, PauseIcon, SkipNextIcon, SkipPrevIcon } from './Icons'

interface TimelineProps {
    currentFrame: number
    totalFrames: number
    isPlaying: boolean
    onPlayPause: () => void
    onSeek: (frame: number) => void
    keyframes: number[]
}

export function Timeline({
    currentFrame,
    totalFrames,
    isPlaying,
    onPlayPause,
    onSeek,
    keyframes,
}: TimelineProps) {
    const maxFrame = Math.max(0, totalFrames - 1)
    const progress = maxFrame > 0 ? (currentFrame / maxFrame) * 100 : 0

    return (
        <div className="bottom-panel">
            <div className="timeline-controls" style={{
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                borderBottom: '1px solid var(--border-color)'
            }}>
                <button className="icon-btn" onClick={() => onSeek(Math.max(0, currentFrame - 1))}>
                    <SkipPrevIcon />
                </button>
                <button className="icon-btn" onClick={onPlayPause}>
                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button className="icon-btn" onClick={() => onSeek(Math.min(maxFrame, currentFrame + 1))}>
                    <SkipNextIcon />
                </button>

                <div className="time-display" style={{ fontFamily: 'monospace', fontSize: '1.1em' }}>
                    {currentFrame} <span style={{ color: '#666' }}>/ {maxFrame}</span>
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
