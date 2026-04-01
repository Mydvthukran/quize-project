# LearnLoop Backend

Express + Socket.IO API for LearnLoop.

## Features implemented

- Quiz generation endpoint with OpenAI integration and local fallback
- Quiz submission scoring and accuracy tracking
- Adaptive recommendations and weak topic detection
- AI answer explanations
- AI coach suggestions
- XP, streaks, badges, challenges, leaderboard
- Flashcard generation from wrong answers
- Bookmark support
- Multiplayer room events via Socket.IO

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Configure optional AI key in `.env`:

- `OPENAI_API_KEY` (optional, local fallback works without it)
- `OPENAI_MODEL` (default `gpt-4o-mini`)

4. Start server:

```bash
npm run dev
```

Backend runs on http://localhost:5000 by default.

## Important note

This MVP uses in-memory storage (`src/data/store.js`) for quick hackathon iteration. Replace with MongoDB persistence for production.
