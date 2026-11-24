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
  // Indonesian narration averages ~128 words per minute
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

  if (boundaryIndices.some((idx) => idx === -1)) {
    return parseGeneralScript(rawText);
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

/**
 * Splits any user-provided script into balanced narration segments (~180 words max per segment)
 * or respects explicit markdown headings (`# ...`) and `---` separators.
 */
export function parseGeneralScript(rawText: string): ScriptChapter[] {
  const normalized = rawText.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const blocks = normalized
    .split(/\n{2,}|^---+\s*$/m)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const hasExplicitHeadings = blocks.some((b) => /^#{1,3}\s+/.test(b));

  const segments: { title: string; lines: string[] }[] = [];

  if (hasExplicitHeadings) {
    let currentTitle = "Pembuka";
    let currentLines: string[] = [];

    for (const block of blocks) {
      const headingMatch = block.match(/^#{1,3}\s+(.+)$/m);
      if (headingMatch && block.split("\n").length === 1) {
        if (currentLines.length > 0) {
          segments.push({ title: currentTitle, lines: currentLines });
          currentLines = [];
        }
        currentTitle = headingMatch[1].trim();
      } else {
        const lines = block
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !/^#{1,3}\s+/.test(l));
        currentLines.push(...lines);
      }
    }
    if (currentLines.length > 0) {
      segments.push({ title: currentTitle, lines: currentLines });
    }
  } else {
    const allLines = normalized
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const TARGET_WORDS = 175;
    let bucket: string[] = [];
    let bucketWords = 0;

    for (const line of allLines) {
      const lineWords = countWords(line);
      if (bucket.length > 0 && bucketWords + lineWords > TARGET_WORDS) {
        segments.push({
          title: `Segmen ${String(segments.length + 1).padStart(2, "0")}`,
          lines: bucket,
        });
        bucket = [line];
        bucketWords = lineWords;
      } else {
        bucket.push(line);
        bucketWords += lineWords;
      }
    }
    if (bucket.length > 0) {
      segments.push({
        title: `Segmen ${String(segments.length + 1).padStart(2, "0")}`,
        lines: bucket,
      });
    }
  }

  return segments.map((seg, idx) => {
    const indexLabel = String(idx + 1).padStart(2, "0");
    const text = seg.lines.join("\n\n");
    const wc = countWords(text);
    const title =
      seg.title.startsWith("Segmen ") && segments.length === 1
        ? "Naskah Utama"
        : seg.title;
    return {
      id: `segmen-${idx + 1}-${Date.now().toString(36).slice(-4)}`,
      roman: indexLabel,
      title,
      period: `${wc} kata`,
      lines: seg.lines,
      text,
      wordCount: wc,
    };
  });
}
