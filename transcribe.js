// api/transcribe.js — Groq Whisper speech-to-text
// Accepts multipart/form-data with audio file

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Collect raw body chunks
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);

    // Forward to Groq Whisper as-is (multipart)
    const contentType = req.headers['content-type'];

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': contentType
      },
      body
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error('Whisper error:', err);
      return res.status(502).json({ error: 'Transcription failed' });
    }

    const data = await groqRes.json();
    return res.status(200).json({ text: data.text || '' });

  } catch (e) {
    console.error('transcribe error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
