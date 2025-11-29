

export const MoveIcon = () => (
    <svg viewBox="0 0 32 32" role="presentation" aria-hidden="true">
        <g strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2">
            <line x1="16" y1="24" x2="16" y2="10" stroke="#27ae60" />
            <line x1="8" y1="16" x2="22" y2="16" stroke="#e74c3c" />
            <line x1="16" y1="16" x2="11" y2="11" stroke="#3498db" />
        </g>
        <polygon points="16,4 20,10 12,10" fill="#27ae60" />
        <polygon points="28,16 22,12.5 22,19.5" fill="#e74c3c" />
        <polygon points="6.4,6.4 10.8,8.3 8.3,10.8" fill="#3498db" />
        <rect x="13.4" y="13.4" width="5.2" height="5.2" rx="1.4" fill="#f6f7fb" stroke="#202020" strokeWidth="0.5" />
    </svg>
)

export const RotateIcon = () => (
    <svg viewBox="0 0 32 32" role="presentation" aria-hidden="true">
        <path d="M16 6 A10 10 0 0 1 26 16" fill="none" stroke="#3498db" strokeWidth="2" strokeLinecap="round" />
        <polygon points="24.2,13.8 26.7,16 23.7,16.5" fill="#3498db" />
        <path d="M26 16 A10 10 0 0 1 16 26" fill="none" stroke="#e74c3c" strokeWidth="2" strokeLinecap="round" />
        <polygon points="18.4,23.6 16,26.5 16.7,23.3" fill="#e74c3c" />
        <path d="M16 26 A10 10 0 0 1 6 16" fill="none" stroke="#27ae60" strokeWidth="2" strokeLinecap="round" />
        <polygon points="7.8,18.2 5.3,16 8.3,15.5" fill="#27ae60" />
        <circle cx="16" cy="16" r="3.2" fill="none" stroke="#d9d9d9" strokeWidth="1.2" />
    </svg>
)

export const ScaleIcon = () => (
    <svg viewBox="0 0 32 32" role="presentation" aria-hidden="true">
        <rect x="9" y="9" width="14" height="14" rx="2" fill="none" stroke="#cfd2d9" strokeWidth="1.6" strokeDasharray="3 2" />
        <rect x="13.2" y="13.2" width="5.6" height="5.6" rx="1" fill="#f6f7fb" stroke="#202020" strokeWidth="0.6" />
        <g strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2">
            <line x1="16" y1="9" x2="16" y2="3.6" stroke="#27ae60" />
            <line x1="23" y1="16" x2="28.4" y2="16" stroke="#e74c3c" />
            <line x1="11" y1="21" x2="6.1" y2="25.9" stroke="#3498db" />
        </g>
        <rect x="14.2" y="1.4" width="3.6" height="3.6" rx="0.8" fill="#27ae60" />
        <rect x="28.4" y="14.2" width="3.6" height="3.6" rx="0.8" fill="#e74c3c" />
        <rect x="3.6" y="25.9" width="3.6" height="3.6" rx="0.8" fill="#3498db" />
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

// View preset icons
export const ViewFrontIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </svg>
)

export const ViewBackIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 2" />
        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" opacity="0.5" />
    </svg>
)

export const ViewLeftIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M4 12 L12 8 L12 16 Z" fill="currentColor" stroke="none" />
    </svg>
)

export const ViewRightIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M20 12 L12 8 L12 16 Z" fill="currentColor" stroke="none" />
    </svg>
)

export const ViewTopIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M12 4 L8 12 L16 12 Z" fill="currentColor" stroke="none" />
    </svg>
)

export const ViewBottomIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M12 20 L8 12 L16 12 Z" fill="currentColor" stroke="none" />
    </svg>
)
