/**
 * Telegram Bot Dispatcher
 * Sends live crowd count alerts and summaries to Telegram via Bot API
 */

export interface SendTelegramMessageParams {
  botToken: string;
  chatId: string;
  message: string;
  parseMode?: 'HTML' | 'MarkdownV2';
}

export const sendTelegramMessage = async ({
  botToken,
  chatId,
  message,
  parseMode = 'HTML',
}: SendTelegramMessageParams): Promise<{ ok: boolean; description?: string }> => {
  if (!botToken.trim() || !chatId.trim()) {
    throw new Error('Telegram Bot Token and Chat ID are required.');
  }

  const cleanToken = botToken.trim();
  const cleanChatId = chatId.trim();

  const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: cleanChatId,
      text: message,
      parse_mode: parseMode,
    }),
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || 'Failed to send message to Telegram.');
  }

  return { ok: true };
};

export const formatTelegramFaceAlert = (
  count: number,
  threshold: number,
  timestamp: string,
  spreadsheetUrl?: string
): string => {
  const alertType = count >= threshold ? '🚨 <b>HIGH OCCUPANCY ALERT</b>' : '📊 <b>LIVE FACE COUNT UPDATE</b>';
  let text = `${alertType}\n\n`;
  text += `👥 <b>Current Detected Faces:</b> <code>${count}</code>\n`;
  text += `🎯 <b>Alert Threshold:</b> <code>${threshold}</code>\n`;
  text += `🕒 <b>Timestamp:</b> <i>${timestamp}</i>\n`;

  if (spreadsheetUrl) {
    text += `\n📑 <a href="${spreadsheetUrl}">Open Synced Google Sheet</a>`;
  }

  return text;
};

export const formatTelegramMemberAlert = (
  member: {
    id: string;
    name: string;
    phoneNumber: string;
    visitCount: number;
  },
  method: 'face_recognition' | 'qr_scan' | 'manual',
  confidence: number,
  timestamp: string,
  spreadsheetUrl?: string
): string => {
  const methodIcon = method === 'qr_scan' ? '📱 QR Code Scan' : method === 'face_recognition' ? '👤 Face Scan Recognition' : '✍️ Manual Check-in';
  let text = `✅ <b>MEMBER IDENTIFIED & CHECKED IN</b>\n\n`;
  text += `👤 <b>Name:</b> <code>${member.name}</code>\n`;
  text += `📞 <b>Phone:</b> <code>${member.phoneNumber}</code>\n`;
  text += `🆔 <b>Member ID:</b> <code>${member.id}</code>\n`;
  text += `🎟️ <b>Total Visits:</b> <code>#${member.visitCount}</code>\n`;
  text += `🔍 <b>Method:</b> ${methodIcon} (${Math.round(confidence * 100)}% match)\n`;
  text += `🕒 <b>Time:</b> <i>${timestamp}</i>\n`;

  if (spreadsheetUrl) {
    text += `\n📑 <a href="${spreadsheetUrl}">Open Google Sheet Log</a>`;
  }

  return text;
};

export const formatTelegramMemberEnrollment = (
  member: {
    id: string;
    name: string;
    phoneNumber: string;
  },
  timestamp: string,
  spreadsheetUrl?: string
): string => {
  let text = `🎉 <b>NEW MEMBER ENROLLED</b>\n\n`;
  text += `👤 <b>Name:</b> <code>${member.name}</code>\n`;
  text += `📞 <b>Phone:</b> <code>${member.phoneNumber}</code>\n`;
  text += `🆔 <b>Member ID:</b> <code>${member.id}</code>\n`;
  text += `🕒 <b>Enrolled At:</b> <i>${timestamp}</i>\n`;

  if (spreadsheetUrl) {
    text += `\n📑 <a href="${spreadsheetUrl}">Open Synced Google Sheet</a>`;
  }

  return text;
};

