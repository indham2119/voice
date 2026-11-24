export type VoiceName = "Charon" | "Fenrir" | "Kore" | "Puck" | "Zephyr";

export type TtsModel = "gemini-3.8-flash-lite-tts" | "gemini-3.8-flash-tts";

export interface VoiceOption {
  id: VoiceName;
  label: string;
  character: string;
  recommendedFor: string;
}

export interface StylePreset {
  id: string;
  label: string;
  prompt: string;
}

export interface ScriptChapter {
  id: string;
  roman: string;
  title: string;
  period: string;
  lines: string[];
  text: string;
  wordCount: number;
}

export interface ChapterAudioState {
  status: "idle" | "generating" | "ready" | "error";
  audioBase64?: string;
  blobUrl?: string;
  durationSeconds?: number;
  peaks?: number[];
  error?: string;
  generatedVoice?: VoiceName;
  generatedModel?: TtsModel;
  generatedStyle?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: string;
}
