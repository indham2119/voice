import { StylePreset, VoiceOption } from "../types/studio";

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: "Charon",
    label: "Charon",
    character: "Berat, berwibawa, tenang",
    recommendedFor: "Dokumenter sejarah & arsip",
  },
  {
    id: "Fenrir",
    label: "Fenrir",
    character: "Tegas, resonan, dramatis",
    recommendedFor: "Kronologi pertempuran & ketegangan",
  },
  {
    id: "Kore",
    label: "Kore",
    character: "Jernih, terukur, artikulatif",
    recommendedFor: "Narasi informatif & edukasi",
  },
  {
    id: "Puck",
    label: "Puck",
    character: "Lincah, ekspresif, hangat",
    recommendedFor: "Penceritaan dinamis",
  },
  {
    id: "Zephyr",
    label: "Zephyr",
    character: "Lembut, reflektif, elegan",
    recommendedFor: "Prolog, epilog & refleksi",
  },
];

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "dokumenter",
    label: "Dokumenter Berwibawa",
    prompt:
      "Narator dokumenter sejarah berbahasa Indonesia yang berwibawa, tenang, intonasi stabil, artikulasi sangat jelas, dengan jeda dramatis pada setiap penyebutan tanggal dan nama tempat.",
  },
  {
    id: "investigatif",
    label: "Jurnalisme Investigasi",
    prompt:
      "Gaya penyiar jurnalisme investigasi yang tegas, ritme terstruktur, penekanan kuat pada fakta kunci seperti embargo minyak, pertempuran laut, dan runtuhnya kekuasaan kolonial.",
  },
  {
    id: "dramatis",
    label: "Dramatis Sinematik",
    prompt:
      "Narasi film dokumenter sinematik dengan dinamika emosi bertahap: tegang saat invasi dan pertempuran, lirih saat penderitaan romusha, dan khidmat penuh harap pada bagian Proklamasi.",
  },
  {
    id: "reflektif",
    label: "Reflektif Museum",
    prompt:
      "Suara pemandu pameran museum sejarah yang hangat, intim, bertempo agak lambat, mengundang pendengar merenungkan perjalanan lahirnya sebuah bangsa.",
  },
];
