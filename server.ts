import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum dikonfigurasi pada environment server.");
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: "v1beta",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const ALLOWED_VOICES = new Set(["Puck", "Charon", "Kore", "Fenrir", "Zephyr"]);
const ALLOWED_TTS_MODELS = new Set([
  "gemini-3.8-flash-lite-tts",
  "gemini-3.8-flash-tts",
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status =
        typeof err === "object" && err !== null && "status" in err
          ? Number((err as { status?: unknown }).status)
          : 0;
      const isRetryable = status === 429 || status === 503 || status === 500;
      if (!isRetryable || attempt === maxAttempts) {
        throw err;
      }
      await sleep(700 * Math.pow(2, attempt - 1));
    }
  }
  throw lastError;
}

function extractCleanMessage(raw: string): string {
  let current = raw.trim();
  for (let i = 0; i < 3; i++) {
    try {
      const parsed = JSON.parse(current) as {
        error?: { message?: string } | string;
        message?: string;
      };
      if (typeof parsed.error === "object" && parsed.error?.message) {
        current = parsed.error.message;
        continue;
      }
      if (typeof parsed.message === "string") {
        current = parsed.message;
        continue;
      }
      break;
    } catch {
      break;
    }
  }
  return current;
}

function formatApiError(err: unknown): { status: number; message: string } {
  const rawMessage =
    err instanceof Error ? err.message : "Terjadi kesalahan pada server Gemini.";
  const cleanMessage = extractCleanMessage(rawMessage);
  const status =
    typeof err === "object" && err !== null && "status" in err
      ? Number((err as { status?: unknown }).status) || 500
      : 500;

  if (status === 403 || cleanMessage.includes("PERMISSION_DENIED")) {
    return {
      status: 403,
      message:
        "Izin API ditolak (403). Periksa GEMINI_API_KEY Anda di panel Settings > Secrets.",
    };
  }
  if (status === 400 && cleanMessage.includes("API_KEY_INVALID")) {
    return {
      status: 400,
      message:
        "API key tidak valid. Periksa kembali GEMINI_API_KEY di panel Settings > Secrets.",
    };
  }
  if (status === 429 || cleanMessage.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      message:
        "Batas kuota permintaan tercapai (429). Tunggu beberapa saat atau gunakan kunci API berbayar di Settings > Secrets.",
    };
  }
  if (status === 503 || cleanMessage.includes("UNAVAILABLE")) {
    return {
      status: 503,
      message:
        "Layanan Gemini sedang sibuk sementara (503). Silakan kirim ulang beberapa detik lagi.",
    };
  }
  return { status, message: cleanMessage };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/tts/generate", async (req, res) => {
    try {
      const body = req.body as {
        text?: unknown;
        voiceName?: unknown;
        style?: unknown;
        model?: unknown;
      };

      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (!text) {
        res.status(400).json({ error: "Teks narasi tidak boleh kosong." });
        return;
      }
      if (text.length > 6000) {
        res.status(400).json({
          error: "Teks segmen terlalu panjang. Bagi menjadi babak yang lebih ringkas.",
        });
        return;
      }

      const voiceName =
        typeof body.voiceName === "string" && ALLOWED_VOICES.has(body.voiceName)
          ? body.voiceName
          : "Charon";

      const model =
        typeof body.model === "string" && ALLOWED_TTS_MODELS.has(body.model)
          ? body.model
          : "gemini-3.8-flash-lite-tts";

      const style =
        typeof body.style === "string" && body.style.trim().length > 0
          ? body.style.trim()
          : "Narator dokumenter sejarah berbahasa Indonesia yang berwibawa, jernih, dan penuh penghayatan.";

      const ai = getAiClient();

      const response = await withRetry(() =>
        ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                {
                  text,
                  speechMetadata: {
                    style,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        })
      );

      const audioPart = response.candidates?.[0]?.content?.parts?.find(
        (part) => part.inlineData?.data
      );
      const base64Audio = audioPart?.inlineData?.data;

      if (!base64Audio) {
        res.status(502).json({
          error: "Model tidak mengembalikan data audio. Silakan coba lagi.",
        });
        return;
      }

      res.json({
        audioBase64: base64Audio,
        mimeType: audioPart?.inlineData?.mimeType || "audio/wav",
        voiceName,
        model,
      });
    } catch (err: unknown) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const body = req.body as {
        message?: unknown;
        history?: unknown;
        activeChapterTitle?: unknown;
        activeVoiceName?: unknown;
        activeStyle?: unknown;
        scriptExcerpt?: unknown;
      };

      const message =
        typeof body.message === "string" ? body.message.trim() : "";
      if (!message) {
        res.status(400).json({ error: "Pesan tidak boleh kosong." });
        return;
      }

      const rawHistory = Array.isArray(body.history) ? body.history : [];
      const history = rawHistory
        .filter(
          (item): item is { role: "user" | "model"; text: string } =>
            typeof item === "object" &&
            item !== null &&
            (item.role === "user" || item.role === "model") &&
            typeof item.text === "string" &&
            item.text.trim().length > 0
        )
        .slice(-24)
        .map((item) => ({
          role: item.role,
          parts: [{ text: item.text }],
        }));

      const activeChapterTitle =
        typeof body.activeChapterTitle === "string"
          ? body.activeChapterTitle
          : "Seluruh Naskah";
      const activeVoiceName =
        typeof body.activeVoiceName === "string" ? body.activeVoiceName : "Charon";
      const activeStyle =
        typeof body.activeStyle === "string" ? body.activeStyle : "";
      const scriptExcerpt =
        typeof body.scriptExcerpt === "string"
          ? body.scriptExcerpt.slice(0, 8000)
          : "";

      const systemInstruction = `Anda adalah Sutradara Suara & Asisten Riset Sejarah untuk proyek dokumenter "Arsip Suara 1945" (naskah narasi sejarah Indonesia 1939–1945: dari Hindia Belanda, perebutan minyak Tarakan/Palembang/Balikpapan, invasi Jepang, penyerahan Kalijati 8 Maret 1942, masa pendudukan & romusha, hingga Proklamasi 17 Agustus 1945).

Peran Anda:
1. Membantu pengguna mengarahkan intonasi, jeda, penekanan kata, dan emosi voiceover (VO) dalam bahasa Indonesia.
2. Memberikan panduan pelafalan yang tepat untuk nama tokoh dan tempat historis (misalnya Karel Doorman, Hitoshi Imamura, Tjarda van Starkenborgh, Ter Poorten, Langoan, Eretan Wetan, Kragan, Kalijati, BPUPKI, Rengasdengklok).
3. Menyarankan arahan gaya suara ringkas (speechMetadata style) dalam 1 kalimat bila pengguna meminta variasi gaya pembacaan. Jika menyarankan arahan gaya baru, bungkus saran gaya tersebut dalam format: [GAYA: <teks arahan gaya>] agar mudah diterapkan ke studio.
4. Menjawab pertanyaan fakta sejarah dan struktur dramaturgi dari naskah yang sedang dikerjakan.

Konteks Studio Saat Ini:
- Babak aktif: ${activeChapterTitle}
- Profil suara aktif: ${activeVoiceName}
- Arahan gaya aktif: ${activeStyle}

Cuplikan Naskah:
${scriptExcerpt}

Gunakan bahasa Indonesia yang lugas, bernas, dan praktis seperti sutradara studio rekaman dokumenter.`;

      const ai = getAiClient();
      const chat = ai.chats.create({
        model: "gemini-4-hydrogen",
        history,
        config: {
          systemInstruction,
        },
      });

      const stream = await withRetry(() => chat.sendMessageStream({ message }));

      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of stream) {
        const chunkText = chunk.text;
        if (chunkText) {
          res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
        }
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err: unknown) {
      const formatted = formatApiError(err);
      if (!res.headersSent) {
        res.status(formatted.status).json({ error: formatted.message });
      } else {
        res.write(`data: ${JSON.stringify({ error: formatted.message })}\n\n`);
        res.end();
      }
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(distDir, "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
