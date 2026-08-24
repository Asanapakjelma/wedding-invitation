import React, { useState } from 'react';

interface BankCardProps {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export const BankAccountCard: React.FC<BankCardProps> = ({ bankName, accountNumber, accountHolder }) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Gagal menyalin teks', err);
    }
  };

  return (
    <div className="border border-stone-200/60 p-5 rounded-2xl bg-white max-w-sm mx-auto shadow-sm text-center relative overflow-hidden">
      <p className="font-serif font-semibold text-stone-700 tracking-wide">{bankName}</p>
      <p className="font-mono text-lg text-amber-800 font-bold select-all my-1.5">{accountNumber}</p>
      <p className="text-xs text-stone-400 mb-4">a.n. {accountHolder}</p>
      <button
        onClick={handleCopy}
        className={`w-full py-2 px-4 rounded-xl text-xs font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
          copied ? 'bg-emerald-600 text-white' : 'bg-stone-800 hover:bg-stone-900 text-white'
        }`}
      >
        {copied ? '✓ Terbaca & Tersalin' : '📋 Salin No. Rekening'}
      </button>
    </div>
  );
};