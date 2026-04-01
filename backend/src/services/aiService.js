import { buildCoachPrompt, buildExplanationPrompt, buildQuizPrompt } from './promptTemplates.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

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
    throw lastError;
  }

  return null;
}

function localFallbackQuiz({ topic, difficulty, questionCount }) {
  const level = difficulty.toLowerCase();
  return {
    questions: Array.from({ length: questionCount }).map((_, index) => {
      const number = index + 1;
      if (index % 3 === 0) {
        return {
          type: 'mcq',
          question: `(${level}) Which statement best summarizes ${topic} concept ${number}?`,
          options: ['Core definition', 'Unrelated fact', 'Historical date', 'Random guess'],
          answer: 'Core definition',
          explanation: `${topic} concept ${number} focuses on understanding definitions before advanced use.`,
          topic,
          difficulty: level,
        };
      }

      if (index % 3 === 1) {
        return {
          type: 'true_false',
          question: `(${level}) True or False: ${topic} requires context-aware practice for mastery.`,
          options: ['True', 'False'],
          answer: 'True',
          explanation: 'Repeated contextual practice improves retention and transfer.',
          topic,
          difficulty: level,
        };
      }

      return {
        type: 'short',
        question: `(${level}) In one sentence, explain why ${topic} matters in real applications.`,
        options: [],
        answer: `${topic} matters because it connects theory to practical problem-solving outcomes.`,
        explanation: 'The best short answers mention both concept and practical impact.',
        topic,
        difficulty: level,
      };
    }),
  };
}

export async function generateQuizAi(input) {
  const prompt = buildQuizPrompt(input);
  const aiResponse = await callOpenAI(prompt);

  if (!aiResponse) {
    return localFallbackQuiz(input);
  }

  return extractJsonFromText(aiResponse);
}

export async function explainAnswerAi({ question, answer }) {
  const prompt = buildExplanationPrompt({ question, answer });
  const aiResponse = await callOpenAI(prompt);

  if (!aiResponse) {
    return {
      explanation:
        'This answer is correct because it aligns with the concept tested in the question and eliminates distractors that do not match the core definition.',
    };
  }

  const parsed = extractJsonFromText(aiResponse);
  return {
    explanation: parsed.explanation || aiResponse,
  };
}

export async function coachSuggestionsAi({ topicStats }) {
  const prompt = buildCoachPrompt({ topicStats });
  const aiResponse = await callOpenAI(prompt);

  if (!aiResponse) {
    return {
      nextTopics: ['Review weak topics first', 'Practice medium-level quizzes'],
      weakConcepts: ['Low accuracy topics', 'Slow response-time topics'],
      threeDayPlan: [
        'Day 1: revise low-accuracy concepts with flashcards',
        'Day 2: take adaptive quiz focused on mistakes',
        'Day 3: complete mixed hard quiz and reflect on explanations',
      ],
    };
  }

  return extractJsonFromText(aiResponse);
}
