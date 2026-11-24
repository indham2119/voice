import { Check, Copy, X } from "lucide-react";
import { useState } from "react";

interface SourceDrawerProps {
  rawText: string;
  onClose: () => void;
}

export function SourceDrawer({ rawText, onClose }: SourceDrawerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sumber Naskah Asli"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/50 p-4 backdrop-blur-[2px]"
    >
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E2DDD3] px-6 py-4">
          <div>
            <h2 className="font-editorial text-2xl font-semibold text-[#1C1917]">
              Sumber Naskah Asli
            </h2>
            <p className="text-xs text-[#57534E]">
              narasi_VO_indonesia_929e98af.txt · 1939–1945
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#D6CEBE] bg-white px-3 py-1.5 text-xs font-medium text-[#1C1917] cursor-pointer hover:border-[#9A3412]"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#15803D]" />
                  <span>Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Salin Teks</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="rounded-md p-1.5 text-[#57534E] cursor-pointer hover:bg-[#EFECE4] hover:text-[#1C1917]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#292524]">
            {rawText}
          </pre>
        </div>
      </div>
    </div>
  );
}
