import React, { useState } from 'react';
import {
  X,
  Search,
  Phone,
  QrCode,
  CheckCircle2,
  Calendar,
  Users,
  Download,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { EnrolledMember } from '../types';

interface MemberDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: EnrolledMember[];
  onCheckInMember: (member: EnrolledMember, method: 'manual' | 'qr_scan' | 'face_recognition') => void;
  onDeleteMember: (memberId: string) => void;
  spreadsheetUrl?: string;
}

export const MemberDirectoryModal: React.FC<MemberDirectoryModalProps> = ({
  isOpen,
  onClose,
  members,
  onCheckInMember,
  onDeleteMember,
  spreadsheetUrl,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberPass, setSelectedMemberPass] = useState<EnrolledMember | null>(null);

  if (!isOpen) return null;

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      m.name.toLowerCase().includes(q) ||
      m.phoneNumber.includes(q) ||
      m.id.toLowerCase().includes(q) ||
      (m.notes && m.notes.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-8 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Enrolled Members Directory</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {members.length} {members.length === 1 ? 'member' : 'members'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">Stored face profiles, QR code passes, and visit counters</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/30 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by phone, name, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
            />
          </div>

          {spreadsheetUrl && (
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
            >
              <span>View In Google Sheets</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Member List */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {filteredMembers.length === 0 ? (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <Users className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm font-medium">No members match your criteria.</p>
              <p className="text-xs">Click "Enroll Member" in the top bar to register people with their phone number.</p>
            </div>
          ) : (
            filteredMembers.map((member) => (
              <div
                key={member.id}
                className="p-4 bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition"
              >
                {/* Member Profile */}
                <div className="flex items-center gap-3.5">
                  <img
                    src={member.photoDataUrl}
                    alt={member.name}
                    className="w-14 h-14 rounded-xl object-cover border border-emerald-500/40 shadow shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{member.name}</h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {member.id}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1 font-mono text-slate-300">
                        <Phone className="w-3 h-3 text-slate-500" />
                        {member.phoneNumber}
                      </span>

                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        Joined {member.enrolledAt.split(' ')[0]}
                      </span>

                      {member.notes && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800/80 text-emerald-400 border border-emerald-500/20">
                          {member.notes}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Visit Counter & Quick Actions */}
                <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Visits Count</span>
                    <span className="text-sm font-extrabold text-white bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-700 inline-block">
                      {member.visitCount}
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedMemberPass(member)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
                    title="View & Download QR Pass"
                  >
                    <QrCode className="w-4 h-4 text-emerald-400" />
                  </button>

                  <button
                    onClick={() => onCheckInMember(member, 'manual')}
                    className="py-1.5 px-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 transition shadow cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Check In</span>
                  </button>

                  <button
                    onClick={() => onDeleteMember(member.id)}
                    className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 transition cursor-pointer"
                    title="Remove Member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800/80 bg-slate-950/50 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            Close Directory
          </button>
        </div>
      </div>

      {/* Enlarged QR Pass Modal */}
      {selectedMemberPass && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl relative">
            <button
              onClick={() => setSelectedMemberPass(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center">
              <img
                src={selectedMemberPass.photoDataUrl}
                alt={selectedMemberPass.name}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-500 shadow-lg mb-2"
              />
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {selectedMemberPass.id}
              </span>
              <h3 className="text-lg font-bold text-white mt-1">{selectedMemberPass.name}</h3>
              <p className="text-xs text-slate-400 font-mono">{selectedMemberPass.phoneNumber}</p>

              {/* QR Image Box */}
              <div className="p-4 bg-white rounded-2xl shadow-xl my-4">
                <img
                  src={selectedMemberPass.qrCodeDataUrl}
                  alt="Member QR Pass"
                  className="w-48 h-48 mx-auto"
                />
                <p className="text-[10px] font-mono text-slate-800 font-bold mt-1">
                  SHOW PASS TO CAMERA SCANNER
                </p>
              </div>

              <div className="w-full flex gap-2">
                <a
                  href={selectedMemberPass.qrCodeDataUrl}
                  download={`Member-Pass-${selectedMemberPass.id}.png`}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download Pass</span>
                </a>
                <button
                  onClick={() => {
                    onCheckInMember(selectedMemberPass, 'manual');
                    setSelectedMemberPass(null);
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
                >
                  Check In Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
