import { BookOpen, ChevronDown, ChevronUp, FileText, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { countWords, estimateDurationSeconds, formatTimecode } from "../utils/scriptParser";

interface ScriptInputSectionProps {
  projectTitle: string;
  onChangeProjectTitle: (title: string) => void;
  draftRawText: string;
  onChangeDraftRawText: (text: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onApplyScript: (rawText: string, title?: string) => void;
  onLoadSampleScript: () => void;
  onResetBlank: () => void;
  isLoadingSample: boolean;
}

export function ScriptInputSection({
  projectTitle,
  onChangeProjectTitle,
  draftRawText,
  onChangeDraftRawText,
  isExpanded,
  onToggleExpand,
  onApplyScript,
  onLoadSampleScript,
  onResetBlank,
  isLoadingSample,
}: ScriptInputSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const wordCount = countWords(draftRawText);
  const estSeconds = estimateDurationSeconds(wordCount);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const content = await file.text();
      if (!content.trim()) {
        setUploadError("File yang dipilih kosong.");
        return;
      }
      const cleanName = file.name.replace(/\.(txt|md)$/i, "");
      onChangeProjectTitle(cleanName || projectTitle);
      onChangeDraftRawText(content);
      onApplyScript(content, cleanName || projectTitle);
    } catch {
      setUploadError("Gagal membaca file teks. Pastikan formatnya .txt atau .md.");
    } finally {
      e.target.value = "";
    }
  };

  return (
    <section
      id="input-naskah"
      aria-label="Input dan Impor Naskah"
      className="border-b border-[#E2DDD3] bg-[#FBF9F5] px-6 py-5 lg:px-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#57534E]">
            <span className="font-medium text-[#9A3412]">Naskah Proyek</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{wordCount} kata</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Estimasi ~{formatTimecode(estSeconds)}
            </span>
          </div>
          <h2 className="mt-0.5 font-editorial text-xl font-semibold text-[#1C1917] truncate">
            {projectTitle || "Proyek Voiceover Baru"}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,text/plain"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#D6CEBE] bg-white px-3 py-1.5 text-xs font-medium text-[#1C1917] whitespace-nowrap cursor-pointer transition-colors hover:border-[#9A3412] hover:text-[#9A3412]"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Unggah .txt</span>
          </button>

          <button
            type="button"
            disabled={isLoadingSample}
            onClick={onLoadSampleScript}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#D6CEBE] bg-white px-3 py-1.5 text-xs font-medium text-[#44403C] whitespace-nowrap cursor-pointer transition-colors hover:border-[#9A3412] hover:text-[#9A3412] disabled:opacity-50"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>
              {isLoadingSample ? "Memuat..." : "Contoh Naskah (1939–1945)"}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleExpand}
            className="inline-flex items-center gap-1 rounded-md bg-[#EFECE4] px-3 py-1.5 text-xs font-semibold text-[#1C1917] whitespace-nowrap cursor-pointer transition-colors hover:bg-[#E2DDD3]"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>{isExpanded ? "Tutup Editor" : "Tempel / Ganti Naskah"}</span>
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {uploadError && (
        <p className="mt-2 text-xs font-medium text-[#B91C1C]" role="alert">
          {uploadError}
        </p>
      )}

      {isExpanded && (
        <div className="mt-5 space-y-4 border-t border-[#E2DDD3] pt-5">
          <div>
            <label
              htmlFor="project-title-input"
              className="block text-xs font-medium uppercase tracking-wider text-[#57534E] mb-1.5"
            >
              Judul Proyek
            </label>
            <input
              id="project-title-input"
              type="text"
              value={projectTitle}
              onChange={(e) => onChangeProjectTitle(e.target.value)}
              placeholder="Contoh: Narasi Video YouTube — Sejarah Jalur Rempah"
              className="w-full rounded-md border border-[#D6CEBE] bg-white px-3.5 py-2 text-sm text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#9A3412] focus:outline-none"
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <label
                htmlFor="raw-script-textarea"
                className="text-xs font-medium uppercase tracking-wider text-[#57534E]"
              >
                Tulis atau Tempel Naskah Lengkap
              </label>
              <span className="text-[11px] text-[#78716C]">
                Tip: Gunakan baris awalan # Judul Babak atau --- untuk membagi segmen manual, atau biarkan sistem membagi otomatis.
              </span>
            </div>
            <textarea
              id="raw-script-textarea"
              rows={8}
              value={draftRawText}
              onChange={(e) => onChangeDraftRawText(e.target.value)}
              placeholder="Tempelkan naskah Anda di sini...&#10;&#10;Misalnya:&#10;# Pembuka&#10;Selamat datang di kanal kami. Hari ini kita akan membahas...&#10;&#10;# Isi Utama&#10;Di balik perkembangan teknologi modern..."
              className="w-full rounded-md border border-[#D6CEBE] bg-white px-4 py-3 text-sm leading-relaxed text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#9A3412] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onResetBlank}
              className="text-xs font-medium text-[#78716C] cursor-pointer hover:text-[#B91C1C]"
            >
              Kosongkan Naskah
            </button>

            <button
              type="button"
              disabled={!draftRawText.trim()}
              onClick={() => onApplyScript(draftRawText)}
              className="rounded-md bg-[#1C1917] px-5 py-2 text-xs font-semibold text-white cursor-pointer transition-colors hover:bg-[#44403C] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Terapkan Naskah ke Segmen Studio
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
