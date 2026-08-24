import React, { useState, useEffect, useRef } from 'react';
import weddingSong from '../assets/wedding-music.mp3'; // Pastikan file mp3 sudah ditaruh di folder assets

export const BackgroundMusic: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  useEffect(() => {
    audioRef.current = new Audio(weddingSong);
    audioRef.current.loop = true;

    // Browser melarang auto-play instan, musik akan memicu otomatis saat layar pertama kali diklik/disentuh tamu
    const handleInitialPlay = () => {
      if (audioRef.current && !isPlayingRef.current) {
        audioRef.current.play().then(() => {
          isPlayingRef.current = true;
          setIsPlaying(true);
        }).catch(err => console.log("Menunggu interaksi pengguna...", err));
      }
      window.removeEventListener('click', handleInitialPlay);
    };

    window.addEventListener('click', handleInitialPlay);

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      isPlayingRef.current = false;
    } else {
      audioRef.current.play();
      isPlayingRef.current = true;
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <button
      onClick={togglePlay}
      className="fixed bottom-6 right-6 z-50 bg-white/90 backdrop-blur-sm p-3 rounded-full shadow-lg border border-stone-100 flex items-center justify-center animate-spin-slow text-stone-700"
      style={{ animationDuration: isPlaying ? '6s' : '0s' }}
      title={isPlaying ? "Matikan Musik" : "Putar Musik"}
    >
      {isPlaying ? (
        <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
      ) : (
        <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
      )}
    </button>
  );
};