export function buildQuizPrompt({ sourceType, source, topic, difficulty, questionCount }) {
  return `Create ${questionCount} quiz questions for ${topic || 'the provided content'}.
Difficulty: ${difficulty}
SourceType: ${sourceType}
Source: ${source}
Return strict JSON with this shape:
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
Return concise text with one example.`;
}

export function buildCoachPrompt({ topicStats }) {
  return `You are a learning coach. Use this topic performance object: ${JSON.stringify(topicStats)}.
Suggest what to study next, weak concepts, and a 3-day plan.
Return JSON with keys: nextTopics, weakConcepts, threeDayPlan.`;
}
