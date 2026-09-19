import React from 'react';
import { MemberCheckInLog, EnrolledMember } from '../types';
import { UserCheck, QrCode, ScanFace, Send, FileSpreadsheet, ExternalLink } from 'lucide-react';

interface MemberCheckInTableProps {
  checkIns: MemberCheckInLog[];
  enrolledMembers: EnrolledMember[];
  spreadsheetUrl?: string;
  onOpenDirectory: () => void;
}

export const MemberCheckInTable: React.FC<MemberCheckInTableProps> = ({
  checkIns,
  enrolledMembers,
  spreadsheetUrl,
  onOpenDirectory,
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-cyan-400" />
            <span>Member Check-In & Scan Attendance Log</span>
          </h3>
          <p className="text-xs text-slate-400">
            Real-time identification events from face biometric recognition and QR pass scans
          </p>
        </div>

        <div className="flex items-center gap-2">
          {spreadsheetUrl && (
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Open Sheets</span>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </a>
          )}

          <button
            onClick={onOpenDirectory}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>Directory ({enrolledMembers.length})</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/60 text-slate-400 font-medium uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">Time</th>
              <th className="py-2.5 px-3">Member</th>
              <th className="py-2.5 px-3">Phone</th>
              <th className="py-2.5 px-3">Scan Method</th>
              <th className="py-2.5 px-3">Visits</th>
              <th className="py-2.5 px-3">Match</th>
              <th className="py-2.5 px-3">Sheets</th>
              <th className="py-2.5 px-3">Telegram</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {checkIns.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500 font-sans text-xs">
                  No member check-ins recorded yet. Scan a face or QR code pass to register attendance.
                </td>
              </tr>
            ) : (
              checkIns.map((item) => {
                const member = enrolledMembers.find((m) => m.id === item.memberId);
                return (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                      {item.timeDisplay}
                    </td>
                    <td className="py-2.5 px-3 font-sans font-semibold text-white whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {member?.photoDataUrl ? (
                          <img
                            src={member.photoDataUrl}
                            alt={item.memberName}
                            className="w-6 h-6 rounded-lg object-cover border border-cyan-500/40"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 text-[10px]">
                            {item.memberName.charAt(0)}
                          </div>
                        )}
                        <span>{item.memberName}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                      {item.phoneNumber}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {item.method === 'qr_scan' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <QrCode className="w-3 h-3" />
                          <span>QR Pass</span>
                        </span>
                      ) : item.method === 'face_recognition' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          <ScanFace className="w-3 h-3" />
                          <span>Face Scan</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          <span>Manual</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-emerald-400 whitespace-nowrap">
                      #{item.visitNumber}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                      {item.confidence > 0 ? `${Math.round(item.confidence * 100)}%` : '100%'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {item.syncedSheets ? (
                        <span className="text-emerald-400 font-sans font-medium text-[11px] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Synced
                        </span>
                      ) : (
                        <span className="text-slate-500 font-sans text-[11px]">Local</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {item.syncedTelegram ? (
                        <span className="text-sky-400 font-sans font-medium text-[11px] flex items-center gap-1">
                          <Send className="w-3 h-3" />
                          Sent
                        </span>
                      ) : (
                        <span className="text-slate-500 font-sans text-[11px]">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
