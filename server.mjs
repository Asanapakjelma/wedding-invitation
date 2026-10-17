import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg'; // Impor driver pg baru
import nodemailer from 'nodemailer';

const { Pool } = pg;
const scrypt = (password, salt) => new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(key.toString('hex'))));

// 1. Ambil Port dan Database URL dari variabel lingkungan (.env)
const port = Number(process.env.PORT || 8787);
const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL;
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const tokenSecret = process.env.AUTH_TOKEN_SECRET || (!isProduction ? process.env.ADMIN_TOKEN || crypto.randomBytes(32).toString('hex') : '');
const smtpUser = (process.env.SMTP_USER || process.env.GMAIL_USER || '').trim();
const smtpPass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');
const devOtpFallback = process.env.NODE_ENV !== 'production' && process.env.DEV_OTP_FALLBACK === 'true';
const allowedOrigins = new Set((process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean));

if (!databaseUrl) {
  throw new Error('DATABASE_URL belum diatur. Salin .env.example menjadi .env lalu isi koneksi PostgreSQL.');
}
if (isProduction && (!tokenSecret || devOtpFallback)) {
  throw new Error('Production membutuhkan AUTH_TOKEN_SECRET dan DEV_OTP_FALLBACK=false.');
}

// 2. Buat Koneksi Pool ke PostgreSQL Lokal
const pool = new Pool({
  connectionString: databaseUrl,
});

const uploadsDirectory = path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), 'public', 'uploads'));
const distDirectory = path.join(process.cwd(), 'dist');
const tableColumns = {
  wedding_settings: ['id', 'user_id', 'bride_name', 'groom_name', 'wedding_date', 'bca_wanita', 'bca_pria', 'wax_color', 'text_color', 'created_at', 'google_maps_url', 'background_url', 'music_url'],
  wedding_photos: ['id', 'user_id', 'slot_number', 'photo_url', 'caption', 'created_at'],
  rsvp_responses: ['id', 'user_id', 'created_at', 'guest_name', 'attendance_status', 'total_guest', 'wishes'],
};

const maxJsonBodySize = 64 * 1024;
const maxUploadSize = 15 * 1024 * 1024;
const rateLimitBuckets = new Map();
const rateLimit = (request, response, key, limit, windowMs) => {
  const clientKey = `${key}:${request.headers['x-forwarded-for']?.split(',')[0].trim() || request.socket.remoteAddress || 'unknown'}`;
  const now = Date.now();
  const current = rateLimitBuckets.get(clientKey);
  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(clientKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) {
    response.setHeader('retry-after', Math.ceil((current.resetAt - now) / 1000));
    json(response, 429, { error: 'Terlalu banyak percobaan. Silakan coba lagi nanti.' });
    return false;
  }
  current.count += 1;
  return true;
};
const allowedHosts = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'maps.google.com',
  'www.google.com',
  'google.com',
]);

const isAllowedMapsUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && allowedHosts.has(url.hostname);
  } catch {
    return false;
  }
};

const extractCoordinates = (url) => {
  const placeCoordinates = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const cameraCoordinates = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  return placeCoordinates || cameraCoordinates;
};

const resolveMapsUrl = async (inputUrl) => {
  let currentUrl = inputUrl;

  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    const response = await fetch(currentUrl, {
      redirect: 'manual',
      headers: { 'user-agent': 'wedding-invitation-maps-resolver/1.0' },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect Google Maps tidak memiliki tujuan.');
      const nextUrl = new URL(location, currentUrl).toString();
      if (!isAllowedMapsUrl(nextUrl)) throw new Error('Redirect menuju host yang tidak diizinkan.');
      currentUrl = nextUrl;
      continue;
    }

    if (!response.ok) throw new Error(`Google Maps mengembalikan status ${response.status}.`);
    return currentUrl;
  }

  throw new Error('Terlalu banyak redirect pada link Google Maps.');
};

const json = (response, statusCode, body) => {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
};

const applyCors = (request, response) => {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader('access-control-allow-origin', origin);
    response.setHeader('vary', 'Origin');
    response.setHeader('access-control-allow-credentials', 'true');
  }
};

const isAdminRequest = (request) => request.headers.authorization === `Bearer ${process.env.ADMIN_TOKEN || adminPassword}`;

const encodeToken = (user) => {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', tokenSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

const getUserFromRequest = (request) => {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expectedSignature = crypto.createHmac('sha256', tokenSecret).update(payload).digest('base64url');
  if (signature.length !== expectedSignature.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null;
  try {
    const user = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return user.exp > Date.now() ? user : null;
  } catch { return null; }
};

const requireUser = (request, response) => {
  const user = getUserFromRequest(request);
  if (!user) json(response, 401, { error: 'Sesi tidak valid. Silakan login kembali.' });
  return user;
};

const mailer = smtpUser && smtpPass ? nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE || 'true') === 'true',
  auth: { user: smtpUser, pass: smtpPass },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
}) : null;

const hashOtp = (otp) => crypto.createHash('sha256').update(otp).digest('hex');

const sendOtpEmail = async (email, otp) => {
  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || smtpUser,
      to: email,
      subject: 'Kode OTP Wedding Invitation',
      text: `Kode verifikasi akun Anda: ${otp}\nKode berlaku selama 10 menit.`,
    });
  } catch (error) {
    console.error('Gagal mengirim email OTP:', error instanceof Error ? error.message : 'Kesalahan SMTP tidak diketahui.');
    throw Object.assign(new Error('Email OTP gagal dikirim. Periksa konfigurasi SMTP Railway atau coba kirim ulang.'), { statusCode: 502 });
  }
};

const initializeAuthSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.app_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL,
      password_hash text NOT NULL, verified boolean NOT NULL DEFAULT false,
      otp_hash text, otp_expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.wedding_settings ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.app_users(id) ON DELETE CASCADE;
    ALTER TABLE public.rsvp_responses ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.app_users(id) ON DELETE CASCADE;
    ALTER TABLE public.wedding_photos DROP CONSTRAINT IF EXISTS wedding_photos_slot_number_key;
    CREATE UNIQUE INDEX IF NOT EXISTS wedding_photos_user_slot_idx ON public.wedding_photos(user_id, slot_number);
  `);
  if (adminEmail && adminPassword) {
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = `${salt}:${await scrypt(adminPassword, salt)}`;
    await pool.query(`INSERT INTO public.app_users (email, password_hash, verified)
      VALUES ($1, $2, true) ON CONFLICT (email) DO UPDATE SET verified = true`, [adminEmail.trim().toLowerCase(), passwordHash]);
    const admin = await pool.query('SELECT id FROM public.app_users WHERE email = $1', [adminEmail.trim().toLowerCase()]);
    await pool.query('UPDATE public.rsvp_responses SET user_id = $1 WHERE user_id IS NULL', [admin.rows[0].id]);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existingSettings = await client.query('SELECT 1 FROM public.wedding_settings WHERE user_id = $1', [admin.rows[0].id]);
      if (!existingSettings.rows[0]) await provisionUserData(client, admin.rows[0].id);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
};

const provisionUserData = async (client, userId) => {
  const settings = await client.query('SELECT * FROM public.wedding_settings WHERE user_id IS NULL ORDER BY id LIMIT 1');
  const template = settings.rows[0];
  if (template) {
    const nextId = await client.query('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM public.wedding_settings');
    await client.query(`INSERT INTO public.wedding_settings (id, user_id, bride_name, groom_name, wedding_date, bca_wanita, bca_pria, wax_color, text_color, google_maps_url, background_url, music_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [nextId.rows[0].id, userId, template.bride_name, template.groom_name, template.wedding_date, template.bca_wanita, template.bca_pria, template.wax_color, template.text_color, template.google_maps_url, template.background_url, template.music_url]);
  }
  await client.query(`INSERT INTO public.wedding_photos (user_id, slot_number, photo_url, caption)
    SELECT $1, slot_number, photo_url, caption FROM public.wedding_photos WHERE user_id IS NULL
    ON CONFLICT (user_id, slot_number) DO NOTHING`, [userId]);
};

const readRequestBody = async (request, maxSize) => {
  const contentLength = Number(request.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > maxSize) {
    throw Object.assign(new Error('Request terlalu besar.'), { statusCode: 413 });
  }

  const chunks = [];
  let bodySize = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bodySize += buffer.length;
    if (bodySize > maxSize) {
      throw Object.assign(new Error('Request terlalu besar.'), { statusCode: 413 });
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
};

const readJsonBody = async (request) => JSON.parse((await readRequestBody(request, maxJsonBodySize)).toString('utf8'));

const resolveUploadPath = (relativePath, allowRoot = false) => {
  if (typeof relativePath !== 'string' || relativePath.includes('\0')) return null;
  const target = path.resolve(uploadsDirectory, relativePath);
  const relative = path.relative(uploadsDirectory, target);
  if (relative === '' ? allowRoot : !relative.startsWith('..') && !path.isAbsolute(relative)) return target;
  return null;
};

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.mpeg': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.webm': 'audio/webm',
};

const serveStatic = async (request, response) => {
  if (request.method !== 'GET' || request.url.startsWith('/api/')) return false;
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    return false;
  }
  const isUpload = pathname.startsWith('/uploads/');
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(isUpload ? '/uploads/'.length : 1);
  const baseDirectory = isUpload ? uploadsDirectory : distDirectory;
  const target = isUpload ? resolveUploadPath(relativePath) : path.resolve(baseDirectory, relativePath);
  if (!target || (!isUpload && !target.startsWith(`${baseDirectory}${path.sep}`))) return false;
  try {
    const file = await fs.readFile(target);
    const extension = path.extname(target).toLowerCase();
    response.writeHead(200, { 'content-type': contentTypes[extension] || 'application/octet-stream' });
    response.end(file);
    return true;
  } catch {
    if (relativePath.includes('.')) return false;
    try {
      const file = await fs.readFile(path.join(distDirectory, 'index.html'));
      response.writeHead(200, { 'content-type': contentTypes['.html'] });
      response.end(file);
      return true;
    } catch { return false; }
  }
};

// Utama: Jalankan server HTTP
const server = http.createServer(async (request, response) => {
  applyCors(request, response);
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('x-frame-options', 'SAMEORIGIN');
  response.setHeader('referrer-policy', 'strict-origin-when-cross-origin');

  if (request.method === 'POST' && ['/api/auth/login', '/api/auth/signup', '/api/auth/verify-otp', '/api/auth/resend'].includes(request.url) && !rateLimit(request, response, request.url, request.url === '/api/auth/login' ? 10 : 5, 15 * 60 * 1000)) return;
  if ((request.method === 'POST' || request.method === 'DELETE') && (request.url.startsWith('/api/rsvp') || request.url.startsWith('/api/data/rsvp_responses') || request.url === '/api/resolve-maps') && !rateLimit(request, response, 'public-post', 30, 60 * 60 * 1000)) return;

  if (request.method === 'GET' && request.url === '/') {
    json(response, 200, {
      name: 'Wedding Invitation API',
      status: 'ok',
      database: 'PostgreSQL',
      endpoints: ['/api/settings', '/api/photos', '/api/rsvp'],
    });
    return;
  }

  if (request.method === 'POST' && request.url === '/api/auth/login') {
    try {
      const { email, password } = await readJsonBody(request);
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      const result = await pool.query('SELECT id, email, password_hash, verified FROM public.app_users WHERE email = $1', [normalizedEmail]);
      const user = result.rows[0];
      if (!user) {
        json(response, 401, { error: 'Email atau password salah.' });
        return;
      }
      if (!user.verified) {
        json(response, 403, { error: 'Email belum diverifikasi. Masukkan OTP terlebih dahulu.' });
        return;
      }
      const [salt, storedHash] = user.password_hash.split(':');
      const passwordHash = await scrypt(String(password || ''), salt);
      if (passwordHash !== storedHash) {
        json(response, 401, { error: 'Email atau password salah.' });
        return;
      }
      json(response, 200, { token: encodeToken({ id: user.id, email: user.email }), user: { id: user.id, email: user.email } });
    } catch (error) {
      json(response, 400, { error: error.message });
    }
    return;
  }

  if (request.method === 'POST' && request.url === '/api/auth/signup') {
    try {
      if (!mailer && !devOtpFallback) {
        json(response, 503, { error: 'Akun baru memakai email dan password dari form ini. Server belum memiliki akun pengirim OTP; isi SMTP_USER dan SMTP_PASS dengan Gmail App Password di .env, lalu restart npm run dev.' });
        return;
      }
      const { email, password } = await readJsonBody(request);
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      if (!/^[^\s@]+@gmail\.com$/i.test(normalizedEmail)) {
        json(response, 400, { error: 'Gunakan alamat Gmail yang valid.' });
        return;
      }
      if (typeof password !== 'string' || password.length < 8) {
        json(response, 400, { error: 'Password minimal 8 karakter.' });
        return;
      }
      const existing = await pool.query('SELECT verified FROM public.app_users WHERE email = $1', [normalizedEmail]);
      if (existing.rows[0]?.verified) {
        json(response, 409, { error: 'Email sudah terdaftar. Silakan login.' });
        return;
      }
      const salt = crypto.randomBytes(16).toString('hex');
      const otp = String(crypto.randomInt(100000, 1000000));
      const passwordHash = `${salt}:${await scrypt(password, salt)}`;
      await pool.query(`INSERT INTO public.app_users (email, password_hash, otp_hash, otp_expires_at)
        VALUES ($1, $2, $3, now() + interval '10 minutes')
        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, otp_hash = EXCLUDED.otp_hash, otp_expires_at = EXCLUDED.otp_expires_at, verified = false`, [normalizedEmail, passwordHash, hashOtp(otp)]);
      if (mailer) {
        await sendOtpEmail(normalizedEmail, otp);
        json(response, 201, { message: 'OTP berhasil dikirim.' });
      } else {
        console.log(`[DEV OTP] ${normalizedEmail}: ${otp}`);
        json(response, 201, { message: 'OTP development dibuat.', developmentOtp: otp });
      }
    } catch (error) { json(response, error?.statusCode || 400, { error: error.message }); }
    return;
  }

  if (request.method === 'POST' && request.url === '/api/auth/verify-otp') {
    try {
      const { email, token } = await readJsonBody(request);
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const result = await pool.query('SELECT id, email, otp_hash, otp_expires_at FROM public.app_users WHERE email = $1', [normalizedEmail]);
      const user = result.rows[0];
      if (!user || !user.otp_hash || user.otp_hash !== hashOtp(String(token || '')) || new Date(user.otp_expires_at) < new Date()) {
        json(response, 400, { error: 'Kode OTP salah atau sudah kedaluwarsa.' });
        return;
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('UPDATE public.app_users SET verified = true, otp_hash = NULL, otp_expires_at = NULL WHERE id = $1', [user.id]);
        await provisionUserData(client, user.id);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
      json(response, 200, { token: encodeToken({ id: user.id, email: user.email }), user: { id: user.id, email: user.email } });
    } catch (error) { json(response, 400, { error: error.message }); }
    return;
  }

  if (request.method === 'POST' && request.url === '/api/auth/resend') {
    try {
      if (!mailer && !devOtpFallback) { json(response, 503, { error: 'Email OTP belum dikonfigurasi di server.' }); return; }
      const { email } = await readJsonBody(request);
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const otp = String(crypto.randomInt(100000, 1000000));
      const result = await pool.query(`UPDATE public.app_users SET otp_hash = $1, otp_expires_at = now() + interval '10 minutes'
        WHERE email = $2 AND verified = false RETURNING email`, [hashOtp(otp), normalizedEmail]);
      if (!result.rows[0]) { json(response, 400, { error: 'Akun belum terdaftar atau sudah diverifikasi.' }); return; }
      if (mailer) {
        await sendOtpEmail(normalizedEmail, otp);
        json(response, 200, { message: 'OTP berhasil dikirim ulang.' });
      } else {
        console.log(`[DEV OTP] ${normalizedEmail}: ${otp}`);
        json(response, 200, { message: 'OTP development dibuat ulang.', developmentOtp: otp });
      }
    } catch (error) { json(response, error?.statusCode || 400, { error: error.message }); }
    return;
  }

  if (request.method === 'GET' && request.url === '/api/auth/session') {
    const user = requireUser(request, response);
    if (user) json(response, 200, { user: { id: user.id, email: user.email } });
    return;
  }

  // CORS Preflight Handling untuk komunikasi lintas port (Frontend <-> Backend)
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'access-control-allow-methods': 'POST, GET, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
    });
    response.end();
    return;
  }

  // =========================================================================
  // ENDPOINT 1: GET /api/rsvp -> Mengambil Seluruh Ucapan & Kehadiran Tamu
  // =========================================================================
  if (request.method === 'GET' && request.url.startsWith('/api/rsvp')) {
    try {
      const owner = new URL(request.url, `http://${request.headers.host || 'localhost'}`).searchParams.get('owner');
      if (!owner) { json(response, 400, { error: 'Owner undangan diperlukan.' }); return; }
      const result = await pool.query('SELECT * FROM public.rsvp_responses WHERE user_id = $1 ORDER BY created_at DESC', [owner]);
      json(response, 200, result.rows);
    } catch (error) {
      json(response, 500, { error: error.message });
    }
    return;
  }

  if (request.method === 'GET' && request.url.startsWith('/api/photos')) {
    try {
      const owner = new URL(request.url, `http://${request.headers.host || 'localhost'}`).searchParams.get('owner');
      const result = owner
        ? await pool.query('SELECT slot_number, photo_url, caption FROM public.wedding_photos WHERE user_id = $1 ORDER BY slot_number ASC', [owner])
        : await pool.query('SELECT slot_number, photo_url, caption FROM public.wedding_photos WHERE user_id IS NULL ORDER BY slot_number ASC');
      json(response, 200, result.rows);
    } catch (error) {
      json(response, 500, { error: error.message });
    }
    return;
  }

  if (request.method === 'POST' && request.url.startsWith('/api/rsvp/reset')) {
    try {
      const user = requireUser(request, response);
      if (!user) return;
      const owner = new URL(request.url, `http://${request.headers.host || 'localhost'}`).searchParams.get('owner');
      if (!owner || owner !== user.id) { json(response, 403, { error: 'Anda hanya dapat mereset RSVP milik akun sendiri.' }); return; }
      const result = await pool.query('DELETE FROM public.rsvp_responses WHERE user_id = $1 RETURNING id', [user.id]);
      json(response, 200, { deleted: result.rowCount || 0 });
    } catch (error) { json(response, 500, { error: error.message }); }
    return;
  }

  if (request.method === 'DELETE' && request.url.startsWith('/api/rsvp')) {
    try {
      const user = requireUser(request, response);
      if (!user) return;
      const params = new URL(request.url, `http://${request.headers.host || 'localhost'}`).searchParams;
      const owner = params.get('owner');
      const id = params.get('id');
      if (!owner || !id) { json(response, 400, { error: 'Owner dan id RSVP diperlukan.' }); return; }
      if (owner !== user.id) { json(response, 403, { error: 'Anda hanya dapat menghapus RSVP milik akun sendiri.' }); return; }
      const result = await pool.query('DELETE FROM public.rsvp_responses WHERE id = $1 AND user_id = $2 RETURNING id', [id, owner]);
      if (!result.rows[0]) { json(response, 404, { error: 'RSVP tidak ditemukan.' }); return; }
      json(response, 200, result.rows[0]);
    } catch (error) { json(response, 500, { error: error.message }); }
    return;
  }

  // =========================================================================
  // ENDPOINT 2: POST /api/rsvp -> Menyimpan Data Tamu Baru (Kirim RSVP)
  // =========================================================================
  if (request.method === 'POST' && request.url.startsWith('/api/rsvp')) {
    try {
      if (!request.headers['content-type']?.startsWith('application/json')) {
        json(response, 415, { error: 'Content-Type harus application/json.' });
        return;
      }

      const owner = new URL(request.url, `http://${request.headers.host || 'localhost'}`).searchParams.get('owner');
      if (!owner) { json(response, 400, { error: 'Owner undangan diperlukan.' }); return; }
      const { guest_name, attendance_status, total_guest, wishes } = await readJsonBody(request);
      const guestName = typeof guest_name === 'string' ? guest_name.trim() : '';
      const attendanceStatus = typeof attendance_status === 'string' ? attendance_status.trim() : '';
      const guestCount = Number(total_guest);

      if (!guestName || !['Hadir', 'Tidak Hadir'].includes(attendanceStatus)) {
        json(response, 400, { error: 'Nama tamu dan status kehadiran wajib diisi.' });
        return;
      }

      if (!Number.isInteger(guestCount) || guestCount < 0 || guestCount > 5) {
        json(response, 400, { error: 'Jumlah tamu harus berupa angka antara 0 dan 5.' });
        return;
      }

      const queryText = `
        INSERT INTO public.rsvp_responses (user_id, guest_name, attendance_status, total_guest, wishes)
        VALUES ($1, $2, $3, $4, $5) RETURNING *;
      `;
      const values = [owner, guestName, attendanceStatus, attendanceStatus === 'Hadir' ? guestCount || 1 : 0, typeof wishes === 'string' ? wishes.trim() : ''];
      
      const result = await pool.query(queryText, values);
      json(response, 201, result.rows[0]);
    } catch (error) {
      json(response, 500, { error: error.message });
    }
    return;
  }

  // =========================================================================
  // ENDPOINT 3: GET /api/settings -> Mengambil Pengaturan Nama Pengantin, Musik, dll
  // =========================================================================
  if (request.method === 'GET' && request.url.startsWith('/api/settings')) {
    try {
      const owner = new URL(request.url, `http://${request.headers.host || 'localhost'}`).searchParams.get('owner');
      const result = owner
        ? await pool.query('SELECT * FROM public.wedding_settings WHERE user_id = $1', [owner])
        : await pool.query('SELECT * FROM public.wedding_settings WHERE user_id IS NULL ORDER BY id LIMIT 1');
      json(response, 200, result.rows[0] || {});
    } catch (error) {
      json(response, 500, { error: error.message });
    }
    return;
  }

  if (request.method === 'GET' && request.url.startsWith('/api/data?')) {
    try {
      const params = new URL(request.url, `http://${request.headers.host || 'localhost'}`).searchParams;
      const table = params.get('table');
      const columns = tableColumns[table];
      if (!columns) {
        json(response, 400, { error: 'Tabel tidak diizinkan.' });
        return;
      }
      const currentUser = getUserFromRequest(request);
      const publicOwner = params.get('owner');
      if (!currentUser && !(table === 'rsvp_responses' && publicOwner)) {
        json(response, 401, { error: 'Login diperlukan.' });
        return;
      }
      const filters = Object.entries(Object.fromEntries(params.entries()))
        .filter(([key]) => columns.includes(key) && !['table', 'select', 'order', 'ascending'].includes(key));
      filters.push(['user_id', currentUser?.id || publicOwner]);
      const selected = (params.get('select') || '*').split(',').map((column) => column.trim());
      const selectColumns = selected.includes('*') ? columns : selected.filter((column) => columns.includes(column));
      if (selectColumns.length === 0) {
        json(response, 400, { error: 'Kolom tidak diizinkan.' });
        return;
      }
      const values = filters.map(([, value]) => value);
      const where = filters.map(([key], index) => `"${key}" = $${index + 1}`).join(' AND ');
      const order = columns.includes(params.get('order')) ? ` ORDER BY "${params.get('order')}" ${params.get('ascending') === 'true' ? 'ASC' : 'DESC'}` : '';
      const result = await pool.query(`SELECT ${selectColumns.map((column) => `"${column}"`).join(', ')} FROM public."${table}"${where ? ` WHERE ${where}` : ''}${order}`, values);
      json(response, 200, result.rows);
    } catch (error) {
      json(response, 500, { error: error.message });
    }
    return;
  }

  if (request.method === 'POST' && request.url.startsWith('/api/data/')) {
    try {
      const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      const table = decodeURIComponent(requestUrl.pathname.slice('/api/data/'.length));
      const columns = tableColumns[table];
      if (!columns) {
        json(response, 400, { error: 'Tabel tidak diizinkan.' });
        return;
      }
      const { operation, filters = {}, payload = {} } = await readJsonBody(request);
      if (!['insert', 'update', 'upsert', 'delete'].includes(operation)) {
        json(response, 400, { error: 'Operasi data tidak valid.' });
        return;
      }
      const currentUser = getUserFromRequest(request);
      const publicOwner = requestUrl.searchParams.get('owner');
      if (!currentUser && !(table === 'rsvp_responses' && publicOwner && operation === 'insert')) {
        json(response, 401, { error: 'Login diperlukan.' });
        return;
      }
      const normalizedPayload = Array.isArray(payload) ? payload[0] || {} : payload;
      const validPayload = Object.fromEntries(Object.entries(normalizedPayload).filter(([key]) => columns.includes(key) && !['id', 'created_at', 'user_id'].includes(key)));
      const validFilters = Object.fromEntries(Object.entries(filters).filter(([key]) => columns.includes(key)));
      if (currentUser) {
        validFilters.user_id = currentUser.id;
        if (operation === 'insert' || operation === 'upsert') validPayload.user_id = currentUser.id;
      } else {
        validPayload.user_id = publicOwner;
      }
      const filterEntries = Object.entries(validFilters);
      const values = [...Object.values(validPayload), ...Object.values(validFilters)];
      const where = filterEntries.map(([key], index) => `"${key}" = $${Object.keys(validPayload).length + index + 1}`).join(' AND ');
      let result;

      if (operation === 'delete') {
        result = await pool.query(`DELETE FROM public."${table}"${where ? ` WHERE ${where}` : ''} RETURNING *`, Object.values(validFilters));
      } else if (operation === 'update') {
        const assignments = Object.keys(validPayload).map((key, index) => `"${key}" = $${index + 1}`).join(', ');
        result = await pool.query(`UPDATE public."${table}" SET ${assignments}${where ? ` WHERE ${where}` : ''} RETURNING *`, values);
      } else if (operation === 'upsert' && table === 'wedding_photos') {
        result = await pool.query(`INSERT INTO public.wedding_photos (${Object.keys(validPayload).map((key) => `"${key}"`).join(', ')}) VALUES (${Object.keys(validPayload).map((_, index) => `$${index + 1}`).join(', ')}) ON CONFLICT (user_id, slot_number) DO UPDATE SET photo_url = EXCLUDED.photo_url, caption = EXCLUDED.caption RETURNING *`, Object.values(validPayload));
      } else {
        result = await pool.query(`INSERT INTO public."${table}" (${Object.keys(validPayload).map((key) => `"${key}"`).join(', ')}) VALUES (${Object.keys(validPayload).map((_, index) => `$${index + 1}`).join(', ')}) RETURNING *`, Object.values(validPayload));
      }
      json(response, 200, result.rows);
    } catch (error) {
      json(response, 500, { error: error.message });
    }
    return;
  }

  if (request.method === 'GET' && request.url.startsWith('/api/storage')) {
    try {
      const folder = new URL(request.url, `http://${request.headers.host || 'localhost'}`).searchParams.get('folder') || '';
      const directory = resolveUploadPath(folder, true);
      if (!directory) { json(response, 400, { error: 'Path folder tidak valid.' }); return; }
      const names = await fs.readdir(directory, { withFileTypes: true }).catch((error) => {
        if (error.code === 'ENOENT') return [];
        throw error;
      });
      json(response, 200, names.filter((entry) => entry.isFile()).map((entry) => ({ name: entry.name })));
    } catch (error) {
      json(response, 500, { error: error.message });
    }
    return;
  }

  if (request.method === 'POST' && request.url.startsWith('/api/storage/')) {
    try {
      if (!requireUser(request, response)) return;
      const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      const relativePath = requestUrl.searchParams.get('path');
      const contentType = request.headers['content-type'] || '';
      const target = resolveUploadPath(relativePath);
      if (!target || !/^(image\/|audio\/)/.test(contentType)) {
        json(response, 400, { error: 'File upload tidak valid.' });
        return;
      }
      const bytes = await readRequestBody(request, maxUploadSize);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, bytes);
      json(response, 201, { path: relativePath });
    } catch (error) {
      json(response, error?.statusCode || 500, { error: error.message });
    }
    return;
  }

  // =========================================================================
  // ENDPOINT 4: POST /api/resolve-maps -> Fitur Bawaan Resolver Google Maps Anda
  // =========================================================================
  if (request.method === 'POST' && request.url === '/api/resolve-maps') {
    try {
      if (!request.headers['content-type']?.startsWith('application/json')) {
        json(response, 415, { error: 'Content-Type harus application/json.' });
        return;
      }

      const { url } = await readJsonBody(request);

      if (typeof url !== 'string' || !isAllowedMapsUrl(url)) {
        json(response, 400, { error: 'Masukkan link Google Maps yang valid.' });
        return;
      }

      const resolvedUrl = await resolveMapsUrl(url);
      const coordinates = extractCoordinates(resolvedUrl);

      if (!coordinates) {
        json(response, 422, { error: 'Koordinat lokasi tidak ditemukan pada link Google Maps.' });
        return;
      }

      json(response, 200, {
        originalUrl: url,
        resolvedUrl,
        latitude: coordinates[1],
        longitude: coordinates[2],
        embedUrl: `https://www.google.com/maps?q=${coordinates[1]},${coordinates[2]}&z=17&output=embed`,
      });
    } catch (error) {
      json(response, error?.statusCode || 500, { error: error instanceof Error ? error.message : 'Gagal memproses link Google Maps.' });
    }
    return;
  }

  if (await serveStatic(request, response)) return;

  // Jika rute API tidak ditemukan
  json(response, 404, { error: 'Endpoint tidak ditemukan.' });
});

initializeAuthSchema()
  .then(async () => {
    await fs.mkdir(uploadsDirectory, { recursive: true });
    server.listen(port, () => {
      console.log(`Server API Wedding & Maps Resolver berjalan di port ${port}`);
    });
  })
  .catch((error) => {
    console.error('Gagal menyiapkan schema autentikasi:', error);
    process.exitCode = 1;
  });