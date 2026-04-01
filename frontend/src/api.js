import { io } from 'socket.io-client';


const API_BASE = 'https://learnloop-backend-6v64.onrender.com/api';
const SOCKET_BASE = 'https://learnloop-backend-6v64.onrender.com';
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
// Force rebuild 20260402-024301
