import type { ViewPreset } from '../viewer/PoseViewer'
import {
    ViewFrontIcon,
    ViewBackIcon,
    ViewLeftIcon,
    ViewRightIcon,
    ViewTopIcon,
    ViewBottomIcon,
} from './Icons'

interface ViewShortcutsProps {
    onViewChange: (preset: ViewPreset) => void
}

const viewButtons: { preset: ViewPreset; icon: React.FC; label: string }[] = [
    { preset: 'front', icon: ViewFrontIcon, label: 'Front' },
    { preset: 'back', icon: ViewBackIcon, label: 'Back' },
    { preset: 'left', icon: ViewLeftIcon, label: 'Left' },
    { preset: 'right', icon: ViewRightIcon, label: 'Right' },
    { preset: 'top', icon: ViewTopIcon, label: 'Top' },
    { preset: 'bottom', icon: ViewBottomIcon, label: 'Bottom' },
]

export function ViewShortcuts({ onViewChange }: ViewShortcutsProps) {
    return (
        <div className="view-shortcuts">
            {viewButtons.map(({ preset, icon: Icon, label }) => (
                <button
                    key={preset}
                    className="view-shortcut-btn"
                    onClick={() => onViewChange(preset)}
                >
                    <span className="hover-label">{label}</span>
                    <Icon />
                </button>
            ))}
        </div>
    )
}
