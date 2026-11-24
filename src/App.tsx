import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChapterList } from "./components/ChapterList";
import { DirectorChat } from "./components/DirectorChat";
import { Header } from "./components/Header";
import { MasterPlayer } from "./components/MasterPlayer";
import { ScriptInputSection } from "./components/ScriptInputSection";
import { VoiceConfigPanel } from "./components/VoiceConfigPanel";
import { STYLE_PRESETS } from "./constants/voices";
import {
  ChapterAudioState,
  ChatMessage,
  ScriptChapter,
  TtsModel,
  VoiceName,
} from "./types/studio";
import {
  countWords,
  estimateDurationSeconds,
  formatTimecode,
  parseGeneralScript,
  parseNarrationScript,
} from "./utils/scriptParser";
import {
  base64ToUint8Array,
  downloadWavBytes,
  extractWaveformPeaks,
  getWavDurationSeconds,
  mergeWavClips,
  uint8ArrayToBlobUrl,
} from "./utils/wavUtils";

const SAMPLE_SCRIPT_URL = "/assets/aistudio/narasi_VO_indonesia_929e98af.txt";
const STORAGE_KEY = "studio_voiceover_project_v1";

function nowTimeLabel(): string {
  return new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function slugifyFilename(title: string): string {
  const clean = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return clean || "voiceover_master";
}

export default function App() {
  const [projectTitle, setProjectTitle] = useState("Proyek Voiceover Baru");
  const [draftRawText, setDraftRawText] = useState("");
  const [chapters, setChapters] = useState<ScriptChapter[]>([]);
  const [isInputExpanded, setIsInputExpanded] = useState(true);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);

  // Studio Voice Settings
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>("Charon");
  const [selectedModel, setSelectedModel] = useState<TtsModel>(
    "gemini-3.8-flash-lite-tts"
  );
  const [stylePrompt, setStylePrompt] = useState(STYLE_PRESETS[0].prompt);

  // Audio State per Segment
  const [audioMap, setAudioMap] = useState<Record<string, ChapterAudioState>>({});
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Batch Generation
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const batchCancelRef = useRef(false);

  // Quick Audition (Voice Sample or Single Line)
  const [isAuditioningVoice, setIsAuditioningVoice] = useState(false);
  const [isAuditionPlaying, setIsAuditionPlaying] = useState(false);
  const [auditionError, setAuditionError] = useState<string | null>(null);
  const [auditioningLineKey, setAuditioningLineKey] = useState<string | null>(
    null
  );

  // Navigation & Mobile Tabs
  const [activeSection, setActiveSection] = useState<
    "input" | "studio" | "player" | "chat"
  >("input");
  const [mobilePanel, setMobilePanel] = useState<"studio" | "chat">("studio");

  // Multi-turn Gemini Chatbot State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-msg",
      role: "model",
      text: "Selamat datang di Studio Voiceover. Tempelkan naskah Anda atau unggah file .txt di bagian atas untuk mulai membuat audio narasi.\n\nSaya siap membantu mengatur intonasi, tanda jeda, memperbaiki kalimat agar lebih enak diucapkan, atau menyarankan gaya suara yang tepat.",
      timestamp: nowTimeLabel(),
    },
  ]);
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const masterAudioRef = useRef<HTMLAudioElement | null>(null);
  const auditionAudioRef = useRef<HTMLAudioElement | null>(null);

  // Restore saved workspace from localStorage if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as {
        projectTitle?: string;
        draftRawText?: string;
        chapters?: ScriptChapter[];
        selectedVoice?: VoiceName;
        stylePrompt?: string;
      };
      if (parsed.projectTitle) setProjectTitle(parsed.projectTitle);
      if (parsed.draftRawText) setDraftRawText(parsed.draftRawText);
      if (Array.isArray(parsed.chapters) && parsed.chapters.length > 0) {
        setChapters(parsed.chapters);
        setActiveChapterId(parsed.chapters[0].id);
        setIsInputExpanded(false);
      }
      if (parsed.selectedVoice) setSelectedVoice(parsed.selectedVoice);
      if (parsed.stylePrompt) setStylePrompt(parsed.stylePrompt);
    } catch {
      // Ignore malformed local storage
    }
  }, []);

  // Persist script workspace to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          projectTitle,
          draftRawText,
          chapters,
          selectedVoice,
          stylePrompt,
        })
      );
    } catch {
      // Ignore quota errors
    }
  }, [projectTitle, draftRawText, chapters, selectedVoice, stylePrompt]);

  // Cleanup Blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(audioMap).forEach((state) => {
        if (state.blobUrl) URL.revokeObjectURL(state.blobUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearAllAudio = useCallback(() => {
    if (masterAudioRef.current) {
      masterAudioRef.current.pause();
      masterAudioRef.current.removeAttribute("src");
    }
    setIsPlaying(false);
    setAudioMap((prev) => {
      Object.values(prev).forEach((s) => {
        if (s.blobUrl) URL.revokeObjectURL(s.blobUrl);
      });
      return {};
    });
  }, []);

  const handleApplyScript = (rawText: string, customTitle?: string) => {
    const parsed = parseGeneralScript(rawText);
    clearAllAudio();
    setChapters(parsed);
    if (customTitle) {
      setProjectTitle(customTitle);
    }
    if (parsed.length > 0) {
      setActiveChapterId(parsed[0].id);
      setIsInputExpanded(false);
    }
  };

  const handleLoadSampleScript = async () => {
    setIsLoadingSample(true);
    setSampleError(null);
    try {
      const res = await fetch(SAMPLE_SCRIPT_URL);
      if (!res.ok) {
        throw new Error(`Gagal memuat contoh naskah (${res.status})`);
      }
      const text = await res.text();
      clearAllAudio();
      const parsed = parseNarrationScript(text);
      setProjectTitle("Dokumenter Sejarah Indonesia (1939–1945)");
      setDraftRawText(text);
      setChapters(parsed);
      if (parsed.length > 0) {
        setActiveChapterId(parsed[0].id);
      }
      setIsInputExpanded(false);
    } catch (err: unknown) {
      setSampleError(
        err instanceof Error ? err.message : "Gagal memuat contoh naskah."
      );
    } finally {
      setIsLoadingSample(false);
    }
  };

  const handleResetBlank = () => {
    clearAllAudio();
    setProjectTitle("Proyek Voiceover Baru");
    setDraftRawText("");
    setChapters([]);
    setActiveChapterId(null);
    setIsInputExpanded(true);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage error
    }
  };

  const totalWords = useMemo(
    () => chapters.reduce((acc, ch) => acc + ch.wordCount, 0),
    [chapters]
  );
  const totalLines = useMemo(
    () => chapters.reduce((acc, ch) => acc + ch.lines.length, 0),
    [chapters]
  );
  const totalEstimatedSeconds = useMemo(
    () => estimateDurationSeconds(totalWords),
    [totalWords]
  );

  const activeChapter = useMemo(
    () => chapters.find((ch) => ch.id === activeChapterId) || chapters[0] || null,
    [chapters, activeChapterId]
  );

  const synthesizeText = useCallback(
    async (text: string): Promise<{
      audioBase64: string;
      wavBytes: Uint8Array;
      blobUrl: string;
      durationSeconds: number;
      peaks: number[];
    }> => {
      const response = await fetch("/api/tts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voiceName: selectedVoice,
          style: stylePrompt,
          model: selectedModel,
        }),
      });

      const data = (await response.json()) as {
        audioBase64?: string;
        error?: string;
      };

      if (!response.ok || !data.audioBase64) {
        throw new Error(data.error || "Gagal menghasilkan audio suara.");
      }

      const wavBytes = base64ToUint8Array(data.audioBase64);
      const blobUrl = uint8ArrayToBlobUrl(wavBytes, "audio/wav");
      const durationSeconds = getWavDurationSeconds(wavBytes);
      const peaks = extractWaveformPeaks(wavBytes, 72);

      return {
        audioBase64: data.audioBase64,
        wavBytes,
        blobUrl,
        durationSeconds,
        peaks,
      };
    },
    [selectedModel, selectedVoice, stylePrompt]
  );

  const generateChapter = useCallback(
    async (chapterId: string): Promise<boolean> => {
      const target = chapters.find((ch) => ch.id === chapterId);
      if (!target || !target.text.trim()) return false;

      setAudioMap((prev) => {
        const oldUrl = prev[chapterId]?.blobUrl;
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        return {
          ...prev,
          [chapterId]: { status: "generating" },
        };
      });

      try {
        const result = await synthesizeText(target.text);
        setAudioMap((prev) => ({
          ...prev,
          [chapterId]: {
            status: "ready",
            audioBase64: result.audioBase64,
            blobUrl: result.blobUrl,
            durationSeconds: result.durationSeconds,
            peaks: result.peaks,
            generatedVoice: selectedVoice,
            generatedModel: selectedModel,
            generatedStyle: stylePrompt,
          },
        }));
        return true;
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "Gagal mensintesis suara segmen.";
        setAudioMap((prev) => ({
          ...prev,
          [chapterId]: {
            status: "error",
            error: msg,
          },
        }));
        return false;
      }
    },
    [chapters, selectedModel, selectedVoice, stylePrompt, synthesizeText]
  );

  const handleGenerateAll = async () => {
    if (chapters.length === 0 || isBatchGenerating) return;
    batchCancelRef.current = false;
    setIsBatchGenerating(true);

    const pendingChapters = chapters.filter(
      (ch) => audioMap[ch.id]?.status !== "ready" && ch.text.trim().length > 0
    );
    const targets = pendingChapters.length > 0 ? pendingChapters : chapters;

    setBatchProgress({ current: 0, total: targets.length });

    for (let i = 0; i < targets.length; i++) {
      if (batchCancelRef.current) break;
      setBatchProgress({ current: i + 1, total: targets.length });
      const ch = targets[i];
      setActiveChapterId(ch.id);
      await generateChapter(ch.id);
    }

    setIsBatchGenerating(false);
  };

  const handleCancelBatch = () => {
    batchCancelRef.current = true;
    setIsBatchGenerating(false);
  };

  // Master Audio Player synchronization
  const playBlobUrlInMaster = useCallback(
    (chapterId: string, blobUrl: string) => {
      const audioEl = masterAudioRef.current;
      if (!audioEl) return;
      setActiveChapterId(chapterId);
      if (audioEl.src !== blobUrl) {
        audioEl.src = blobUrl;
      }
      audioEl
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    },
    []
  );

  const handlePlayChapter = (chapterId: string) => {
    const state = audioMap[chapterId];
    if (!state || state.status !== "ready" || !state.blobUrl) return;

    const audioEl = masterAudioRef.current;
    if (!audioEl) return;

    if (activeChapterId === chapterId && isPlaying) {
      audioEl.pause();
      setIsPlaying(false);
      return;
    }

    if (activeChapterId === chapterId && audioEl.src === state.blobUrl) {
      audioEl
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
      return;
    }

    playBlobUrlInMaster(chapterId, state.blobUrl);
  };

  const handleToggleMasterPlay = () => {
    if (!activeChapter) return;
    handlePlayChapter(activeChapter.id);
  };

  const handleSelectChapterInPlayer = (chapterId: string) => {
    setActiveChapterId(chapterId);
    const state = audioMap[chapterId];
    const audioEl = masterAudioRef.current;
    if (!audioEl) return;

    if (state?.status === "ready" && state.blobUrl) {
      const wasPlaying = isPlaying;
      audioEl.src = state.blobUrl;
      if (wasPlaying) {
        audioEl
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      } else {
        setIsPlaying(false);
      }
    } else {
      audioEl.pause();
      audioEl.removeAttribute("src");
      setIsPlaying(false);
    }
  };

  const handleNextChapter = useCallback(() => {
    if (!activeChapter) return;
    const idx = chapters.findIndex((c) => c.id === activeChapter.id);
    for (let i = idx + 1; i < chapters.length; i++) {
      const next = chapters[i];
      const nextAudio = audioMap[next.id];
      if (nextAudio?.status === "ready" && nextAudio.blobUrl) {
        playBlobUrlInMaster(next.id, nextAudio.blobUrl);
        return;
      }
    }
    setIsPlaying(false);
  }, [activeChapter, audioMap, chapters, playBlobUrlInMaster]);

  const handlePrevChapter = () => {
    if (!activeChapter) return;
    const idx = chapters.findIndex((c) => c.id === activeChapter.id);
    for (let i = idx - 1; i >= 0; i--) {
      const prev = chapters[i];
      const prevAudio = audioMap[prev.id];
      if (prevAudio?.status === "ready" && prevAudio.blobUrl) {
        playBlobUrlInMaster(prev.id, prevAudio.blobUrl);
        return;
      }
    }
  };

  // Voice & Single Line Audition
  const stopAudition = () => {
    const el = auditionAudioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setIsAuditionPlaying(false);
  };

  const handleAuditionVoice = async () => {
    if (isAuditionPlaying) {
      stopAudition();
      return;
    }
    setAuditionError(null);
    setIsAuditioningVoice(true);
    try {
      const firstLine = activeChapter?.lines[0];
      const sampleText =
        firstLine ||
        "Halo, ini adalah contoh suara narasi untuk proyek Anda. Atur gaya dan intonasi sesuai kebutuhan cerita.";
      const result = await synthesizeText(sampleText);
      const el = auditionAudioRef.current;
      if (el) {
        el.src = result.blobUrl;
        el.onended = () => {
          setIsAuditionPlaying(false);
          URL.revokeObjectURL(result.blobUrl);
        };
        await el.play();
        setIsAuditionPlaying(true);
      }
    } catch (err: unknown) {
      setAuditionError(
        err instanceof Error ? err.message : "Gagal memutar pratinjau suara."
      );
    } finally {
      setIsAuditioningVoice(false);
    }
  };

  const handleAuditionLine = async (lineKey: string, text: string) => {
    stopAudition();
    setAuditionError(null);
    setAuditioningLineKey(lineKey);
    try {
      const result = await synthesizeText(text);
      const el = auditionAudioRef.current;
      if (el) {
        el.src = result.blobUrl;
        el.onended = () => {
          URL.revokeObjectURL(result.blobUrl);
        };
        await el.play();
      }
    } catch (err: unknown) {
      setAuditionError(
        err instanceof Error ? err.message : "Gagal memutar uji baris."
      );
    } finally {
      setAuditioningLineKey(null);
    }
  };

  // Download Per-Segment or Stitched Master WAV
  const handleDownloadChapter = (chapterId: string) => {
    const ch = chapters.find((c) => c.id === chapterId);
    const state = audioMap[chapterId];
    if (!ch || !state?.audioBase64) return;
    const bytes = base64ToUint8Array(state.audioBase64);
    downloadWavBytes(
      bytes,
      `${slugifyFilename(projectTitle)}_segmen_${ch.roman}.wav`
    );
  };

  const handleDownloadMaster = () => {
    const orderedClips = chapters
      .map((ch) => audioMap[ch.id]?.audioBase64 || "")
      .filter((b64) => b64.length > 0);
    const merged = mergeWavClips(orderedClips);
    if (!merged) return;
    downloadWavBytes(merged, `${slugifyFilename(projectTitle)}_master.wav`);
  };

  const handleUpdateChapter = (
    chapterId: string,
    newTitle: string,
    newText: string
  ) => {
    setChapters((prev) =>
      prev.map((ch) => {
        if (ch.id !== chapterId) return ch;
        const lines = newText
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        const normalizedText = lines.join("\n\n");
        return {
          ...ch,
          title: newTitle.trim() || ch.title,
          lines,
          text: normalizedText,
          wordCount: countWords(normalizedText),
        };
      })
    );
  };

  const handleDeleteChapter = (chapterId: string) => {
    setChapters((prev) => {
      const filtered = prev
        .filter((ch) => ch.id !== chapterId)
        .map((ch, idx) => ({
          ...ch,
          roman: String(idx + 1).padStart(2, "0"),
        }));
      if (activeChapterId === chapterId) {
        setActiveChapterId(filtered[0]?.id || null);
      }
      return filtered;
    });
    setAudioMap((prev) => {
      const next = { ...prev };
      if (next[chapterId]?.blobUrl) {
        URL.revokeObjectURL(next[chapterId].blobUrl!);
      }
      delete next[chapterId];
      return next;
    });
  };

  const handleAddChapter = () => {
    const nextIndex = chapters.length + 1;
    const roman = String(nextIndex).padStart(2, "0");
    const defaultLine = "Tulis kalimat narasi untuk segmen ini.";
    const newChapter: ScriptChapter = {
      id: `segmen-${nextIndex}-${Date.now().toString(36)}`,
      roman,
      title: `Segmen ${roman}`,
      period: "2 baris",
      lines: [defaultLine],
      text: defaultLine,
      wordCount: countWords(defaultLine),
    };
    setChapters((prev) => [...prev, newChapter]);
    setActiveChapterId(newChapter.id);
  };

  // Multi-turn Gemini Chatbot
  const handleSendMessage = async (userText: string) => {
    if (isChatStreaming) return;
    setChatError(null);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: userText,
      timestamp: nowTimeLabel(),
    };
    const modelMsgId = `model-${Date.now() + 1}`;
    const placeholderModelMsg: ChatMessage = {
      id: modelMsgId,
      role: "model",
      text: "",
      timestamp: nowTimeLabel(),
    };

    const historyPayload = chatMessages.map((m) => ({
      role: m.role,
      text: m.text,
    }));

    setChatMessages((prev) => [...prev, userMsg, placeholderModelMsg]);
    setIsChatStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history: historyPayload,
          projectTitle,
          activeChapterTitle: activeChapter
            ? `Segmen ${activeChapter.roman}: ${activeChapter.title}`
            : "Belum ada segmen aktif",
          activeVoiceName: selectedVoice,
          activeStyle: stylePrompt,
          scriptExcerpt: activeChapter ? activeChapter.text : draftRawText,
        }),
      });

      if (!response.ok) {
        const errBody = (await response.json()) as { error?: string };
        throw new Error(errBody.error || "Gagal menghubungi asisten sutradara.");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Stream respons tidak tersedia.");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const event of events) {
          const line = event.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload) as {
              text?: string;
              error?: string;
            };
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.text) {
              setChatMessages((prev) =>
                prev.map((m) =>
                  m.id === modelMsgId
                    ? { ...m, text: m.text + parsed.text }
                    : m
                )
              );
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message) {
              throw parseErr;
            }
          }
        }
      }
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menerima balasan.";
      setChatError(errMsg);
      setChatMessages((prev) =>
        prev.filter((m) => !(m.id === modelMsgId && m.text.trim() === ""))
      );
    } finally {
      setIsChatStreaming(false);
    }
  };

  const handleAskDirectorAboutChapter = (chapter: ScriptChapter) => {
    setActiveChapterId(chapter.id);
    setMobilePanel("chat");
    handleSendMessage(
      `Berikan arahan penyutradaraan suara (intonasi, tempo, jeda, dan pelafalan istilah penting) untuk Segmen ${chapter.roman}: ${chapter.title}, serta usulkan 1 kalimat arahan gaya dalam format [GAYA: ...].`
    );
  };

  const handleNavigate = (
    section: "input" | "studio" | "player" | "chat"
  ) => {
    setActiveSection(section);
    if (section === "chat") {
      setMobilePanel("chat");
      document
        .getElementById("asisten-sutradara")
        ?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setMobilePanel("studio");
    if (section === "input") {
      setIsInputExpanded(true);
      document
        .getElementById("input-naskah")
        ?.scrollIntoView({ behavior: "smooth" });
    } else if (section === "player") {
      document
        .getElementById("pemutar-master")
        ?.scrollIntoView({ behavior: "smooth" });
    } else {
      document
        .getElementById("naskah-babak")
        ?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const batchProgressText = `${batchProgress.current}/${batchProgress.total}`;

  return (
    <div id="top" className="min-h-screen bg-[#F7F4EE] text-[#1C1917]">
      {/* Hidden Audio Elements */}
      <audio
        ref={masterAudioRef}
        onEnded={handleNextChapter}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />
      <audio ref={auditionAudioRef} />

      <Header
        activeSection={activeSection}
        onNavigate={handleNavigate}
        isBatchGenerating={isBatchGenerating}
        batchProgressText={batchProgressText}
        onGenerateAll={handleGenerateAll}
        onCancelBatch={handleCancelBatch}
        hasChapters={chapters.length > 0}
      />

      {/* Mobile Workspace Switcher */}
      <div className="flex border-b border-[#E2DDD3] bg-[#FBF9F5] px-6 py-2 lg:hidden">
        <div className="grid w-full grid-cols-2 gap-1 rounded-md bg-[#EFECE4] p-1">
          <button
            type="button"
            onClick={() => setMobilePanel("studio")}
            className={`rounded py-1.5 text-xs font-semibold ${
              mobilePanel === "studio"
                ? "bg-white text-[#1C1917] shadow-xs"
                : "text-[#57534E]"
            }`}
          >
            Studio &amp; Naskah
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel("chat")}
            className={`rounded py-1.5 text-xs font-semibold ${
              mobilePanel === "chat"
                ? "bg-white text-[#1C1917] shadow-xs"
                : "text-[#57534E]"
            }`}
          >
            Asisten Sutradara
          </button>
        </div>
      </div>

      {/* Main 2-Column Desktop Studio Layout */}
      <main className="mx-auto grid max-w-[1440px] grid-cols-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_430px]">
        {/* Left Column: Hero + Script Input + Voice Settings + Master Player + Segments */}
        <div
          className={`min-w-0 border-r border-[#E2DDD3] ${
            mobilePanel === "studio" ? "block" : "hidden lg:block"
          }`}
        >
          {/* Editorial Studio Banner */}
          <div className="border-b border-[#E2DDD3] px-6 py-8 lg:px-8 lg:py-9">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#57534E]">
              <span>Generator Suara Narasi</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {chapters.length} Segmen
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {totalLines} Baris
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {totalWords} Kata
                {totalWords > 0
                  ? ` (~${formatTimecode(totalEstimatedSeconds)})`
                  : ""}
              </span>
            </div>

            <h1 className="mt-2.5 max-w-2xl font-editorial text-4xl font-semibold tracking-tight text-[#1C1917] lg:text-[42px] lg:leading-[1.12] [text-wrap:balance]">
              Ubah Naskah Menjadi Audio Narasi Berkualitas
            </h1>

            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#57534E]">
              Tempelkan naskah Anda sendiri atau unggah file teks, pilih
              karakter suara serta gaya penyampaiannya, lalu unduh hasilnya
              dalam format WAV siap pakai.
            </p>
          </div>

          <ScriptInputSection
            projectTitle={projectTitle}
            onChangeProjectTitle={setProjectTitle}
            draftRawText={draftRawText}
            onChangeDraftRawText={setDraftRawText}
            isExpanded={isInputExpanded}
            onToggleExpand={() => setIsInputExpanded((prev) => !prev)}
            onApplyScript={handleApplyScript}
            onLoadSampleScript={handleLoadSampleScript}
            onResetBlank={handleResetBlank}
            isLoadingSample={isLoadingSample}
          />

          {sampleError && (
            <div className="border-b border-[#E2DDD3] bg-[#B91C1C]/5 px-6 py-3 text-xs font-medium text-[#B91C1C] lg:px-8">
              {sampleError}
            </div>
          )}

          <VoiceConfigPanel
            selectedVoice={selectedVoice}
            onSelectVoice={setSelectedVoice}
            selectedModel={selectedModel}
            onSelectModel={setSelectedModel}
            stylePrompt={stylePrompt}
            onChangeStylePrompt={setStylePrompt}
            isAuditioning={isAuditioningVoice}
            isAuditionPlaying={isAuditionPlaying}
            auditionError={auditionError}
            onAuditionVoice={handleAuditionVoice}
          />

          <MasterPlayer
            chapters={chapters}
            audioMap={audioMap}
            activeChapterId={activeChapterId}
            isPlaying={isPlaying}
            onSelectChapter={handleSelectChapterInPlayer}
            onTogglePlay={handleToggleMasterPlay}
            onNextChapter={handleNextChapter}
            onPrevChapter={handlePrevChapter}
            onDownloadMaster={handleDownloadMaster}
            audioRef={masterAudioRef}
          />

          <ChapterList
            chapters={chapters}
            audioMap={audioMap}
            activeChapterId={activeChapterId}
            isPlaying={isPlaying}
            isBatchGenerating={isBatchGenerating}
            auditioningLineKey={auditioningLineKey}
            onGenerateChapter={generateChapter}
            onPlayChapter={handlePlayChapter}
            onDownloadChapter={handleDownloadChapter}
            onUpdateChapter={handleUpdateChapter}
            onDeleteChapter={handleDeleteChapter}
            onAddChapter={handleAddChapter}
            onAuditionLine={handleAuditionLine}
            onAskDirector={handleAskDirectorAboutChapter}
          />
        </div>

        {/* Right Column: Sticky Multi-Turn Gemini Director Chatbot */}
        <div
          className={`lg:sticky lg:top-[61px] lg:h-[calc(100vh-61px)] ${
            mobilePanel === "chat" ? "block" : "hidden lg:block"
          }`}
        >
          <DirectorChat
            messages={chatMessages}
            isStreaming={isChatStreaming}
            error={chatError}
            activeChapterTitle={
              activeChapter
                ? `Segmen ${activeChapter.roman}: ${activeChapter.title}`
                : "Belum ada segmen aktif"
            }
            onSendMessage={handleSendMessage}
            onClearChat={() =>
              setChatMessages([
                {
                  id: `reset-${Date.now()}`,
                  role: "model",
                  text: "Sesi penyutradaraan dimulai ulang. Silakan tanyakan arahan intonasi, perbaikan naskah, atau pelafalan kata untuk proyek Anda.",
                  timestamp: nowTimeLabel(),
                },
              ])
            }
            onApplySuggestedStyle={(style) => setStylePrompt(style)}
          />
        </div>
      </main>
    </div>
  );
}
