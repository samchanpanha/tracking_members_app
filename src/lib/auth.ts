export interface GoogleUser {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

let cachedAccessToken: string | null = null;
let cachedUser: GoogleUser | null = null;

export const initAuth = (
  onAuthSuccess?: (user: GoogleUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  const token = localStorage.getItem('google_access_token');
  const userStr = localStorage.getItem('google_user');
  if (token && userStr) {
    cachedAccessToken = token;
    cachedUser = JSON.parse(userStr);
    if (onAuthSuccess) onAuthSuccess(cachedUser!, cachedAccessToken!);
  } else {
    if (onAuthFailure) onAuthFailure();
  }
  
  // Return a dummy unsubscribe function for compatibility with App.tsx
  return () => {};
};

export const handleLoginSuccess = async (
  tokenResponse: any,
  onSuccess: (user: GoogleUser, token: string) => void
) => {
  try {
    const accessToken = tokenResponse.access_token;
    cachedAccessToken = accessToken;
    localStorage.setItem('google_access_token', accessToken);

    // Fetch user profile from Google OAuth2 API
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      throw new Error('Failed to fetch user profile.');
    }

    const data = await res.json();
    cachedUser = {
      displayName: data.name || null,
      email: data.email || null,
      photoURL: data.picture || null,
    };
    
    localStorage.setItem('google_user', JSON.stringify(cachedUser));

    onSuccess(cachedUser, accessToken);
    return { user: cachedUser, accessToken };
  } catch (err) {
    console.error('Failed to get user profile', err);
    throw err;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (token) {
    localStorage.setItem('google_access_token', token);
  } else {
    localStorage.removeItem('google_access_token');
  }
};

export const logoutGoogle = async () => {
  cachedAccessToken = null;
  cachedUser = null;
  localStorage.removeItem('google_access_token');
  localStorage.removeItem('google_user');
};
