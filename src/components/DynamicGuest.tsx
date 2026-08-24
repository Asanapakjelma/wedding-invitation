import React, { useState, useEffect } from 'react';

export const DynamicGuest: React.FC = () => {
  const [guestName] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const toParam = params.get('to');
    return toParam || 'Tamu Undangan';
  });

  return (
    <div className="text-center p-6 bg-white/80 backdrop-blur-sm rounded-2xl max-w-sm mx-auto my-6 border border-stone-100 shadow-sm animate-fade-in">
      <p className="text-xs uppercase tracking-widest text-stone-400 mb-2">Kepada Yth. Bapak/Ibu/Saudara/i:</p>
      <h3 className="text-2xl font-medium text-stone-800 font-serif tracking-wide">{guestName}</h3>
      <p className="text-[11px] text-stone-400 mt-3 italic">*Tanpa mengurangi rasa hormat, kami mengundang Anda untuk hadir</p>
    </div>
  );
};