import { useEffect, useMemo, useState } from 'react'
import { api, getQuizSocket } from './api'
import './App.css'

function App() {
  const [darkMode, setDarkMode] = useState(false)
  const [sourceType, setSourceType] = useState('text')
  const [source, setSource] = useState('')
  const [topic, setTopic] = useState('JavaScript Closures')
  const [difficulty, setDifficulty] = useState('medium')
  const [questionCount, setQuestionCount] = useState(8)
  const [quiz, setQuiz] = useState(null)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [dashboard, setDashboard] = useState(null)
  const [coach, setCoach] = useState(null)
  const [adaptive, setAdaptive] = useState(null)
  const [dailyChallenges, setDailyChallenges] = useState([])
  const [flashcards, setFlashcards] = useState([])
  const [bookmarks, setBookmarks] = useState([])
  const [explanations, setExplanations] = useState({})
  const [activeView, setActiveView] = useState('quiz')
  const [statusMessage, setStatusMessage] = useState('Ready to learn smarter with LearnLoop.')

  const [roomState, setRoomState] = useState(null)
  const [roomName, setRoomName] = useState('Recall Sprint')
  const [playerName, setPlayerName] = useState('Learner')
  const [joinRoomId, setJoinRoomId] = useState('')

  const [customDraft, setCustomDraft] = useState({
    question: '',
    options: ['', '', '', ''],
    answer: '',
    type: 'mcq',
  })
  const [customQuestions, setCustomQuestions] = useState([])

  const accuracySeries = useMemo(() => {
    if (!dashboard?.history?.length) return []
    return [...dashboard.history].reverse().slice(-8)
  }, [dashboard])

  useEffect(() => {
    const socket = getQuizSocket()

    socket.on('room:created', (room) => setRoomState(room))
    socket.on('room:update', (room) => setRoomState(room))
    socket.on('room:started', (room) => setRoomState(room))
    socket.on('room:error', (event) => setStatusMessage(event.message || 'Room event failed'))

    return () => {
      socket.off('room:created')
      socket.off('room:update')
      socket.off('room:started')
      socket.off('room:error')
    }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('learnloop:theme')
    if (saved === 'dark') setDarkMode(true)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('learnloop:theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    loadOverview()
  }, [])

  async function loadOverview() {
    try {
      const [dashboardData, coachData, adaptiveData, challengeData, flashData, bookmarkData] =
        await Promise.all([
          api.dashboard(),
          api.coach(),
          api.adaptive(),
          api.dailyChallenges(),
          api.flashcards(),
          api.bookmarks(),
        ])

      setDashboard(dashboardData)
      setCoach(coachData)
      setAdaptive(adaptiveData)
      setDailyChallenges(challengeData.challenges || [])
      setFlashcards(flashData.flashcards || [])
      setBookmarks(bookmarkData.bookmarks || [])
    } catch (error) {
      setStatusMessage(`Could not load dashboard data: ${error.message}`)
    }
  }

  async function generateQuiz() {
    try {
      setIsLoading(true)
      setStatusMessage('Generating AI-powered quiz...')
      const generated = await api.generateQuiz({
        sourceType,
        source,
        topic,
        difficulty,
        questionCount: Number(questionCount),
      })
      setQuiz(generated)
      setResult(null)
      setAnswers({})
      setExplanations({})
      setActiveView('quiz')
      setStatusMessage(`Quiz ready: ${generated.questions.length} questions.`)
      localStorage.setItem('learnloop:lastQuiz', JSON.stringify(generated))
    } catch (error) {
      setStatusMessage(`Quiz generation failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  async function submitQuiz() {
    if (!quiz) return

    try {
      setIsLoading(true)
      const payload = {
        userId: 'demo-user',
        topic: quiz.topic,
        questions: quiz.questions,
        answers,
        elapsedSec: Math.floor(Math.random() * 240 + 120),
      }

      const summary = await api.submitQuiz(payload)
      setResult(summary)
      setStatusMessage(`Scored ${summary.result.accuracy}% and gained ${summary.earnedXp} XP.`)
      await loadOverview()
      setActiveView('dashboard')
    } catch (error) {
      setStatusMessage(`Quiz submission failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  async function explain(questionObj) {
    try {
      const response = await api.explain({
        question: questionObj.question,
        answer: questionObj.answer,
      })

      setExplanations((previous) => ({
        ...previous,
        [questionObj.id]: response.explanation,
      }))
    } catch (error) {
      setStatusMessage(`Could not fetch explanation: ${error.message}`)
    }
  }

  async function bookmark(questionObj) {
    try {
      const response = await api.bookmarkQuestion(questionObj.question)
      setBookmarks(response.bookmarks || [])
      setStatusMessage('Question bookmarked for revision mode.')
    } catch (error) {
      setStatusMessage(`Could not bookmark question: ${error.message}`)
    }
  }

  function createRoom() {
    const socket = getQuizSocket()
    socket.emit('room:create', { roomName, host: playerName })
    setStatusMessage('Creating multiplayer room...')
  }

  function joinRoom() {
    const socket = getQuizSocket()
    socket.emit('room:join', { roomId: joinRoomId, playerName })
    setStatusMessage(`Joining room ${joinRoomId}...`)
  }

  function startRoom() {
    if (!roomState?.id) return
    const socket = getQuizSocket()
    socket.emit('room:start', { roomId: roomState.id })
  }

  function loadOfflineQuiz() {
    const cached = localStorage.getItem('learnloop:lastQuiz')
    if (!cached) {
      setStatusMessage('No offline quiz found yet.')
      return
    }
    setQuiz(JSON.parse(cached))
    setActiveView('quiz')
    setStatusMessage('Loaded cached offline quiz.')
  }

  function pushCustomQuestion() {
    if (!customDraft.question.trim() || !customDraft.answer.trim()) return

    const question = {
      id: `custom-${Date.now()}`,
      topic,
      difficulty,
      ...customDraft,
      options: customDraft.type === 'mcq' ? customDraft.options.filter(Boolean) : [],
      explanation: 'Custom question explanation can be requested with Explain Answer.',
    }
    setCustomQuestions((previous) => [...previous, question])
    setCustomDraft({
      question: '',
      options: ['', '', '', ''],
      answer: '',
      type: 'mcq',
    })
  }

  function useCustomQuiz() {
    if (!customQuestions.length) return
    setQuiz({
      id: `custom-pack-${Date.now()}`,
      topic,
      difficulty,
      sourceType: 'manual',
      questions: customQuestions,
    })
    setAnswers({})
    setResult(null)
    setActiveView('quiz')
    setStatusMessage('Custom quiz loaded.')
  }

  return (
    <div className="page-shell">
      <header className="hero-block">
        <div>
          <p className="eyebrow">Intelligent Recall Platform</p>
          <h1>LearnLoop</h1>
          <p className="hero-copy">
            Transform tutorials, links, and notes into adaptive AI quizzes that diagnose weak areas,
            explain mistakes, and build exam-ready confidence.
          </p>
        </div>
        <div className="hero-controls">
          <button type="button" onClick={() => setDarkMode((previous) => !previous)}>
            {darkMode ? 'Switch to Light' : 'Switch to Dark'}
          </button>
          <button type="button" onClick={loadOfflineQuiz}>
            Load Offline Quiz
          </button>
          <p className="status">{statusMessage}</p>
        </div>
      </header>

      <nav className="view-nav">
        {['quiz', 'dashboard', 'revision', 'multiplayer', 'builder'].map((view) => (
          <button
            key={view}
            type="button"
            className={activeView === view ? 'active' : ''}
            onClick={() => setActiveView(view)}
          >
            {view}
          </button>
        ))}
      </nav>

      <section className="input-grid">
        <label>
          Source Type
          <select value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
            <option value="text">Text / Notes</option>
            <option value="url">Tutorial / YouTube URL</option>
            <option value="topic">Topic only</option>
          </select>
        </label>
        <label>
          Topic
          <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Operating Systems" />
        </label>
        <label>
          Difficulty
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label>
          Questions
          <input
            type="number"
            min="3"
            max="20"
            value={questionCount}
            onChange={(event) => setQuestionCount(event.target.value)}
          />
        </label>
      </section>

      <textarea
        className="source-box"
        value={source}
        onChange={(event) => setSource(event.target.value)}
        placeholder="Paste tutorial text, doc summary, URL, or your learning notes..."
      />

      <div className="action-row">
        <button type="button" disabled={isLoading} onClick={generateQuiz}>
          {isLoading ? 'Generating...' : 'Generate AI Quiz'}
        </button>
        <button type="button" disabled={!quiz || isLoading} onClick={submitQuiz}>
          Submit Quiz
        </button>
      </div>

      {result && (
        <section className="card">
          <h2>Last Quiz Result</h2>
          <p>
            Accuracy: {result.result.accuracy}% ({result.result.correct}/{result.result.total})
          </p>
          <p>XP earned: {result.earnedXp}</p>
          <p>Current streak: {result.streak}</p>
        </section>
      )}

      {adaptive && (
        <section className="card">
          <h2>Smart Practice Mode</h2>
          <p>
            Recommended next topic: <strong>{adaptive.recommendedTopic}</strong> ({adaptive.recommendedDifficulty})
          </p>
          <p>Weak topics: {(adaptive.weakTopics || []).join(', ') || 'No weak topics yet'}</p>
        </section>
      )}

      {activeView === 'quiz' && quiz && (
        <section className="card">
          <h2>
            Quiz: {quiz.topic} ({quiz.difficulty})
          </h2>
          {quiz.questions.map((question) => (
            <article key={question.id} className="question-card">
              <p className="question-title">
                [{question.type}] {question.question}
              </p>
              {question.options?.length > 0 ? (
                <div className="option-grid">
                  {question.options.map((option) => (
                    <label key={option}>
                      <input
                        type="radio"
                        name={question.id}
                        checked={answers[question.id] === option}
                        onChange={() =>
                          setAnswers((previous) => ({
                            ...previous,
                            [question.id]: option,
                          }))
                        }
                      />
                      {option}
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  value={answers[question.id] || ''}
                  placeholder="Write your short answer"
                  onChange={(event) =>
                    setAnswers((previous) => ({
                      ...previous,
                      [question.id]: event.target.value,
                    }))
                  }
                />
              )}
              <div className="question-actions">
                <button type="button" onClick={() => explain(question)}>
                  Explain Answer
                </button>
                <button type="button" onClick={() => bookmark(question)}>
                  Bookmark
                </button>
              </div>
              {explanations[question.id] && <p className="explanation">{explanations[question.id]}</p>}
            </article>
          ))}
        </section>
      )}

      {activeView === 'dashboard' && dashboard && (
        <section className="card">
          <h2>Topic Dashboard</h2>
          <div className="stats-grid">
            <div>
              <p className="metric">XP</p>
              <strong>{dashboard.profile.xp}</strong>
            </div>
            <div>
              <p className="metric">Streak</p>
              <strong>{dashboard.profile.streak} days</strong>
            </div>
            <div>
              <p className="metric">Badges</p>
              <strong>{dashboard.profile.badges.join(', ') || 'None'}</strong>
            </div>
          </div>

          <h3>Accuracy Trend</h3>
          <div className="chart-row">
            {accuracySeries.map((item) => (
              <div key={item.id} className="chart-col">
                <span>{item.accuracy}%</span>
                <div style={{ height: `${Math.max(12, item.accuracy)}%` }} />
                <small>{item.topic.slice(0, 8)}</small>
              </div>
            ))}
          </div>

          <h3>Daily Challenges</h3>
          <ul>
            {dailyChallenges.map((challenge) => (
              <li key={challenge.id}>
                {challenge.title} - {challenge.xp} XP
              </li>
            ))}
          </ul>

          <h3>Leaderboard</h3>
          <ul>
            {dashboard.leaderboard.map((player) => (
              <li key={player.id}>
                {player.name} - XP {player.xp} - streak {player.streak}
              </li>
            ))}
          </ul>

          {coach && (
            <>
              <h3>Performance AI Coach</h3>
              <p>Next Topics: {(coach.nextTopics || []).join(', ')}</p>
              <p>Weak Concepts: {(coach.weakConcepts || []).join(', ')}</p>
              <ul>
                {(coach.threeDayPlan || []).map((plan) => (
                  <li key={plan}>{plan}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {activeView === 'revision' && (
        <section className="card">
          <h2>Revision Mode</h2>
          <p>Flashcards from your mistakes:</p>
          <div className="flashcard-grid">
            {flashcards.map((card) => (
              <article key={card.id} className="flashcard">
                <p>Q: {card.front}</p>
                <p>A: {card.back}</p>
              </article>
            ))}
            {!flashcards.length && <p>No flashcards yet. Submit a quiz to generate them.</p>}
          </div>
          <h3>Bookmarked Difficult Questions</h3>
          <ul>
            {bookmarks.map((item) => (
              <li key={item.id}>{item.question}</li>
            ))}
          </ul>
        </section>
      )}

      {activeView === 'multiplayer' && (
        <section className="card">
          <h2>Real-time Multiplayer Quiz Rooms</h2>
          <div className="input-grid">
            <label>
              Your Name
              <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} />
            </label>
            <label>
              Room Name
              <input value={roomName} onChange={(event) => setRoomName(event.target.value)} />
            </label>
            <label>
              Room ID
              <input value={joinRoomId} onChange={(event) => setJoinRoomId(event.target.value)} />
            </label>
          </div>
          <div className="action-row">
            <button type="button" onClick={createRoom}>
              Create Room
            </button>
            <button type="button" onClick={joinRoom}>
              Join Room
            </button>
            <button type="button" onClick={startRoom}>
              Start Live Quiz
            </button>
          </div>
          {roomState && (
            <div>
              <p>
                Room {roomState.id} ({roomState.roomName})
              </p>
              <p>Players: {(roomState.players || []).map((player) => player.name).join(', ')}</p>
              <p>{roomState.started ? 'Quiz started' : 'Waiting for host to start'}</p>
            </div>
          )}
        </section>
      )}

      {activeView === 'builder' && (
        <section className="card">
          <h2>Custom Quiz Builder</h2>
          <label>
            Type
            <select
              value={customDraft.type}
              onChange={(event) => setCustomDraft((previous) => ({ ...previous, type: event.target.value }))}
            >
              <option value="mcq">MCQ</option>
              <option value="true_false">True / False</option>
              <option value="short">Short Answer</option>
            </select>
          </label>
          <label>
            Question
            <textarea
              value={customDraft.question}
              onChange={(event) => setCustomDraft((previous) => ({ ...previous, question: event.target.value }))}
            />
          </label>
          {customDraft.type === 'mcq' && (
            <div className="option-grid">
              {customDraft.options.map((option, index) => (
                <input
                  key={`${index}`}
                  value={option}
                  placeholder={`Option ${index + 1}`}
                  onChange={(event) =>
                    setCustomDraft((previous) => {
                      const updated = [...previous.options]
                      updated[index] = event.target.value
                      return { ...previous, options: updated }
                    })
                  }
                />
              ))}
            </div>
          )}
          <label>
            Correct Answer
            <input
              value={customDraft.answer}
              onChange={(event) => setCustomDraft((previous) => ({ ...previous, answer: event.target.value }))}
            />
          </label>
          <div className="action-row">
            <button type="button" onClick={pushCustomQuestion}>
              Add Question
            </button>
            <button type="button" onClick={useCustomQuiz}>
              Use Custom Quiz
            </button>
          </div>
          <p>{customQuestions.length} custom questions created.</p>
        </section>
      )}

    </div>
  )
}

export default App
