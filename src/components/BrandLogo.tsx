import React from 'react';
import logoImage from '../assets/Logo Fidsa Tunas Invitation.png';

interface BrandLogoProps {
  compact?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ compact = false }) => (
  <div className={`flex items-center justify-center ${compact ? 'gap-2' : 'gap-3'}`}>
    <img
      src={logoImage}
      alt="Fidsa Tunas Invitation"
      className={compact ? 'h-20 w-28 object-contain' : 'h-24 w-36 object-contain'}
    />
  </div>
);

export default BrandLogo;