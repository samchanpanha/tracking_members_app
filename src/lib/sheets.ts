/**
 * Google Sheets API Integration Service
 */

export interface CreateSheetResponse {
  spreadsheetId: string;
  spreadsheetUrl: string;
  sheetTitle: string;
}

export const createFaceTrackingSpreadsheet = async (
  token: string,
  title: string = 'Face Tracking & Counter Log'
): Promise<CreateSheetResponse> => {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const payload = {
    properties: {
      title: `${title} (${new Date().toLocaleDateString()})`,
    },
    sheets: [
      {
        properties: {
          title: 'Live Logs',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
        data: [
          {
            startRow: 0,
            startColumn: 0,
            rowData: [
              {
                values: [
                  { userEnteredValue: { stringValue: 'Timestamp' } },
                  { userEnteredValue: { stringValue: 'Detected Faces Count' } },
                  { userEnteredValue: { stringValue: 'Crowd Status' } },
                  { userEnteredValue: { stringValue: 'Telegram Alert Sent' } },
                  { userEnteredValue: { stringValue: 'Notes / Context' } },
                ],
              },
            ],
          },
        ],
      },
      {
        properties: {
          title: 'Members Directory',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
        data: [
          {
            startRow: 0,
            startColumn: 0,
            rowData: [
              {
                values: [
                  { userEnteredValue: { stringValue: 'Member ID' } },
                  { userEnteredValue: { stringValue: 'Full Name' } },
                  { userEnteredValue: { stringValue: 'Phone Number' } },
                  { userEnteredValue: { stringValue: 'Enrolled Date' } },
                  { userEnteredValue: { stringValue: 'Total Visits' } },
                  { userEnteredValue: { stringValue: 'Last Check-in' } },
                ],
              },
            ],
          },
        ],
      },
      {
        properties: {
          title: 'Member Check-ins',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
        data: [
          {
            startRow: 0,
            startColumn: 0,
            rowData: [
              {
                values: [
                  { userEnteredValue: { stringValue: 'Timestamp' } },
                  { userEnteredValue: { stringValue: 'Member ID' } },
                  { userEnteredValue: { stringValue: 'Full Name' } },
                  { userEnteredValue: { stringValue: 'Phone Number' } },
                  { userEnteredValue: { stringValue: 'Scan Method' } },
                  { userEnteredValue: { stringValue: 'Visit Number' } },
                  { userEnteredValue: { stringValue: 'Telegram Alert' } },
                ],
              },
            ],
          },
        ],
      },
      {
        properties: {
          title: 'Summary Stats',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
        data: [
          {
            startRow: 0,
            startColumn: 0,
            rowData: [
              {
                values: [
                  { userEnteredValue: { stringValue: 'Metric' } },
                  { userEnteredValue: { stringValue: 'Formula / Value' } },
                ],
              },
              {
                values: [
                  { userEnteredValue: { stringValue: 'Total Enrolled Members' } },
                  { userEnteredValue: { formulaValue: "=COUNTA('Members Directory'!A2:A)" } },
                ],
              },
              {
                values: [
                  { userEnteredValue: { stringValue: 'Total Member Check-ins' } },
                  { userEnteredValue: { formulaValue: "=COUNTA('Member Check-ins'!A2:A)" } },
                ],
              },
              {
                values: [
                  { userEnteredValue: { stringValue: 'Total Log Entries' } },
                  { userEnteredValue: { formulaValue: "=COUNTA('Live Logs'!B2:B)" } },
                ],
              },
              {
                values: [
                  { userEnteredValue: { stringValue: 'Average Live Count' } },
                  { userEnteredValue: { formulaValue: "=IFERROR(AVERAGE('Live Logs'!B2:B), 0)" } },
                ],
              },
              {
                values: [
                  { userEnteredValue: { stringValue: 'Peak Face Count' } },
                  { userEnteredValue: { formulaValue: "=IFERROR(MAX('Live Logs'!B2:B), 0)" } },
                ],
              },
              {
                values: [
                  { userEnteredValue: { stringValue: 'Created At' } },
                  { userEnteredValue: { stringValue: timestamp } },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create Google Sheet: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
    sheetTitle: data.properties?.title || title,
  };
};

export const appendFaceLogToSheet = async (
  token: string,
  spreadsheetId: string,
  entry: {
    timestamp: string;
    count: number;
    status: string;
    telegramSent: boolean;
    notes?: string;
  }
): Promise<boolean> => {
  const range = `'Live Logs'!A:E`;
  const values = [
    [
      entry.timestamp,
      entry.count,
      entry.status,
      entry.telegramSent ? 'Yes' : 'No',
      entry.notes || 'Live Scan Event',
    ],
  ];

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to append row to Google Sheet: ${response.statusText}`);
  }

  return true;
};

export const appendMemberToSheet = async (
  token: string,
  spreadsheetId: string,
  member: {
    id: string;
    name: string;
    phoneNumber: string;
    enrolledAt: string;
    visitCount: number;
    lastSeenAt?: string;
  }
): Promise<boolean> => {
  const range = `'Members Directory'!A:F`;
  const values = [
    [
      member.id,
      member.name,
      member.phoneNumber,
      member.enrolledAt,
      member.visitCount,
      member.lastSeenAt || member.enrolledAt,
    ],
  ];

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to append member to Google Sheet: ${response.statusText}`);
  }

  return true;
};

export const appendMemberCheckInToSheet = async (
  token: string,
  spreadsheetId: string,
  checkIn: {
    timestamp: string;
    memberId: string;
    memberName: string;
    phoneNumber: string;
    method: string;
    visitNumber: number;
    telegramSent: boolean;
  }
): Promise<boolean> => {
  const range = `'Member Check-ins'!A:G`;
  const values = [
    [
      checkIn.timestamp,
      checkIn.memberId,
      checkIn.memberName,
      checkIn.phoneNumber,
      checkIn.method === 'qr_scan' ? 'QR Scan' : checkIn.method === 'face_recognition' ? 'Face Scan' : 'Manual',
      checkIn.visitNumber,
      checkIn.telegramSent ? 'Yes' : 'No',
    ],
  ];

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to append member check-in to Google Sheet: ${response.statusText}`);
  }

  return true;
};

