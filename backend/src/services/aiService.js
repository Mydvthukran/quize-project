import { buildCoachPrompt, buildExplanationPrompt, buildQuizPrompt } from './promptTemplates.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const STOP_WORDS = new Set([
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
  'what',
  'when',
  'where',
  'which',
  'quiz',
  'notes',
  'tutorial',
  'video',
  'learn',
  'learnloop',
  'topic',
  'converts',
  'convert',
  'uses',
  'use',
  'produces',
  'produce',
  'includes',
  'include',
  'involves',
  'involve',
  'creates',
  'create',
  'explains',
  'explain',
  'shows',
  'show',
  'describes',
  'describe',
  'concept',
  'idea',
  'lesson',
  'material',
  'energy',
  'chemical',
  'process',
  'study',
  'about',
]);

function getApiKeys() {
  const primary = process.env.OPENAI_API_KEY || '';
  const keyList = (process.env.OPENAI_API_KEYS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return [...new Set([primary, ...keyList].filter(Boolean))];
}

function extractJsonFromText(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error('Failed to parse AI JSON response.');
  }
}

function extractKeywords(source = '', topic = '') {
  const text = `${topic} ${source}`.toLowerCase().replace(/https?:\/\/\S+/g, ' ');
  const tokens = text.match(/[a-z0-9][a-z0-9-]{2,}/g) || [];
  const topicTokens = (topic.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) || []).filter(Boolean);
  const keywords = [];

  for (const token of tokens) {
    if (STOP_WORDS.has(token) || topicTokens.includes(token)) continue;
    if (!keywords.includes(token)) {
      keywords.push(token);
    }
  }

  return keywords.slice(0, 8);
}

function titleCase(value = '') {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(' ');
}

async function callOpenAI(prompt) {
  const apiKeys = getApiKeys();
  if (!apiKeys.length) {
    return null;
  }

  let lastError = null;

  for (const apiKey of apiKeys) {
    try {
      const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          temperature: 0.5,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'You are LearnLoop AI, expert in educational quiz design.',
            },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        lastError = new Error(`OpenAI call failed (${response.status}): ${body}`);
        continue;
      }

      const payload = await response.json();
      return payload.choices?.[0]?.message?.content || null;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    console.warn('LearnLoop AI fallback activated:', lastError.message);
  }

  return null;
}

function localFallbackExplanation(question, answer) {
  return {
    explanation: `The answer "${answer}" best matches the concept tested by "${question}" because it is the most direct and correct interpretation of the prompt.`,
  };
}

function localFallbackCoach(topicStats) {
  const topics = Array.isArray(topicStats) ? topicStats : [];
  const weakTopics = topics
    .filter((item) => (item.accuracy || 0) < 70)
    .map((item) => item.topic)
    .slice(0, 3);

  return {
    nextTopics: weakTopics.length ? weakTopics : ['Review core foundations', 'Practice mixed quizzes'],
    weakConcepts: weakTopics.length ? weakTopics : ['Low-confidence topics', 'Frequently missed ideas'],
    threeDayPlan: [
      'Day 1: Review your weakest topic and summarize key ideas.',
      'Day 2: Take a focused quiz on incorrect answers.',
      'Day 3: Mix topics together and use explanations to close gaps.',
    ],
  };
}

function localFallbackQuiz({ topic, difficulty, questionCount, source = '', sourceType = 'text' }) {
  const level = difficulty.toLowerCase();
  const keywords = extractKeywords(source, topic);
  const anchors = keywords.length ? keywords : [topic || 'core concept'];
  const contextLabel = sourceType === 'url' ? 'tutorial' : 'source';

  return {
    questions: Array.from({ length: Number(questionCount) }).map((_, index) => {
      const number = index + 1;
      const anchor = titleCase(anchors[index % anchors.length]);
      const secondary = titleCase(anchors[(index + 1) % anchors.length]);

      if (index % 3 === 0) {
        return {
          type: 'mcq',
          question: `(${level}) Which statement best describes the role of ${anchor} in ${topic} from the ${contextLabel}?`,
          options: [
            `${anchor} as the main idea`,
            `A random detail about ${secondary}`,
            `An unrelated historical fact`,
            `A distractor outside the lesson`,
          ],
          answer: `${anchor} as the main idea`,
          explanation: `${anchor} is the core idea the source connects to ${topic}.`,
          topic: topic || anchor,
          difficulty: level,
        };
      }

      if (index % 3 === 1) {
        return {
          type: 'true_false',
          question: `(${level}) True or False: The ${contextLabel} presents ${anchor} as a key part of ${topic}.`,
          options: ['True', 'False'],
          answer: 'True',
          explanation: `${anchor} appears as a direct idea from the lesson, so the statement is true.`,
          topic: topic || anchor,
          difficulty: level,
        };
      }

      return {
        type: 'short',
        question: `(${level}) In one sentence, explain how ${anchor} contributes to understanding ${topic}.`,
        options: [],
        answer: `${anchor} supports ${topic} by connecting the specific lesson idea to the broader concept.`,
        explanation: 'A strong short answer links the source idea back to the main topic.',
        topic: topic || anchor,
        difficulty: level,
      };
    }),
  };
}

export async function generateQuizAi(input) {
  try {
    const prompt = buildQuizPrompt(input);
    const aiResponse = await callOpenAI(prompt);

    if (!aiResponse) {
      return localFallbackQuiz(input);
    }

    return extractJsonFromText(aiResponse);
  } catch (error) {
    console.warn('LearnLoop quiz generation fallback:', error.message);
    return localFallbackQuiz(input);
  }
}

export async function explainAnswerAi({ question, answer }) {
  try {
    const prompt = buildExplanationPrompt({ question, answer });
    const aiResponse = await callOpenAI(prompt);

    if (!aiResponse) {
      return localFallbackExplanation(question, answer);
    }

    const parsed = extractJsonFromText(aiResponse);
    return {
      explanation: parsed.explanation || aiResponse,
    };
  } catch (error) {
    console.warn('LearnLoop explanation fallback:', error.message);
    return localFallbackExplanation(question, answer);
  }
}

export async function coachSuggestionsAi({ topicStats }) {
  try {
    const prompt = buildCoachPrompt({ topicStats });
    const aiResponse = await callOpenAI(prompt);

    if (!aiResponse) {
      return localFallbackCoach(topicStats);
    }

    return extractJsonFromText(aiResponse);
  } catch (error) {
    console.warn('LearnLoop coach fallback:', error.message);
    return localFallbackCoach(topicStats);
  }
}
