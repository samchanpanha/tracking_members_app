import React, { useState } from 'react';
import { Send, Bell, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { TelegramConfig } from '../types';

interface TelegramBotCardProps {
  config: TelegramConfig;
  onUpdateConfig: (newConfig: TelegramConfig) => void;
  onSendTestAlert: () => Promise<void>;
  isSending: boolean;
}

export const TelegramBotCard: React.FC<TelegramBotCardProps> = ({
  config,
  onUpdateConfig,
  onSendTestAlert,
  isSending,
}) => {
  const [tokenInput, setTokenInput] = useState(config.botToken);
  const [chatIdInput, setChatIdInput] = useState(config.chatId);
  const [thresholdInput, setThresholdInput] = useState(config.alertThreshold.toString());
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const thresholdNum = Math.max(1, parseInt(thresholdInput, 10) || 1);
    onUpdateConfig({
      ...config,
      botToken: tokenInput.trim(),
      chatId: chatIdInput.trim(),
      alertThreshold: thresholdNum,
    });
    setStatusMsg({ type: 'success', text: 'Telegram Bot settings saved!' });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleTest = async () => {
    setStatusMsg(null);
    try {
      await onSendTestAlert();
      setStatusMsg({ type: 'success', text: 'Test alert sent successfully to Telegram!' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to dispatch Telegram message' });
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Telegram Bot Alerts</h3>
              <p className="text-xs text-slate-400">Instant headcount threshold & crowd alert notifications</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Active</label>
            <button
              id="toggle-telegram-enabled-btn"
              onClick={() => onUpdateConfig({ ...config, enabled: !config.enabled })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                config.enabled ? 'bg-sky-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  config.enabled ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Telegram Bot Token
            </label>
            <input
              type="password"
              placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRstuVWXyz"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Obtained from @BotFather in Telegram
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Telegram Chat / Channel ID
              </label>
              <input
                type="text"
                placeholder="e.g. 987654321 or @mychannel"
                value={chatIdInput}
                onChange={(e) => setChatIdInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Alert Count Threshold
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={config.autoAlertOnPeak}
                onChange={(e) =>
                  onUpdateConfig({ ...config, autoAlertOnPeak: e.target.checked })
                }
                className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0"
              />
              <span>Trigger alert when count ≥ threshold</span>
            </label>
          </div>

          {statusMsg && (
            <div
              className={`p-2 rounded-lg text-xs flex items-center gap-1.5 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/40 border border-rose-500/30 text-rose-300'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">{statusMsg.text}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition cursor-pointer"
            >
              Save Bot Config
            </button>
            <button
              type="button"
              id="test-telegram-btn"
              onClick={handleTest}
              disabled={isSending || !tokenInput || !chatIdInput}
              className="py-2 px-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{isSending ? 'Sending...' : 'Test Bot'}</span>
            </button>
          </div>
        </form>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center gap-2 text-[11px] text-slate-400">
        <ShieldCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
        <span>Telegram alerts are dispatched via direct secure HTTPS bot webhook.</span>
      </div>
    </div>
  );
};
