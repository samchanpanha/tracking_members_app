export interface DetectedFace {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  landmarks?: {
    leftEye?: { x: number; y: number };
    rightEye?: { x: number; y: number };
    nose?: { x: number; y: number };
    mouth?: { x: number; y: number };
  };
  matchedMember?: {
    id: string;
    name: string;
    phoneNumber: string;
    similarity: number;
    photoDataUrl?: string;
  };
}

export interface EnrolledMember {
  id: string;
  name: string;
  phoneNumber: string;
  enrolledAt: string;
  photoDataUrl: string;
  featureVector: number[];
  qrCodeDataUrl: string;
  qrPayload: string;
  visitCount: number;
  lastSeenAt?: string;
  notes?: string;
}

export interface MemberCheckInLog {
  id: string;
  memberId: string;
  memberName: string;
  phoneNumber: string;
  timestamp: string;
  timeDisplay: string;
  method: 'face_recognition' | 'qr_scan' | 'manual';
  confidence: number;
  visitNumber: number;
  syncedSheets: boolean;
  syncedTelegram: boolean;
}

export interface CountLogEntry {
  id: string;
  timestamp: string;
  timeDisplay: string;
  count: number;
  status: 'Normal' | 'Peak' | 'Empty';
  syncedSheets: boolean;
  syncedTelegram: boolean;
  notes?: string;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
  alertThreshold: number;
  autoAlertOnPeak: boolean;
}

export interface SheetsConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  sheetTitle: string;
  autoLogIntervalSeconds: number;
  isAutoLogging: boolean;
}

export interface UserProfile {
  name: string;
  email: string;
  photoUrl?: string;
}
