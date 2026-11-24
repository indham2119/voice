import { AlertCircle, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChapterList } from "./components/ChapterList";
import { DirectorChat } from "./components/DirectorChat";
import { Header } from "./components/Header";
import { MasterPlayer } from "./components/MasterPlayer";
import { SourceDrawer } from "./components/SourceDrawer";
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

const SCRIPT_ASSET_URL = "/assets/aistudio/narasi_VO_indonesia_929e98af.txt";

function nowTimeLabel(): string {
  return new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function App() {
  const [rawScript, setRawScript] = useState("");
  const [chapters, setChapters] = useState<ScriptChapter[]>([]);
  const [scriptLoading, setScriptLoading] = useState(true);
  const [scriptError, setScriptError] = useState<string | null>(null);

  // Studio Voice Settings
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>("Charon");
  const [selectedModel, setSelectedModel] = useState<TtsModel>(
    "gemini-3.8-flash-lite-tts"
  );
  const [stylePrompt, setStylePrompt] = useState(STYLE_PRESETS[0].prompt);

  // Audio State per Chapter
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
    "studio" | "player" | "chat" | "source"
  >("studio");
  const [mobilePanel, setMobilePanel] = useState<"studio" | "chat">("studio");
  const [showSourceDrawer, setShowSourceDrawer] = useState(false);

  // Multi-turn Gemini Chatbot State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-msg",
      role: "model",
      text: "Selamat datang di ruang produksi Arsip Suara 1945. Naskah dokumenter Anda (1939–1945) telah dibagi menjadi 6 babak kronologis.\n\nAnda dapat langsung menekan Buat Semua Suara untuk menghasilkan audio WAV seluruh naskah, atau berdiskusi dengan saya mengenai intonasi, jeda dramatis, maupun pelafalan nama tokoh sejarah.",
      timestamp: nowTimeLabel(),
    },
  ]);
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const masterAudioRef = useRef<HTMLAudioElement | null>(null);
  const auditionAudioRef = useRef<HTMLAudioElement | null>(null);

  // Load local narration script asset
  useEffect(() => {
    let active = true;
    async function loadScript() {
      setScriptLoading(true);
      setScriptError(null);
      try {
        const res = await fetch(SCRIPT_ASSET_URL);
        if (!res.ok) {
          throw new Error(`Gagal memuat naskah (${res.status})`);
        }
        const text = await res.text();
        if (!active) return;
        setRawScript(text);
        const parsed = parseNarrationScript(text);
        setChapters(parsed);
        if (parsed.length > 0) {
          setActiveChapterId(parsed[0].id);
        }
      } catch (err: unknown) {
        if (!active) return;
        setScriptError(
          err instanceof Error ? err.message : "Gagal memuat berkas naskah."
        );
      } finally {
        if (active) setScriptLoading(false);
      }
    }
    loadScript();
    return () => {
      active = false;
    };
  }, []);

  // Cleanup Blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(audioMap).forEach((state) => {
        if (state.blobUrl) URL.revokeObjectURL(state.blobUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (!target) return false;

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
          err instanceof Error ? err.message : "Gagal mensintesis suara babak.";
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
      (ch) => audioMap[ch.id]?.status !== "ready"
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
  const playBlobUrlInMaster = useCallback((chapterId: string, blobUrl: string) => {
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
  }, []);

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
      const sampleText =
        "Tahun 1939, belum ada negara bernama Indonesia. Wilayah ini masih koloni Belanda bernama Hindia Belanda.";
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

  // Download Per-Chapter or Stitched Master WAV
  const handleDownloadChapter = (chapterId: string) => {
    const ch = chapters.find((c) => c.id === chapterId);
    const state = audioMap[chapterId];
    if (!ch || !state?.audioBase64) return;
    const bytes = base64ToUint8Array(state.audioBase64);
    downloadWavBytes(bytes, `VO_Babak_${ch.roman}_${ch.id}.wav`);
  };

  const handleDownloadMaster = () => {
    const orderedClips = chapters
      .map((ch) => audioMap[ch.id]?.audioBase64 || "")
      .filter((b64) => b64.length > 0);
    const merged = mergeWavClips(orderedClips);
    if (!merged) return;
    downloadWavBytes(merged, "narasi_VO_indonesia_1939_1945_master.wav");
  };

  const handleUpdateChapterText = (chapterId: string, newText: string) => {
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
          lines,
          text: normalizedText,
          wordCount: countWords(normalizedText),
        };
      })
    );
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
          activeChapterTitle: activeChapter
            ? `Babak ${activeChapter.roman}: ${activeChapter.title}`
            : "Seluruh Naskah",
          activeVoiceName: selectedVoice,
          activeStyle: stylePrompt,
          scriptExcerpt: activeChapter ? activeChapter.text : rawScript,
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
      `Berikan arahan penyutradaraan suara (intonasi, tempo, penekanan, dan pelafalan istilah penting) untuk Babak ${chapter.roman}: ${chapter.title}, serta usulkan 1 kalimat arahan gaya dalam format [GAYA: ...].`
    );
  };

  const handleNavigate = (
    section: "studio" | "player" | "chat" | "source"
  ) => {
    setActiveSection(section);
    if (section === "source") {
      setShowSourceDrawer(true);
      return;
    }
    if (section === "chat") {
      setMobilePanel("chat");
      document
        .getElementById("asisten-sutradara")
        ?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setMobilePanel("studio");
    if (section === "player") {
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
        {/* Left Column: Editorial Intro + Voice Settings + Master Player + Chapters */}
        <div
          className={`min-w-0 border-r border-[#E2DDD3] ${
            mobilePanel === "studio" ? "block" : "hidden lg:block"
          }`}
        >
          {/* Editorial Documentary Banner */}
          <div className="border-b border-[#E2DDD3] px-6 py-8 lg:px-8 lg:py-10">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#57534E]">
              <span>Produksi Voiceover Dokumenter</span>
              <span aria-hidden="true">·</span>
              <span>1939–1945</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {chapters.length} Babak
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {totalLines} Baris
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {totalWords} Kata (~{formatTimecode(totalEstimatedSeconds)})
              </span>
            </div>

            <h1 className="mt-2.5 max-w-2xl font-editorial text-4xl font-semibold tracking-tight text-[#1C1917] lg:text-[44px] lg:leading-[1.12] [text-wrap:balance]">
              Dari Minyak Tarakan hingga Proklamasi Kemerdekaan
            </h1>

            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#57534E]">
              Naskah narasi sejarah Indonesia telah disusun menjadi 6 babak
              kronologis agar sintesis suara terdengar konsisten, berwibawa, dan
              dapat diunduh sebagai satu master audio WAV utuh.
            </p>
          </div>

          {scriptLoading ? (
            <div className="flex items-center gap-3 px-6 py-16 text-sm text-[#57534E] lg:px-8">
              <Loader2 className="h-4 w-4 animate-spin text-[#9A3412]" />
              <span>Memuat naskah narasi dari arsip lokal...</span>
            </div>
          ) : scriptError ? (
            <div className="flex items-center gap-3 px-6 py-12 text-sm text-[#B91C1C] lg:px-8">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{scriptError}</span>
            </div>
          ) : (
            <>
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
                onUpdateChapterText={handleUpdateChapterText}
                onAuditionLine={handleAuditionLine}
                onAskDirector={handleAskDirectorAboutChapter}
              />
            </>
          )}
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
                ? `Babak ${activeChapter.roman}: ${activeChapter.title}`
                : "Seluruh Naskah"
            }
            onSendMessage={handleSendMessage}
            onClearChat={() =>
              setChatMessages([
                {
                  id: `reset-${Date.now()}`,
                  role: "model",
                  text: "Sesi penyutradaraan dimulai ulang. Silakan tanyakan arahan intonasi, jeda, atau pelafalan istilah sejarah untuk naskah ini.",
                  timestamp: nowTimeLabel(),
                },
              ])
            }
            onApplySuggestedStyle={(style) => setStylePrompt(style)}
          />
        </div>
      </main>

      {showSourceDrawer && (
        <SourceDrawer
          rawText={rawScript}
          onClose={() => {
            setShowSourceDrawer(false);
            setActiveSection("studio");
          }}
        />
      )}
    </div>
  );
}
