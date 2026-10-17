import React, { useState, useEffect } from 'react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface CountdownProps {
  targetDate: string; // Format: "YYYY-MM-DDTHH:mm:ss"
}

const getTimeLeft = (targetDate: string): TimeLeft => {
  const difference = +new Date(targetDate) - +new Date();
  if (difference <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
};

export const CountdownTimer: React.FC<CountdownProps> = ({ targetDate }) => {
  const initialTimeLeft = getTimeLeft(targetDate);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(initialTimeLeft);
  const [isOver, setIsOver] = useState<boolean>(initialTimeLeft.days === 0 && initialTimeLeft.hours === 0 && initialTimeLeft.minutes === 0 && initialTimeLeft.seconds === 0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const nextTimeLeft = getTimeLeft(targetDate);
      setTimeLeft(nextTimeLeft);
      setIsOver(nextTimeLeft.days === 0 && nextTimeLeft.hours === 0 && nextTimeLeft.minutes === 0 && nextTimeLeft.seconds === 0);
    };

    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  if (isOver) {
    return <div className="text-center font-serif text-amber-600 font-medium py-4">Acara Sedang / Telah Berlangsung ✨</div>;
  }

  return (
    <div className="flex justify-center gap-3 my-6">
      {[
        { label: 'Hari', value: timeLeft.days },
        { label: 'Jam', value: timeLeft.hours },
        { label: 'Menit', value: timeLeft.minutes },
        { label: 'Detik', value: timeLeft.seconds },
      ].map((item, idx) => (
        <div key={idx} className="flex flex-col items-center bg-white/90 backdrop-blur-sm p-3 rounded-xl border border-stone-100 min-w-16.25 shadow-sm">
          <span className="text-xl font-bold font-mono text-stone-800">{String(item.value).padStart(2, '0')}</span>
          <span className="text-[10px] uppercase text-stone-400 tracking-wider mt-0.5">{item.label}</span>
        </div>
      ))}
    </div>
  );
};