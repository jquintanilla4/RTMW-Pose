import type { RefObject } from 'react'
import { useEffect, useState } from 'react'

export type AspectRatioOption = 'none' | '16:9' | '1:1' | '4:3' | '9:16' | '3:4' | '2:1' | 'custom'

interface AspectRatioOverlayProps {
    containerRef: RefObject<HTMLDivElement | null>
    aspectRatio: AspectRatioOption
    active: boolean
    showRuleOfThirds?: boolean
    customAspectRatio?: number | null
}

export function AspectRatioOverlay({ containerRef, aspectRatio, active, showRuleOfThirds = true, customAspectRatio }: AspectRatioOverlayProps) {
    const [size, setSize] = useState({ width: 0, height: 0 })

    useEffect(() => {
        const element = containerRef.current
        if (!element) return

        const updateSize = () => {
            const rect = element.getBoundingClientRect()
            setSize({ width: rect.width, height: rect.height })
        }

        updateSize()

        const observer = new ResizeObserver(() => updateSize())
        observer.observe(element)
        window.addEventListener('resize', updateSize)

        return () => {
            observer.disconnect()
            window.removeEventListener('resize', updateSize)
        }
    }, [containerRef, active, aspectRatio])

    if (!active || aspectRatio === 'none') return null

    const parseAspectRatio = () => {
        if (aspectRatio === 'custom') return customAspectRatio ?? null
        const [w, h] = aspectRatio.split(':').map(Number)
        if (!w || !h) return null
        return w / h
    }

    const ratio = parseAspectRatio()
    if (!ratio || !size.width || !size.height) return null
    const containerRatio = size.width / size.height
    const guideWidth = containerRatio > ratio ? size.height * ratio : size.width
    const guideHeight = containerRatio > ratio ? size.height : size.width / ratio
    const left = (size.width - guideWidth) / 2
    const top = (size.height - guideHeight) / 2

    return (
        <div className="aspect-overlay">
            <div
                className="aspect-frame"
                style={{
                    width: guideWidth,
                    height: guideHeight,
                    left,
                    top,
                }}
            >
                {showRuleOfThirds && (
                    <>
                        <div className="aspect-grid vertical" style={{ left: '33.333%' }} />
                        <div className="aspect-grid vertical" style={{ left: '66.666%' }} />
                        <div className="aspect-grid horizontal" style={{ top: '33.333%' }} />
                        <div className="aspect-grid horizontal" style={{ top: '66.666%' }} />
                    </>
                )}
            </div>
        </div>
    )
}
