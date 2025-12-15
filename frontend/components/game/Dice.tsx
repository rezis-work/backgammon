'use client';

import { useEffect, useState } from 'react';

interface DiceProps {
  value: number | null;
  isRolling?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function Dice({ value, isRolling = false, size = 'md' }: DiceProps) {
  const [displayValue, setDisplayValue] = useState<number>(value || 1);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isRolling) {
      setIsAnimating(true);
      const interval = setInterval(() => {
        setDisplayValue(Math.floor(Math.random() * 6) + 1);
      }, 100);

      setTimeout(() => {
        clearInterval(interval);
        setIsAnimating(false);
        if (value) setDisplayValue(value);
      }, 1000);
    } else if (value) {
      setDisplayValue(value);
    }
  }, [isRolling, value]);

  const sizeClasses = {
    sm: 'w-12 h-12 text-xl',
    md: 'w-16 h-16 text-2xl',
    lg: 'w-20 h-20 text-3xl',
  };

  const dotPositions: { [key: number]: string[] } = {
    1: ['center'],
    2: ['top-left', 'bottom-right'],
    3: ['top-left', 'center', 'bottom-right'],
    4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
    6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right'],
  };

  const dotClass = (position: string) => {
    const base = 'absolute w-2 h-2 bg-gray-800 rounded-full';
    const positions: { [key: string]: string } = {
      'top-left': 'top-1 left-1',
      'top-right': 'top-1 right-1',
      'middle-left': 'top-1/2 left-1 -translate-y-1/2',
      'middle-right': 'top-1/2 right-1 -translate-y-1/2',
      'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
      'bottom-left': 'bottom-1 left-1',
      'bottom-right': 'bottom-1 right-1',
    };
    return `${base} ${positions[position]}`;
  };

  return (
    <div
      className={`
        ${sizeClasses[size]}
        relative
        bg-gradient-to-br from-white to-gray-100
        border-4 border-gray-800
        rounded-lg
        shadow-lg
        flex items-center justify-center
        ${isAnimating ? 'animate-spin' : ''}
        transition-transform duration-300
        hover:scale-110
      `}
    >
      {dotPositions[displayValue]?.map((pos, i) => (
        <div key={i} className={dotClass(pos)} />
      ))}
    </div>
  );
}

