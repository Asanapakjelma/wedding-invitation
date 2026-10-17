import React, { useState, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { DynamicGuest } from './components/DynamicGuest';
import { CountdownTimer } from './components/CountdownTimer';
import { BankAccountCard } from './components/BankAccountCard';
import { BackgroundMusic } from './components/BackgroundMusic';
import { RSVP } from './components/RSVP';
import { ScrollReveal } from './components/ScrollReveal';
import WaxSealButton from './components/WaxSealButton';
import { ProtectedRoute } from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import DashboardPage from './pages/DashboardPage';

import heroImage from './assets/hero-wedding.png';
import batikBg from './assets/hero-wedding.png';

interface InvitationPageProps {
  brideName: string;
  groomName: string;
  weddingDate: string;
  bcaWanita: string;
  bcaPria: string;
  waxColor: string;
  textColor: string;
  googleMapsUrl: string;
  backgroundUrl: string;
  musicUrl: string;
  owner?: string;
}

interface WeddingPhoto {
  slot_number: number;
  photo_url: string;
  caption?: string | null;
}

const getGoogleMapsEmbedUrl = (url: string) => {
  if (url.includes('/embed')) return url;

  const coordinates = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
    || url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);

  if (coordinates) {
    return `https://www.google.com/maps?q=${coordinates[1]},${coordinates[2]}&z=17&output=embed`;
  }

  return `https://www.google.com/maps?q=${encodeURIComponent(url)}&output=embed`;
};

// Komponen internal untuk menangani animasi fade-in per gambar secara halus
const GalleryImage: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="w-full h-full bg-stone-100 overflow-hidden relative">
      {/* Efek skeleton loading saat gambar belum siap */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-linear-to-r from-stone-100 via-stone-200 to-stone-100 animate-pulse" />
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setIsLoaded(true)}
        loading="lazy"
        className={`w-full h-full object-cover object-center transition-all duration-1000 ease-out transform group-hover:scale-103 ${
          isLoaded 
            ? 'opacity-100 blur-0 scale-100' 
            : 'opacity-0 blur-md scale-95'
        }`}
      />
    </div>
  );
};

export const InvitationPage: React.FC<InvitationPageProps> = ({ 
  brideName, 
  groomName,
  weddingDate,
  bcaWanita,
  bcaPria,
  waxColor,
  textColor,
  googleMapsUrl,
  backgroundUrl,
  musicUrl,
  owner
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [galleryPhotos, setGalleryPhotos] = useState<WeddingPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState<boolean>(true);

  // Perubahan Utama: Sinkronisasi data Galeri Foto lewat REST API Server lokal murni
  useEffect(() => {
    const fetchGalleryData = async () => {
      try {
        setLoadingPhotos(true);
        
        // Memanggil endpoint API lokal port 8787
        const response = await fetch(`/api/photos${owner ? `?owner=${encodeURIComponent(owner)}` : ''}`);
        if (!response.ok) throw new Error('Gagal memuat galeri dari API lokal.');
        
        const data = await response.json();
        if (data) setGalleryPhotos(data);
      } catch (err) {
        console.error("Gagal memuat galeri foto:", err);
      } finally {
        setLoadingPhotos(false);
      }
    };

    fetchGalleryData();
  }, [owner]);

  const handleOpenInvitation = () => {
    setIsOpen(true);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  return (
    <div 
      className={`min-h-screen bg-repeat bg-center bg-fixed text-[#3A3530] selection:bg-[#E6DFD3] pb-24 ${
        !isOpen ? 'h-screen overflow-hidden' : 'overflow-x-hidden'
      }`}
      style={{ 
        backgroundImage: `linear-gradient(to bottom, rgba(249, 246, 240, 0.68), rgba(249, 246, 240, 0.78)), url(${backgroundUrl || batikBg})` 
      }}
    >
      <BackgroundMusic musicUrl={musicUrl} />

      {/* ================= HALAMAN 1: HERO / COVER ================= */}
      {!isOpen ? (
        <header className="fixed inset-0 z-50 h-screen w-full flex flex-col justify-between items-center text-center px-4 py-12 overflow-hidden bg-[#F9F6F0]">
          <div 
            className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-100"
            style={{ backgroundImage: `linear-gradient(to bottom, rgba(249, 246, 240, 0.70), rgba(249, 246, 240, 0.90)), url(${backgroundUrl || heroImage})` }}
          ></div>
          
          <div className="absolute inset-0 bg-[radial-gradient(#2C2724_1px,transparent_1px)] bg-size-[24px_24px] opacity-5 pointer-events-none"></div>
          
          <div className="relative z-10 mt-4">
            <ScrollReveal delay={0.1}>
              <span className="text-[13px] uppercase tracking-[0.3em] text-[#5A524A] font-bold block">
                The Wedding Celebration Of
              </span>
            </ScrollReveal>
          </div>

          <div className="my-auto space-y-4 animate-fade-in relative z-10">
            <h1 className="text-5xl md:text-7xl font-light text-[#2C2724] tracking-wide font-serif drop-shadow-sm">
              {brideName} & {groomName}
            </h1>
            <div className="w-12 h-px bg-[#8C8275] mx-auto my-2"></div>
            <p className="text-sm tracking-[0.15em] text-[#4A433C] font-medium uppercase">
              {weddingDate ? new Date(weddingDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '31 DESEMBER 2027'}
            </p>
          </div>

          <div className="w-full max-w-sm relative z-10 flex flex-col items-center mb-6">
            <ScrollReveal delay={0.3}>
              <DynamicGuest />
              
              <div className="-mt-6 z-20 relative">
                <WaxSealButton 
                onClick={handleOpenInvitation} 
                waxColor={waxColor} 
                textColor={textColor} 
                text="Buka Undangan"
                />
              </div>

            </ScrollReveal>
          </div>
        </header>
      ) : (
        /* ================= HALAMAN 2: KONTEN INTERAKTIF UTAMA ================= */
        <div id="main-content" className="max-w-xl mx-auto px-4 space-y-24 pt-16 relative z-10 animate-fade-in">
          
          {/* SEKSI KUTIPAN */}
          <ScrollReveal>
            <section className="text-center py-4 space-y-4 max-w-md mx-auto">
              <p className="text-s leading-relaxed text-[#2C2724] font-semibold italic">
                "Dan di antara tanda-tanda (kebesaran)-Nya ialah Dia menciptakan pasangan-pasangan untukmu dari jenismu sendiri, agar kamu cenderung dan merasa tenteram kepadanya..."
              </p>
              <p className="text-[10px] uppercase tracking-widest text-[#5A524A] font-bold">— Ar-Rum: 21</p>
            </section>
          </ScrollReveal>

          {/* SEKSI HITUNG MUNDUR */}
          <ScrollReveal>
            <section className="text-center bg-white/85 backdrop-blur-md p-8 rounded-3xl border border-[#E6DFD3]/80 shadow-sm">
              <p className="font-serif italic text-[#5A524A] text-xs mb-3 tracking-wide font-medium">
                Menghitung Hari Bersama Menuju Hari Bahagia:
              </p>
              <CountdownTimer targetDate={weddingDate} />
            </section>
          </ScrollReveal>

          {/* SEKSI GALERI FOTO */}
          <ScrollReveal>
            <section className="text-center space-y-8 bg-white/80 backdrop-blur-md p-6 md:p-8 rounded-3xl border border-[#E6DFD3]/80 shadow-sm">
              <div>
                <h2 className="font-serif text-2xl text-[#2C2724] font-medium tracking-wide">Our Stories</h2>
                <div className="w-12 h-px bg-[#8C8275] mx-auto my-3"></div>
              </div>

              {loadingPhotos ? (
                <div className="flex justify-center items-center py-12">
                  <div className="w-5 h-5 border-2 border-[#5A524A] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : galleryPhotos.length === 0 ? (
                <p className="text-xs text-stone-400 italic py-8">Belum ada foto momen yang dibagikan.</p>
              ) : (
                <div className="space-y-8">
                  {galleryPhotos.map((photo, index) => (
                    <div 
                      key={photo.slot_number} 
                      className="overflow-hidden rounded-2xl border border-[#E6DFD3]/60 bg-white/50 shadow-sm group flex flex-col items-center p-3 animate-fade-in"
                      style={{ 
                        animationDelay: `${index * 150}ms` 
                      }}
                    >
                      <div className="w-full aspect-4/3 sm:aspect-video overflow-hidden relative rounded-xl shadow-inner">
                        <GalleryImage 
                          src={photo.photo_url} 
                          alt={`Momen Pernikahan Slot ${photo.slot_number}`} 
                        />
                        <div className="absolute inset-0 bg-stone-900/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      </div>

                      {photo.caption && (
                        <div className="w-full px-4 pt-4 pb-2 text-center">
                          <p className="font-serif italic text-sm text-[#4A433C] tracking-wide leading-relaxed max-w-md mx-auto">
                            "{photo.caption}"
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </ScrollReveal>

          {/* SEKSI DIGITAL GIFT */}
          <section className="space-y-6">
            <ScrollReveal>
              <div className="text-center max-w-sm mx-auto">
                <h2 className="font-serif text-2xl text-[#2C2724] font-medium">Digital Gift</h2>
                <div className="w-12 h-px bg-[#8C8275] mx-auto my-3"></div>
                <div className="space-y-3">
                  <BankAccountCard bankName="BANK BCA" accountNumber={bcaWanita} accountHolder={`Mempelai ${brideName}`} />
                  <BankAccountCard bankName="BANK BCA" accountNumber={bcaPria} accountHolder={`Mempelai ${groomName}`} />
                </div>
              </div>
            </ScrollReveal>
          </section>

          <section className="space-y-6">
            <ScrollReveal>
              <div className="text-center bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-[#E6DFD3]/80 shadow-sm space-y-4">
                <h2 className="font-serif text-2xl text-[#2C2724] font-medium">Lokasi Acara</h2>
                {googleMapsUrl ? (
                  <iframe
                    title="Lokasi acara"
                    src={getGoogleMapsEmbedUrl(googleMapsUrl)}
                    className="w-full aspect-video rounded-2xl border-0"
                    loading="lazy"
                  />
                ) : (
                  <p className="text-sm text-stone-500">Lokasi acara belum tersedia.</p>
                )}
              </div>
            </ScrollReveal>
          </section>

          <section>
            <ScrollReveal>
              <RSVP />
            </ScrollReveal>
          </section>
        </div>
      )}
    </div>
  );
};

const defaultSettings: InvitationPageProps = {
  brideName: 'Wanita',
  groomName: 'Pria',
  weddingDate: '',
  bcaWanita: '',
  bcaPria: '',
  waxColor: '#E3D5CA',
  textColor: '#6F4E37',
  googleMapsUrl: '',
  backgroundUrl: '',
  musicUrl: '',
  owner: '',
};

const App: React.FC = () => {
  const [settings, setSettings] = useState<InvitationPageProps>(defaultSettings);

  useEffect(() => {
    const owner = new URLSearchParams(window.location.search).get('owner') || '';
    fetch(`/api/settings${owner ? `?owner=${encodeURIComponent(owner)}` : ''}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Gagal memuat pengaturan.')))
      .then((data: Record<string, unknown>) => setSettings((current) => ({
        ...current,
        brideName: typeof data.bride_name === 'string' ? data.bride_name : current.brideName,
        groomName: typeof data.groom_name === 'string' ? data.groom_name : current.groomName,
        weddingDate: typeof data.wedding_date === 'string' ? data.wedding_date : current.weddingDate,
        bcaWanita: typeof data.bca_wanita === 'string' ? data.bca_wanita : current.bcaWanita,
        bcaPria: typeof data.bca_pria === 'string' ? data.bca_pria : current.bcaPria,
        waxColor: typeof data.wax_color === 'string' ? data.wax_color : current.waxColor,
        textColor: typeof data.text_color === 'string' ? data.text_color : current.textColor,
        googleMapsUrl: typeof data.google_maps_url === 'string' ? data.google_maps_url : current.googleMapsUrl,
        backgroundUrl: typeof data.background_url === 'string' ? data.background_url : current.backgroundUrl,
        musicUrl: typeof data.music_url === 'string' ? data.music_url : current.musicUrl,
        owner,
      })))
      .catch((error: unknown) => console.error(error));
  }, []);

  const updateSetting = (key: keyof InvitationPageProps) => (value: string) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/admin" element={<DashboardPage
          {...settings}
          setBrideName={updateSetting('brideName')}
          setGroomName={updateSetting('groomName')}
          setWeddingDate={updateSetting('weddingDate')}
          setBcaWanita={updateSetting('bcaWanita')}
          setBcaPria={updateSetting('bcaPria')}
          setWaxColor={updateSetting('waxColor')}
          setTextColor={updateSetting('textColor')}
          setGoogleMapsUrl={updateSetting('googleMapsUrl')}
          setBackgroundUrl={updateSetting('backgroundUrl')}
          setMusicUrl={updateSetting('musicUrl')}
        />} />
      </Route>
      <Route path="/invitation" element={<InvitationPage {...settings} owner={new URLSearchParams(window.location.search).get('owner') || settings.owner} />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default App;