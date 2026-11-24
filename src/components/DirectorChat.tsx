import { ArrowUpRight, Loader2, Send, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChatMessage } from "../types/studio";

interface DirectorChatProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  activeChapterTitle: string;
  onSendMessage: (text: string) => void;
  onClearChat: () => void;
  onApplySuggestedStyle: (style: string) => void;
}

const QUICK_PROMPTS = [
  "Berikan arahan intonasi & jeda dramatis untuk babak ini.",
  "Panduan pelafalan nama tokoh Belanda & Jepang di naskah.",
  "Sarankan arahan gaya suara untuk penutup Proklamasi 17 Agustus.",
  "Cek kata-kata yang rawan salah baca saat rekaman VO.",
];

function extractStyleSuggestion(text: string): string | null {
  const match = text.match(/\[GAYA:\s*([^\]]+)\]/i);
  return match ? match[1].trim() : null;
}

export function DirectorChat({
  messages,
  isStreaming,
  error,
  activeChapterTitle,
  onSendMessage,
  onClearChat,
  onApplySuggestedStyle,
}: DirectorChatProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    onSendMessage(trimmed);
  };

  return (
    <aside
      id="asisten-sutradara"
      aria-label="Asisten Sutradara Suara Gemini"
      className="flex h-full flex-col bg-[#FBF9F5]"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-[#E2DDD3] px-5 py-4">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#9A3412]">
            Asisten Sutradara Suara
          </span>
          <h2 className="mt-0.5 font-editorial text-xl font-semibold text-[#1C1917]">
            Arahan Intonasi &amp; Riset
          </h2>
          <p className="mt-0.5 text-xs text-[#57534E]">
            Fokus aktif: {activeChapterTitle}
          </p>
        </div>

        {messages.length > 1 && (
          <button
            type="button"
            onClick={onClearChat}
            title="Bersihkan riwayat percakapan"
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[#78716C] cursor-pointer hover:bg-[#EFECE4] hover:text-[#1C1917]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Scrollable Thread */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-5 py-4 min-h-[340px] max-h-[calc(100vh-300px)]"
      >
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const suggestedStyle = !isUser
            ? extractStyleSuggestion(msg.text)
            : null;
          const cleanedText = suggestedStyle
            ? msg.text.replace(/\[GAYA:\s*([^\]]+)\]/gi, "$1").trim()
            : msg.text;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
            >
              <div className="mb-1 flex items-center gap-2 text-[11px] text-[#78716C]">
                <span className="font-medium text-[#44403C]">
                  {isUser ? "Anda" : "Sutradara Gemini"}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{msg.timestamp}</span>
              </div>

              <div
                className={`max-w-[92%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? "bg-[#1C1917] text-[#FBF9F5]"
                    : "border border-[#E2DDD3] bg-white text-[#292524]"
                }`}
              >
                {cleanedText || (
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#78716C]">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Menyusun arahan...
                  </span>
                )}
              </div>

              {suggestedStyle && (
                <button
                  type="button"
                  onClick={() => onApplySuggestedStyle(suggestedStyle)}
                  className="mt-1.5 inline-flex items-center gap-1 rounded border border-[#9A3412]/30 bg-[#9A3412]/8 px-2.5 py-1 text-xs font-semibold text-[#9A3412] cursor-pointer transition-colors hover:bg-[#9A3412] hover:text-white"
                >
                  <span>Terapkan Arahan Gaya ke Studio</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}

        {error && (
          <div
            role="alert"
            className="rounded-md border border-[#B91C1C]/30 bg-[#B91C1C]/5 px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]"
          >
            {error}
          </div>
        )}
      </div>

      {/* Quick Prompts */}
      <div className="border-t border-[#E2DDD3] px-5 py-3">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={isStreaming}
              onClick={() => onSendMessage(prompt)}
              className="rounded border border-[#E2DDD3] bg-white px-2.5 py-1 text-left text-[11px] font-medium text-[#44403C] cursor-pointer transition-colors hover:border-[#9A3412] hover:text-[#9A3412] disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-[#E2DDD3] bg-[#F7F4EE] px-5 py-3.5"
      >
        <div className="flex items-end gap-2">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Tanyakan intonasi, pelafalan tokoh, atau minta variasi naskah..."
            className="flex-1 resize-none rounded-md border border-[#D6CEBE] bg-white px-3 py-2 text-sm text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#9A3412] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            aria-label="Kirim pesan"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#9A3412] text-white cursor-pointer transition-colors hover:bg-[#7C2D12] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>
    </aside>
  );
}
