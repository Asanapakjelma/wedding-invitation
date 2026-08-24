import React from 'react';

interface WaxSealButtonProps {
  onClick?: () => void;
  text?: string;
  waxColor?: string;   // Ditambahkan
  textColor?: string;  // Ditambahkan
}

const WaxSealButton: React.FC<WaxSealButtonProps> = ({ 
  onClick, 
  text = "Buka Undangan",
  waxColor = "#E3D5CA", // Default jika kosong
  textColor = "#6F4E37"  // Default jika kosong
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-4">
      <button
        onClick={onClick}
        type="button"
        style={{
          backgroundColor: waxColor,
          color: textColor,
          clipPath: "polygon(25% 5%, 55% 0%, 80% 8%, 98% 30%, 95% 65%, 85% 90%, 55% 100%, 20% 95%, 2% 75%, 0% 40%)",
        }}
        className="relative w-32 h-32 font-serif font-bold text-center text-sm leading-tight tracking-wide uppercase shadow-xl shadow-black/25 transition-all duration-300 ease-in-out hover:scale-105 active:scale-95 animate-pulse hover:animate-none cursor-pointer select-none flex items-center justify-center px-4"
      >
        <span 
          style={{ textShadow: `-1.5px -1.5px 0 #FFF, 1.5px -1.5px 0 #FFF, -1.5px 1.5px 0 #FFF, 1.5px 1.5px 0 #FFF` }}
          className="drop-shadow-sm pointer-events-none"
        >
          {text}
        </span>
        <div 
          className="absolute inset-2 border pointer-events-none"
          style={{
            borderColor: `${textColor}1A`, // Ditambahkan opacity tipis pada border dalam stempel
            clipPath: "polygon(20% 8%, 60% 3%, 85% 12%, 95% 40%, 90% 70%, 75% 92%, 40% 95%, 12% 85%, 5% 50%)"
          }}
        />
      </button>
    </div>
  );
};

export default WaxSealButton;