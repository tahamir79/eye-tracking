import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function clean(raw: string): string[] {
  return raw
    .replace(/[^\w\s,]/g, '')        // strip punctuation
    .split(/[, ]+/)                  // split on commas / spaces
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export async function POST(req: NextRequest) {
  const { text } = (await req.json()) as { text?: string };

  if (!text || !text.trim()) {
    return NextResponse.json({ suggestions: [] });
  }

  const prompt = `
Suggest **exactly three** next words (comma-separated, no quotes)
for continuing this passage:
${text}
`;

  const chat = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 12,
    temperature: 0.6,
  });

  const suggestions = clean(chat.choices[0].message.content ?? '');
  return NextResponse.json({ suggestions });
}
