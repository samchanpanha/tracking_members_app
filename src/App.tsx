import { useState, useEffect, useRef, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logoutGoogle,
  getAccessToken,
  setCachedAccessToken,
} from './lib/auth';
import {
  createFaceTrackingSpreadsheet,
  appendFaceLogToSheet,
  appendMemberToSheet,
  appendMemberCheckInToSheet,
} from './lib/sheets';
import {
  sendTelegramMessage,
  formatTelegramFaceAlert,
  formatTelegramMemberAlert,
  formatTelegramMemberEnrollment,
} from './lib/telegram';
import { HybridFaceTracker } from './lib/faceTracker';
import {
  matchDetectedFaces,
  scanQRCodeFromFrame,
  createDemoMember,
} from './lib/memberRecognition';
import { FaceScanner } from './components/FaceScanner';
import { SheetsSyncCard } from './components/SheetsSyncCard';
import { TelegramBotCard } from './components/TelegramBotCard';
import { CountLogTable } from './components/CountLogTable';
import { MemberCheckInTable } from './components/MemberCheckInTable';
import { EnrollMemberModal } from './components/EnrollMemberModal';
import { MemberDirectoryModal } from './components/MemberDirectoryModal';
import {
  DetectedFace,
  CountLogEntry,
  TelegramConfig,
  SheetsConfig,
  EnrolledMember,
  MemberCheckInLog,
} from './types';
import {
  ScanFace,
  AlertTriangle,
  Radio,
  UserPlus,
  Users,
  QrCode,
  Sparkles,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';

export default function App() {
  // Authentication & Google Workspace
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Camera & Face Tracking
  const [isStreaming, setIsStreaming] = useState(false);
  const [faces, setFaces] = useState<DetectedFace[]>([]);
  const [fps, setFps] = useState<number>(0);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Members & Biometrics
  const [enrolledMembers, setEnrolledMembers] = useState<EnrolledMember[]>(() => {
    const saved = localStorage.getItem('app_enrolled_members');
    return saved ? JSON.parse(saved) : [];
  });

  const [memberCheckIns, setMemberCheckIns] = useState<MemberCheckInLog[]>(() => {
    const saved = localStorage.getItem('app_member_checkins');
    return saved ? JSON.parse(saved) : [];
  });

  // Modal States
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isMemberDirectoryOpen, setIsMemberDirectoryOpen] = useState(false);
  const [activeLogTab, setActiveLogTab] = useState<'members' | 'crowd'>('members');
  const [lastQrScannedText, setLastQrScannedText] = useState<string | null>(null);

  // Cooldown tracker to prevent repetitive check-in trigger within 8s
  const lastCheckInCooldownRef = useRef<{ [memberId: string]: number }>({});

  // Video and Canvas Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackerRef = useRef<HybridFaceTracker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const qrScanFrameCounterRef = useRef<number>(0);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Google Sheets Config
  const [sheetsConfig, setSheetsConfig] = useState<SheetsConfig>(() => {
    const saved = localStorage.getItem('app_sheets_config');
    return saved
      ? JSON.parse(saved)
      : {
          spreadsheetId: '',
          spreadsheetUrl: '',
          sheetTitle: '',
          autoLogIntervalSeconds: 5,
          isAutoLogging: false,
        };
  });

  // Telegram Bot Config
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>(() => {
    const saved = localStorage.getItem('app_telegram_config');
    return saved
      ? JSON.parse(saved)
      : {
          botToken: '',
          chatId: '',
          enabled: false,
          alertThreshold: 3,
          autoAlertOnPeak: true,
        };
  });

  // Crowd Headcount Event Logs
  const [logs, setLogs] = useState<CountLogEntry[]>(() => {
    const saved = localStorage.getItem('app_face_logs');
    return saved ? JSON.parse(saved) : [];
  });

  const [isLogging, setIsLogging] = useState(false);
  const [isTelegramSending, setIsTelegramSending] = useState(false);
  const [notificationBanner, setNotificationBanner] = useState<{
    text: string;
    type: 'success' | 'alert' | 'error';
  } | null>(null);

  // Keep state synchronized with LocalStorage
  useEffect(() => {
    localStorage.setItem('app_enrolled_members', JSON.stringify(enrolledMembers));
  }, [enrolledMembers]);

  useEffect(() => {
    localStorage.setItem('app_member_checkins', JSON.stringify(memberCheckIns.slice(0, 100)));
  }, [memberCheckIns]);

  useEffect(() => {
    localStorage.setItem('app_sheets_config', JSON.stringify(sheetsConfig));
  }, [sheetsConfig]);

  useEffect(() => {
    localStorage.setItem('app_telegram_config', JSON.stringify(telegramConfig));
  }, [telegramConfig]);

  useEffect(() => {
    localStorage.setItem('app_face_logs', JSON.stringify(logs.slice(0, 50)));
  }, [logs]);

  // Auth initialization
  useEffect(() => {
    initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setCachedAccessToken(token);
      },
      () => {
        setUser(null);
      }
    );

    // If no enrolled members, seed a default demo member for quick testing
    if (enrolledMembers.length === 0 && !localStorage.getItem('app_enrolled_members')) {
      createDemoMember().then((demo) => {
        setEnrolledMembers([demo]);
      });
    }
  }, []);

  const showBanner = (text: string, type: 'success' | 'alert' | 'error') => {
    setNotificationBanner({ text, type });
    setTimeout(() => setNotificationBanner(null), 4000);
  };

  // Gentle audio chime on identification
  const playChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12); // A5

      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } catch {
      // Audio context may be muted or blocked by browser policy
    }
  };

  // Google Sign-In Handler
  const handleSignIn = async () => {
    setIsAuthLoading(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        showBanner(`Connected as ${res.user.displayName || res.user.email}`, 'success');
      }
    } catch (err: any) {
      showBanner(err.message || 'Google sign-in was canceled or failed.', 'error');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Google Sign-Out Handler
  const handleSignOut = async () => {
    try {
      await logoutGoogle();
      setUser(null);
      showBanner('Signed out of Google Workspace.', 'success');
    } catch (err: any) {
      console.error(err);
    }
  };

  // Create Google Sheet with Tabs
  const handleCreateSheet = async () => {
    const token = await getAccessToken();
    if (!token) {
      showBanner('Please sign in with Google first.', 'alert');
      return;
    }

    setIsAuthLoading(true);
    try {
      const result = await createFaceTrackingSpreadsheet(token);
      setSheetsConfig((prev) => ({
        ...prev,
        spreadsheetId: result.spreadsheetId,
        spreadsheetUrl: result.spreadsheetUrl,
        sheetTitle: result.sheetTitle,
        isAutoLogging: true,
      }));
      showBanner('Google Sheet created with Live Logs, Members, & Check-ins tabs!', 'success');
    } catch (err: any) {
      showBanner(err.message || 'Failed to create Google Sheet.', 'error');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Member Check-in Handler (Face identification or QR scan or manual)
  const handleCheckInMember = useCallback(
    async (
      member: EnrolledMember,
      method: 'face_recognition' | 'qr_scan' | 'manual',
      confidence = 0.95
    ) => {
      const nowMs = Date.now();
      const lastCheckIn = lastCheckInCooldownRef.current[member.id] || 0;

      // Cooldown: prevent duplicate check-ins within 8 seconds for the same person
      if (nowMs - lastCheckIn < 8000 && method !== 'manual') {
        return;
      }

      lastCheckInCooldownRef.current[member.id] = nowMs;
      playChime();

      const now = new Date();
      const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
      const timeDisplay = now.toLocaleTimeString();
      const updatedVisitCount = (member.visitCount || 0) + 1;

      // Update Member state
      setEnrolledMembers((prev) =>
        prev.map((m) =>
          m.id === member.id
            ? { ...m, visitCount: updatedVisitCount, lastSeenAt: timestamp }
            : m
        )
      );

      let syncedSheets = false;
      let syncedTelegram = false;

      // 1. Sync to Google Sheets if connected
      const token = await getAccessToken();
      if (sheetsConfig.spreadsheetId && token) {
        try {
          await appendMemberCheckInToSheet(token, sheetsConfig.spreadsheetId, {
            timestamp,
            memberId: member.id,
            memberName: member.name,
            phoneNumber: member.phoneNumber,
            method,
            visitNumber: updatedVisitCount,
            telegramSent: false,
          });
          syncedSheets = true;
        } catch (e: any) {
          console.error('Failed to log member check-in to Sheets:', e);
        }
      }

      // 2. Dispatch Telegram alert if enabled
      if (telegramConfig.enabled && telegramConfig.botToken && telegramConfig.chatId) {
        try {
          const msg = formatTelegramMemberAlert(
            {
              id: member.id,
              name: member.name,
              phoneNumber: member.phoneNumber,
              visitCount: updatedVisitCount,
            },
            method,
            confidence,
            timestamp,
            sheetsConfig.spreadsheetUrl
          );
          await sendTelegramMessage({
            botToken: telegramConfig.botToken,
            chatId: telegramConfig.chatId,
            message: msg,
          });
          syncedTelegram = true;
        } catch (err: any) {
          console.error('Telegram member check-in alert error:', err);
        }
      }

      // 3. Append to Member Check-In Log
      const newCheckIn: MemberCheckInLog = {
        id: `${Date.now()}-${Math.random()}`,
        memberId: member.id,
        memberName: member.name,
        phoneNumber: member.phoneNumber,
        timestamp,
        timeDisplay,
        method,
        confidence,
        visitNumber: updatedVisitCount,
        syncedSheets,
        syncedTelegram,
      };

      setMemberCheckIns((prev) => [newCheckIn, ...prev]);

      const methodLabel = method === 'qr_scan' ? 'QR Pass' : method === 'face_recognition' ? 'Face Scan' : 'Manual';
      showBanner(`Check-in recorded: ${member.name} (${methodLabel}, Visit #${updatedVisitCount})`, 'success');
    },
    [sheetsConfig, telegramConfig]
  );

  // New Member Enrolled Handler
  const handleEnrollSuccess = async (newMember: EnrolledMember) => {
    setEnrolledMembers((prev) => [newMember, ...prev]);

    const timestamp = newMember.enrolledAt;

    // 1. Log to Google Sheet "Members Directory" if connected
    const token = await getAccessToken();
    if (sheetsConfig.spreadsheetId && token) {
      try {
        await appendMemberToSheet(token, sheetsConfig.spreadsheetId, {
          id: newMember.id,
          name: newMember.name,
          phoneNumber: newMember.phoneNumber,
          enrolledAt: timestamp,
          visitCount: 0,
          lastSeenAt: timestamp,
        });
      } catch (err) {
        console.error('Failed to append new member to Google Sheet:', err);
      }
    }

    // 2. Dispatch Telegram Notification if enabled
    if (telegramConfig.enabled && telegramConfig.botToken && telegramConfig.chatId) {
      try {
        const msg = formatTelegramMemberEnrollment(
          {
            id: newMember.id,
            name: newMember.name,
            phoneNumber: newMember.phoneNumber,
          },
          timestamp,
          sheetsConfig.spreadsheetUrl
        );
        await sendTelegramMessage({
          botToken: telegramConfig.botToken,
          chatId: telegramConfig.chatId,
          message: msg,
        });
      } catch (err) {
        console.error('Failed to dispatch new member Telegram alert:', err);
      }
    }

    showBanner(`Enrolled ${newMember.name} (${newMember.phoneNumber}) with QR Pass!`, 'success');
  };

  // Delete Member Handler
  const handleDeleteMember = (memberId: string) => {
    setEnrolledMembers((prev) => prev.filter((m) => m.id !== memberId));
    showBanner('Member removed from local database.', 'alert');
  };

  // Start Camera Stream
  const startCameraStream = useCallback(async (): Promise<boolean> => {
    if (isStreaming && videoRef.current?.srcObject) return true;
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera device access is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      trackerRef.current = new HybridFaceTracker();

      // Initialize QR canvas
      if (!qrCanvasRef.current) {
        const qc = document.createElement('canvas');
        qc.width = 320;
        qc.height = 240;
        qrCanvasRef.current = qc;
        qrCtxRef.current = qc.getContext('2d', { willReadFrequently: true });
      }

      setIsStreaming(true);
      showBanner('Live face recognition & QR scan active.', 'success');
      return true;
    } catch (err: any) {
      console.error('Camera access error:', err);
      const msg = err.message || 'Could not access camera. Please allow camera permissions.';
      setCameraError(msg);
      showBanner(msg, 'error');
      return false;
    }
  }, [isStreaming]);

  // Stop Camera Stream
  const stopCameraStream = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setFaces([]);
    setFps(0);
    showBanner('Camera scan paused.', 'alert');
  }, []);

  // Toggle Camera Stream
  const toggleCameraStream = async () => {
    if (isStreaming) {
      stopCameraStream();
    } else {
      await startCameraStream();
    }
  };

  // Helper to open enrollment modal and kick off camera automatically
  const handleOpenEnrollModal = () => {
    setIsEnrollModalOpen(true);
    if (!isStreaming) {
      startCameraStream().catch(() => {});
    }
  };

  // Real-time Face Tracking + Member Recognition + QR Scan Loop
  useEffect(() => {
    if (!isStreaming) return;

    let isSubscribed = true;

    const runDetection = async () => {
      if (!isSubscribed) return;

      const video = videoRef.current;
      const tracker = trackerRef.current;

      if (video && tracker && video.readyState >= 2) {
        try {
          // 1. Detect faces in current frame
          const rawFaces = await tracker.detectFaces(video);

          // 2. Cross-reference detected faces with enrolled members biometrics
          const enrichedFaces = matchDetectedFaces(video, rawFaces, enrolledMembers);

          if (isSubscribed) {
            setFaces(enrichedFaces);
          }

          // 3. Periodic QR Code Scan (every 10 frames to optimize CPU)
          qrScanFrameCounterRef.current++;
          if (qrScanFrameCounterRef.current % 10 === 0 && qrCanvasRef.current && qrCtxRef.current) {
            const qrResult = scanQRCodeFromFrame(video, qrCanvasRef.current, qrCtxRef.current);
            if (qrResult && qrResult.payload) {
              setLastQrScannedText(qrResult.payload.slice(0, 32));

              // Parse payload to check if it's an enrolled member
              let matchedMember: EnrolledMember | undefined;

              try {
                const parsed = JSON.parse(qrResult.payload);
                if (parsed && parsed.id) {
                  matchedMember = enrolledMembers.find((m) => m.id === parsed.id);
                }
              } catch {
                // Not JSON, check direct ID or phone number
                matchedMember = enrolledMembers.find(
                  (m) => m.id === qrResult.payload || m.phoneNumber === qrResult.payload
                );
              }

              if (matchedMember) {
                handleCheckInMember(matchedMember, 'qr_scan', 1.0);
              }
            }
          }
        } catch (e) {
          console.warn('Detection loop error:', e);
        }

        // Calculate FPS
        frameCountRef.current++;
        const now = performance.now();
        const elapsed = now - lastFrameTimeRef.current;
        if (elapsed >= 1000) {
          setFps(Math.round((frameCountRef.current * 1000) / elapsed));
          frameCountRef.current = 0;
          lastFrameTimeRef.current = now;
        }
      }

      animationFrameRef.current = requestAnimationFrame(runDetection);
    };

    animationFrameRef.current = requestAnimationFrame(runDetection);

    return () => {
      isSubscribed = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isStreaming, enrolledMembers, handleCheckInMember]);

  // Log crowd count event (to state, Sheets, and Telegram)
  const logCurrentCount = useCallback(
    async (isAutomated = false) => {
      const currentCount = faces.length;
      const now = new Date();
      const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
      const timeDisplay = now.toLocaleTimeString();
      const isPeak = currentCount >= telegramConfig.alertThreshold;

      let syncedSheets = false;
      let syncedTelegram = false;

      setIsLogging(true);

      // 1. Sync to Google Sheets if configured
      const token = await getAccessToken();
      if (sheetsConfig.spreadsheetId && token) {
        try {
          await appendFaceLogToSheet(token, sheetsConfig.spreadsheetId, {
            timestamp,
            count: currentCount,
            status: isPeak ? 'Peak' : currentCount === 0 ? 'Empty' : 'Normal',
            telegramSent: false,
            notes: isAutomated ? 'Auto Sync Interval' : 'Manual Scan Check',
          });
          syncedSheets = true;
        } catch (e: any) {
          console.error('Failed to append to Google Sheet:', e);
        }
      }

      // 2. Dispatch Telegram alert if enabled & threshold reached
      if (
        telegramConfig.enabled &&
        telegramConfig.botToken &&
        telegramConfig.chatId &&
        (!isAutomated || (telegramConfig.autoAlertOnPeak && isPeak))
      ) {
        try {
          const alertMsg = formatTelegramFaceAlert(
            currentCount,
            telegramConfig.alertThreshold,
            timestamp,
            sheetsConfig.spreadsheetUrl
          );
          await sendTelegramMessage({
            botToken: telegramConfig.botToken,
            chatId: telegramConfig.chatId,
            message: alertMsg,
          });
          syncedTelegram = true;
        } catch (err: any) {
          console.error('Telegram dispatch error:', err);
        }
      }

      const newEntry: CountLogEntry = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp,
        timeDisplay,
        count: currentCount,
        status: isPeak ? 'Peak' : currentCount === 0 ? 'Empty' : 'Normal',
        syncedSheets,
        syncedTelegram,
        notes: isAutomated ? 'Auto Interval' : 'Manual Entry',
      };

      setLogs((prev) => [newEntry, ...prev]);
      setIsLogging(false);

      if (!isAutomated) {
        showBanner(`Logged headcount of ${currentCount} faces.`, 'success');
      }
    },
    [faces.length, telegramConfig, sheetsConfig]
  );

  // Automated Headcount Timer
  useEffect(() => {
    if (!sheetsConfig.isAutoLogging || !isStreaming || !sheetsConfig.spreadsheetId) return;

    const intervalMs = Math.max(3, sheetsConfig.autoLogIntervalSeconds) * 1000;
    const interval = setInterval(() => {
      logCurrentCount(true);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [
    sheetsConfig.isAutoLogging,
    sheetsConfig.autoLogIntervalSeconds,
    sheetsConfig.spreadsheetId,
    isStreaming,
    logCurrentCount,
  ]);

  // Test Telegram Dispatch
  const handleTestTelegram = async () => {
    setIsTelegramSending(true);
    try {
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const testMsg = formatTelegramFaceAlert(
        faces.length,
        telegramConfig.alertThreshold,
        now,
        sheetsConfig.spreadsheetUrl
      );
      await sendTelegramMessage({
        botToken: telegramConfig.botToken,
        chatId: telegramConfig.chatId,
        message: testMsg,
      });
      showBanner('Telegram test message dispatched successfully!', 'success');
    } finally {
      setIsTelegramSending(false);
    }
  };

  const primaryFace = faces[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white flex flex-col font-sans antialiased">
      {/* Top Application Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-emerald-500 to-teal-400 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-950/50">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <ScanFace className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Face Tracker & Member Recognition</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Live Scan + QR
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Face tracking, phone enrollment, biometric recognition, QR passes, Google Sheets & Telegram alerts
            </p>
          </div>
        </div>

        {/* Top Actions & Status */}
        <div className="flex items-center gap-2.5">
          <button
            id="open-directory-btn"
            onClick={() => setIsMemberDirectoryOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span>Members ({enrolledMembers.length})</span>
          </button>

          <button
            id="open-enroll-btn"
            onClick={handleOpenEnrollModal}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow shadow-emerald-950/40 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Enroll Member</span>
          </button>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <Radio
              className={`w-3.5 h-3.5 ${
                isStreaming ? 'text-emerald-400 animate-pulse' : 'text-slate-500'
              }`}
            />
            <span className="text-slate-300 font-medium">
              {isStreaming ? `Live (${faces.length} in view)` : 'Scanner Off'}
            </span>
          </div>
        </div>
      </header>

      {/* Global Notification Banner */}
      {notificationBanner && (
        <div
          className={`px-4 py-2.5 text-xs text-center font-medium transition-all ${
            notificationBanner.type === 'success'
              ? 'bg-emerald-950/80 border-b border-emerald-500/30 text-emerald-300'
              : notificationBanner.type === 'alert'
              ? 'bg-amber-950/80 border-b border-amber-500/30 text-amber-300'
              : 'bg-rose-950/80 border-b border-rose-500/30 text-rose-300'
          }`}
        >
          {notificationBanner.text}
        </div>
      )}

      {/* Main Body Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Top Section: Live Face Scanner + Metrics HUD */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Video Viewfinder */}
          <div className="lg:col-span-8">
            <FaceScanner
              isStreaming={isStreaming}
              faces={faces}
              onToggleStream={toggleCameraStream}
              videoRef={videoRef}
              canvasRef={canvasRef}
              fps={fps}
              cameraError={cameraError}
              onOpenEnrollModal={handleOpenEnrollModal}
              onCheckInMember={handleCheckInMember}
              enrolledMembers={enrolledMembers}
              lastQrScannedText={lastQrScannedText}
            />
          </div>

          {/* Real-time Headcount & Membership HUD */}
          <div className="lg:col-span-4 space-y-4">
            {/* Live Crowd Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Current Headcount
                </span>
                {faces.length >= telegramConfig.alertThreshold && (
                  <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    <AlertTriangle className="w-3 h-3" />
                    PEAK OCCUPANCY
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-5xl font-extrabold text-white tracking-tight">
                  {faces.length}
                </span>
                <span className="text-sm font-medium text-slate-400">
                  {faces.length === 1 ? 'person in view' : 'people in view'}
                </span>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Enrolled Members</span>
                  <span className="text-cyan-400 font-semibold text-sm">
                    {enrolledMembers.length} registered
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Check-Ins</span>
                  <span className="text-emerald-400 font-semibold text-sm">
                    {memberCheckIns.length} recorded
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-slate-300">Quick Scanner Actions</span>

              <button
                onClick={handleOpenEnrollModal}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition shadow flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Enroll Member (Phone + Face)</span>
              </button>

              <button
                onClick={() => setIsMemberDirectoryOpen(true)}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>View & Print Member QR Passes</span>
              </button>

              <button
                onClick={() => logCurrentCount(false)}
                disabled={!isStreaming || isLogging}
                className="w-full py-2 px-4 bg-slate-900 hover:bg-slate-850 disabled:opacity-50 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{isLogging ? 'Logging...' : 'Log Headcount to Sheet'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Integrations Row: Google Sheets Sync + Telegram Bot */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SheetsSyncCard
            user={user}
            sheetsConfig={sheetsConfig}
            isLoading={isAuthLoading}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onCreateSheet={handleCreateSheet}
            onToggleAutoLogging={() =>
              setSheetsConfig((prev) => ({
                ...prev,
                isAutoLogging: !prev.isAutoLogging,
              }))
            }
            onChangeInterval={(seconds) =>
              setSheetsConfig((prev) => ({
                ...prev,
                autoLogIntervalSeconds: seconds,
              }))
            }
          />

          <TelegramBotCard
            config={telegramConfig}
            onUpdateConfig={setTelegramConfig}
            onSendTestAlert={handleTestTelegram}
            isSending={isTelegramSending}
          />
        </div>

        {/* Log Stream Section with Tabs */}
        <div className="space-y-3">
          {/* Tab Switcher */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <button
              onClick={() => setActiveLogTab('members')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
                activeLogTab === 'members'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Member Check-Ins & Attendance</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
                {memberCheckIns.length}
              </span>
            </button>

            <button
              onClick={() => setActiveLogTab('crowd')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
                activeLogTab === 'crowd'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Crowd Headcount Log</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
                {logs.length}
              </span>
            </button>
          </div>

          {/* Active Tab Table */}
          {activeLogTab === 'members' ? (
            <MemberCheckInTable
              checkIns={memberCheckIns}
              enrolledMembers={enrolledMembers}
              spreadsheetUrl={sheetsConfig.spreadsheetUrl}
              onOpenDirectory={() => setIsMemberDirectoryOpen(true)}
            />
          ) : (
            <CountLogTable
              logs={logs}
              onManualLog={() => logCurrentCount(false)}
              isLogging={isLogging}
              canLog={isStreaming}
              spreadsheetUrl={sheetsConfig.spreadsheetUrl}
            />
          )}
        </div>
      </main>

      {/* Member Enrollment Modal */}
      <EnrollMemberModal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        videoRef={videoRef}
        isStreaming={isStreaming}
        onEnrollSuccess={handleEnrollSuccess}
        primaryFaceBox={primaryFace}
        onStartCamera={startCameraStream}
      />

      {/* Member Directory & QR Passes Modal */}
      <MemberDirectoryModal
        isOpen={isMemberDirectoryOpen}
        onClose={() => setIsMemberDirectoryOpen(false)}
        members={enrolledMembers}
        onCheckInMember={(member, method) => handleCheckInMember(member, method, 1.0)}
        onDeleteMember={handleDeleteMember}
        spreadsheetUrl={sheetsConfig.spreadsheetUrl}
      />
    </div>
  );
}
