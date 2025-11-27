import { useEffect, useRef, useState } from 'react'
import './App.css'
import { PoseViewer } from './viewer/PoseViewer'
import type { PoseViewerCallbacks, TransformMode } from './viewer/PoseViewer'
import { Header } from './components/Header'
import { Toolbar } from './components/Toolbar'
import { PropertiesPanel } from './components/PropertiesPanel'
import { Timeline } from './components/Timeline'
import { VideoExporter } from './utils/VideoExporter'

function App() {
  const viewerContainerRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useRef<PoseViewer | null>(null)
  const exporterRef = useRef<VideoExporter>(new VideoExporter())

  const [statusText, setStatusText] = useState('Load a JSON file exported by rtmw3d_export_json.py')
  const [fileName, setFileName] = useState<string>()
  const [frameInfo, setFrameInfo] = useState({ index: 0, total: 0, personCount: 0 })
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [depthGain, setDepthGain] = useState(1)
  const [exportThickness, setExportThickness] = useState('')
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [editingEnabled, setEditingEnabled] = useState(false)
  const [selectionInfo, setSelectionInfo] = useState('Editing disabled.')
  const [hasSelection, setHasSelection] = useState(false)
  const [transformMode, setTransformMode] = useState<TransformMode>('translate')
  const [keyframeFrames, setKeyframeFrames] = useState<number[]>([])
  const [currentFrameHasKeyframe, setCurrentFrameHasKeyframe] = useState(false)
  const frameInfoRef = useRef(frameInfo)
  const editingEnabledRef = useRef(editingEnabled)

  useEffect(() => {
    if (!viewerContainerRef.current) return

    const callbacks: PoseViewerCallbacks = {
      onStatusChange: (text) => setStatusText(text),
      onFrameUpdate: ({ index, total, personCount }) => {
        setFrameInfo({ index, total, personCount })
      },
      onPlaybackStateChange: (playing) => setIsPlaying(playing),
      onSelectionInfoChange: ({ text, hasSelection: active }) => {
        setSelectionInfo(text)
        setHasSelection(active)
      },
      onKeyframeStateChange: ({ framesWithKeyframes, hasKeyframeAtCurrent }) => {
        setKeyframeFrames(framesWithKeyframes)
        setCurrentFrameHasKeyframe(hasKeyframeAtCurrent)
      },
    }

    const viewer = new PoseViewer({ container: viewerContainerRef.current, callbacks })
    viewerRef.current = viewer

    // Preload ffmpeg
    exporterRef.current.load().catch(err => {
      console.error('Failed to load ffmpeg:', err)
      setStatusText('Failed to load video exporter. Check console.')
    })

    return () => viewer.dispose()
  }, [])

  useEffect(() => {
    viewerRef.current?.setTransformMode(transformMode)
  }, [transformMode])

  useEffect(() => {
    frameInfoRef.current = frameInfo
  }, [frameInfo])

  useEffect(() => {
    editingEnabledRef.current = editingEnabled
  }, [editingEnabled])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const key = event.key.toLowerCase()

      if (key === 'o') {
        event.preventDefault()
        document.getElementById('file-upload')?.click()
        return
      }

      if (!viewerRef.current) return

      if (key === ' ' || event.code === 'Space') {
        event.preventDefault()
        viewerRef.current.togglePlayback()
        return
      }

      if (key === ',' || key === '<') {
        event.preventDefault()
        const { index, total } = frameInfoRef.current
        if (total > 0) {
          viewerRef.current.seekFrame(Math.max(0, index - 1))
        }
        return
      }

      if (key === '.' || key === '>') {
        event.preventDefault()
        const { index, total } = frameInfoRef.current
        if (total > 0) {
          const maxFrame = Math.max(0, total - 1)
          viewerRef.current.seekFrame(Math.min(maxFrame, index + 1))
        }
        return
      }

      if (key === 'j') {
        event.preventDefault()
        viewerRef.current.toggleReversePlayback()
        return
      }

      if (!editingEnabledRef.current) return

      if (key === 'w') {
        setTransformMode('translate')
      } else if (key === 's') {
        setTransformMode('scale')
      } else if (key === 'r') {
        setTransformMode('rotate')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleFileLoad = async (file: File) => {
    const text = await file.text()
    viewerRef.current?.loadFromJSON(text, file.name)
    setFileName(file.name)
    setSpeed(1)
    setDepthGain(1)
  }

  const runExport = async () => {
    if (!viewerRef.current || !frameInfo.total) return
    const parsedThickness = parseFloat(exportThickness)
    const stickWidth = Number.isFinite(parsedThickness) && parsedThickness > 0 ? parsedThickness : undefined

    const wasPlaying = isPlaying
    if (wasPlaying) viewerRef.current.togglePlayback()

    setStatusText('Exporting video... Do not close this tab.')

    try {
      const frames: Blob[] = []
      const total = frameInfo.total

      // Capture all frames
      for (let i = 0; i < total; i++) {
        viewerRef.current.seekFrame(i)
        // Wait a tiny bit for render
        await new Promise(r => setTimeout(r, 20))
        const blob = await viewerRef.current.captureKijaiFrame(i, undefined, undefined, stickWidth)
        if (blob) frames.push(blob)
        setStatusText(`Capturing frame ${i + 1}/${total}`)
      }

      setStatusText('Compressing frames...')
      const blob = await exporterRef.current.exportVideo(frames, 30, (ratio) => {
        setStatusText(`Compressing: ${(ratio * 100).toFixed(0)}%`)
      })

      // Download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${fileName?.replace('.json', '') || 'export'}.zip`
      a.click()
      URL.revokeObjectURL(url)

      setStatusText('Export complete! Unzip and run render.sh to create video.')
    } catch (err) {
      console.error(err)
      setStatusText('Export failed: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      if (wasPlaying) viewerRef.current.togglePlayback()
    }
  }

  const handleExport = () => {
    setExportDialogOpen(true)
  }

  const handleConfirmExport = async () => {
    setExportDialogOpen(false)
    await runExport()
  }

  const handleCancelExport = () => {
    setExportDialogOpen(false)
  }

  const handleExportJSON = () => {
    if (!viewerRef.current) return
    const json = viewerRef.current.exportJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName?.replace('.json', '') || 'export'}_edited.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app-container">
      <Header
        onFileLoad={handleFileLoad}
        onExport={handleExport}
        onExportJSON={handleExportJSON}
        statusText={statusText}
        fileName={fileName}
      />

      <div className="main-content">
        <div className="viewport-container" ref={viewerContainerRef}>
          <Toolbar
            activeMode={transformMode}
            onModeChange={setTransformMode}
            enabled={editingEnabled}
          />
        </div>

        <PropertiesPanel
          selectionInfo={selectionInfo}
          hasSelection={hasSelection}
          onClearSelection={() => viewerRef.current?.clearSelection()}
          onResetFrame={() => viewerRef.current?.clearFrameKeyframes()}
          canResetFrame={currentFrameHasKeyframe}
          depthGain={depthGain}
          onDepthGainChange={(val) => {
            setDepthGain(val)
            viewerRef.current?.setDepthGain(val)
          }}
          speed={speed}
          onSpeedChange={(val) => {
            setSpeed(val)
            viewerRef.current?.setSpeed(val)
          }}
          editingEnabled={editingEnabled}
          onToggleEditing={() => {
            const next = !editingEnabled
            setEditingEnabled(next)
            viewerRef.current?.setEditingEnabled(next)
          }}
        />
      </div>

      <Timeline
        currentFrame={frameInfo.index}
        totalFrames={frameInfo.total}
        isPlaying={isPlaying}
        onPlayPause={() => viewerRef.current?.togglePlayback()}
        onPlayBackward={() => viewerRef.current?.toggleReversePlayback()}
        onSeek={(frame) => viewerRef.current?.seekFrame(frame)}
        keyframes={keyframeFrames}
        onPropagateBackwards={() => viewerRef.current?.propagateCurrentFrameBackwards()}
        onPropagateForwards={() => viewerRef.current?.propagateCurrentFrameForwards()}
        currentFrameHasKeyframe={currentFrameHasKeyframe}
      />

      {exportDialogOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-title">Export Video</div>
            <div className="modal-body">
              <p style={{ marginBottom: 8, color: '#aaa' }}>
                Set pose line thickness in pixels. Leave blank for auto sizing.
              </p>
              <input
                type="number"
                min={1}
                step={1}
                value={exportThickness}
                onChange={(e) => setExportThickness(e.target.value)}
                placeholder="Auto"
                style={{ width: '100%', padding: '8px', fontSize: '1rem' }}
              />
            </div>
            <div className="modal-actions">
              <button onClick={handleCancelExport}>Cancel</button>
              <button onClick={handleConfirmExport} style={{ marginLeft: 8 }}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
