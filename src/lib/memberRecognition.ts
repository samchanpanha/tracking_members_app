import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { EnrolledMember, DetectedFace } from '../types';

/**
 * Generates a unique member ID
 */
export const generateMemberId = (): string => {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `MEM-${num}`;
};

/**
 * Generates a high-resolution QR code data URL for a member
 */
export const generateMemberQRCode = async (member: {
  id: string;
  name: string;
  phoneNumber: string;
}): Promise<{ qrCodeDataUrl: string; qrPayload: string }> => {
  const qrPayload = JSON.stringify({
    app: 'face_tracker_member',
    id: member.id,
    name: member.name,
    phone: member.phoneNumber,
  });

  const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
    width: 320,
    margin: 2,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  });

  return { qrCodeDataUrl, qrPayload };
};

/**
 * Creates a sample demo member for instant testing
 */
export const createDemoMember = async (): Promise<EnrolledMember> => {
  const memberId = 'MEM-820419';
  const name = 'Jordan Lee';
  const phoneNumber = '+1 555-0199';
  const { qrCodeDataUrl, qrPayload } = await generateMemberQRCode({
    id: memberId,
    name,
    phoneNumber,
  });

  const photoDataUrl =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="#0f172a"/><circle cx="120" cy="95" r="45" fill="#38bdf8"/><path d="M50 210 c0 -45 35 -70 70 -70 s70 25 70 70 Z" fill="#0284c7"/></svg>`
    );

  return {
    id: memberId,
    name,
    phoneNumber,
    enrolledAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    photoDataUrl,
    featureVector: new Array(104).fill(0.098),
    qrCodeDataUrl,
    qrPayload,
    visitCount: 2,
    notes: 'VIP Member',
  };
};

/**
 * Extracts a normalized 104-dimensional feature vector from a face bounding box
 */
export const extractFaceFeatureVector = (
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number
): number[] => {
  const bx = Math.max(0, Math.floor(box.x));
  const by = Math.max(0, Math.floor(box.y));
  const bw = Math.min(canvasWidth - bx, Math.max(16, Math.floor(box.width)));
  const bh = Math.min(canvasHeight - by, Math.max(16, Math.floor(box.height)));

  if (bw <= 0 || bh <= 0) {
    return new Array(104).fill(0);
  }

  let imgData: ImageData;
  try {
    imgData = ctx.getImageData(bx, by, bw, bh);
  } catch {
    return new Array(104).fill(0);
  }

  const data = imgData.data;

  // 1. 8x8 Luminance Grid (64 float values)
  const lumaGrid: number[] = [];
  const cellW = bw / 8;
  const cellH = bh / 8;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      let sumY = 0;
      let count = 0;
      const startX = Math.floor(c * cellW);
      const endX = Math.floor((c + 1) * cellW);
      const startY = Math.floor(r * cellH);
      const endY = Math.floor((r + 1) * cellH);

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * bw + x) * 4;
          const red = data[idx];
          const green = data[idx + 1];
          const blue = data[idx + 2];
          const yVal = 0.299 * red + 0.587 * green + 0.114 * blue;
          sumY += yVal;
          count++;
        }
      }
      lumaGrid.push(count > 0 ? sumY / (count * 255) : 0);
    }
  }

  // 2. 4x4 Chroma Cb Grid (16 values) & 4x4 Chroma Cr Grid (16 values)
  const cbGrid: number[] = [];
  const crGrid: number[] = [];
  const chromaCellW = bw / 4;
  const chromaCellH = bh / 4;

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let sumCb = 0;
      let sumCr = 0;
      let count = 0;
      const startX = Math.floor(c * chromaCellW);
      const endX = Math.floor((c + 1) * chromaCellW);
      const startY = Math.floor(r * chromaCellH);
      const endY = Math.floor((r + 1) * chromaCellH);

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * bw + x) * 4;
          const red = data[idx];
          const green = data[idx + 1];
          const blue = data[idx + 2];
          const cb = (128 - 0.168736 * red - 0.331264 * green + 0.5 * blue) / 255;
          const cr = (128 + 0.5 * red - 0.418688 * green - 0.081312 * blue) / 255;
          sumCb += cb;
          sumCr += cr;
          count++;
        }
      }
      cbGrid.push(count > 0 ? sumCb / count : 0.5);
      crGrid.push(count > 0 ? sumCr / count : 0.5);
    }
  }

  // 3. Proportions & Geometric descriptors (8 values)
  const aspect = Math.min(2.0, Math.max(0.5, bh / bw)) / 2.0;
  const geo = [
    aspect,
    bx / Math.max(1, canvasWidth),
    by / Math.max(1, canvasHeight),
    bw / Math.max(1, canvasWidth),
    bh / Math.max(1, canvasHeight),
    (lumaGrid[18] || 0.5) - (lumaGrid[42] || 0.5), // Top to bottom contrast (forehead vs chin)
    (lumaGrid[25] || 0.5) - (lumaGrid[30] || 0.5), // Left vs right facial balance
    (crGrid[5] || 0.5), // Central facial flush
  ];

  // Combine
  const rawVector = [...lumaGrid, ...cbGrid, ...crGrid, ...geo];

  // L2 unit normalization
  let normSq = 0;
  for (let i = 0; i < rawVector.length; i++) {
    normSq += rawVector[i] * rawVector[i];
  }
  const norm = Math.sqrt(normSq) || 1;
  return rawVector.map((v) => v / norm);
};

/**
 * Computes Cosine Similarity between two normalized vectors (-1 to 1)
 */
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
  }
  return dot;
};

/**
 * Finds the best matching member given a face feature vector
 */
export const findBestMemberMatch = (
  featureVector: number[],
  members: EnrolledMember[],
  threshold = 0.76
): { member: EnrolledMember; similarity: number } | null => {
  if (!members || members.length === 0 || !featureVector || featureVector.length === 0) {
    return null;
  }

  let bestMatch: EnrolledMember | null = null;
  let highestSim = -1;

  for (const member of members) {
    if (!member.featureVector || member.featureVector.length === 0) continue;
    const sim = cosineSimilarity(featureVector, member.featureVector);
    if (sim > highestSim) {
      highestSim = sim;
      bestMatch = member;
    }
  }

  if (bestMatch && highestSim >= threshold) {
    return { member: bestMatch, similarity: highestSim };
  }

  return null;
};

/**
 * Captures face crop and feature vector for enrollment
 */
export const captureFaceForEnrollment = (
  video: HTMLVideoElement,
  faceBox?: { x: number; y: number; width: number; height: number }
): { photoDataUrl: string; featureVector: number[] } => {
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = 240;
  cropCanvas.height = 240;
  const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });

  if (!cropCtx || !video || video.videoWidth === 0) {
    return {
      photoDataUrl: '',
      featureVector: new Array(104).fill(0),
    };
  }

  const vw = video.videoWidth;
  const vh = video.videoHeight;

  let sx = 0;
  let sy = 0;
  let sw = vw;
  let sh = vh;

  if (faceBox && faceBox.width > 20 && faceBox.height > 20) {
    // Add 20% margin around face
    const margin = Math.max(faceBox.width, faceBox.height) * 0.2;
    sx = Math.max(0, faceBox.x - margin);
    sy = Math.max(0, faceBox.y - margin);
    sw = Math.min(vw - sx, faceBox.width + margin * 2);
    sh = Math.min(vh - sy, faceBox.height + margin * 2);
  } else {
    // Center crop square
    const minDim = Math.min(vw, vh);
    sx = (vw - minDim) / 2;
    sy = (vh - minDim) / 2;
    sw = minDim;
    sh = minDim;
  }

  // Draw mirrored to match selfie presentation
  cropCtx.save();
  cropCtx.translate(240, 0);
  cropCtx.scale(-1, 1);
  cropCtx.drawImage(video, sx, sy, sw, sh, 0, 0, 240, 240);
  cropCtx.restore();

  const photoDataUrl = cropCanvas.toDataURL('image/jpeg', 0.9);

  // Extract feature vector from the 240x240 normalized face crop
  const featureVector = extractFaceFeatureVector(
    cropCtx,
    { x: 0, y: 0, width: 240, height: 240 },
    240,
    240
  );

  return { photoDataUrl, featureVector };
};

/**
 * Processes an uploaded image file for biometric member enrollment
 */
export const processImageFileForEnrollment = (
  file: File | Blob
): Promise<{ photoDataUrl: string; featureVector: number[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = 240;
        cropCanvas.height = 240;
        const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
        if (!cropCtx) {
          reject(new Error('Failed to create canvas context.'));
          return;
        }

        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;

        cropCtx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 240, 240);
        const photoDataUrl = cropCanvas.toDataURL('image/jpeg', 0.9);
        const featureVector = extractFaceFeatureVector(
          cropCtx,
          { x: 0, y: 0, width: 240, height: 240 },
          240,
          240
        );

        resolve({ photoDataUrl, featureVector });
      };
      img.onerror = () => reject(new Error('Failed to load image file.'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
};

/**
 * Scans for QR code in the video frame
 */
export const scanQRCodeFromFrame = (
  video: HTMLVideoElement,
  tempCanvas: HTMLCanvasElement,
  tempCtx: CanvasRenderingContext2D
): { payload: string; location?: any } | null => {
  if (!video || video.readyState < 2 || video.videoWidth === 0) return null;

  const w = tempCanvas.width;
  const h = tempCanvas.height;

  tempCtx.drawImage(video, 0, 0, w, h);
  const imgData = tempCtx.getImageData(0, 0, w, h);
  const code = jsQR(imgData.data, w, h, {
    inversionAttempts: 'dontInvert',
  });

  if (code && code.data) {
    return {
      payload: code.data,
      location: code.location,
    };
  }

  return null;
};

// Reusable canvas for extracting face vectors during real-time tracking
let matchCanvas: HTMLCanvasElement | null = null;
let matchCtx: CanvasRenderingContext2D | null = null;

if (typeof document !== 'undefined') {
  matchCanvas = document.createElement('canvas');
  matchCanvas.width = 320;
  matchCanvas.height = 240;
  matchCtx = matchCanvas.getContext('2d', { willReadFrequently: true });
}

/**
 * Enriches detected face objects with matched member information
 */
export const matchDetectedFaces = (
  video: HTMLVideoElement,
  faces: DetectedFace[],
  members: EnrolledMember[]
): DetectedFace[] => {
  if (
    !faces ||
    faces.length === 0 ||
    !members ||
    members.length === 0 ||
    !matchCtx ||
    !matchCanvas ||
    !video ||
    video.readyState < 2
  ) {
    return faces;
  }

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw === 0 || vh === 0) return faces;

  if (matchCanvas.width !== vw || matchCanvas.height !== vh) {
    matchCanvas.width = vw;
    matchCanvas.height = vh;
  }

  matchCtx.drawImage(video, 0, 0, vw, vh);

  return faces.map((face) => {
    const fVec = extractFaceFeatureVector(matchCtx!, face, vw, vh);
    const match = findBestMemberMatch(fVec, members, 0.74);
    if (match) {
      return {
        ...face,
        matchedMember: {
          id: match.member.id,
          name: match.member.name,
          phoneNumber: match.member.phoneNumber,
          similarity: match.similarity,
          photoDataUrl: match.member.photoDataUrl,
        },
      };
    }
    return face;
  });
};

