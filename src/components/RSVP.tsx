import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

interface RsvpData {
  id: string;
  guest_name: string;
  attendance_status: string;
  total_guest: number;
  wishes: string;
  created_at: string;
}

export const RSVP: React.FC = () => {
  const location = useLocation();
  
  const [urlGuestName, setUrlGuestName] = useState<string>('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('Hadir');
  const [total, setTotal] = useState(1);
  const [wishes, setWishes] = useState('');
  const [responses, setResponses] = useState<RsvpData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRsvpResponses();
    
    // Membaca parameter "?to=" dari URL secara ketat
    const searchParams = new URLSearchParams(location.search);
    const guestParam = searchParams.get('to');
    
    if (guestParam) {
      const decodedName = decodeURIComponent(guestParam).trim();
      setUrlGuestName(decodedName);
      setName(decodedName); // Paksa input teks menggunakan nama tamu dari URL
    } else {
      setUrlGuestName('');
      setName('');
    }
  }, [location.search]);

  const fetchRsvpResponses = async () => {
    const { data, error } = await supabase
      .from('rsvp_responses')
      .select('*')
      .order('created_at', { ascending: false });

    if (data && !error) setResponses(data);
  };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const finalGuestName = urlGuestName.trim() || name.trim();

      // TAMBAHAN VALIDASI BLOCK LIST:
      if (finalGuestName.toLowerCase() === 'tamu uji coba') {
        alert('Fitur RSVP berjalan normal! Teks "Tamu Uji Coba" diblokir oleh sistem agar tidak mengotori database katering pernikahan.');
        return;
      }

      setLoading(true);

      try {
        const { error } = await supabase
          .from('rsvp_responses')
          .insert([
            {
              guest_name: finalGuestName, 
              attendance_status: status,
              total_guest: status === 'Hadir' ? total : 0,
              wishes: wishes.trim()
            }
          ]);

        if (error) throw error;

        setWishes('');
        setTotal(1);
      
        if (!urlGuestName) {
          setName('');
        }

        await fetchRsvpResponses(); 
        alert(`✓ Terima kasih ${finalGuestName}, konfirmasi & ucapan Anda berhasil terkirim!`);
      } catch (err: any) {
        alert('Gagal mengirim RSVP: ' + err.message);
      } finally {
        setLoading(false);
      }
  };


  return (
    <div className="space-y-8 text-stone-800">
      {/* KARTU FORM INPUT RSVP */}
      <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-[#E6DFD3]/80 shadow-sm text-left space-y-4">
        <div className="text-center">
          <h3 className="font-serif text-xl font-medium text-[#2C2724]">Konfirmasi Kehadiran</h3>
          <div className="w-8 h-px bg-[#8C8275] mx-auto my-1"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-stone-600">Nama Tamu</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Contoh: Budi Sudarsono" 
              className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none disabled:opacity-75 disabled:bg-stone-100/80 font-medium" 
              disabled={!!urlGuestName} // Kunci input jika nama tamu sudah terdeteksi dari link WA (?to=...)
              required 
            />
            {urlGuestName && (
              <p className="text-[10px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
                <span>✓ Terverifikasi untuk:</span> 
                <span className="font-bold underline">{urlGuestName}</span>
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-stone-600">Apakah Anda Akan Hadir?</label>
            <select 
              value={status} 
              onChange={(e) => setStatus(e.target.value)} 
              className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none cursor-pointer"
            >
              <option value="Hadir">Ya, Saya Akan Hadir</option>
              <option value="Tidak Hadir">Maaf, Saya Tidak Bisa Hadir</option>
            </select>
          </div>

          {status === 'Hadir' && (
            <div className="space-y-1 animate-fade-in">
              <label className="font-semibold text-stone-600">Jumlah Tamu yang Hadir</label>
              <input 
                type="number" 
                min="1" 
                max="5" 
                value={total} 
                onChange={(e) => setTotal(parseInt(e.target.value) || 1)} 
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none font-mono" 
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="font-semibold text-stone-600">Doa & Ucapan Hangat</label>
            <textarea 
              rows={3} 
              value={wishes} 
              onChange={(e) => setWishes(e.target.value)} 
              placeholder="Tuliskan ucapan selamat dan doa restu Anda di sini..." 
              className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none resize-none leading-relaxed" 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full py-3 bg-[#6F4E37] hover:bg-[#5a3f2b] text-white text-xs uppercase font-bold tracking-wider rounded-xl transition-all duration-200 disabled:opacity-50 shadow-sm"
          >
            {loading ? 'Mengirim Konfirmasi...' : 'Kirim RSVP & Ucapan'}
          </button>
        </form>
      </div>

      {/* KARTU BALON UCAPAN (GUEST BOOK LIST) */}
      <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-[#E6DFD3]/80 shadow-sm text-left space-y-4">
        <h4 className="font-serif text-sm font-bold text-[#2C2724] border-b pb-2 flex justify-between items-center">
          <span>Doa Restu Tamu Undangan</span>
          <span className="bg-stone-100 text-[10px] font-sans px-2 py-0.5 rounded-full text-stone-500 font-normal">
            {responses.length} Ucapan
          </span>
        </h4>

        <div className="max-h-64 overflow-y-auto space-y-3 pr-1 divide-y divide-stone-100 scrollbar-thin">
          {responses.length === 0 ? (
            <p className="text-stone-400 italic text-center py-6 text-xs">Belum ada ucapan. Jadilah yang pertama memberikan doa!</p>
          ) : (
            responses.map((item) => (
              <div key={item.id} className="pt-3 first:pt-0 space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-stone-800">{item.guest_name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                    item.attendance_status === 'Hadir' 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                      : 'bg-red-50 text-red-600 border border-red-100'
                  }`}>
                    {item.attendance_status === 'Hadir' ? `👍 Hadir (${item.total_guest} orang)` : '❌ Absen'}
                  </span>
                </div>
                <p className="text-stone-600 leading-relaxed italic bg-stone-50/50 p-2.5 rounded-xl border border-stone-100 mt-1">
                  "{item.wishes || 'Selamat menempuh hidup baru!'}"
                </p>
                <p className="text-[9px] text-stone-400 text-right pt-0.5">
                  {new Date(item.created_at).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};