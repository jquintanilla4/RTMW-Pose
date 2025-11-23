import JSZip from 'jszip'


export class VideoExporter {
    async load() {
        // No-op for now, but keeping interface consistent
        return Promise.resolve()
    }

    async exportVideo(
        frames: Blob[],
        fps: number,
        onProgress: (ratio: number) => void
    ): Promise<Blob> {
        const zip = new JSZip()
        const folder = zip.folder('frames')
        if (!folder) throw new Error('Failed to create zip folder')

        // Add frames to zip
        frames.forEach((blob, index) => {
            const filename = `frame${String(index).padStart(4, '0')}.png`
            folder.file(filename, blob)
            // Simple progress estimation
            if (index % 10 === 0) {
                onProgress(index / frames.length)
            }
        })

        // Add a simple script to run ffmpeg
        const scriptContent = `#!/bin/bash
# Run this script to generate the video
# Requires ffmpeg to be installed

ffmpeg -framerate ${fps} -i frames/frame%04d.png -c:v libx264 -pix_fmt yuv420p output.mp4
echo "Video generated: output.mp4"
`
        zip.file('render.sh', scriptContent, { unixPermissions: '755' })

        onProgress(0.9)

        const content = await zip.generateAsync({ type: 'blob' }, (metadata) => {
            onProgress(metadata.percent / 100)
        })

        return content
    }
}
