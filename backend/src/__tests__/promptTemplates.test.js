import { describe, it, expect } from 'vitest';
import {
  buildQuizPrompt,
  buildExplanationPrompt,
  buildCoachPrompt,
} from '../services/promptTemplates.js';

describe('buildQuizPrompt', () => {
  it('includes topic, difficulty, and questionCount in the output', () => {
    const prompt = buildQuizPrompt({
      sourceType: 'text',
      source: 'Photosynthesis converts sunlight into energy.',
      topic: 'Biology',
      difficulty: 'medium',
      questionCount: 5,
    });

    expect(prompt).toContain('Biology');
    expect(prompt).toContain('medium');
    expect(prompt).toContain('5');
  });

  it('includes the source preview in the output', () => {
    const source = 'React hooks enable functional components to use state.';
    const prompt = buildQuizPrompt({
      sourceType: 'text',
      source,
      topic: 'React',
      difficulty: 'easy',
      questionCount: 3,
    });

    expect(prompt).toContain(source);
  });

  it('falls back to "No source text was provided." when source is empty', () => {
    const prompt = buildQuizPrompt({
      sourceType: 'text',
      source: '',
      topic: 'Chemistry',
      difficulty: 'hard',
      questionCount: 4,
    });

    expect(prompt).toContain('No source text was provided.');
  });

  it('truncates long source text to at most 700 characters in the source preview section', () => {
    const longSource = 'b'.repeat(1000);
    const prompt = buildQuizPrompt({
      sourceType: 'text',
      source: longSource,
      topic: 'History',
      difficulty: 'easy',
      questionCount: 2,
    });
    // Extract only the "Source preview:" block from the prompt
    const previewMatch = prompt.match(/Source preview:\n([\s\S]*?)\n\nRules:/);
    expect(previewMatch).not.toBeNull();
    const previewContent = previewMatch[1].trim();
    // The preview should be exactly 700 characters (sliced from 1000)
    expect(previewContent.length).toBe(700);
    expect(previewContent).toBe('b'.repeat(700));
  });

  it('returns a JSON shape instruction in the prompt', () => {
    const prompt = buildQuizPrompt({
      sourceType: 'text',
      source: 'Some content',
      topic: 'Math',
      difficulty: 'medium',
      questionCount: 4,
    });

    expect(prompt).toContain('"questions"');
    expect(prompt).toContain('"type"');
    expect(prompt).toContain('"answer"');
  });

  it('includes extracted key terms from the source', () => {
    const prompt = buildQuizPrompt({
      sourceType: 'text',
      source: 'Neural networks use backpropagation during training.',
      topic: 'Machine Learning',
      difficulty: 'hard',
      questionCount: 5,
    });

    // At least one keyword from the source should appear in the prompt
    expect(prompt).toMatch(/neural|networks|backpropagation|training/i);
  });
});

describe('buildExplanationPrompt', () => {
  it('contains the question and answer in the prompt', () => {
    const prompt = buildExplanationPrompt({
      question: 'What is mitosis?',
      answer: 'Cell division',
    });

    expect(prompt).toContain('What is mitosis?');
    expect(prompt).toContain('Cell division');
  });

  it('asks for an explanation with an example', () => {
    const prompt = buildExplanationPrompt({
      question: 'What is Newton\'s first law?',
      answer: 'An object in motion stays in motion',
    });

    expect(prompt).toContain('example');
  });
});

describe('buildCoachPrompt', () => {
  it('includes serialized topic stats in the prompt', () => {
    const topicStats = [
      { topic: 'Math', accuracy: 55 },
      { topic: 'Science', accuracy: 80 },
    ];
    const prompt = buildCoachPrompt({ topicStats });

    expect(prompt).toContain('Math');
    expect(prompt).toContain('55');
  });

  it('requests the expected JSON keys in the prompt', () => {
    const prompt = buildCoachPrompt({ topicStats: [] });

    expect(prompt).toContain('nextTopics');
    expect(prompt).toContain('weakConcepts');
    expect(prompt).toContain('threeDayPlan');
  });
});
