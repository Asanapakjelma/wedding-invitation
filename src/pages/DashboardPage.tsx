import React, { useState, useEffect, useCallback } from 'react';
import { isTestGuest, mapsResolverUrl, RSVP_RESET_AT, localApi, resetRsvps } from '../lib/localApi';
import { useNavigate } from 'react-router-dom';

interface DashboardPageProps {
  brideName: string; setBrideName: (name: string) => void;
  groomName: string; setGroomName: (name: string) => void;
  weddingDate: string; setWeddingDate: (date: string) => void;
  bcaWanita: string; setBcaWanita: (num: string) => void;
  bcaPria: string; setBcaPria: (num: string) => void;
  waxColor: string; setWaxColor: (color: string) => void;
  textColor: string; setTextColor: (color: string) => void;
  googleMapsUrl: string; setGoogleMapsUrl: (url: string) => void;
  backgroundUrl: string; setBackgroundUrl: (url: string) => void;
  musicUrl: string; setMusicUrl: (url: string) => void;
}

interface GuestItem {
  id: string;
  name: string;
  link: string;
}

interface WeddingPhoto {
  slot_number: number;
  photo_url: string;
  caption?: string;
}

interface DashboardRsvp {
  id: string;
  guest_name: string;
  attendance_status: string;
  total_guest: number;
  wishes: string;
  created_at: string;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  brideName, setBrideName,
  groomName, setGroomName,
  weddingDate, setWeddingDate,
  bcaWanita, setBcaWanita,
  bcaPria, setBcaPria,
  waxColor, setWaxColor,
  textColor, setTextColor,
  googleMapsUrl, setGoogleMapsUrl,
  backgroundUrl, setBackgroundUrl,
  musicUrl, setMusicUrl
}) => {
  const navigate = useNavigate();

  // State internal untuk generator nama tamu, unggah media, dan galeri "Our Moments"
  const [guestName, setGuestName] = useState<string>('');
  const [submittedGuestName, setSubmittedGuestName] = useState<string>(''); 
  const [generatedLink, setGeneratedLink] = useState<string>('');
  const [copiedIndex, setCopiedIndex] = useState<string | number | null>(null);
  const [baseUrl] = useState<string>(() => window.location.origin);
  const [guestList, setGuestList] = useState<GuestItem[]>([]);
  const [saveLoading, setSaveLoading] = useState<boolean>(false);
  const [mediaLoading, setMediaLoading] = useState<'background' | 'music' | null>(null);
  
  // State baru berbasis Map Objek untuk melacak foto per Slot (Key: slot_number)
  const [photos, setPhotos] = useState<Record<number, WeddingPhoto>>({});
  const [loadingSlot, setLoadingSlot] = useState<number | null>(null);
  const TOTAL_SLOTS = 6; // Jumlah slot foto mandiri yang disediakan

  // TAMBAHAN: State untuk menampung data kalkulasi statistik buku tamu (RSVP)
  const [stats, setStats] = useState({ hadir: 0, absen: 0, totalTamu: 0 });
  const [rsvpResponses, setRsvpResponses] = useState<DashboardRsvp[]>([]);
  const [userId, setUserId] = useState('');

  const calculateRsvpStats = useCallback(async () => {
    try {
      if (!userId) return;
      const response = await fetch(`/api/rsvp?owner=${encodeURIComponent(userId)}`);
      if (!response.ok) throw new Error('Gagal memuat RSVP.');
      const data = await response.json() as DashboardRsvp[];
      const visibleResponses = data.filter((row) =>
        new Date(row.created_at) >= RSVP_RESET_AT && !isTestGuest(row.guest_name)
      );
      setRsvpResponses(visibleResponses);
      let hadirCount = 0;
      let absenCount = 0;
      let totalOrang = 0;
      visibleResponses.forEach((row) => {
        if (row.attendance_status === 'Hadir') {
          hadirCount++;
          totalOrang += row.total_guest || 1;
        } else {
          absenCount++;
        }
      });
      setStats({ hadir: hadirCount, absen: absenCount, totalTamu: totalOrang });
    } catch (err) {
      console.error('Gagal mengalkulasi data statistik RSVP:', err);
    }
  }, [userId]);

  const handleResetRsvps = async () => {
    if (!userId || !window.confirm('Hapus semua RSVP dan doa restu dari akun ini?')) return;
    try {
      await resetRsvps(userId);
      setRsvpResponses([]);
      setStats({ hadir: 0, absen: 0, totalTamu: 0 });
      alert('Semua RSVP dan doa restu sudah direset ke nol.');
    } catch (error) {
      alert('Gagal mereset RSVP: ' + (error instanceof Error ? error.message : 'Terjadi kesalahan.'));
    }
  };

  // Ambil daftar foto "Our Moments" dan statistik RSVP saat komponen pertama kali dimuat
  useEffect(() => {
    void localApi.auth.getSession().then(({ data }) => setUserId(data.session?.user.id || ''));
    fetchOurMomentsPhotos();
  }, []);

  useEffect(() => {
    if (!userId) return;
    void Promise.resolve().then(() => calculateRsvpStats());
    fetch(`/api/settings?owner=${encodeURIComponent(userId)}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Gagal memuat settings user.')))
      .then((data: Record<string, unknown>) => {
        if (typeof data.bride_name === 'string') setBrideName(data.bride_name);
        if (typeof data.groom_name === 'string') setGroomName(data.groom_name);
        if (typeof data.wedding_date === 'string') setWeddingDate(data.wedding_date);
        if (typeof data.bca_wanita === 'string') setBcaWanita(data.bca_wanita);
        if (typeof data.bca_pria === 'string') setBcaPria(data.bca_pria);
        if (typeof data.wax_color === 'string') setWaxColor(data.wax_color);
        if (typeof data.text_color === 'string') setTextColor(data.text_color);
        if (typeof data.google_maps_url === 'string') setGoogleMapsUrl(data.google_maps_url);
        if (typeof data.background_url === 'string') setBackgroundUrl(data.background_url);
        if (typeof data.music_url === 'string') setMusicUrl(data.music_url);
      })
      .catch((error: unknown) => console.error(error));
  }, [userId, calculateRsvpStats, setBrideName, setGroomName, setWeddingDate, setBcaWanita, setBcaPria, setWaxColor, setTextColor, setGoogleMapsUrl, setBackgroundUrl, setMusicUrl]);

  async function fetchOurMomentsPhotos() {
    try {
      const { data, error } = await localApi.from<WeddingPhoto[]>('wedding_photos')
        .select('slot_number, photo_url, caption');

      if (error) throw error;

      if (data) {
        const photoMap = data.reduce((acc, curr) => {
          acc[curr.slot_number] = curr;
          return acc;
        }, {} as Record<number, WeddingPhoto>);
        setPhotos(photoMap);
      }
    } catch (err) {
      console.error('Gagal mengambil data foto dari database:', err);
    }
  }

  // Fungsi simpan data konfigurasi teks dan warna tema ke database
  const handleSaveAllSettings = async () => {
    setSaveLoading(true);
    try {
      const normalizedGoogleMapsUrl = googleMapsUrl.trim();
      let resolvedGoogleMapsUrl = normalizedGoogleMapsUrl;

      if (normalizedGoogleMapsUrl) {
        const resolverResponse = await fetch(mapsResolverUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: normalizedGoogleMapsUrl }),
        });
        const resolverResult = await resolverResponse.json();

        if (!resolverResponse.ok) {
          throw new Error(resolverResult.error || 'Link Google Maps tidak dapat diproses.');
        }

        resolvedGoogleMapsUrl = resolverResult.resolvedUrl;
        setGoogleMapsUrl(resolvedGoogleMapsUrl);
      }

      const { error } = await localApi
        .from('wedding_settings')
        .update({
          bride_name: brideName,
          groom_name: groomName,
          wedding_date: weddingDate,
          bca_wanita: bcaWanita,
          bca_pria: bcaPria,
          wax_color: waxColor,
          text_color: textColor,
          google_maps_url: resolvedGoogleMapsUrl,
          background_url: backgroundUrl,
          music_url: musicUrl
        })
        .eq('user_id', userId);

      if (error) throw error;
      alert('✓ Selamat! Seluruh konfigurasi tema telah tersimpan permanen di basis data pusat cloud.');
    } catch (error) {
      alert('Gagal menyimpan data: ' + (error instanceof Error ? error.message : 'Terjadi kesalahan.'));
    } finally {
      setSaveLoading(false);
    }
  };

  const handleUploadMedia = async (type: 'background' | 'music', event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isBackground = type === 'background';
    const validType = isBackground ? file.type.startsWith('image/') : file.type.startsWith('audio/');
    const maxSize = isBackground ? 5 * 1024 * 1024 : 15 * 1024 * 1024;

    if (!validType) {
      alert(isBackground ? 'File harus berupa gambar.' : 'File harus berupa audio.');
      event.target.value = '';
      return;
    }
    if (file.size > maxSize) {
      alert(`Ukuran file terlalu besar. Maksimal ${isBackground ? '5 MB' : '15 MB'}.`);
      event.target.value = '';
      return;
    }

    setMediaLoading(type);
    try {
      if (!userId) throw new Error('Sesi user belum siap. Muat ulang halaman.');
      const filePath = isBackground ? `users/${userId}/background/background.jpg` : `users/${userId}/music.mp3`;
      const { error: uploadError } = await localApi.storage
        .from('wedding-gallery')
        .upload(filePath, file, { cacheControl: '0', upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data } = localApi.storage.from('wedding-gallery').getPublicUrl(filePath);
      const mediaUrl = `${data.publicUrl}?v=${Date.now()}`;
      const { error: settingsError } = await localApi
        .from('wedding_settings')
        .update(isBackground ? { background_url: mediaUrl } : { music_url: mediaUrl })
        .eq('user_id', userId);
      if (settingsError) throw settingsError;

      if (isBackground) setBackgroundUrl(mediaUrl);
      else setMusicUrl(mediaUrl);
      alert(`✓ ${isBackground ? 'Background' : 'Lagu'} berhasil diunggah dan diterapkan.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan.';
      alert(message.includes('row-level security policy')
        ? 'Gagal mengunggah file: izin penyimpanan lokal belum tersedia.'
        : 'Gagal mengunggah file: ' + message);
    } finally {
      setMediaLoading(null);
      event.target.value = '';
    }
  };

  const handleRemoveMedia = async (type: 'background' | 'music') => {
    try {
      const field = type === 'background' ? 'background_url' : 'music_url';
      const { error } = await localApi
        .from('wedding_settings')
        .update({ [field]: null })
        .eq('user_id', userId);
      if (error) throw error;

      if (type === 'background') setBackgroundUrl('');
      else setMusicUrl('');
    } catch (error) {
      alert('Gagal menghapus media: ' + (error instanceof Error ? error.message : 'Terjadi kesalahan.'));
    }
  };

  // Fungsi Unggah Foto berbasis Slot Individual + Validasi Gambar & Ukuran 2MB
  const handleUploadPhotoSlot = async (slotNumber: number, e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];

      // Validasi Ukuran File Maksimal 2MB
      const maxFileSize = 2 * 1024 * 1024; 
      if (file.size > maxFileSize) {
        alert('❌ Ukuran file terlalu besar! Maksimal file yang bisa di-upload hanya 2 MB.');
        e.target.value = ''; 
        return;
      }

      if (!file.type.startsWith('image/')) {
        alert('❌ File harus berupa format gambar! (.jpg, .jpeg, .png, .webp)');
        e.target.value = '';
        return;
      }

      setLoadingSlot(slotNumber);

      // Mulai Proses Unggah ke Bucket Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `slot_${slotNumber}_${Date.now()}.${fileExt}`;
      const filePath = `gallery/${fileName}`;

      const { error: uploadError } = await localApi.storage
        .from('wedding-gallery')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      // Dapatkan URL Publik File Gambar dari Storage
      const { data: { publicUrl } } = localApi.storage
        .from('wedding-gallery')
        .getPublicUrl(filePath);

      // Simpan data tautan menggunakan upsert
      const { error: dbError } = await localApi
        .from('wedding_photos')
        .upsert({
          slot_number: slotNumber,
          photo_url: publicUrl,
          caption: photos[slotNumber]?.caption || ''
        }, { onConflict: 'slot_number' });

      if (dbError) throw dbError;

      await fetchOurMomentsPhotos(); 
      e.target.value = ''; 
    } catch (error: unknown) {
      alert('Terjadi kesalahan sistem: ' + (error instanceof Error ? error.message : 'Terjadi kesalahan.'));
    } finally {
      setLoadingSlot(null);
    }
  };

  // Fungsi menghapus foto dari slot tertentu secara permanen
  const handleDeletePhotoSlot = async (slotNumber: number) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus foto di Slot ${slotNumber}?`)) return;
    
    try {
      const { error } = await localApi
        .from('wedding_photos')
        .delete()
        .eq('slot_number', slotNumber);

      if (error) throw error;

      const updatedPhotos = { ...photos };
      delete updatedPhotos[slotNumber];
      setPhotos(updatedPhotos);
      
      alert(`✓ Foto pada slot ${slotNumber} berhasil dihapus.`);
    } catch (error: unknown) {
      alert('Gagal menghapus foto: ' + (error instanceof Error ? error.message : 'Terjadi kesalahan.'));
    }
  };

  const handleLogout = async () => {
    await localApi.auth.signOut();
    navigate('/');
  };

  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    const session = userId ? null : await localApi.auth.getSession();
    const activeUserId = userId || session?.data.session?.user.id || '';
    if (!activeUserId) {
      alert('Sesi akun belum siap. Silakan tunggu sebentar lalu coba lagi.');
      return;
    }
    setSubmittedGuestName(guestName.trim());
    const encodedName = encodeURIComponent(guestName.trim());
    setUserId(activeUserId);
    const invitationUrl = `${baseUrl}/invitation?to=${encodedName}&owner=${encodeURIComponent(activeUserId)}`;
    setGeneratedLink(invitationUrl);

    const newGuest: GuestItem = { id: Date.now().toString(), name: guestName.trim(), link: invitationUrl };
    setGuestList([newGuest, ...guestList]);
    setGuestName(''); 
  };

  const handleCopyText = (name: string, link: string, idOrIndex: string | number) => {
    const templateTeks = `Halo *${name}*,\n\nTanpa mengurangi rasa hormat, perkenankan kami mengundang Anda untuk menghadiri acara pernikahan kami.\n\nDetail undangan dapat diakses melalui tautan digital berikut:\n${link}\n\nMerupakan suatu kebahagiaan bagi kami apabila Anda berkenan hadir. Terima kasih.`;
    navigator.clipboard.writeText(templateTeks).then(() => {
      setCopiedIndex(idOrIndex);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-8 font-sans text-stone-800">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* HEADER BAR PANEL */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl border border-stone-200 shadow-sm gap-4">
          <div>
            <h1 className="font-serif text-2xl font-bold text-stone-900">Halaman Edit Undangan Pernikahan</h1>
            <p className="text-xs text-stone-400 mt-1">Kelola konten wedding invitation Anda disini.</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={() => navigate(`/invitation?to=Tamu%20Uji%20Coba&owner=${encodeURIComponent(userId)}`)} disabled={!userId} className="flex-1 sm:flex-none px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Lihat Hasil</button>
            <button onClick={handleLogout} className="flex-1 sm:flex-none px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors">Keluar</button>
          </div>
        </div>

        {/* TAMBAHAN VISUAL: PANEL STATISTIK RSVP BUKU TAMU REAL-TIME */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm text-center space-y-1">
            <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block">Konfirmasi Hadir</span>
            <p className="text-2xl font-bold text-emerald-600">{stats.hadir} <span className="text-xs font-normal text-stone-400">Rombongan</span></p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm text-center space-y-1">
            <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block">Total Pax Katering</span>
            <p className="text-2xl font-bold text-indigo-600">{stats.totalTamu} <span className="text-xs font-normal text-stone-400">Orang</span></p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm text-center space-y-1">
            <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block">Tidak Bisa Hadir</span>
            <p className="text-2xl font-bold text-red-500">{stats.absen} <span className="text-xs font-normal text-stone-400">Undangan</span></p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3 border-b pb-2">
            <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest">RSVP & Doa Restu Tamu</h2>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => void calculateRsvpStats()} className="text-[10px] font-bold uppercase tracking-wider text-[#6F4E37] hover:text-[#5a3f2b]">Muat ulang</button>
              <button type="button" onClick={() => void handleResetRsvps()} disabled={!userId} className="text-[10px] font-bold uppercase tracking-wider text-red-500 hover:text-red-700 disabled:opacity-50">Reset RSVP</button>
            </div>
          </div>
          {rsvpResponses.length === 0 ? (
            <p className="text-xs text-stone-400 italic">Belum ada konfirmasi dari tamu undangan.</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {rsvpResponses.map((response) => (
                <div key={response.id} className="border-b border-stone-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-stone-800">{response.guest_name}</span>
                    <span className={`text-[10px] font-bold ${response.attendance_status === 'Hadir' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {response.attendance_status === 'Hadir' ? `Hadir (${response.total_guest} orang)` : 'Tidak hadir'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 italic mt-1">{response.wishes || 'Tidak ada ucapan.'}</p>
                  <p className="text-[10px] text-stone-400 mt-1">{new Date(response.created_at).toLocaleString('id-ID')}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* LAYOUT KONTROL GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            
            {/* FORM DATA MEMPELAI */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest border-b pb-2">Informasi Mempelai</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600">Nama Panggilan Wanita</label>
                  <input type="text" value={brideName} onChange={(e) => setBrideName(e.target.value)} className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600">Nama Panggilan Pria</label>
                  <input type="text" value={groomName} onChange={(e) => setGroomName(e.target.value)} className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none" />
                </div>
              </div>
              <div className="space-y-1 pt-2">
                <label className="text-xs font-medium text-stone-600">Tanggal & Waktu Acara</label>
                <input type="datetime-local" value={weddingDate.substring(0, 16)} onChange={(e) => setWeddingDate(e.target.value)} className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none" />
              </div>
            </div>

            {/* DATA DIGITAL GIFT */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest border-b pb-2">Rekening Digital Gift (BCA)</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600">No. Rekening Wanita</label>
                  <input type="text" value={bcaWanita} onChange={(e) => setBcaWanita(e.target.value)} className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-mono focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600">No. Rekening Pria</label>
                  <input type="text" value={bcaPria} onChange={(e) => setBcaPria(e.target.value)} className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-mono focus:outline-none" />
                </div>
              </div>
            </div>

            {/* BACKGROUND MUSIC */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              <div>
                <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest border-b pb-2">Background Music Invitation</h2>
                <p className="text-[11px] text-stone-400 mt-1">Upload atau hapus lagu yang diputar pada invitation.</p>
              </div>
              {musicUrl && <audio controls src={musicUrl} className="w-full" />}
              <div className="flex gap-2">
                <label className="flex-1 text-center px-4 py-2.5 bg-stone-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer hover:bg-stone-700 transition-colors">
                  {mediaLoading === 'music' ? 'Mengunggah...' : 'Upload Lagu'}
                  <input type="file" accept="audio/*" className="hidden" onChange={(event) => handleUploadMedia('music', event)} disabled={mediaLoading !== null} />
                </label>
                {musicUrl && <button type="button" onClick={() => handleRemoveMedia('music')} className="px-4 py-2.5 bg-red-50 text-red-600 border border-red-100 text-xs font-bold rounded-xl">Hapus</button>}
              </div>
            </div>

            {/* INTEGRASI GANTI FOTO SATU PERSATU DENGAN CAPTION INPUT MANDIRI */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              <div>
                <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest border-b pb-2">Our Moments - Photo Gallery Manager</h2>
                <p className="text-[11px] text-stone-400 mt-1">Unggah foto dan ketik caption mandiri untuk setiap slot foto di bawah ini.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                {Array.from({ length: TOTAL_SLOTS }, (_, i) => i + 1).map((slotNumber) => {
                  const photo = photos[slotNumber];
                  
                  return (
                    <div key={slotNumber} className="border border-stone-200 rounded-xl p-3 flex flex-col justify-between bg-stone-50/50 shadow-sm">
                      <div className="w-full flex flex-col items-center">
                        <span className="text-[10px] font-bold text-stone-400 uppercase mb-2">Slot Foto {slotNumber}</span>
                        
                        {photo ? (
                          <div className="w-full flex flex-col">
                            <img 
                              src={photo.photo_url} 
                              alt={`Momen Slot ${slotNumber}`} 
                              className="w-full h-24 object-cover rounded-lg border border-stone-100 mb-2"
                            />
                            
                            <input 
                              type="text"
                              value={photo.caption || ''}
                              placeholder="Ketik caption foto..."
                              onChange={(e) => {
                                const newText = e.target.value;
                                setPhotos(prev => ({
                                  ...prev,
                                  [slotNumber]: { ...prev[slotNumber], caption: newText }
                                }));
                              }}
                              onBlur={async (e) => {
                                try {
                                  await localApi
                                    .from('wedding_photos')
                                    .update({ caption: e.target.value })
                                    .eq('slot_number', slotNumber);
                                } catch (err) {
                                  console.error("Gagal menyimpan caption:", err);
                                }
                              }}
                              className="w-full px-2 py-1 mb-2 bg-white border border-stone-200 rounded-md text-[11px] focus:outline-none focus:border-stone-400 transition-colors"
                            />

                            <div className="flex gap-1">
                              <label className="flex-1 text-center bg-stone-800 text-white text-[10px] font-bold py-1.5 px-2 rounded-md cursor-pointer hover:bg-stone-700 transition">
                                Ganti
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={(e) => handleUploadPhotoSlot(slotNumber, e)}
                                  disabled={loadingSlot !== null}
                                />
                              </label>
                              <button 
                                type="button"
                                onClick={() => handleDeletePhotoSlot(slotNumber)}
                                className="bg-red-50 text-red-600 border border-red-100 text-[10px] font-bold py-1.5 px-2 rounded-md hover:bg-red-100 transition"
                              >
                                Hapus
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label className="w-full h-32 border-2 border-dashed border-stone-300 rounded-lg flex flex-col justify-center items-center cursor-pointer hover:border-stone-500 hover:bg-white transition bg-white/70">
                            {loadingSlot === slotNumber ? (
                              <span className="text-[10px] text-amber-600 font-medium animate-pulse">Uploading...</span>
                            ) : (
                              <>
                                <span className="text-xl text-stone-400">+</span>
                                <span className="text-[10px] text-stone-500 mt-0.5">Upload</span>
                              </>
                            )}
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={(e) => handleUploadPhotoSlot(slotNumber, e)}
                              disabled={loadingSlot !== null}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* GOOGLE MAPS LOCATION */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              <div>
                <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest border-b pb-2">Lokasi Acara - Google Maps</h2>
                <p className="text-[11px] text-stone-400 mt-1">Tambahkan link lokasi Google Maps agar tamu dapat menemukan tempat acara dengan mudah.</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-600">Link Google Maps</label>
                <input
                  type="url"
                  value={googleMapsUrl}
                  onChange={(e) => setGoogleMapsUrl(e.target.value)}
                  placeholder="https://maps.google.com/..."
                  className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none"
                />
              </div>
              {googleMapsUrl && (
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors"
                >
                  Buka Link Google Maps
                </a>
              )}
            </div>

            {/* WA LINK GENERATOR */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest border-b pb-2">WhatsApp Link Guest Generator</h2>
              <form onSubmit={handleGenerateLink} className="flex gap-2">
                <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Ketik Nama Tamu" className="flex-1 px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none" />
                <button type="submit" className="px-4 py-2 bg-stone-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-stone-700 transition-colors">Buat Link</button>
              </form>

              {generatedLink && (
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3 animate-fade-in">
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Hasil Tautan Untuk {submittedGuestName}:</p>
                    <p className="text-xs font-mono text-stone-600 break-all bg-white p-2 rounded-lg border border-stone-100 mt-1 select-all">{generatedLink}</p>
                  </div>
                  <div className="text-right">
                    <button type="button" onClick={() => handleCopyText(submittedGuestName, generatedLink, 'latest')} className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${copiedIndex === 'latest' ? 'bg-emerald-500 text-white' : 'bg-[#6F4E37] text-white hover:bg-[#5a3f2b]'}`}>{copiedIndex === 'latest' ? '✓ Berhasil Disalin!' : '📋 Salin Pesan WA'}</button>
                  </div>
                </div>
              )}

              {/* Tabel Riwayat Histori */}
              {guestList.length > 0 && (
                <div className="pt-4 border-t border-stone-100 space-y-2">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Riwayat Tautan Tamu ({guestList.length}):</p>
                  <div className="max-h-40 overflow-y-auto border border-stone-100 rounded-xl divide-y divide-stone-100 shadow-inner bg-stone-50/30">
                    {guestList.map((guest) => (
                      <div key={guest.id} className="flex justify-between items-center p-3 bg-white hover:bg-stone-50/50 transition-colors gap-4">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-stone-800 truncate">{guest.name}</p>
                          <p className="text-[10px] font-mono text-stone-400 truncate mt-0.5">{guest.link}</p>
                        </div>
                        <button type="button" onClick={() => handleCopyText(guest.name, guest.link, guest.id)} className={`shrink-0 px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${copiedIndex === guest.id ? 'bg-emerald-500 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{copiedIndex === guest.id ? 'Tersalin' : 'Salin'}</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="pt-4">
              <button 
                type="button"
                onClick={handleSaveAllSettings} 
                disabled={saveLoading} 
                className="w-full py-3.5 bg-[#6F4E37] hover:bg-[#5a3f2b] active:scale-[0.98] text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saveLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Menyelaraskan Basis Data...</span>
                  </>
                ) : (
                  <span>Simpan Seluruh Pengaturan</span>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {/* BACKGROUND INVITATION */}
            <div className="self-start h-fit bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
            <div>
              <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest border-b pb-2">Background Invitation</h2>
              <p className="text-[11px] text-stone-400 mt-1">Upload atau hapus gambar background invitation.</p>
            </div>
            {backgroundUrl && <img src={backgroundUrl} alt="Preview background invitation" className="w-full h-28 object-cover rounded-xl border border-stone-200" />}
            <div className="flex gap-2">
              <label className="flex-1 text-center px-4 py-2.5 bg-stone-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer hover:bg-stone-700 transition-colors">
                {mediaLoading === 'background' ? 'Mengunggah...' : 'Upload Gambar'}
                <input type="file" accept="image/*" className="hidden" onChange={(event) => handleUploadMedia('background', event)} disabled={mediaLoading !== null} />
              </label>
              {backgroundUrl && <button type="button" onClick={() => handleRemoveMedia('background')} className="px-4 py-2.5 bg-red-50 text-red-600 border border-red-100 text-xs font-bold rounded-xl">Hapus</button>}
            </div>
            </div>

            {/* KUSTOMISASI WARNA STEMPEL */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest border-b pb-2">Kustomisasi Warna Tombol</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-stone-600">Warna Dasar Lilin</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-stone-400">{waxColor}</span>
                    <input type="color" value={waxColor} onChange={(e) => setWaxColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 overflow-hidden shadow-sm" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-stone-600">Warna Tulisan Stempel</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-stone-400">{textColor}</span>
                    <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 overflow-hidden shadow-sm" />
                  </div>
                </div>
              </div>
              <div className="mt-4 p-4 bg-stone-50 rounded-xl border border-dashed border-stone-200 text-center">
                <p className="text-[10px] text-stone-400 uppercase font-bold tracking-wider mb-3">Live Preview Tombol</p>
                <div style={{ backgroundColor: waxColor, color: textColor }} className="w-24 h-24 mx-auto rounded-full flex items-center justify-center font-serif text-[10px] font-bold uppercase tracking-wider shadow-md select-none transition-all duration-300">Buka</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardPage;