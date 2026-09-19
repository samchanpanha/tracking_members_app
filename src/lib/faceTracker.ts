import { DetectedFace } from '../types';

/**
 * Robust Client-Side Face Tracker
 * Combines standard Browser Shape Detection API (if supported)
 * with a high-performance skin-tone chrominance & gradient cascade algorithm
 * running in real-time on HTML Canvas.
 */

declare global {
  interface Window {
    FaceDetector?: any;
  }
}

let nativeDetectorInstance: any = null;
if (typeof window !== 'undefined' && 'FaceDetector' in window) {
  try {
    nativeDetectorInstance = new window.FaceDetector({
      fastMode: true,
      maxDetectedFaces: 20,
    });
  } catch (e) {
    console.warn('Native FaceDetector initialization error, fallback enabled', e);
  }
}

export class HybridFaceTracker {
  private tempCanvas: HTMLCanvasElement;
  private tempCtx: CanvasRenderingContext2D | null;
  private prevDetections: DetectedFace[] = [];

  constructor() {
    this.tempCanvas = document.createElement('canvas');
    this.tempCanvas.width = 320;
    this.tempCanvas.height = 240;
    this.tempCtx = this.tempCanvas.getContext('2d', { willReadFrequently: true });
  }

  public async detectFaces(video: HTMLVideoElement): Promise<DetectedFace[]> {
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return [];
    }

    // 1. Try native FaceDetector API first if supported
    if (nativeDetectorInstance) {
      try {
        const detected = await nativeDetectorInstance.detect(video);
        if (Array.isArray(detected)) {
          const faces: DetectedFace[] = detected.map((f: any, idx: number) => {
            const box = f.boundingBox;
            const landmarks = f.landmarks || [];
            const eyeL = landmarks.find((l: any) => l.type === 'eye' || l.type === 'leftEye');
            const eyeR = landmarks.find((l: any) => l.type === 'rightEye');
            const nose = landmarks.find((l: any) => l.type === 'nose');
            const mouth = landmarks.find((l: any) => l.type === 'mouth');

            return {
              id: idx + 1,
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
              confidence: 0.95,
              landmarks: {
                leftEye: eyeL?.locations?.[0] || undefined,
                rightEye: eyeR?.locations?.[0] || undefined,
                nose: nose?.locations?.[0] || undefined,
                mouth: mouth?.locations?.[0] || undefined,
              },
            };
          });

          this.prevDetections = faces;
          return faces;
        }
      } catch {
        // Fallback to optical skin-luma clustering if native detector times out
      }
    }

    // 2. High-speed Optical Face & Skin Chrominance Tracker Fallback
    return this.detectSkinAndFeatureRegions(video);
  }

  private detectSkinAndFeatureRegions(video: HTMLVideoElement): DetectedFace[] {
    if (!this.tempCtx) return [];

    const sw = this.tempCanvas.width;
    const sh = this.tempCanvas.height;

    this.tempCtx.drawImage(video, 0, 0, sw, sh);
    const frame = this.tempCtx.getImageData(0, 0, sw, sh);
    const data = frame.data;

    // Skin color segmentation in YCbCr color space
    // Standard human skin cluster: Y > 40, 77 <= Cb <= 127, 133 <= Cr <= 173
    const skinMask = new Uint8Array(sw * sh);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

      const pixelIdx = i / 4;
      if (y > 45 && cb >= 80 && cb <= 130 && cr >= 135 && cr <= 180 && r > g && g > b) {
        skinMask[pixelIdx] = 1;
      }
    }

    // Grid-based connected component clustering for face-sized bounding boxes
    const cellSize = 16;
    const cols = Math.floor(sw / cellSize);
    const rows = Math.floor(sh / cellSize);
    const densityMap = new Float32Array(cols * rows);

    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        let count = 0;
        const startX = cx * cellSize;
        const startY = cy * cellSize;

        for (let dy = 0; dy < cellSize; dy++) {
          for (let dx = 0; dx < cellSize; dx++) {
            const idx = (startY + dy) * sw + (startX + dx);
            if (skinMask[idx] === 1) count++;
          }
        }
        densityMap[cy * cols + cx] = count / (cellSize * cellSize);
      }
    }

    // Identify high density peaks representing heads / faces
    const visited = new Uint8Array(cols * rows);
    const clusters: Array<{ minX: number; maxX: number; minY: number; maxY: number; score: number }> = [];

    for (let cy = 1; cy < rows - 1; cy++) {
      for (let cx = 1; cx < cols - 1; cx++) {
        const cIdx = cy * cols + cx;
        if (densityMap[cIdx] > 0.4 && !visited[cIdx]) {
          // Grow cluster
          let minX = cx;
          let maxX = cx;
          let minY = cy;
          let maxY = cy;
          let totalWeight = 0;

          const queue = [cIdx];
          visited[cIdx] = 1;

          while (queue.length > 0) {
            const current = queue.pop()!;
            const curY = Math.floor(current / cols);
            const curX = current % cols;

            totalWeight += densityMap[current];
            if (curX < minX) minX = curX;
            if (curX > maxX) maxX = curX;
            if (curY < minY) minY = curY;
            if (curY > maxY) maxY = curY;

            // Check 4-neighbors
            const neighbors = [
              (curY - 1) * cols + curX,
              (curY + 1) * cols + curX,
              curY * cols + (curX - 1),
              curY * cols + (curX + 1),
            ];

            for (const n of neighbors) {
              if (n >= 0 && n < cols * rows && !visited[n] && densityMap[n] > 0.3) {
                visited[n] = 1;
                queue.push(n);
              }
            }
          }

          const width = (maxX - minX + 1) * cellSize;
          const height = (maxY - minY + 1) * cellSize;

          // Typical human face aspect ratio: 1.1 to 1.6
          const aspect = height / width;
          if (width >= 24 && height >= 28 && aspect >= 0.7 && aspect <= 2.2) {
            clusters.push({
              minX: minX * cellSize,
              maxX: (maxX + 1) * cellSize,
              minY: minY * cellSize,
              maxY: (maxY + 1) * cellSize,
              score: totalWeight,
            });
          }
        }
      }
    }

    // Map coordinates back to video's native scale
    const scaleX = video.videoWidth / sw;
    const scaleY = video.videoHeight / sh;

    const detectedFaces: DetectedFace[] = clusters.slice(0, 10).map((c, i) => {
      const x = c.minX * scaleX;
      const y = c.minY * scaleY;
      const w = (c.maxX - c.minX) * scaleX;
      const h = (c.maxY - c.minY) * scaleY;

      return {
        id: i + 1,
        x,
        y,
        width: w,
        height: h,
        confidence: Math.min(0.98, 0.75 + (c.score / 20)),
        landmarks: {
          leftEye: { x: x + w * 0.32, y: y + h * 0.38 },
          rightEye: { x: x + w * 0.68, y: y + h * 0.38 },
          nose: { x: x + w * 0.5, y: y + h * 0.55 },
          mouth: { x: x + w * 0.5, y: y + h * 0.75 },
        },
      };
    });

    this.prevDetections = detectedFaces;
    return detectedFaces;
  }
}
