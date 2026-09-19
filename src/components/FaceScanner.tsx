import React, { useRef, useEffect } from 'react';
import { Camera, CameraOff, Sparkles, UserCheck, UserPlus, QrCode } from 'lucide-react';
import { DetectedFace, EnrolledMember } from '../types';

interface FaceScannerProps {
  isStreaming: boolean;
  faces: DetectedFace[];
  onToggleStream: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  fps: number;
  cameraError?: string | null;
  onOpenEnrollModal: () => void;
  onCheckInMember?: (member: EnrolledMember, method: 'face_recognition' | 'qr_scan') => void;
  enrolledMembers?: EnrolledMember[];
  lastQrScannedText?: string | null;
}

export const FaceScanner: React.FC<FaceScannerProps> = ({
  isStreaming,
  faces,
  onToggleStream,
  videoRef,
  canvasRef,
  fps,
  cameraError,
  onOpenEnrollModal,
  onCheckInMember,
  enrolledMembers = [],
  lastQrScannedText,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Overlay face tracking boxes, member identification badges, and points on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Adjust canvas dimensions to match video presentation
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!isStreaming) return;

    faces.forEach((face, index) => {
      const isMember = !!face.matchedMember;
      const themeColor = isMember ? '#06b6d4' : '#22c55e'; // Cyan for recognized member, Emerald for visitor
      const cornerColor = isMember ? '#38bdf8' : '#4ade80';

      // 1. Draw target bounding box
      ctx.strokeStyle = themeColor;
      ctx.lineWidth = isMember ? 3.5 : 2.5;
      ctx.fillStyle = isMember ? 'rgba(6, 182, 212, 0.16)' : 'rgba(34, 197, 94, 0.10)';

      // Semi-transparent box background
      ctx.fillRect(face.x, face.y, face.width, face.height);

      // Rounded frame
      ctx.strokeRect(face.x, face.y, face.width, face.height);

      // Corner accent brackets
      const cornerLen = Math.min(face.width, face.height) * 0.22;
      ctx.strokeStyle = cornerColor;
      ctx.lineWidth = isMember ? 4.5 : 3.5;

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(face.x, face.y + cornerLen);
      ctx.lineTo(face.x, face.y);
      ctx.lineTo(face.x + cornerLen, face.y);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(face.x + face.width - cornerLen, face.y);
      ctx.lineTo(face.x + face.width, face.y);
      ctx.lineTo(face.x + face.width, face.y + cornerLen);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(face.x, face.y + face.height - cornerLen);
      ctx.lineTo(face.x, face.y + face.height);
      ctx.lineTo(face.x + cornerLen, face.y + face.height);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(face.x + face.width - cornerLen, face.y + face.height);
      ctx.lineTo(face.x + face.width, face.y + face.height);
      ctx.lineTo(face.x + face.width, face.y + face.height - cornerLen);
      ctx.stroke();

      // 2. Member Identification HUD Tag
      let label = `Face #${face.id || index + 1} (${Math.round(face.confidence * 100)}%)`;
      if (face.matchedMember) {
        label = `VERIFIED: ${face.matchedMember.name} • ${face.matchedMember.phoneNumber}`;
      }

      ctx.font = 'bold 13px ui-sans-serif, system-ui, -apple-system';
      const textMetrics = ctx.measureText(label);
      const tagHeight = 24;
      const tagWidth = textMetrics.width + 20;

      ctx.fillStyle = isMember ? 'rgba(8, 51, 68, 0.92)' : 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(face.x, Math.max(0, face.y - tagHeight - 4), tagWidth, tagHeight);

      if (isMember) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(face.x, Math.max(0, face.y - tagHeight - 4), tagWidth, tagHeight);
      }

      ctx.fillStyle = isMember ? '#67e8f9' : '#4ade80';
      ctx.fillText(label, face.x + 10, Math.max(16, face.y - 8));

      // 3. Landmarks
      if (face.landmarks) {
        ctx.fillStyle = isMember ? '#38bdf8' : '#38bdf8';
        const marks = [
          face.landmarks.leftEye,
          face.landmarks.rightEye,
          face.landmarks.nose,
          face.landmarks.mouth,
        ].filter(Boolean);

        marks.forEach((pt) => {
          if (pt) {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        });
      }
    });
  }, [faces, isStreaming, canvasRef, videoRef]);

  // Check if any face in current frame has an identified member
  const primaryIdentifiedFace = faces.find((f) => f.matchedMember);
  const matchedMemberObj = primaryIdentifiedFace?.matchedMember
    ? enrolledMembers.find((m) => m.id === primaryIdentifiedFace.matchedMember?.id)
    : null;

  return (
    <div
      id="face-scanner-container"
      ref={containerRef}
      className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center"
    >
      {/* Underlying Video */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`w-full h-full object-cover transform ${isStreaming ? 'scale-x-[-1]' : 'hidden'}`}
      />

      {/* Target Scanning Overlay Canvas */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full object-cover pointer-events-none transform ${
          isStreaming ? 'scale-x-[-1]' : 'hidden'
        }`}
      />

      {/* Camera Off / Inactive State */}
      {!isStreaming && (
        <div className="flex flex-col items-center justify-center p-6 text-center z-10 space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-400 shadow-inner">
            <CameraOff className="w-8 h-8 text-slate-400" />
          </div>
          <div className="max-w-md">
            <h3 className="text-lg font-semibold text-slate-200">Camera Feed Inactive</h3>
            <p className="text-sm text-slate-400 mt-1">
              {cameraError || 'Activate the live scan camera to initiate real-time face tracking, member recognition, QR check-in, and automated Sheet logging.'}
            </p>
          </div>
          <button
            id="start-camera-cta-button"
            onClick={onToggleStream}
            className="px-6 py-2.5 rounded-xl font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-950/40 flex items-center gap-2 cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Start Live Camera Scan</span>
          </button>
        </div>
      )}

      {/* Active Live Stream Controls & HUD */}
      {isStreaming && (
        <>
          {/* Top-left HUD badge */}
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs font-mono text-slate-200">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-semibold text-red-400">REC LIVE</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-300">{fps} FPS</span>
            <span className="text-slate-500">|</span>
            <span className="text-emerald-400 font-bold">{faces.length} {faces.length === 1 ? 'FACE' : 'FACES'}</span>
          </div>

          {/* Top-right Dual Mode (Face + QR) Indicator */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs text-slate-300">
              <QrCode className="w-3.5 h-3.5 text-cyan-400" />
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Face & QR Scanner Ready</span>
            </div>
          </div>

          {/* Live Recognized Member Floating Toast */}
          {matchedMemberObj && onCheckInMember && (
            <div className="absolute top-14 inset-x-4 max-w-md mx-auto z-20 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="bg-slate-900/95 backdrop-blur-md border-2 border-cyan-500/80 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={matchedMemberObj.photoDataUrl}
                    alt={matchedMemberObj.name}
                    className="w-11 h-11 rounded-xl object-cover border border-cyan-400 shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-bold text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-500/30">
                        Member Identified
                      </span>
                      <span className="text-xs font-bold text-white">{matchedMemberObj.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                      {matchedMemberObj.phoneNumber} • {matchedMemberObj.visitCount} prior visits
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onCheckInMember(matchedMemberObj, 'face_recognition')}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow transition cursor-pointer shrink-0"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Check In</span>
                </button>
              </div>
            </div>
          )}

          {/* QR Scanned Toast */}
          {lastQrScannedText && (
            <div className="absolute top-14 left-4 z-20 bg-emerald-950/90 border border-emerald-500/60 rounded-xl px-3 py-1.5 text-xs text-emerald-200 flex items-center gap-2 shadow-lg">
              <QrCode className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>QR Code Scanned: {lastQrScannedText}</span>
            </div>
          )}

          {/* Bottom Controls Bar */}
          <div className="absolute bottom-4 inset-x-4 flex justify-between items-center bg-slate-900/85 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-700/60">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-400">Live Faces:</span>
                <span className="text-sm font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  {faces.length}
                </span>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 border-l border-slate-800 pl-3">
                <span>Enrolled Members:</span>
                <span className="font-semibold text-cyan-400">{enrolledMembers.length}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="enroll-member-scanner-btn"
                onClick={onOpenEnrollModal}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 cursor-pointer shadow"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Enroll Member</span>
              </button>

              <button
                id="stop-camera-button"
                onClick={onToggleStream}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600/90 hover:bg-rose-500 text-white transition flex items-center gap-1.5 cursor-pointer"
              >
                <CameraOff className="w-3.5 h-3.5" />
                <span>Stop</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
