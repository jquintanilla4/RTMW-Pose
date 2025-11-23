import type { ChangeEvent } from 'react'

interface HeaderProps {
    onFileLoad: (file: File) => void
    onExport: () => void
    statusText: string
    fileName?: string
}

export function Header({ onFileLoad, onExport, statusText, fileName }: HeaderProps) {
    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) {
            onFileLoad(file)
        }
        event.target.value = ''
    }

    return (
        <header className="header">
            <div className="header-title">
                RTMW Pose Editor {fileName && <span style={{ opacity: 0.5 }}>— {fileName}</span>}
            </div>
            <div className="header-controls">
                <span className="status" style={{ marginRight: 16, fontSize: '0.85rem', color: '#888' }}>
                    {statusText}
                </span>
                <label className="button-like">
                    <button
                        onClick={() => document.getElementById('file-upload')?.click()}
                        title="Open JSON (O)"
                    >
                        Open JSON
                    </button>
                    <input
                        id="file-upload"
                        type="file"
                        accept=".json"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />
                </label>
                <button onClick={onExport}>Export Video</button>
            </div>
        </header>
    )
}
