import { StylePreset, VoiceOption } from "../types/studio";

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: "Charon",
    label: "Charon",
    character: "Berat, berwibawa, tenang",
    recommendedFor: "Dokumenter & narasi serius",
  },
  {
    id: "Fenrir",
    label: "Fenrir",
    character: "Tegas, resonan, dramatis",
    recommendedFor: "Trailer, ketegangan & berita",
  },
  {
    id: "Kore",
    label: "Kore",
    character: "Jernih, terukur, artikulatif",
    recommendedFor: "Edukasi, YouTube & profil",
  },
  {
    id: "Puck",
    label: "Puck",
    character: "Lincah, ekspresif, hangat",
    recommendedFor: "Promosi, iklan & hiburan",
  },
  {
    id: "Zephyr",
    label: "Zephyr",
    character: "Lembut, reflektif, elegan",
    recommendedFor: "Podcast, cerita & audiobuku",
  },
];

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "dokumenter",
    label: "Dokumenter Berwibawa",
    prompt:
      "Narator dokumenter berbahasa Indonesia yang berwibawa, tenang, intonasi stabil, artikulasi sangat jelas, dengan jeda dramatis pada bagian penting.",
  },
  {
    id: "edukasi",
    label: "YouTube & Edukasi",
    prompt:
      "Pembawa acara video edukasi yang hangat, komunikatif, ritme mengalir alami, jelas, dan mudah diikuti pendengar.",
  },
  {
    id: "iklan",
    label: "Iklan & Promosi",
    prompt:
      "Pengisi suara komersial yang berenergi, persuasif, cerah, antusias, dengan penekanan kuat pada pesan utama.",
  },
  {
    id: "podcast",
    label: "Podcast & Bercerita",
    prompt:
      "Gaya bertutur santai dan intim seperti berbincang akrab, tempo sedikit tenang, dengan ekspresi dan jeda napas yang natural.",
  },
  {
    id: "berita",
    label: "Berita & Korporat",
    prompt:
      "Penyiar berita profesional yang tegas, netral, terstruktur, rapi, dan berartikulasi tajam di setiap kalimat.",
  },
];
