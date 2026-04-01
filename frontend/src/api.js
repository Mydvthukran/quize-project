import { io } from 'socket.io-client';

// Determine if running in development or production
function getApiUrl() {
  if (typeof window === 'undefined') {
    return 'https://learnloop-backend-6v64.onrender.com/api';
  }
  const port = window.location.port;
  const isDev = port === '5173' || port === '5174';
  const isLocalIP = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return (isDev || isLocalIP) ? 'http://localhost:5000/api' : 'https://learnloop-backend-6v64.onrender.com/api';
}

function getSocketUrl() {
  if (typeof window === 'undefined') {
    return 'https://learnloop-backend-6v64.onrender.com';
  }
  const port = window.location.port;
  const isDev = port === '5173' || port === '5174';
  const isLocalIP = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return (isDev || isLocalIP) ? 'http://localhost:5000' : 'https://learnloop-backend-6v64.onrender.com';
}

const API_BASE = getApiUrl();
const SOCKET_BASE = getSocketUrl();

console.log('[LearnLoop API] Initialized:', { API_BASE, hostname: typeof window !== 'undefined' ? window.location.hostname : 'ssr', port: typeof window !== 'undefined' ? window.location.port : 'ssr' });

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || 'Request failed');
  }

  return response.json();
}

export const api = {
  health: () => request('/health'),
  generateQuiz: (payload) => request('/quiz/generate', { method: 'POST', body: JSON.stringify(payload) }),
  submitQuiz: (payload) => request('/quiz/submit', { method: 'POST', body: JSON.stringify(payload) }),
  explain: (payload) => request('/quiz/explain', { method: 'POST', body: JSON.stringify(payload) }),
  adaptive: () => request('/quiz/adaptive?userId=demo-user'),
  coach: () => request('/quiz/coach?userId=demo-user'),
  dailyChallenges: () => request('/quiz/daily-challenges'),
  dashboard: () => request('/progress/dashboard?userId=demo-user'),
  flashcards: () => request('/quiz/flashcards?userId=demo-user'),
  bookmarks: () => request('/quiz/bookmarks?userId=demo-user'),
  bookmarkQuestion: (question) =>
    request('/quiz/bookmark', {
      method: 'POST',
      body: JSON.stringify({ userId: 'demo-user', question }),
    }),
};

let socket;
export function getQuizSocket() {
  if (!socket) {
    socket = io(SOCKET_BASE, {
      transports: ['websocket'],
    });
  }
  return socket;
}
# Final production fix - 20260402-025346
