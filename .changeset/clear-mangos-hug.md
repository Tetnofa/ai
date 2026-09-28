---
'@tanstack/ai': minor
'@tanstack/ai-client': patch
'@tanstack/ai-openai': minor
'@tanstack/ai-lovable': minor
'@tanstack/ai-openrouter': minor
'@tanstack/ai-groq': minor
'@tanstack/ai-grok': minor
'@tanstack/ai-gemini': minor
'@tanstack/ai-elevenlabs': minor
'@tanstack/ai-fal': minor
'@tanstack/ai-event-client': patch
'@tanstack/ai-persistence': patch
---

Add a pluggable `mediaUploader` callback that stores generated media streams and returns a public URL. OpenAI, Lovable, and OpenRouter video downloads now require an uploader when no public upstream URL is available, rather than silently buffering video as base64.

Opt into hosted speech on OpenAI, Lovable, Groq, Grok, ElevenLabs, and fal, hosted ElevenLabs audio, and hosted OpenAI/Gemini inline images. Hosted speech results carry `url` and an empty `audio`; existing base64 output remains the default for speech and inline images. Buffered media warnings use the configured logger.
