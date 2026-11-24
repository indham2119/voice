import { Loader2, Play, Square } from "lucide-react";
import { STYLE_PRESETS, VOICE_OPTIONS } from "../constants/voices";
import { TtsModel, VoiceName } from "../types/studio";

interface VoiceConfigPanelProps {
  selectedVoice: VoiceName;
  onSelectVoice: (voice: VoiceName) => void;
  selectedModel: TtsModel;
  onSelectModel: (model: TtsModel) => void;
  stylePrompt: string;
  onChangeStylePrompt: (style: string) => void;
  isAuditioning: boolean;
  isAuditionPlaying: boolean;
  auditionError: string | null;
  onAuditionVoice: () => void;
}

export function VoiceConfigPanel({
  selectedVoice,
  onSelectVoice,
  selectedModel,
  onSelectModel,
  stylePrompt,
  onChangeStylePrompt,
  isAuditioning,
  isAuditionPlaying,
  auditionError,
  onAuditionVoice,
}: VoiceConfigPanelProps) {
  return (
    <section
      aria-label="Pengaturan Suara Narator"
      className="border-b border-[#E2DDD3] bg-[#FBF9F5] px-6 py-6 lg:px-8"
    >
      <div className="flex flex-col gap-6">
        {/* Top Row: Voice Selection & Engine Toggle */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <div className="flex items-baseline justify-between gap-4 mb-3">
              <h2 className="font-editorial text-xl font-semibold text-[#1C1917]">
                01. Karakter Suara Narator
              </h2>
              <button
                type="button"
                onClick={onAuditionVoice}
                disabled={isAuditioning}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A3412] hover:text-[#7C2D12] cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9A3412]"
              >
                {isAuditioning ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Memuat contoh suara...</span>
                  </>
                ) : isAuditionPlaying ? (
                  <>
                    <Square className="h-3 w-3 fill-current" />
                    <span>Hentikan Pratinjau</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3 fill-current" />
                    <span>Uji Suara {selectedVoice}</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {VOICE_OPTIONS.map((voice) => {
                const isSelected = voice.id === selectedVoice;
                return (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => onSelectVoice(voice.id)}
                    className={`flex flex-col items-start text-left rounded-md border px-3 py-2.5 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9A3412] ${
                      isSelected
                        ? "border-[#9A3412] bg-[#9A3412]/[0.06] text-[#1C1917]"
                        : "border-[#E2DDD3] bg-white/70 text-[#44403C] hover:border-[#C7BFB1] hover:bg-white"
                    }`}
                  >
                    <span className="text-sm font-semibold whitespace-nowrap">
                      {voice.label}
                    </span>
                    <span className="mt-0.5 text-[11px] leading-snug text-[#57534E] line-clamp-2">
                      {voice.character}
                    </span>
                  </button>
                );
              })}
            </div>
            {auditionError && (
              <p className="mt-2 text-xs font-medium text-[#B91C1C]" role="alert">
                {auditionError}
              </p>
            )}
          </div>

          <div className="lg:w-64 shrink-0">
            <span className="block text-xs font-medium uppercase tracking-wider text-[#57534E] mb-2.5">
              Mesin Sintesis Audio
            </span>
            <div className="grid grid-cols-2 gap-1 rounded-md border border-[#E2DDD3] bg-[#F7F4EE] p-1">
              <button
                type="button"
                onClick={() => onSelectModel("gemini-3.8-flash-lite-tts")}
                className={`rounded px-2.5 py-2 text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                  selectedModel === "gemini-3.8-flash-lite-tts"
                    ? "bg-white text-[#1C1917] shadow-xs"
                    : "text-[#57534E] hover:text-[#1C1917]"
                }`}
              >
                Flash Lite TTS
              </button>
              <button
                type="button"
                onClick={() => onSelectModel("gemini-3.8-flash-tts")}
                className={`rounded px-2.5 py-2 text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                  selectedModel === "gemini-3.8-flash-tts"
                    ? "bg-white text-[#1C1917] shadow-xs"
                    : "text-[#57534E] hover:text-[#1C1917]"
                }`}
              >
                Flash TTS
              </button>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[#78716C]">
              {selectedModel === "gemini-3.8-flash-lite-tts"
                ? "Cepat & stabil untuk pembacaan naskah panjang."
                : "Ekspresif untuk arahan gaya & dinamika vokal khusus."}
            </p>
          </div>
        </div>

        {/* Bottom Row: Style Preset & Custom Direction */}
        <div className="border-t border-[#E2DDD3] pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
            <label
              htmlFor="style-direction-input"
              className="text-xs font-medium uppercase tracking-wider text-[#57534E]"
            >
              Arahan Gaya &amp; Intonasi Sutradara
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {STYLE_PRESETS.map((preset) => {
                const isActive = stylePrompt.trim() === preset.prompt.trim();
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onChangeStylePrompt(preset.prompt)}
                    className={`rounded px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                      isActive
                        ? "bg-[#1C1917] text-[#FBF9F5]"
                        : "bg-[#EFECE4] text-[#44403C] hover:bg-[#E2DDD3]"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <textarea
            id="style-direction-input"
            rows={2}
            value={stylePrompt}
            onChange={(e) => onChangeStylePrompt(e.target.value)}
            placeholder="Jelaskan gaya pembacaan, tempo, jeda, dan warna emosi narator..."
            className="w-full rounded-md border border-[#D6CEBE] bg-white px-3.5 py-2.5 text-sm leading-relaxed text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#9A3412] focus:outline-none"
          />
        </div>
      </div>
    </section>
  );
}
