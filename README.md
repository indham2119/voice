# Voice Over Generator — Studio Voiceover

Aplikasi web untuk mengubah naskah apa saja (dokumenter, video YouTube, iklan, podcast, materi edukasi) menjadi audio voiceover **WAV 24kHz** siap pakai menggunakan **Gemini Text-to-Speech**, lengkap dengan **Asisten Sutradara Suara** multi-turn untuk konsultasi intonasi, jeda, dan penyuntingan naskah.

## Fitur Utama

- **Input Naskah Fleksibel**: Tempel teks langsung atau unggah file `.txt` / `.md`, lengkap dengan pembagian segmen otomatis (atau gunakan `# Judul Segmen` dan `---` untuk pemisahan manual).
- **Pilihan Karakter & Gaya Suara**: 5 karakter suara (`Charon`, `Fenrir`, `Kore`, `Puck`, `Zephyr`), 2 mesin sintesis (`gemini-3.8-flash-lite-tts` & `gemini-3.8-flash-tts`), preset gaya pembacaan, serta kolom arahan gaya kustom.
- **Pratinjau & Pemutar Master**: Uji suara per baris, pemutar waveform interaktif, pengaturan kecepatan putar (`0.85x`–`1.25x`), unduh `.wav` per segmen, atau gabungkan seluruh segmen menjadi satu file **Master WAV** utuh.
- **Asisten Sutradara Suara**: Chatbot interaktif (`gemini-4-hydrogen`) untuk membantu arahan intonasi, tanda jeda, pelafalan istilah asing, dan saran gaya pembacaan.

---

## Cara Menggunakan dengan API Key Sendiri

Setiap pengguna yang menjalankan proyek ini **wajib menggunakan `GEMINI_API_KEY` milik masing-masing** di sisi server. API key tidak pernah dimasukkan lewat tampilan browser.

### Opsi 1: Jalankan di Komputer Lokal

#### Prasyarat
- **Node.js versi 22.6 atau lebih baru** (agar mendukung eksekusi TypeScript native `node server.ts`) — cek dengan `node -v`
- **Gemini API Key** gratis/berbayar dari [Google AI Studio](https://aistudio.google.com/)

#### Langkah Instalasi
1. **Clone repositori ini**
   ```bash
   git clone <URL_REPOSITORI_GITHUB_ANDA>
   cd <NAMA_FOLDER_REPO>
   ```

2. **Instal dependensi**
   ```bash
   npm install
   ```

3. **Siapkan file environment (`.env`)**
   Salin `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
   Buka file `.env` dan isi `GEMINI_API_KEY` milik Anda:
   ```env
   GEMINI_API_KEY="MASUKKAN_API_KEY_GEMINI_ANDA"
   APP_URL="http://localhost:3000"
   ```

4. **Jalankan aplikasi (mode pengembangan)**
   ```bash
   npm run dev
   ```
   Buka browser dan kunjungi: **`http://localhost:3000`**

5. **Menjalankan versi produksi (opsional)**
   ```bash
   npm run build
   NODE_ENV=production npm start
   ```

---

### Opsi 2: Import ke Google AI Studio (Tanpa Setup Lokal)

1. Buka [Google AI Studio](https://aistudio.google.com/) menggunakan akun Google Anda masing-masing.
2. Pilih opsi **Import from GitHub** dan masukkan URL repositori GitHub ini.
3. Buka panel **Settings > Secrets** di AI Studio, lalu pastikan `GEMINI_API_KEY` Anda aktif.
4. Aplikasi langsung berjalan dan seluruh pemakaian API memakai kuota akun Google Anda sendiri.

---

### Opsi 3: Deploy ke Hosting Pribadi (Cloud Run / Railway / Render / VPS)

Jika Anda ingin meng-online-kan versi milik Anda sendiri:
- **Runtime**: Node.js `>= 22.6`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Environment Variables**:
  - `NODE_ENV=production`
  - `PORT=3000` (atau sesuai port dari platform hosting)
  - `GEMINI_API_KEY=<API_KEY_ANDA>`

---

## Catatan Keamanan

- Jangan pernah mengunggah file `.env` atau menuliskan `GEMINI_API_KEY` ke dalam kode sumber yang dipublikasikan ke GitHub (file `.env*` sudah dikecualikan di `.gitignore`).
- Seluruh permintaan TTS dan chat diproses melalui endpoint backend (`/api/tts/generate` dan `/api/chat`) di `server.ts`.
