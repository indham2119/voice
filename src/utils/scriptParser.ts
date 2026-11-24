import { ScriptChapter } from "../types/studio";

interface ChapterRule {
  id: string;
  roman: string;
  title: string;
  period: string;
  startsWith: string;
}

const CHAPTER_BOUNDARIES: ChapterRule[] = [
  {
    id: "babak-1",
    roman: "01",
    title: "Minyak, Koloni & Embargo",
    period: "1939 – Agu 1941",
    startsWith: "Tahun 1939, belum ada negara bernama Indonesia.",
  },
  {
    id: "babak-2",
    roman: "02",
    title: "Serbuan ke Nusantara",
    period: "Des 1941 – Feb 1942",
    startsWith: "7 Desember 1941 waktu Hawaii, pesawat Jepang menyerang Pearl Harbor.",
  },
  {
    id: "babak-3",
    roman: "03",
    title: "Laut Jawa & Penyerahan Kalijati",
    period: "Feb – 8 Mar 1942",
    startsWith: "Kini Jawa terkepung: pusat pemerintahan Hindia Belanda, markas terakhir Sekutu.",
  },
  {
    id: "babak-4",
    roman: "04",
    title: "Tiga Pemerintahan Militer & Romusha",
    period: "1942 – Feb 1945",
    startsWith: "Jepang membagi wilayah ini menjadi tiga pemerintahan militer.",
  },
  {
    id: "babak-5",
    roman: "05",
    title: "Gelombang Balik Sekutu di Pasifik",
    period: "Apr 1944 – Jul 1945",
    startsWith: "Sementara itu, Jepang mulai kalah di Pasifik. Sekutu maju dari pulau ke pulau.",
  },
  {
    id: "babak-6",
    roman: "06",
    title: "BPUPKI, Hiroshima & Proklamasi",
    period: "Apr – 17 Agu 1945",
    startsWith: "29 April 1945: Jepang meresmikan BPUPKI untuk menyelidiki persiapan kemerdekaan.",
  },
];

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function estimateDurationSeconds(wordCount: number): number {
  // Indonesian documentary narration averages ~128 words per minute
  return Math.max(2, Math.round((wordCount / 128) * 60));
}

export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function parseNarrationScript(rawText: string): ScriptChapter[] {
  const allLines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const boundaryIndices: number[] = [];
  for (const rule of CHAPTER_BOUNDARIES) {
    const idx = allLines.findIndex((line) => line.startsWith(rule.startsWith));
    boundaryIndices.push(idx);
  }

  // Fallback if custom text does not match boundaries cleanly
  if (boundaryIndices.some((idx) => idx === -1)) {
    const chunkSize = Math.ceil(allLines.length / 6);
    return CHAPTER_BOUNDARIES.map((rule, i) => {
      const slice = allLines.slice(i * chunkSize, (i + 1) * chunkSize);
      const text = slice.join("\n\n");
      return {
        id: rule.id,
        roman: rule.roman,
        title: rule.title,
        period: rule.period,
        lines: slice,
        text,
        wordCount: countWords(text),
      };
    }).filter((ch) => ch.lines.length > 0);
  }

  return CHAPTER_BOUNDARIES.map((rule, i) => {
    const start = boundaryIndices[i];
    const end =
      i + 1 < boundaryIndices.length ? boundaryIndices[i + 1] : allLines.length;
    const lines = allLines.slice(start, end);
    const text = lines.join("\n\n");
    return {
      id: rule.id,
      roman: rule.roman,
      title: rule.title,
      period: rule.period,
      lines,
      text,
      wordCount: countWords(text),
    };
  });
}
