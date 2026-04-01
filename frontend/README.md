# LearnLoop Frontend

LearnLoop is an intelligent quiz-based learning platform where learners can turn tutorials, notes, and links into adaptive quizzes.

## Features implemented

- AI quiz generation inputs (text, URL, topic)
- Multiple question types (MCQ, true/false, short answer)
- Smart practice recommendations based on weak areas
- Explain Answer flow with AI/fallback logic
- Topic dashboard with trend chart and leaderboard
- Revision mode with flashcards and bookmarks
- Custom quiz builder
- Real-time multiplayer room controls (Socket.IO)
- Dark mode and basic offline support with service worker

## Run frontend

1. Install dependencies:

```bash
npm install
```

2. Optional environment:

```bash
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

3. Start dev server:

```bash
npm run dev
```

The app runs on http://localhost:5173 by default.
