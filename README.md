# React + TypeScript + Vite

## Development

Run `npm run dev` to start the Vite frontend and PostgreSQL API backend together. The API runs on port `8787` and converts Google Maps short links into full URLs before they are saved to PostgreSQL.

## Akun dan Verifikasi OTP

Setiap pengguna membuat akun dengan alamat `@gmail.com` dan passwordnya sendiri melalui halaman register. Email/password pendaftar disimpan sebagai akun terpisah di database dan tidak diambil dari `ADMIN_EMAIL` atau `ADMIN_PASSWORD`. Server mengirim OTP melalui satu akun Gmail pengirim, lalu membuat settings dan galeri terpisah untuk setiap akun.

1. Aktifkan 2-Step Verification pada Gmail pengirim.
2. Buat Gmail App Password, lalu isi `SMTP_USER`, `SMTP_PASS`, dan `SMTP_FROM` di `.env` berdasarkan `.env.example`.
3. Isi `AUTH_TOKEN_SECRET` dengan secret acak yang panjang.
4. Jalankan `npm run dev`; tabel `app_users` dan kolom kepemilikan akan disiapkan otomatis pada startup.

`SMTP_PASS` harus berupa App Password Gmail, bukan password Gmail utama. SMTP_USER/SMTP_PASS hanya kredensial pengirim OTP, bukan kredensial user yang sedang mendaftar. Tanpa konfigurasi SMTP, pendaftaran akan ditolak agar aplikasi tidak memberi kesan OTP terkirim padahal tidak ada email yang dikirim.

## Production Deployment (Vercel + Railway)

Frontend di-deploy ke Vercel; API Node.js dan PostgreSQL berjalan di Railway. Railway menjalankan `npm run build` lalu `npm start` sesuai `railway.json`. Jangan deploy `.env` atau memasukkan secret ke Git.

### Railway

1. Tambahkan service PostgreSQL dan service API dari repository ini ke project Railway.
2. Pada service API, buat variable `DATABASE_URL` sebagai reference ke database, misalnya `${{Postgres.DATABASE_URL}}` (gunakan nama service database yang terlihat di project).
3. Buat secret `AUTH_TOKEN_SECRET` yang panjang dan acak. Atur `NODE_ENV=production` dan `DEV_OTP_FALLBACK=false`. Railway mengisi `PORT` secara otomatis.
4. Hubungkan volume persisten pada service API dengan mount path `/data`, lalu atur `UPLOADS_DIR=/data/uploads`. Tanpa volume, upload akan hilang saat container diganti.
5. Jalankan [railway-schema.sql](./railway-schema.sql) sekali pada PostgreSQL Railway sebelum API mulai menerima traffic. Schema ini tidak mengimpor contoh RSVP atau data pribadi.
6. Untuk mengaktifkan registrasi, isi `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, dan `SMTP_FROM` dengan kredensial pengirim OTP. Tanpa SMTP, API tetap hidup tetapi endpoint registrasi mengembalikan `503`.
7. Setelah deployment API aktif, buat domain publik HTTPS pada service API. Simpan domain ini untuk konfigurasi Vercel.

`CORS_ORIGINS` menerima daftar origin yang dipisahkan koma. Isi dengan domain Vercel jika browser mengakses API secara langsung; untuk rewrite same-origin dari Vercel, akses frontend tetap memakai domain Vercel. Jangan pernah mengatur CORS ke wildcard dengan credentials.

### Vercel

Deploy repository yang sama sebagai project Vite. Setelah domain HTTPS API Railway tersedia, atur rewrite `/api/*` dan `/uploads/*` ke domain Railway supaya permintaan API dan berkas upload diteruskan ke backend. Jangan memakai URL API HTTP.

### Schema dan file upload

Jalankan SQL schema sebelum API pertama kali start. Server melakukan migrasi auth ringan saat startup, tetapi tabel wedding utama harus sudah tersedia. File media ditulis ke `UPLOADS_DIR`, dibatasi maksimal 15 MB per upload, dan harus berada di volume persisten Railway.

### Development

Salin `.env.example` ke `.env`, isi `DATABASE_URL` PostgreSQL lokal serta kredensial SMTP bila menguji OTP, lalu jalankan `npm run dev`. Jangan commit `.env`.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

## Note:
This project also comes with file size restriction logic for uploads and auto-pluring to prevent the website storage from getting full or slow to access.
