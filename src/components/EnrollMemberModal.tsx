import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  X,
  Check,
  QrCode,
  Phone,
  User as UserIcon,
  ShieldAlert,
  Upload,
  RefreshCw,
  Sparkles,
  Video,
  CheckCircle2,
} from 'lucide-react';
import { EnrolledMember } from '../types';
import {
  generateMemberId,
  generateMemberQRCode,
  captureFaceForEnrollment,
  processImageFileForEnrollment,
} from '../lib/memberRecognition';

interface EnrollMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isStreaming: boolean;
  onEnrollSuccess: (newMember: EnrolledMember) => void;
  primaryFaceBox?: { x: number; y: number; width: number; height: number };
  onStartCamera?: () => Promise<boolean>;
}

export const EnrollMemberModal: React.FC<EnrollMemberModalProps> = ({
  isOpen,
  onClose,
  videoRef,
  isStreaming,
  onEnrollSuccess,
  primaryFaceBox,
  onStartCamera,
}) => {
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [featureVector, setFeatureVector] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [enrolledMemberResult, setEnrolledMemberResult] = useState<EnrolledMember | null>(null);
  const [captureMode, setCaptureMode] = useState<'camera' | 'upload'>('camera');
  const [isDragging, setIsDragging] = useState(false);

  // In-modal live video viewfinder ref
  const modalVideoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Attempt auto-start camera when modal opens if not already streaming
  useEffect(() => {
    if (!isOpen) return;

    if (!isStreaming && onStartCamera && !capturedPhoto) {
      setIsStartingCamera(true);
      onStartCamera()
        .catch((err) => {
          console.warn('Auto camera start:', err);
        })
        .finally(() => {
          setIsStartingCamera(false);
        });
    }
  }, [isOpen, isStreaming, onStartCamera, capturedPhoto]);

  // Connect active media stream to in-modal preview video element
  useEffect(() => {
    if (!isOpen || !modalVideoRef.current) return;

    const sourceVideo = videoRef.current;
    if (sourceVideo && sourceVideo.srcObject) {
      modalVideoRef.current.srcObject = sourceVideo.srcObject;
      modalVideoRef.current.play().catch(() => {});
    } else {
      modalVideoRef.current.srcObject = null;
    }
  }, [isOpen, isStreaming, videoRef.current?.srcObject]);

  if (!isOpen) return null;

  // Handle starting camera on demand
  const handleStartCamera = async () => {
    setErrorMsg(null);
    if (!onStartCamera) {
      setErrorMsg('Camera starter is not available.');
      return;
    }

    setIsStartingCamera(true);
    try {
      const success = await onStartCamera();
      if (!success) {
        setErrorMsg('Could not access camera. Please allow camera permissions in your browser or upload a photo.');
      } else {
        setErrorMsg(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start camera.');
    } finally {
      setIsStartingCamera(false);
    }
  };

  // Capture face from camera stream
  const handleCaptureFace = async () => {
    setErrorMsg(null);

    // If stream is not active, automatically start it first!
    if (!isStreaming || !videoRef.current?.srcObject) {
      if (onStartCamera) {
        setIsStartingCamera(true);
        const started = await onStartCamera();
        setIsStartingCamera(false);
        if (!started) {
          setErrorMsg('Camera stream could not be started. Please allow camera permissions or upload a face photo.');
          return;
        }
        // Give camera 500ms to deliver initial decoded frames
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else {
        setErrorMsg('Camera stream is not active. Please start the camera or upload a photo.');
        return;
      }
    }

    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      setErrorMsg('Camera is still initializing. Please wait a moment and try again.');
      return;
    }

    try {
      const { photoDataUrl, featureVector: fVec } = captureFaceForEnrollment(
        video,
        primaryFaceBox
      );

      if (!photoDataUrl) {
        setErrorMsg('Could not detect or capture face image. Ensure your face is centered in the camera.');
        return;
      }

      setCapturedPhoto(photoDataUrl);
      setFeatureVector(fVec);
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error capturing face.');
    }
  };

  // Handle uploaded image file
  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload an image file (JPG, PNG, WebP).');
      return;
    }

    setErrorMsg(null);
    setIsProcessing(true);
    try {
      const { photoDataUrl, featureVector: fVec } = await processImageFileForEnrollment(file);
      setCapturedPhoto(photoDataUrl);
      setFeatureVector(fVec);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process uploaded photo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Member full name is required.');
      return;
    }

    if (!phoneNumber.trim()) {
      setErrorMsg('Member phone number is required.');
      return;
    }

    if (!capturedPhoto || featureVector.length === 0) {
      setErrorMsg('Please capture or upload the member\'s face first.');
      return;
    }

    setIsProcessing(true);
    try {
      const memberId = generateMemberId();
      const { qrCodeDataUrl, qrPayload } = await generateMemberQRCode({
        id: memberId,
        name: name.trim(),
        phoneNumber: phoneNumber.trim(),
      });

      const newMember: EnrolledMember = {
        id: memberId,
        name: name.trim(),
        phoneNumber: phoneNumber.trim(),
        enrolledAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        photoDataUrl: capturedPhoto,
        featureVector,
        qrCodeDataUrl,
        qrPayload,
        visitCount: 0,
        notes: notes.trim() || undefined,
      };

      onEnrollSuccess(newMember);
      setEnrolledMemberResult(newMember);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to enroll member.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setName('');
    setPhoneNumber('');
    setNotes('');
    setCapturedPhoto(null);
    setFeatureVector([]);
    setEnrolledMemberResult(null);
    setErrorMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-6">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Enroll New Member</h2>
              <p className="text-xs text-slate-400">Capture face for scan identification & generate QR pass</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {enrolledMemberResult ? (
            /* Success & Member Pass Screen */
            <div className="space-y-5 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Member Enrolled Successfully!</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Face biometrics stored for auto-identification and QR check-in pass generated.
                </p>
              </div>

              {/* Digital Member Pass Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border border-emerald-500/30 text-left shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                      Verified Member Pass
                    </span>
                    <h4 className="text-base font-bold text-white">{enrolledMemberResult.name}</h4>
                  </div>
                  <span className="text-xs font-mono px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                    {enrolledMemberResult.id}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <img
                    src={enrolledMemberResult.photoDataUrl}
                    alt={enrolledMemberResult.name}
                    className="w-20 h-20 rounded-xl object-cover border-2 border-emerald-500/60 shadow"
                  />
                  <div className="space-y-1.5 text-xs text-slate-300 flex-1">
                    <div className="flex items-center gap-1.5 font-mono text-cyan-400">
                      <Phone className="w-3.5 h-3.5" />
                      <span>{enrolledMemberResult.phoneNumber}</span>
                    </div>
                    {enrolledMemberResult.notes && (
                      <p className="text-slate-400 text-[11px] italic">
                        {enrolledMemberResult.notes}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-500">
                      Enrolled: {enrolledMemberResult.enrolledAt}
                    </p>
                  </div>
                </div>

                {/* QR Code */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <div className="p-2 bg-white rounded-xl shadow inline-block">
                    <img
                      src={enrolledMemberResult.qrCodeDataUrl}
                      alt="Member QR Pass"
                      className="w-24 h-24"
                    />
                  </div>
                  <div className="text-right text-xs space-y-1 max-w-[180px]">
                    <span className="text-[11px] font-semibold text-slate-300 block">
                      Fast-Scan Check-In
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Hold this QR pass in front of camera scanner for 1-second touchless check-in.
                    </p>
                    <span className="text-emerald-400 font-semibold text-[11px] flex items-center justify-end gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Ready for Live Scan
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <a
                  href={enrolledMemberResult.qrCodeDataUrl}
                  download={`Member-Pass-${enrolledMemberResult.id}.png`}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition"
                >
                  <QrCode className="w-4 h-4 text-emerald-400" />
                  <span>Download QR Pass</span>
                </a>
                <button
                  onClick={handleReset}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Enrollment Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span>{errorMsg}</span>
                  </div>
                </div>
              )}

              {/* Mode Toggle: Camera vs Upload */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <span>Member Face Photo</span>
                  <span className="text-emerald-400">*</span>
                </label>
                <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setCaptureMode('camera')}
                    className={`px-2.5 py-1 rounded-md transition font-medium flex items-center gap-1 cursor-pointer ${
                      captureMode === 'camera'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Camera className="w-3 h-3" />
                    <span>Live Camera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCaptureMode('upload')}
                    className={`px-2.5 py-1 rounded-md transition font-medium flex items-center gap-1 cursor-pointer ${
                      captureMode === 'upload'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Upload className="w-3 h-3" />
                    <span>Upload Photo</span>
                  </button>
                </div>
              </div>

              {/* Face Photo Capture Section */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col items-center text-center">
                {capturedPhoto ? (
                  /* Photo Captured State */
                  <div className="space-y-3 flex flex-col items-center">
                    <div className="relative">
                      <img
                        src={capturedPhoto}
                        alt="Captured Member Face"
                        className="w-32 h-32 rounded-2xl object-cover border-2 border-emerald-500 shadow-xl"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCapturedPhoto(null);
                          setFeatureVector([]);
                        }}
                        className="absolute -top-2 -right-2 p-1 bg-slate-800 hover:bg-rose-600 text-slate-200 rounded-full border border-slate-600 transition shadow cursor-pointer"
                        title="Retake Photo"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Face Biometrics Encoded (104 features)</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setCapturedPhoto(null);
                        setFeatureVector([]);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-200 underline transition cursor-pointer"
                    >
                      Retake or choose different photo
                    </button>
                  </div>
                ) : captureMode === 'camera' ? (
                  /* Live Camera Viewfinder / Capture Mode */
                  <div className="w-full flex flex-col items-center space-y-3">
                    {/* Viewfinder Preview Box */}
                    <div className="relative w-full max-w-[280px] h-[190px] rounded-2xl overflow-hidden bg-slate-900 border border-slate-700 shadow-inner flex items-center justify-center">
                      <video
                        ref={modalVideoRef}
                        playsInline
                        muted
                        autoPlay
                        className={`w-full h-full object-cover transform scale-x-[-1] ${
                          isStreaming ? 'block' : 'hidden'
                        }`}
                      />

                      {/* Face Positioning Guide Reticle (when streaming) */}
                      {isStreaming && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                          {/* Face Oval Frame */}
                          <div className="w-32 h-40 rounded-[50%] border-2 border-dashed border-emerald-400/70 animate-pulse flex items-center justify-center">
                            <span className="text-[10px] text-emerald-300 font-mono bg-slate-950/70 px-2 py-0.5 rounded backdrop-blur-sm -mt-24">
                              Align Face Here
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Off / Initializing State */}
                      {!isStreaming && (
                        <div className="flex flex-col items-center justify-center p-4 text-slate-400 space-y-2">
                          {isStartingCamera ? (
                            <>
                              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                              <span className="text-xs text-slate-300 font-medium">
                                Initializing camera feed...
                              </span>
                            </>
                          ) : (
                            <>
                              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                                <Video className="w-6 h-6" />
                              </div>
                              <span className="text-xs text-slate-300 font-medium">
                                Camera is currently off
                              </span>
                              <p className="text-[11px] text-slate-500 max-w-[220px]">
                                Start the camera to frame member face and record biometric vectors.
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Camera Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full max-w-[280px]">
                      {isStreaming ? (
                        <button
                          type="button"
                          id="capture-member-face-btn"
                          onClick={handleCaptureFace}
                          className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-lg shadow-emerald-950/40 cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Capture Face Snapshot</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          id="start-camera-enroll-btn"
                          onClick={handleStartCamera}
                          disabled={isStartingCamera}
                          className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-lg shadow-cyan-950/40 cursor-pointer disabled:opacity-50"
                        >
                          {isStartingCamera ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Starting Camera...</span>
                            </>
                          ) : (
                            <>
                              <Video className="w-4 h-4" />
                              <span>Start Camera to Capture Face</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* File Upload Dropzone Mode */
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full max-w-[280px] p-6 rounded-2xl border-2 border-dashed transition cursor-pointer flex flex-col items-center justify-center ${
                      isDragging
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-slate-700 bg-slate-900/60 hover:border-slate-600'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileUpload(e.target.files[0]);
                        }
                      }}
                    />
                    <Upload className="w-8 h-8 text-cyan-400 mb-2" />
                    <span className="text-xs font-semibold text-slate-200">
                      Choose Face Image or Drop
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1">
                      Supports JPG, PNG, WebP (auto biometric extraction)
                    </span>
                  </div>
                )}
              </div>

              {/* Inputs */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Full Name <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Phone Number <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +1 555-0199 or 012-345-678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none font-mono"
                  />
                  <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Used for search, member identification, and attendance logging
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Notes / Role (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. VIP Member, Guest, Staff, Student"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="confirm-enroll-btn"
                  disabled={isProcessing || !capturedPhoto || !name.trim() || !phoneNumber.trim()}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-lg shadow-emerald-950/40 cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{isProcessing ? 'Enrolling...' : 'Enroll & Generate QR Pass'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
