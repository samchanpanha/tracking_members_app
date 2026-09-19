import React from 'react';
import { LogOut, RefreshCw, Table2, ExternalLink } from 'lucide-react';
import { User } from 'firebase/auth';
import { SheetsConfig } from '../types';

interface SheetsSyncCardProps {
  user: User | null;
  sheetsConfig: SheetsConfig;
  isLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onCreateSheet: () => void;
  onToggleAutoLogging: () => void;
  onChangeInterval: (seconds: number) => void;
}

export const SheetsSyncCard: React.FC<SheetsSyncCardProps> = ({
  user,
  sheetsConfig,
  isLoading,
  onSignIn,
  onSignOut,
  onCreateSheet,
  onToggleAutoLogging,
  onChangeInterval,
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Table2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Google Sheets Sync
              </h3>
              <p className="text-xs text-slate-400">Automatic live headcount logging & cloud analytics</p>
            </div>
          </div>

          {user && (
            <button
              id="sign-out-button"
              onClick={onSignOut}
              title="Sign Out"
              className="text-xs text-slate-400 hover:text-rose-400 p-1.5 rounded-lg border border-slate-800 hover:border-rose-900/50 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* User Account / Google Auth Status */}
        {!user ? (
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 text-center mb-4">
            <p className="text-xs text-slate-400 mb-3">
              Sign in with your Google account to create and stream real-time face logs directly into your Google Sheets.
            </p>
            <button
              id="google-signin-btn"
              onClick={onSignIn}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-200 bg-white/10 hover:bg-white/15 border border-white/20 transition-all shadow-sm w-full cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isLoading ? 'Connecting...' : 'Sign in with Google'}</span>
            </button>
          </div>
        ) : (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 mb-4">
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Google User'}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full border border-emerald-500/40"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-white text-xs">
                  {user.email?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white truncate">{user.displayName || 'Google User'}</div>
                <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
              </div>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Connected
              </span>
            </div>
          </div>
        )}

        {/* Connected Spreadsheet Info / Create Button */}
        {user && (
          <div className="space-y-3">
            {sheetsConfig.spreadsheetId ? (
              <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="text-slate-400 font-medium">Synced Sheet:</span>
                  <a
                    href={sheetsConfig.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
                  >
                    <span>Open Sheet</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="mt-1 text-xs font-mono text-slate-200 truncate">
                  {sheetsConfig.sheetTitle || 'Face Tracking & Counter Log'}
                </div>
              </div>
            ) : (
              <button
                id="create-new-sheet-btn"
                onClick={onCreateSheet}
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Table2 className="w-3.5 h-3.5" />}
                <span>Create New Synced Google Sheet</span>
              </button>
            )}

            {/* Auto-Logging Interval Controls */}
            {sheetsConfig.spreadsheetId && (
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">Auto-Log to Sheet</label>
                  <button
                    id="toggle-auto-log-btn"
                    onClick={onToggleAutoLogging}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                      sheetsConfig.isAutoLogging ? 'bg-emerald-600' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        sheetsConfig.isAutoLogging ? 'translate-x-4' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {sheetsConfig.isAutoLogging && (
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Sync Interval:</span>
                    <select
                      value={sheetsConfig.autoLogIntervalSeconds}
                      onChange={(e) => onChangeInterval(Number(e.target.value))}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value={3}>Every 3 sec</option>
                      <option value={5}>Every 5 sec</option>
                      <option value={10}>Every 10 sec</option>
                      <option value={30}>Every 30 sec</option>
                      <option value={60}>Every 1 min</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
