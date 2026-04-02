function extractFocusTerms(source = '', topic = '') {
  const text = `${topic} ${source}`.toLowerCase();
  const tokens = text.match(/[a-z0-9][a-z0-9-]{2,}/g) || [];
  const stopWords = new Set([
    'the',
    'and',
    'for',
    'with',
    'that',
    'this',
    'from',
    'into',
    'your',
    'about',
    'quiz',
    'notes',
    'tutorial',
    'video',
    'learn',
    'learnloop',
  ]);

  const focusTerms = [];
  for (const token of tokens) {
    if (stopWords.has(token)) continue;
    if (!focusTerms.includes(token)) {
      focusTerms.push(token);
    }
  }

  return focusTerms.slice(0, 8);
}

export function buildQuizPrompt({ sourceType, source, topic, difficulty, questionCount }) {
  const focusTerms = extractFocusTerms(source, topic);
  const sourcePreview = source.trim().replace(/\s+/g, ' ').slice(0, 700) || 'No source text was provided.';

  return `You are writing a study quiz that must stay tightly aligned to the user's material.

Topic: ${topic || 'General Learning'}
Difficulty: ${difficulty}
Question count: ${questionCount}
Source type: ${sourceType}
Key terms to anchor on: ${focusTerms.length ? focusTerms.join(', ') : topic || 'general foundations'}

Source preview:
${sourcePreview}

Rules:
- Stay on topic. Do not ask unrelated trivia.
- Use the source preview and key terms to shape every question.
- Mix MCQ, True/False, and Short Answer.
- Keep explanations short and directly tied to the concept tested.
- If the source is thin, stay close to the topic and foundational concepts.

Return strict JSON with this exact shape:
{
  \"questions\": [
    {
      \"type\": \"mcq|true_false|short\",
      \"question\": \"...\",
      \"options\": [\"...\"],
      \"answer\": \"...\",
      \"explanation\": \"...\",
      \"topic\": \"...\",
      \"difficulty\": \"easy|medium|hard\"
    }
  ]
}`;
}

export function buildExplanationPrompt({ question, answer }) {
  return `Explain why the answer is correct in simple study-friendly language.
Question: ${question}
Answer: ${answer}
Return JSON with key: explanation. Keep it concise with one example.`;
}

export function buildCoachPrompt({ topicStats }) {
  return `You are a learning coach. Use this topic performance object: ${JSON.stringify(topicStats)}.
Suggest what to study next, weak concepts, and a 3-day plan.
Return JSON with keys: nextTopics, weakConcepts, threeDayPlan.`;
}
