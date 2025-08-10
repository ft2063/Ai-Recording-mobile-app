// index.js — full, debug-friendly MP4 server
import express from "express";
import multer from "multer";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import OpenAI from "openai";
import { summarizeKeyPoints, embed, answerWithRAG } from "./ai.js";
import { addItem, searchByQueryEmbedding, listItems } from "./db.js";
import "dotenv/config";



const app = express();
app.use(express.json({ limit: "10mb" }));
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Ensure folders exist
await fsp.mkdir("uploads", { recursive: true });
await fsp.mkdir("debug", { recursive: true });

// Always save as .mp4 so Whisper recognizes the container
const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => cb(null, "upload.m4a"),
  });
const upload = multer({ storage });

// Health
app.get("/", (_, res) =>
  res.type("text/plain").send("OK – POST /transcribe with multipart field 'file'")
);
app.get("/health", async (_, res) => res.json({ ok: true }));

app.post("/transcribe", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });

    // Basic request logs
    console.log("---- Incoming upload ----");
    console.log("originalname:", req.file.originalname);
    console.log("mimetype    :", req.file.mimetype);
    console.log("saved path  :", req.file.path);
    console.log("size bytes  :", req.file.size);

    // Save a copy to debug/ with timestamp (for manual playback)
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const debugCopy = path.join("debug", `rec-${stamp}.mp4`);
    await fsp.copyFile(req.file.path, debugCopy);

    // Peek header (should include 'ftyp')
    const fd = await fsp.open(req.file.path, "r");
    const buf = Buffer.alloc(12);
    await fd.read(buf, 0, 12, 0);
    await fd.close();
    console.log("header bytes:", buf.toString("ascii"));
    console.log("-------------------------");

    if (req.file.size < 12000) {
      console.warn("⚠️ File is very small; likely silent mic or permissions issue.");
    }

    // Optional: force language via query (?lang=en)
    const forcedLang = (req.query.lang || "").toString().trim() || undefined;

    // Log the API call details
    const apiCall = {
      filePath: req.file.path,
      model: "whisper-1",
      response_format: "verbose_json",
      temperature: 0,
      ...(forcedLang ? { language: forcedLang } : {}),
    };
    console.log(">>> Sending to OpenAI Whisper API with:");
    console.log(apiCall);

    // Call Whisper
    const result = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "whisper-1",
      response_format: "verbose_json",
      temperature: 0,
      ...(forcedLang ? { language: forcedLang } : {}),
    });

    // Log raw response
    console.log("<<< Whisper API raw response:");
    console.dir(result, { depth: null });

    // Pretty print transcript + segments
    console.log("\n===== TRANSCRIPT =====");
    console.log(result.text || "(empty)");
    console.log("======================\n");

    if (Array.isArray(result.segments)) {
      console.log("Segments:", result.segments.length, " Duration(s):", result.duration);
      for (const s of result.segments) {
        const t0 = Number(s.start ?? 0).toFixed(2);
        const t1 = Number(s.end ?? 0).toFixed(2);
        console.log(`[${t0}s–${t1}s] ${s.text}`);
      }
      console.log("==== END SEGMENTS ====\n");
    }

    // Cleanup temp
    fsp.unlink(req.file.path).catch(() => {});

    res.json({
      text: result.text || "",
      duration: result.duration ?? null,
      segments: result.segments ?? [],
      debugFile: debugCopy,
    });
  } catch (e) {
    console.error("Transcription error:", e);
    res.status(500).send(String(e));
  }
});

app.post("/ingest", async (req, res) => {
    try {
      const { text, meta } = req.body || {};
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Provide { text }" });
      }
  
      const keyPoints = await summarizeKeyPoints(text);
      const vector   = await embed(text);
  
      const id = await addItem({ text, keyPoints, embedding: vector, meta: meta || {} });
  
      res.json({ id, keyPoints });
    } catch (e) {
      console.error("Ingest error:", e);
      res.status(500).json({ error: String(e) });
    }
  });
  
  // --- NEW: Semantic search ---
  app.get("/search", async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();
      const k = Number(req.query.k || 5);
      if (!q) return res.status(400).json({ error: "Provide ?q=..." });
  
      const qVec = await embed(q);
      const results = await searchByQueryEmbedding(qVec, k);
  
      res.json({
        query: q,
        results: results.map(({ item, score }) => ({
          id: item.id,
          score,
          keyPoints: item.keyPoints,
          snippet: item.text.slice(0, 400),
          createdAt: item.createdAt,
          meta: item.meta,
        })),
      });
    } catch (e) {
      console.error("Search error:", e);
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/answer", async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();
      const k = Number(req.query.k || 5);
      if (!q) return res.status(400).json({ error: "Provide ?q=..." });
  
      // retrieve top-k
      const qVec = await embed(q);
      const retrieved = await searchByQueryEmbedding(qVec, k);
  
      // build minimal context for the model
      const contexts = retrieved.map(({ item, score }) => ({
        id: item.id,
        score,
        keyPoints: item.keyPoints,
        snippet: item.text.slice(0, 600),
        createdAt: item.createdAt,
        meta: item.meta,
      }));
  
      const { answer } = await answerWithRAG(q, contexts);
  
      res.json({
        query: q,
        answer,
        sources: contexts.map((c, i) => ({
          ref: `#${i+1}`,
          id: c.id,
          title: c.meta?.title || null,
          score: c.score,
          createdAt: c.createdAt,
        })),
      });
    } catch (e) {
      console.error("Answer error:", e);
      res.status(500).json({ error: String(e) });
    }
  });

  // List everything in the library (simple view)
app.get("/library", async (req, res) => {
    try {
      const items = await listItems();
      const out = items.map((it) => ({
        id: it.id,
        createdAt: it.createdAt,
        title: it.meta?.title || null,
        keyPoints: it.keyPoints || "",
      }));
      res.json(out);
    } catch (e) {
      console.error("Library error:", e);
      res.status(500).json({ error: String(e) });
    }
  });
  
  
app.listen(3001, "0.0.0.0", () => console.log("Transcribe server → http://0.0.0.0:3001"));
