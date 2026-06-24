// api/feedback.js — Groq LLM coach with 5 prompt techniques
// Prompt 1 (Zero-Shot)     → terminology
// Prompt 2 (Few-Shot)      → behavioral/STAR
// Prompt 3 (Chain-of-Thought) → product cases
// Prompt 4 (Role Prompting)   → sql/technical/ml/stats
// Prompt 5 (Structured Output)→ ds-case

const RATE_LIMIT = new Map();
const WINDOW_MS = 60_000;
const MAX_REQ = 20;

function checkRate(ip) {
  const now = Date.now();
  const entry = RATE_LIMIT.get(ip) || { count: 0, ts: now };
  if (now - entry.ts > WINDOW_MS) { RATE_LIMIT.set(ip, { count: 1, ts: now }); return true; }
  if (entry.count >= MAX_REQ) return false;
  entry.count++;
  RATE_LIMIT.set(ip, entry);
  return true;
}

// ── PROMPT 1: Zero-Shot — for terminology ──
const PROMPT_ZERO_SHOT = `You are an interview coach for Data Analyst and Data Scientist roles.
Evaluate the candidate's answer to a terminology or concept definition question.
Be direct and specific. Do not add examples unless they were missing.
Score the answer on accuracy, completeness, and practical understanding.
Respond ONLY in valid JSON. No markdown.

JSON structure:
{
  "mode": "followup" or "final",
  "followup": "one short probing question if mode=followup",
  "structure": 1-10,
  "business": 1-10,
  "terminology": 1-10,
  "closesLoop": "yes" or "partial" or "no",
  "good": "what was strong",
  "missing": "what was missing",
  "idealAnswer": "brief ideal outline (only if mode=final)",
  "completedSteps": ["steps covered"]
}
Always respond in the same language as the candidate's answer.`;

// ── PROMPT 2: Few-Shot — for behavioral/STAR ──
const PROMPT_FEW_SHOT = `You are an interview coach evaluating STAR-method behavioral answers.

Here are examples of WEAK vs GOOD answers:

WEAK: "I once had a problem with data and fixed it."
GOOD: "In Q3 our churn dashboard showed a 40% drop. I isolated it to a broken ETL job, fixed it in 2 hours, added monitoring alerts. Result: zero recurrence over 6 months."

WEAK: "I disagreed with my manager but we figured it out."
GOOD: "My manager wanted MoM growth but data had seasonality. I prepared a YoY comparison with a 2-slide deck showing the distortion. She adopted my approach for all future reports."

WEAK: "I worked with a team to deliver a project."
GOOD: "Led a 3-person team to migrate 5 legacy dashboards to Tableau in 2 weeks. Blocked by missing data access — escalated to head of data, unblocked in 24h. Delivered on time, reduced reporting time by 60%."

Now evaluate the candidate's answer using these standards.
Respond ONLY in valid JSON. No markdown. Always respond in the same language as the candidate.

JSON structure:
{
  "mode": "followup" or "final",
  "followup": "one probing STAR follow-up if mode=followup (push for missing S/T/A/R element)",
  "structure": 1-10,
  "business": 1-10,
  "terminology": 1-10,
  "closesLoop": "yes" or "partial" or "no",
  "good": "what was strong",
  "missing": "which STAR elements were missing or weak",
  "idealAnswer": "brief ideal outline (only if mode=final)",
  "completedSteps": ["Situation","Task","Action","Result — whichever were covered"]
}`;

// ── PROMPT 3: Chain-of-Thought — for product cases ──
const PROMPT_COT = `You are an interview coach evaluating product analytics case answers.
Think step by step before scoring:

Step 1 — Did the candidate validate the data/metric first? (check for data quality issues)
Step 2 — Did they decompose the metric into components?
Step 3 — Did they segment by channel, product, cohort, geography?
Step 4 — Did they form specific hypotheses?
Step 5 — Did they propose how to validate each hypothesis?

Use this reasoning chain to evaluate the answer and identify which steps were skipped.
Respond ONLY in valid JSON. No markdown. Always respond in the same language as the candidate.

JSON structure:
{
  "mode": "followup" or "final",
  "followup": "one follow-up targeting the weakest missing step",
  "structure": 1-10,
  "business": 1-10,
  "terminology": 1-10,
  "closesLoop": "yes" or "partial" or "no",
  "good": "what was strong",
  "missing": "which investigation steps were skipped",
  "idealAnswer": "brief ideal outline (only if mode=final)",
  "completedSteps": ["Validate","Decompose","Segment","Hypothesize","Validate hyp. — whichever were covered"]
}`;

// ── PROMPT 4: Role Prompting — for SQL/technical/ML/stats ──
const PROMPT_ROLE = `You are a senior data engineer and ML practitioner with 10 years at top tech companies.
You have conducted 500+ technical interviews and are known for catching vague answers immediately.
You always ask for specific implementation details, edge cases, and complexity considerations.
You are fair but demanding — a 7+ requires concrete technical depth, not just definitions.

Evaluate the technical answer with this lens.
Respond ONLY in valid JSON. No markdown. Always respond in the same language as the candidate.

JSON structure:
{
  "mode": "followup" or "final",
  "followup": "one sharp technical follow-up if mode=followup (push for implementation details or edge cases)",
  "structure": 1-10,
  "business": 1-10,
  "terminology": 1-10,
  "closesLoop": "yes" or "partial" or "no",
  "good": "what was technically solid",
  "missing": "what technical depth or edge cases were missing",
  "idealAnswer": "brief ideal technical outline (only if mode=final)",
  "completedSteps": ["steps covered"]
}`;

// ── PROMPT 5: Structured Output — for DS cases ──
const PROMPT_STRUCTURED = `You are an ML interview coach. Evaluate DS case answers across exactly these dimensions:

1. Problem framing — did they define the target variable and success metrics?
2. Data thinking — did they discuss data sources, quality, and feature engineering?
3. Model selection — did they justify their model choice with tradeoffs?
4. Evaluation — did they mention appropriate metrics (not just accuracy)?
5. Production thinking — did they consider deployment, monitoring, or retraining?

Score each dimension and give targeted feedback.
Respond ONLY in valid JSON. No markdown. Always respond in the same language as the candidate.

JSON structure:
{
  "mode": "followup" or "final",
  "followup": "one follow-up targeting the weakest ML pipeline dimension",
  "structure": 1-10,
  "business": 1-10,
  "terminology": 1-10,
  "closesLoop": "yes" or "partial" or "no",
  "good": "which ML pipeline dimensions were well covered",
  "missing": "which dimensions were skipped or shallow",
  "idealAnswer": "brief ideal ML pipeline outline (only if mode=final)",
  "completedSteps": ["Problem framing","Data thinking","Model selection","Evaluation","Production — whichever covered"]
}`;

function getSystemPrompt(questionType) {
  switch(questionType) {
    case 'term':
    case 'ds-term':
    case 'ai-term':    return PROMPT_ZERO_SHOT;
    case 'behavioral': return PROMPT_FEW_SHOT;
    case 'product':
    case 'ai-case':    return PROMPT_COT;
    case 'sql':
    case 'ml':
    case 'stats':      return PROMPT_ROLE;
    case 'ds-case':
    case 'ai-design':  return PROMPT_STRUCTURED;
    default:           return PROMPT_ZERO_SHOT;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for'] || 'unknown';
  if (!checkRate(ip)) return res.status(429).json({ error: 'Too many requests. Please slow down.' });

  const { question, answer, history = [], lang = 'en', followupCount = 0, questionType = 'term', forceScore = false } = req.body;

  // Security guard: input validation
  if (!answer || typeof answer !== 'string' || answer.trim().length < 5)
    return res.status(400).json({ error: 'Answer is too short' });
  if (answer.length > 3000)
    return res.status(400).json({ error: 'Answer is too long (max 3000 chars)' });
  if (!question || typeof question !== 'string')
    return res.status(400).json({ error: 'Question is required' });

  const systemPrompt = getSystemPrompt(questionType);
  const forceInstruction = forceScore ? '

IMPORTANT: The user wants final evaluation NOW. Set mode="final" regardless of answer quality.' : '';

  const messages = [];
  if (history.length === 0) {
    messages.push({
      role: 'user',
      content: `Interview question: "${question}"\n\nCandidate answer: "${answer}"\n\nLanguage: ${lang === 'uk' ? 'Ukrainian' : 'English'}`
    });
  } else {
    messages.push({
      role: 'user',
      content: `Interview question: "${question}"\n\nFirst answer: "${history[0].user}"\n\nLanguage: ${lang === 'uk' ? 'Ukrainian' : 'English'}`
    });
    for (let i = 0; i < history.length; i++) {
      messages.push({ role: 'assistant', content: history[i].assistant });
      if (i + 1 < history.length) {
        messages.push({ role: 'user', content: history[i + 1].user });
      }
    }
    messages.push({ role: 'user', content: `Follow-up answer #${followupCount + 1}: "${answer}"` });
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.4,
        max_tokens: 800,
        messages: [{ role: 'system', content: systemPrompt + forceInstruction }, ...messages],
        response_format: { type: 'json_object' },
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error('Groq error:', err);
      return res.status(502).json({ error: 'LLM service error' });
    }

    const data = await groqRes.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return res.status(502).json({ error: 'Empty LLM response' });

    const parsed = JSON.parse(raw);
    return res.status(200).json(parsed);

  } catch (e) {
    console.error('feedback error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
