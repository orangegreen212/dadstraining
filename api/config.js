// api/config.js — отдаёт Groq key фронтенду (только Whisper, безопасно)
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ groqKey: process.env.GROQ_API_KEY || '' });
};
