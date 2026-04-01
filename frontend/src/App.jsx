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

  const heroMetrics = useMemo(() => {
    const latestAccuracy = result?.result?.accuracy ?? dashboard?.history?.[0]?.accuracy ?? 0
    const masteredTopics = dashboard?.topicStats?.filter((item) => (item.accuracy || 0) >= 80).length || 0

    return {
      latestAccuracy,
      masteredTopics,
      bookmarks: bookmarks.length,
      flashcards: flashcards.length,
    }
  }, [dashboard, result, bookmarks.length, flashcards.length])

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
    <div className={`app-shell ${darkMode ? 'theme-dark' : ''}`}>
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="topbar panel">
        <div className="brand-lockup">
          <div className="brand-mark">LL</div>
          <div>
            <p className="brand-name">LearnLoop</p>
            <p className="brand-tag">Adaptive quiz studio</p>
          </div>
        </div>

        <div className="topbar-actions">
          <button type="button" className="ghost-btn" onClick={() => setDarkMode((previous) => !previous)}>
            {darkMode ? 'Light mode' : 'Dark mode'}
          </button>
          <button type="button" className="ghost-btn" onClick={loadOfflineQuiz}>
            Offline quiz
          </button>
          <span className="status-chip">{statusMessage}</span>
        </div>
      </header>

      <section className="hero panel">
        <div className="hero-copy">
          <p className="eyebrow">AI-powered recall engine</p>
          <h1>Turn notes into quizzes that stay on topic.</h1>
          <p className="hero-copy-text">
            Paste tutorials, links, or study notes and LearnLoop will generate focused questions,
            explain mistakes, and adapt practice around weak areas.
          </p>
          <div className="hero-pills">
            <span>MCQ</span>
            <span>True / False</span>
            <span>Short Answer</span>
            <span>Spaced Repetition</span>
          </div>
        </div>

        <div className="hero-metrics">
          <article className="metric-card accent">
            <span>Latest accuracy</span>
            <strong>{heroMetrics.latestAccuracy}%</strong>
          </article>
          <article className="metric-card">
            <span>Mastered topics</span>
            <strong>{heroMetrics.masteredTopics}</strong>
          </article>
          <article className="metric-card">
            <span>Flashcards saved</span>
            <strong>{heroMetrics.flashcards}</strong>
          </article>
          <article className="metric-card">
            <span>Bookmarks</span>
            <strong>{heroMetrics.bookmarks}</strong>
          </article>
        </div>
      </section>

      <div className="workspace-grid">
        <aside className="panel composer-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Quiz composer</p>
              <h2>Build your next round</h2>
            </div>
            <div className="pill-row">
              {['quiz', 'dashboard', 'revision', 'multiplayer', 'builder'].map((view) => (
                <button
                  key={view}
                  type="button"
                  className={activeView === view ? 'pill active' : 'pill'}
                  onClick={() => setActiveView(view)}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>

          <section className="settings-grid">
            <label>
              Source type
              <select value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
                <option value="text">Text / notes</option>
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

          <label className="source-field">
            Source material
            <textarea
              className="source-box premium"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="Paste tutorial text, doc summary, URL, or your learning notes..."
            />
          </label>

          <div className="action-row primary-actions">
            <button type="button" className="primary-btn" disabled={isLoading} onClick={generateQuiz}>
              {isLoading ? 'Generating...' : 'Generate AI Quiz'}
            </button>
            <button type="button" className="secondary-btn" disabled={!quiz || isLoading} onClick={submitQuiz}>
              Submit Quiz
            </button>
          </div>

          {adaptive && (
            <div className="mini-panel">
              <div>
                <p className="section-kicker">Smart practice</p>
                <h3>Next focus</h3>
              </div>
              <p>
                <strong>{adaptive.recommendedTopic}</strong> · {adaptive.recommendedDifficulty}
              </p>
              <p className="muted">{(adaptive.weakTopics || []).join(', ') || 'No weak topics yet'}</p>
            </div>
          )}

          {result && (
            <div className="mini-panel result-panel">
              <div>
                <p className="section-kicker">Last result</p>
                <h3>{result.result.accuracy}% accuracy</h3>
              </div>
              <div className="result-stats">
                <span>{result.result.correct}/{result.result.total} correct</span>
                <span>+{result.earnedXp} XP</span>
                <span>{result.streak} streak</span>
              </div>
            </div>
          )}
        </aside>

        <main className="studio-panel">
          {activeView === 'quiz' && quiz && (
            <section className="panel content-card hero-stage">
              <div className="section-heading compact">
                <div>
                  <p className="section-kicker">Live quiz</p>
                  <h2>{quiz.topic}</h2>
                </div>
                <span className="badge">{quiz.difficulty}</span>
              </div>

              <div className="question-stack">
                {quiz.questions.map((question) => (
                  <article key={question.id} className="question-card premium">
                    <div className="question-head">
                      <span className="question-type">{question.type}</span>
                      <span className="question-topic">{question.topic}</span>
                    </div>
                    <p className="question-title">{question.question}</p>
                    {question.options?.length > 0 ? (
                      <div className="option-grid premium">
                        {question.options.map((option) => (
                          <label key={option} className="option-chip">
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
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        className="answer-box"
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
                      <button type="button" className="ghost-btn" onClick={() => explain(question)}>
                        Explain answer
                      </button>
                      <button type="button" className="ghost-btn" onClick={() => bookmark(question)}>
                        Bookmark
                      </button>
                    </div>
                    {explanations[question.id] && <p className="explanation">{explanations[question.id]}</p>}
                  </article>
                ))}
              </div>
            </section>
          )}

          {activeView === 'dashboard' && dashboard && (
            <section className="panel content-card">
              <div className="section-heading compact">
                <div>
                  <p className="section-kicker">Topic dashboard</p>
                  <h2>Performance overview</h2>
                </div>
              </div>

              <div className="stats-grid premium">
                <article className="mini-metric">
                  <span>XP</span>
                  <strong>{dashboard.profile.xp}</strong>
                </article>
                <article className="mini-metric">
                  <span>Streak</span>
                  <strong>{dashboard.profile.streak} days</strong>
                </article>
                <article className="mini-metric">
                  <span>Badges</span>
                  <strong>{dashboard.profile.badges.join(', ') || 'None'}</strong>
                </article>
              </div>

              <div className="chart-card">
                <h3>Accuracy trend</h3>
                <div className="chart-row premium">
                  {accuracySeries.map((item) => (
                    <div key={item.id} className="chart-col">
                      <span>{item.accuracy}%</span>
                      <div style={{ height: `${Math.max(12, item.accuracy)}%` }} />
                      <small>{item.topic.slice(0, 10)}</small>
                    </div>
                  ))}
                </div>
              </div>

              <div className="two-column-list">
                <section>
                  <h3>Daily challenges</h3>
                  <ul className="clean-list">
                    {dailyChallenges.map((challenge) => (
                      <li key={challenge.id}>
                        <span>{challenge.title}</span>
                        <strong>{challenge.xp} XP</strong>
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>Leaderboard</h3>
                  <ul className="clean-list">
                    {dashboard.leaderboard.map((player) => (
                      <li key={player.id}>
                        <span>{player.name}</span>
                        <strong>{player.xp} XP</strong>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              {coach && (
                <div className="mini-panel coach-panel">
                  <p className="section-kicker">Performance AI coach</p>
                  <h3>What to study next</h3>
                  <p>{(coach.nextTopics || []).join(', ')}</p>
                  <p className="muted">{(coach.weakConcepts || []).join(', ')}</p>
                  <ul className="coach-plan">
                    {(coach.threeDayPlan || []).map((plan) => (
                      <li key={plan}>{plan}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {activeView === 'revision' && (
            <section className="panel content-card">
              <div className="section-heading compact">
                <div>
                  <p className="section-kicker">Revision mode</p>
                  <h2>Flashcards and bookmarks</h2>
                </div>
              </div>

              <div className="flashcard-grid premium">
                {flashcards.map((card) => (
                  <article key={card.id} className="flashcard">
                    <span>Question</span>
                    <p>{card.front}</p>
                    <span>Answer</span>
                    <p>{card.back}</p>
                  </article>
                ))}
                {!flashcards.length && <p className="empty-state">No flashcards yet. Submit a quiz to generate them.</p>}
              </div>

              <div>
                <h3>Bookmarked questions</h3>
                <ul className="clean-list bookmarks-list">
                  {bookmarks.map((item) => (
                    <li key={item.id}>{item.question}</li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {activeView === 'multiplayer' && (
            <section className="panel content-card">
              <div className="section-heading compact">
                <div>
                  <p className="section-kicker">Real-time rooms</p>
                  <h2>Multiplayer quiz lobby</h2>
                </div>
              </div>

              <div className="settings-grid lobby-grid">
                <label>
                  Your name
                  <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} />
                </label>
                <label>
                  Room name
                  <input value={roomName} onChange={(event) => setRoomName(event.target.value)} />
                </label>
                <label>
                  Room ID
                  <input value={joinRoomId} onChange={(event) => setJoinRoomId(event.target.value)} />
                </label>
              </div>

              <div className="action-row">
                <button type="button" className="primary-btn" onClick={createRoom}>
                  Create room
                </button>
                <button type="button" className="secondary-btn" onClick={joinRoom}>
                  Join room
                </button>
                <button type="button" className="ghost-btn" onClick={startRoom}>
                  Start live quiz
                </button>
              </div>

              {roomState && (
                <div className="mini-panel">
                  <h3>{roomState.roomName}</h3>
                  <p>Room {roomState.id}</p>
                  <p>Players: {(roomState.players || []).map((player) => player.name).join(', ')}</p>
                  <p>{roomState.started ? 'Quiz started' : 'Waiting for host to start'}</p>
                </div>
              )}
            </section>
          )}

          {activeView === 'builder' && (
            <section className="panel content-card">
              <div className="section-heading compact">
                <div>
                  <p className="section-kicker">Custom builder</p>
                  <h2>Write your own quiz</h2>
                </div>
              </div>

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
                  className="source-box premium"
                  value={customDraft.question}
                  onChange={(event) => setCustomDraft((previous) => ({ ...previous, question: event.target.value }))}
                />
              </label>

              {customDraft.type === 'mcq' && (
                <div className="option-grid premium">
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
                Correct answer
                <input
                  value={customDraft.answer}
                  onChange={(event) => setCustomDraft((previous) => ({ ...previous, answer: event.target.value }))}
                />
              </label>

              <div className="action-row">
                <button type="button" className="primary-btn" onClick={pushCustomQuestion}>
                  Add question
                </button>
                <button type="button" className="secondary-btn" onClick={useCustomQuiz}>
                  Use custom quiz
                </button>
              </div>

              <p className="muted">{customQuestions.length} custom questions created.</p>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
