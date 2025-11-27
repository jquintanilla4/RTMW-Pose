

export const MoveIcon = () => (
    <svg viewBox="0 0 32 32" role="presentation" aria-hidden="true">
        <line x1="16" y1="6" x2="16" y2="26" stroke="#1ed760" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="6" y1="16" x2="26" y2="16" stroke="#ff4f4f" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="10" y1="22" x2="22" y2="10" stroke="#4fa3ff" strokeWidth="2.2" strokeLinecap="round" />
        <polygon points="16,4 19,8 13,8" fill="#1ed760" />
        <polygon points="16,28 19,24 13,24" fill="#1ed760" />
        <polygon points="28,16 24,19 24,13" fill="#ff4f4f" />
        <polygon points="4,16 8,19 8,13" fill="#ff4f4f" />
        <polygon points="23.5,8.5 25.5,12 20.5,11.5" fill="#4fa3ff" />
        <polygon points="8.5,23.5 6.5,20 11.5,20.5" fill="#4fa3ff" />
        <circle cx="16" cy="16" r="2.3" fill="#f7f7f7" />
    </svg>
)

export const RotateIcon = () => (
    <svg viewBox="0 0 32 32" role="presentation" aria-hidden="true">
        <circle cx="16" cy="16" r="8" stroke="#4fa3ff" strokeWidth="1.8" fill="none" strokeDasharray="5 4" />
        <circle cx="16" cy="16" r="10.5" stroke="#ff4f4f" strokeWidth="1.8" fill="none" strokeDasharray="5 4" />
        <circle cx="16" cy="16" r="6" stroke="#1ed760" strokeWidth="1.8" fill="none" strokeDasharray="5 4" />
        <polygon points="16,3.5 18.8,8.2 13.2,8.2" fill="#4fa3ff" />
        <polygon points="28.5,16 23.8,18.8 23.8,13.2" fill="#ff4f4f" />
        <polygon points="16,28.5 13.2,23.8 18.8,23.8" fill="#1ed760" />
        <circle cx="16" cy="16" r="2.3" fill="#f7f7f7" />
    </svg>
)

export const ScaleIcon = () => (
    <svg viewBox="0 0 32 32" role="presentation" aria-hidden="true">
        <line x1="16" y1="7" x2="16" y2="25" stroke="#1ed760" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="7" y1="16" x2="25" y2="16" stroke="#ff4f4f" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="10" y1="22" x2="22" y2="10" stroke="#4fa3ff" strokeWidth="2.2" strokeLinecap="round" />
        <rect x="14" y="4" width="4" height="4" rx="0.8" fill="#1ed760" />
        <rect x="14" y="24" width="4" height="4" rx="0.8" fill="#1ed760" />
        <rect x="24" y="14" width="4" height="4" rx="0.8" fill="#ff4f4f" />
        <rect x="4" y="14" width="4" height="4" rx="0.8" fill="#ff4f4f" />
        <rect x="22" y="8" width="4" height="4" rx="0.8" fill="#4fa3ff" />
        <rect x="8" y="20" width="4" height="4" rx="0.8" fill="#4fa3ff" />
        <circle cx="16" cy="16" r="2.3" fill="#f7f7f7" />
    </svg>
)

export const PlayIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z" />
    </svg>
)

export const PlayBackwardIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ transform: 'scaleX(-1)' }}>
        <path d="M8 5v14l11-7z" />
    </svg>
)

export const PauseIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
)

export const LoopIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
    </svg>
)

export const SkipNextIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <polygon points="6,6 6,18 14,12" />
        <rect x="18" y="6" width="2" height="12" rx="0.5" />
    </svg>
)

export const SkipPrevIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="6" width="2" height="12" rx="0.5" />
        <polygon points="18,6 18,18 10,12" />
    </svg>
)
