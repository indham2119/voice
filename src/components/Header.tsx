import { Loader2, Volume2 } from "lucide-react";

interface HeaderProps {
  activeSection: "input" | "studio" | "player" | "chat";
  onNavigate: (section: "input" | "studio" | "player" | "chat") => void;
  isBatchGenerating: boolean;
  batchProgressText: string;
  onGenerateAll: () => void;
  onCancelBatch: () => void;
  hasChapters: boolean;
}

export function Header({
  activeSection,
  onNavigate,
  isBatchGenerating,
  batchProgressText,
  onGenerateAll,
  onCancelBatch,
  hasChapters,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#E2DDD3] bg-[#F7F4EE]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-6 py-3.5 lg:px-10">
        {/* Zone 1: Single-element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("input");
          }}
          className="font-editorial text-2xl font-semibold tracking-tight text-[#1C1917] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9A3412]"
        >
          Studio Voiceover
        </a>

        {/* Zone 2: Concise single-line nav links */}
        <nav
          aria-label="Navigasi Utama"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-[#57534E]"
        >
          <button
            type="button"
            onClick={() => onNavigate("input")}
            className={`whitespace-nowrap shrink-0 cursor-pointer transition-colors hover:text-[#1C1917] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9A3412] ${
              activeSection === "input"
                ? "text-[#1C1917] underline decoration-[#9A3412] decoration-2 underline-offset-8"
                : ""
            }`}
          >
            Input Naskah
          </button>
          <button
            type="button"
            onClick={() => onNavigate("studio")}
            className={`whitespace-nowrap shrink-0 cursor-pointer transition-colors hover:text-[#1C1917] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9A3412] ${
              activeSection === "studio"
                ? "text-[#1C1917] underline decoration-[#9A3412] decoration-2 underline-offset-8"
                : ""
            }`}
          >
            Daftar Segmen
          </button>
          <button
            type="button"
            onClick={() => onNavigate("player")}
            className={`whitespace-nowrap shrink-0 cursor-pointer transition-colors hover:text-[#1C1917] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9A3412] ${
              activeSection === "player"
                ? "text-[#1C1917] underline decoration-[#9A3412] decoration-2 underline-offset-8"
                : ""
            }`}
          >
            Pemutar Master
          </button>
          <button
            type="button"
            onClick={() => onNavigate("chat")}
            className={`whitespace-nowrap shrink-0 cursor-pointer transition-colors hover:text-[#1C1917] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9A3412] ${
              activeSection === "chat"
                ? "text-[#1C1917] underline decoration-[#9A3412] decoration-2 underline-offset-8"
                : ""
            }`}
          >
            Asisten Sutradara
          </button>
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="shrink-0">
          {isBatchGenerating ? (
            <button
              type="button"
              onClick={onCancelBatch}
              className="inline-flex items-center gap-2 rounded-md border border-[#9A3412] bg-[#FBF9F5] px-4 py-2 text-xs font-semibold text-[#9A3412] whitespace-nowrap shrink-0 cursor-pointer transition-colors hover:bg-[#9A3412]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9A3412]"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Hentikan ({batchProgressText})</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!hasChapters}
              onClick={onGenerateAll}
              className="inline-flex items-center gap-2 rounded-md bg-[#9A3412] px-4 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer transition-colors hover:bg-[#7C2D12] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9A3412]"
            >
              <Volume2 className="h-3.5 w-3.5" />
              <span>Buat Semua Suara</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
