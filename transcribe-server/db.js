// db.js
import fsp from "fs/promises";
import path from "path";

const DB_FILE = path.join(process.cwd(), "library.json");

async function load() {
  try {
    const buf = await fsp.readFile(DB_FILE, "utf8");
    return JSON.parse(buf);
  } catch {
    return { items: [] };
  }
}

async function save(db) {
  await fsp.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const L = Math.min(a.length, b.length);
  for (let i = 0; i < L; i++) {
    const x = a[i], y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

export async function addItem({ text, keyPoints, embedding, meta = {} }) {
  const db = await load();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  db.items.push({
    id,
    createdAt: new Date().toISOString(),
    text,
    keyPoints,
    embedding,
    meta,
  });
  await save(db);
  return id;
}

export async function searchByQueryEmbedding(queryEmbedding, topK = 5) {
  const db = await load();
  const scored = db.items.map((it) => ({
    item: it,
    score: cosine(queryEmbedding, it.embedding || []),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

export async function listItems() {
    try {
      const buf = await fsp.readFile(DB_FILE, "utf8");
      const db = JSON.parse(buf);
      return db.items || [];
    } catch {
      return [];
    }
  }