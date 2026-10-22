/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface AtriumLogoProps {
  className?: string;
  variant?: 'full' | 'horizontal' | 'arch-only' | 'compact';
  theme?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
}

export const AtriumLogo: React.FC<AtriumLogoProps> = ({
  className = '',
  variant = 'horizontal',
  theme = 'dark',
  size = 'md',
  showSubtitle = true,
}) => {
  // Arch SVG Element
  const ArchEmblem = ({ width = 36, height = 36 }: { width?: number; height?: number }) => (
    <svg
      viewBox="0 0 320 280"
      width={width}
      height={height}
      className="shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logoGold1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C5A059" />
          <stop offset="35%" stopColor="#DFBA73" />
          <stop offset="50%" stopColor="#EAD59E" />
          <stop offset="70%" stopColor="#C5A059" />
          <stop offset="100%" stopColor="#9A7332" />
        </linearGradient>
        <linearGradient id="logoGold2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#B28C47" />
          <stop offset="50%" stopColor="#D4AE67" />
          <stop offset="100%" stopColor="#805F25" />
        </linearGradient>
        <linearGradient id="logoGold3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#987332" />
          <stop offset="50%" stopColor="#BF9853" />
          <stop offset="100%" stopColor="#6F4D18" />
        </linearGradient>
        <linearGradient id="logoGold4" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7A5620" />
          <stop offset="50%" stopColor="#A17B39" />
          <stop offset="100%" stopColor="#55390F" />
        </linearGradient>
        <linearGradient id="logoGold5" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#52360E" />
          <stop offset="50%" stopColor="#73501A" />
          <stop offset="100%" stopColor="#3D2608" />
        </linearGradient>
      </defs>

      <g transform="translate(160, 160)">
        {/* Arch 1 */}
        <path
          d="M -140 100 L -140 95 C -140 95 -133 95 -130 87 L -130 -15 C -130 -85 -72 -135 0 -135 C 72 -135 130 -85 130 -15 L 130 87 C 133 95 140 95 140 95 L 140 100 L 110 100 L 110 88 C 110 88 113 88 114 84 L 114 -15 C 114 -72 62 -120 0 -120 C -62 -120 -114 -72 -114 -15 L -114 84 C -113 88 -110 88 -110 88 L -110 100 Z"
          fill="url(#logoGold1)"
        />
        {/* Arch 2 */}
        <path
          d="M -100 95 L -100 -15 C -100 -62 -55 -104 0 -104 C 55 -104 100 -62 100 -15 L 100 95 L 85 95 L 85 -15 C 85 -53 46 -90 0 -90 C -46 -90 -85 -53 -85 -15 L -85 95 Z"
          fill="url(#logoGold2)"
        />
        {/* Arch 3 */}
        <path
          d="M -72 90 L -72 -15 C -72 -46 -39 -75 0 -75 C 39 -75 72 -46 72 -15 L 72 90 L 59 90 L 59 -15 C 59 -38 32 -62 0 -62 C -32 -62 -59 -38 -59 -15 L -59 90 Z"
          fill="url(#logoGold3)"
        />
        {/* Arch 4 */}
        <path
          d="M -48 85 L -48 -15 C -48 -32 -26 -49 0 -49 C 26 -49 48 -32 48 -15 L 48 85 L 37 85 L 37 -15 C 37 -26 20 -37 0 -37 C -20 -37 -37 -26 -37 -15 L -37 85 Z"
          fill="url(#logoGold4)"
        />
        {/* Arch 5 (core) */}
        <path
          d="M -26 80 L -26 -15 C -26 -22 -14 -27 0 -27 C 14 -27 26 -22 26 -15 L 26 80 L 16 80 L 16 -15 C 16 -17 8 -18 0 -18 C -8 -18 -16 -17 -16 -15 L -16 80 Z"
          fill="url(#logoGold5)"
        />
      </g>
    </svg>
  );

  if (variant === 'arch-only') {
    const archSizes = { sm: 24, md: 36, lg: 52, xl: 72 };
    const px = archSizes[size] || 36;
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        <ArchEmblem width={px} height={Math.round(px * 0.88)} />
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        {/* Arch Icon */}
        <div className="mb-2">
          <ArchEmblem width={size === 'xl' ? 96 : size === 'lg' ? 76 : 56} height={size === 'xl' ? 84 : size === 'lg' ? 66 : 48} />
        </div>

        {/* Brand Text */}
        <div className="space-y-0.5">
          <div
            className={`font-serif tracking-[0.22em] font-normal leading-tight ${
              theme === 'light' ? 'text-amber-800' : 'text-[#DFBA73]'
            } ${size === 'xl' ? 'text-3xl' : size === 'lg' ? 'text-2xl' : 'text-xl'}`}
            style={{ fontFamily: "'Playfair Display', 'Cinzel', serif" }}
          >
            ATRIUM
          </div>
          <div
            className={`font-serif tracking-[0.32em] font-normal leading-tight ${
              theme === 'light' ? 'text-amber-900' : 'text-[#C5A059]'
            } ${size === 'xl' ? 'text-xl' : size === 'lg' ? 'text-lg' : 'text-base'}`}
            style={{ fontFamily: "'Playfair Display', 'Cinzel', serif" }}
          >
            SUITES
          </div>
          <div
            className={`text-[9px] tracking-[0.5em] font-medium pt-0.5 ${
              theme === 'light' ? 'text-amber-700' : 'text-[#EAD59E]'
            }`}
          >
            • LOMBOK •
          </div>
        </div>

        {/* Company Full Name */}
        {showSubtitle && (
          <div
            className={`mt-2 text-[10px] tracking-[0.25em] uppercase font-bold ${
              theme === 'light' ? 'text-slate-800 border-t border-slate-300 pt-1.5' : 'text-amber-700/90'
            }`}
          >
            PT ATRIUM MANAGEMENT GROUP
          </div>
        )}
      </div>
    );
  }

  // Variant: horizontal (default, perfect for Navbar and Document headers)
  const isLight = theme === 'light';
  const logoPx = size === 'sm' ? 28 : size === 'lg' ? 44 : 36;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="shrink-0 drop-shadow-xs">
        <ArchEmblem width={logoPx} height={Math.round(logoPx * 0.88)} />
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span
            className={`font-bold tracking-tight text-sm uppercase ${
              isLight ? 'text-slate-900' : 'text-slate-900'
            }`}
          >
            PT ATRIUM MANAGEMENT GROUP
          </span>
        </div>

        {showSubtitle && (
          <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-wide">
            <span className={isLight ? 'text-amber-800 font-semibold' : 'text-[#DFBA73] font-semibold'}>
              ATRIUM SUITES
            </span>
            <span className={isLight ? 'text-slate-500' : 'text-slate-500'}>•</span>
            <span className={isLight ? 'text-slate-500' : 'text-slate-500'}>
              Hospitality Finance &amp; Operations
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
