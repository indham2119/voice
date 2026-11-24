import {
  Download,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChapterAudioState, ScriptChapter } from "../types/studio";
import { formatTimecode } from "../utils/scriptParser";

interface MasterPlayerProps {
  chapters: ScriptChapter[];
  audioMap: Record<string, ChapterAudioState>;
  activeChapterId: string | null;
  isPlaying: boolean;
  onSelectChapter: (chapterId: string) => void;
  onTogglePlay: () => void;
  onNextChapter: () => void;
  onPrevChapter: () => void;
  onDownloadMaster: () => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

const PLAYBACK_RATES = [0.85, 1, 1.15, 1.25];

export function MasterPlayer({
  chapters,
  audioMap,
  activeChapterId,
  isPlaying,
  onSelectChapter,
  onTogglePlay,
  onNextChapter,
  onPrevChapter,
  onDownloadMaster,
  audioRef,
}: MasterPlayerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const waveformRef = useRef<HTMLDivElement | null>(null);

  const readyChapters = useMemo(
    () => chapters.filter((ch) => audioMap[ch.id]?.status === "ready"),
    [chapters, audioMap]
  );

  const activeChapter = useMemo(
    () => chapters.find((ch) => ch.id === activeChapterId) || chapters[0] || null,
    [chapters, activeChapterId]
  );

  const activeAudio = activeChapter ? audioMap[activeChapter.id] : undefined;

  const totalGeneratedSeconds = useMemo(
    () =>
      readyChapters.reduce(
        (sum, ch) => sum + (audioMap[ch.id]?.durationSeconds || 0),
        0
      ),
    [readyChapters, audioMap]
  );

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    audioEl.playbackRate = playbackRate;

    const handleTimeUpdate = () => {
      setCurrentTime(audioEl.currentTime || 0);
    };
    const handleLoadedMetadata = () => {
      setDuration(audioEl.duration || activeAudio?.durationSeconds || 0);
    };

    audioEl.addEventListener("timeupdate", handleTimeUpdate);
    audioEl.addEventListener("loadedmetadata", handleLoadedMetadata);
    return () => {
      audioEl.removeEventListener("timeupdate", handleTimeUpdate);
      audioEl.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [audioRef, playbackRate, activeAudio?.blobUrl, activeAudio?.durationSeconds]);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(activeAudio?.durationSeconds || 0);
  }, [activeChapterId, activeAudio?.durationSeconds]);

  const effectiveDuration = duration || activeAudio?.durationSeconds || 0;
  const progressRatio =
    effectiveDuration > 0 ? Math.min(1, currentTime / effectiveDuration) : 0;

  const peaks = useMemo(() => {
    if (activeAudio?.peaks && activeAudio.peaks.length > 0) {
      return activeAudio.peaks;
    }
    return Array.from({ length: 72 }, () => 0.14);
  }, [activeAudio?.peaks]);

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const audioEl = audioRef.current;
    if (!audioEl || !waveformRef.current || !effectiveDuration) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = clickX / rect.width;
    audioEl.currentTime = ratio * effectiveDuration;
    setCurrentTime(audioEl.currentTime);
  };

  return (
    <section
      id="pemutar-master"
      aria-label="Pemutar Master Dokumenter"
      className="border-b border-[#E2DDD3] bg-[#1C1917] px-6 py-6 text-[#FBF9F5] lg:px-8"
    >
      <div className="flex flex-col gap-5">
        {/* Header Metadata */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#A8A29E]">
              <span className="font-mono tabular-nums uppercase tracking-wider text-[#D6CEBE]">
                Pemutar Master
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {readyChapters.length} dari {chapters.length} babak siap
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Total durasi {formatTimecode(totalGeneratedSeconds)}
              </span>
              <span aria-hidden="true">·</span>
              <span>WAV 24kHz Mono</span>
            </div>
            <h3 className="mt-1 font-editorial text-2xl font-medium tracking-wide text-[#FBF9F5]">
              {activeChapter
                ? `${activeChapter.roman}. ${activeChapter.title}`
                : "Menunggu naskah"}
            </h3>
          </div>

          <button
            type="button"
            disabled={readyChapters.length === 0}
            onClick={onDownloadMaster}
            className="inline-flex items-center gap-2 rounded-md border border-[#57534E] bg-[#292524] px-4 py-2 text-xs font-semibold text-[#FBF9F5] whitespace-nowrap shrink-0 cursor-pointer transition-colors hover:border-[#9A3412] hover:bg-[#9A3412] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FBF9F5]"
          >
            <Download className="h-3.5 w-3.5" />
            <span>
              Unduh Master WAV ({readyChapters.length}/{chapters.length})
            </span>
          </button>
        </div>

        {/* Waveform Scrubber */}
        <div
          ref={waveformRef}
          onClick={handleScrub}
          role="slider"
          aria-label="Garis waktu pemutaran audio"
          aria-valuemin={0}
          aria-valuemax={Math.round(effectiveDuration)}
          aria-valuenow={Math.round(currentTime)}
          tabIndex={0}
          className="group relative flex h-14 w-full cursor-pointer items-center gap-[3px] rounded-md bg-[#292524]/80 px-3 py-2"
        >
          {peaks.map((amp, idx) => {
            const barRatio = idx / peaks.length;
            const isPlayed = barRatio <= progressRatio;
            const heightPct = Math.round(amp * 100);
            return (
              <div
                key={idx}
                className="flex-1 flex items-center justify-center h-full"
              >
                <div
                  style={{ height: `${Math.max(14, heightPct)}%` }}
                  className={`w-full rounded-[1px] transition-colors ${
                    activeAudio?.status !== "ready"
                      ? "bg-[#44403C]"
                      : isPlayed
                        ? "bg-[#EA580C]"
                        : "bg-[#78716C] group-hover:bg-[#A8A29E]"
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Transport Controls + Chapter Selector */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onPrevChapter}
              disabled={readyChapters.length === 0}
              aria-label="Babak sebelumnya"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-[#44403C] text-[#D6CEBE] cursor-pointer transition-colors hover:border-[#78716C] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <SkipBack className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              disabled={activeAudio?.status !== "ready"}
              aria-label={isPlaying ? "Jeda narasi" : "Putar narasi"}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[#9A3412] px-5 text-xs font-semibold text-white whitespace-nowrap cursor-pointer transition-colors hover:bg-[#7C2D12] disabled:bg-[#44403C] disabled:text-[#A8A29E] disabled:cursor-not-allowed"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-4 w-4 fill-current" />
                  <span>Jeda</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" />
                  <span>
                    {activeAudio?.status === "ready"
                      ? "Putar Babak"
                      : "Belum Dibuat"}
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onNextChapter}
              disabled={readyChapters.length === 0}
              aria-label="Babak berikutnya"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-[#44403C] text-[#D6CEBE] cursor-pointer transition-colors hover:border-[#78716C] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            <span className="ml-2 font-mono text-xs tabular-nums text-[#D6CEBE]">
              {formatTimecode(currentTime)} / {formatTimecode(effectiveDuration)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Quick Chapter Switcher */}
            <div className="flex items-center gap-1 rounded-md bg-[#292524] p-1">
              {chapters.map((ch) => {
                const state = audioMap[ch.id];
                const isSelected = ch.id === activeChapter?.id;
                const isReady = state?.status === "ready";
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => onSelectChapter(ch.id)}
                    title={`Babak ${ch.roman}: ${ch.title}`}
                    className={`rounded px-2.5 py-1 font-mono text-xs tabular-nums cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[#9A3412] text-white font-semibold"
                        : isReady
                          ? "text-[#FBF9F5] hover:bg-[#44403C]"
                          : "text-[#78716C] hover:text-[#D6CEBE]"
                    }`}
                  >
                    {ch.roman}
                  </button>
                );
              })}
            </div>

            {/* Playback Rate */}
            <div className="flex items-center gap-1.5 text-xs text-[#A8A29E]">
              <Volume2 className="h-3.5 w-3.5" />
              <div className="flex items-center gap-1">
                {PLAYBACK_RATES.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setPlaybackRate(rate)}
                    className={`rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums cursor-pointer transition-colors ${
                      playbackRate === rate
                        ? "bg-[#44403C] text-white"
                        : "hover:text-white"
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
