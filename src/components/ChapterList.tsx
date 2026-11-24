import {
  AlertCircle,
  CheckCircle2,
  Download,
  Edit3,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Volume2,
} from "lucide-react";
import { useState } from "react";
import { ChapterAudioState, ScriptChapter } from "../types/studio";
import { estimateDurationSeconds, formatTimecode } from "../utils/scriptParser";

interface ChapterListProps {
  chapters: ScriptChapter[];
  audioMap: Record<string, ChapterAudioState>;
  activeChapterId: string | null;
  isPlaying: boolean;
  isBatchGenerating: boolean;
  auditioningLineKey: string | null;
  onGenerateChapter: (chapterId: string) => void;
  onPlayChapter: (chapterId: string) => void;
  onDownloadChapter: (chapterId: string) => void;
  onUpdateChapter: (chapterId: string, newTitle: string, newText: string) => void;
  onDeleteChapter: (chapterId: string) => void;
  onAddChapter: () => void;
  onAuditionLine: (lineKey: string, text: string) => void;
  onAskDirector: (chapter: ScriptChapter) => void;
}

export function ChapterList({
  chapters,
  audioMap,
  activeChapterId,
  isPlaying,
  isBatchGenerating,
  auditioningLineKey,
  onGenerateChapter,
  onPlayChapter,
  onDownloadChapter,
  onUpdateChapter,
  onDeleteChapter,
  onAddChapter,
  onAuditionLine,
  onAskDirector,
}: ChapterListProps) {
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftText, setDraftText] = useState("");

  const startEditing = (chapter: ScriptChapter) => {
    setEditingChapterId(chapter.id);
    setDraftTitle(chapter.title);
    setDraftText(chapter.text);
  };

  const saveEdit = (chapterId: string) => {
    onUpdateChapter(chapterId, draftTitle, draftText);
    setEditingChapterId(null);
  };

  if (chapters.length === 0) {
    return (
      <section
        id="naskah-babak"
        aria-label="Daftar Segmen Narasi"
        className="px-6 py-12 text-center lg:px-8"
      >
        <p className="font-editorial text-2xl font-medium text-[#1C1917]">
          Belum ada segmen naskah
        </p>
        <p className="mt-2 text-sm text-[#57534E]">
          Tempel naskah di kolom Input Naskah di atas, unggah file teks, atau tambah segmen baru secara manual.
        </p>
        <button
          type="button"
          onClick={onAddChapter}
          className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-[#9A3412] px-4 py-2 text-xs font-semibold text-white cursor-pointer hover:bg-[#7C2D12]"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Tambah Segmen Pertama</span>
        </button>
      </section>
    );
  }

  return (
    <section
      id="naskah-babak"
      aria-label="Daftar Segmen Narasi"
      className="divide-y divide-[#E2DDD3]"
    >
      {chapters.map((chapter) => {
        const audioState = audioMap[chapter.id] || { status: "idle" };
        const isCurrent = activeChapterId === chapter.id;
        const isThisPlaying = isCurrent && isPlaying;
        const isEditing = editingChapterId === chapter.id;
        const estSeconds = estimateDurationSeconds(chapter.wordCount);

        return (
          <article
            key={chapter.id}
            className={`px-6 py-7 transition-colors lg:px-8 ${
              isCurrent ? "bg-[#FBF9F5]" : "bg-[#F7F4EE]"
            }`}
          >
            {/* Segment Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#57534E]">
                  <span className="font-mono font-medium text-[#9A3412] tabular-nums">
                    Segmen {chapter.roman}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {chapter.lines.length} baris
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {chapter.wordCount} kata
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {audioState.durationSeconds
                      ? `Durasi ${formatTimecode(audioState.durationSeconds)}`
                      : `Estimasi ~${formatTimecode(estSeconds)}`}
                  </span>
                </div>

                <h3 className="mt-1.5 font-editorial text-2xl font-semibold text-[#1C1917]">
                  {chapter.roman}. {chapter.title}
                </h3>

                {/* Explicit Audio Status Label */}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  {audioState.status === "ready" && (
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#15803D]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Audio siap ({audioState.generatedVoice})</span>
                    </span>
                  )}
                  {audioState.status === "generating" && (
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#B45309]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Sedang mensintesis suara...</span>
                    </span>
                  )}
                  {audioState.status === "error" && (
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#B91C1C]">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>{audioState.error || "Gagal membuat suara"}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Segment Actions */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {audioState.status === "ready" && (
                  <>
                    <button
                      type="button"
                      onClick={() => onPlayChapter(chapter.id)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#1C1917] px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap cursor-pointer transition-colors hover:bg-[#44403C]"
                    >
                      {isThisPlaying ? (
                        <>
                          <Pause className="h-3.5 w-3.5 fill-current" />
                          <span>Jeda</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>Putar</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onDownloadChapter(chapter.id)}
                      title="Unduh file WAV segmen ini"
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#D6CEBE] bg-white px-3 py-2 text-xs font-medium text-[#1C1917] whitespace-nowrap cursor-pointer transition-colors hover:border-[#9A3412] hover:text-[#9A3412]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>WAV</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  disabled={
                    audioState.status === "generating" || isBatchGenerating
                  }
                  onClick={() => onGenerateChapter(chapter.id)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    audioState.status === "ready"
                      ? "border border-[#D6CEBE] bg-white text-[#44403C] hover:border-[#9A3412] hover:text-[#9A3412]"
                      : "bg-[#9A3412] text-white hover:bg-[#7C2D12]"
                  }`}
                >
                  {audioState.status === "generating" ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : audioState.status === "ready" ? (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Buat Ulang</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-3.5 w-3.5" />
                      <span>Buat Suara</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    isEditing ? setEditingChapterId(null) : startEditing(chapter)
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-[#E2DDD3] bg-transparent px-2.5 py-2 text-xs font-medium text-[#57534E] whitespace-nowrap cursor-pointer transition-colors hover:border-[#A8A29E] hover:text-[#1C1917]"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>{isEditing ? "Batal" : "Sunting"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onAskDirector(chapter)}
                  className="inline-flex items-center rounded-md px-2.5 py-2 text-xs font-medium text-[#9A3412] whitespace-nowrap cursor-pointer transition-colors hover:bg-[#9A3412]/10"
                >
                  Tanya Sutradara
                </button>

                {chapters.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteChapter(chapter.id)}
                    title="Hapus segmen"
                    className="inline-flex items-center rounded-md p-2 text-[#78716C] cursor-pointer transition-colors hover:bg-[#EFECE4] hover:text-[#B91C1C]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Segment Content: Edit Mode or Editorial Line-by-Line */}
            {isEditing ? (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#57534E] mb-1">
                    Judul Segmen
                  </label>
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="w-full rounded-md border border-[#D6CEBE] bg-white px-3.5 py-2 text-sm font-medium text-[#1C1917] focus:border-[#9A3412] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#57534E] mb-1">
                    Isi Naskah Segmen
                  </label>
                  <textarea
                    rows={Math.min(14, Math.max(5, chapter.lines.length + 1))}
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    className="w-full rounded-md border border-[#9A3412]/50 bg-white px-4 py-3 text-[15px] leading-relaxed text-[#1C1917] focus:border-[#9A3412] focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingChapterId(null)}
                    className="rounded-md border border-[#D6CEBE] bg-white px-3.5 py-1.5 text-xs font-medium text-[#57534E] cursor-pointer hover:text-[#1C1917]"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => saveEdit(chapter.id)}
                    className="rounded-md bg-[#1C1917] px-4 py-1.5 text-xs font-semibold text-white cursor-pointer hover:bg-[#44403C]"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 max-w-2xl space-y-2.5">
                {chapter.lines.map((line, lineIdx) => {
                  const lineKey = `${chapter.id}-${lineIdx}`;
                  const isLineLoading = auditioningLineKey === lineKey;
                  return (
                    <div
                      key={lineKey}
                      className="group flex items-start justify-between gap-3 rounded px-2 py-1 -mx-2 transition-colors hover:bg-[#EFECE4]/70"
                    >
                      <p className="text-[15px] leading-[1.7] text-[#292524]">
                        {line}
                      </p>
                      <button
                        type="button"
                        onClick={() => onAuditionLine(lineKey, line)}
                        disabled={auditioningLineKey !== null}
                        title="Dengarkan baris ini saja"
                        className="mt-1 inline-flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-[#78716C] opacity-70 transition-opacity hover:bg-white hover:text-[#9A3412] group-hover:opacity-100 cursor-pointer disabled:opacity-40"
                      >
                        {isLineLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        <span>Uji</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        );
      })}

      {/* Add Segment Footer */}
      <div className="px-6 py-5 lg:px-8">
        <button
          type="button"
          onClick={onAddChapter}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[#C7BFB1] bg-transparent px-4 py-2 text-xs font-semibold text-[#57534E] cursor-pointer transition-colors hover:border-[#9A3412] hover:text-[#9A3412]"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Tambah Segmen Baru</span>
        </button>
      </div>
    </section>
  );
}
