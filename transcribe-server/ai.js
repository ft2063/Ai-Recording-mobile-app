import 'dotenv/config';   // <-- must be line 1
import OpenAI from 'openai';



const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function summarizeKeyPoints(text) {
  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Extract concise key bullets (≤7) from the transcript. One bullet per line, plain text." },
      { role: "user", content: `Transcript:\n${text}` }
    ],
    temperature: 0.2
  });
  return resp.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function embed(text) {
  const resp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text
  });
  return resp.data[0].embedding;
}
export async function answerWithRAG(query, contexts) {
  // contexts: [{ id, keyPoints, snippet, createdAt, meta }]
  const contextText = contexts.map((c, i) => {
    const title = c.meta?.title ? ` (${c.meta.title})` : "";
    return `[#${i+1}${title}] 
Key points:
${c.keyPoints || "(none)"}

Snippet:
${c.snippet || "(none)"}\n`;
  }).join("\n");

  const system = `You are a helpful assistant. Answer the question using ONLY the provided context.
Cite your sources inline like [#1], [#2] etc. If the answer isn't in the context, say you don't know. Be brief.`;
  const user = `Question: ${query}\n\nContext:\n${contextText}`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: 0.2,
  });

  const answer = resp.choices?.[0]?.message?.content?.trim() ?? "";
  return { answer };
}