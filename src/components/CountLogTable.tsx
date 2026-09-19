import React from 'react';
import { CountLogEntry } from '../types';
import { Activity, Clock, Users, Send, FileSpreadsheet } from 'lucide-react';

interface CountLogTableProps {
  logs: CountLogEntry[];
  onManualLog: () => void;
  isLogging: boolean;
  canLog: boolean;
  spreadsheetUrl?: string;
}

export const CountLogTable: React.FC<CountLogTableProps> = ({
  logs,
  onManualLog,
  isLogging,
  canLog,
  spreadsheetUrl,
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <span>Face Tracking Event Stream</span>
          </h3>
          <p className="text-xs text-slate-400">
            Real-time audit history of scanned face counts, Google Sheet writes, and Telegram alert triggers
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
              <span>View In Sheets</span>
            </a>
          )}

          <button
            id="manual-log-btn"
            onClick={onManualLog}
            disabled={!canLog || isLogging}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow transition flex items-center gap-1.5 cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            <span>{isLogging ? 'Logging...' : 'Log Current Count'}</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/60 text-slate-400 font-medium uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">Time</th>
              <th className="py-2.5 px-3">Detected Count</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-center">Sheets Synced</th>
              <th className="py-2.5 px-3 text-center">Telegram Notified</th>
              <th className="py-2.5 px-3">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-500 italic">
                  No scan entries recorded yet. Start camera scan to log face counts.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2 px-3 font-mono text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{log.timeDisplay}</span>
                  </td>
                  <td className="py-2 px-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 font-bold text-white">
                      <Users className="w-3 h-3 text-emerald-400" />
                      {log.count}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                        log.status === 'Peak'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : log.status === 'Normal'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    {log.syncedSheets ? (
                      <span className="text-emerald-400 font-semibold text-[11px] inline-flex items-center gap-1">
                        ✓ Synced
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {log.syncedTelegram ? (
                      <span className="text-sky-400 font-semibold text-[11px] inline-flex items-center gap-1">
                        <Send className="w-3 h-3" /> Sent
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-slate-400 text-[11px] truncate max-w-[200px]">
                    {log.notes || 'Routine Headcount'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
