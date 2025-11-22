import React, { useState, MouseEvent } from 'react';
import { CardData, Suit, Rank, Edition, Enhancement } from '../types';

interface CardProps {
  card: CardData;
  onClick: (card: CardData) => void;
  disabled?: boolean;
  className?: string;
  small?: boolean;
}

const suitColors = {
  [Suit.Hearts]: 'text-red-500',
  [Suit.Diamonds]: 'text-orange-500',
  [Suit.Clubs]: 'text-slate-800',
  [Suit.Spades]: 'text-slate-900',
};

const suitIcons = {
  [Suit.Hearts]: '♥',
  [Suit.Diamonds]: '♦',
  [Suit.Clubs]: '♣',
  [Suit.Spades]: '♠',
};

const rankLabels: Record<Rank, string> = {
  [Rank.Two]: '2', [Rank.Three]: '3', [Rank.Four]: '4', [Rank.Five]: '5',
  [Rank.Six]: '6', [Rank.Seven]: '7', [Rank.Eight]: '8', [Rank.Nine]: '9',
  [Rank.Ten]: '10', [Rank.Jack]: 'J', [Rank.Queen]: 'Q', [Rank.King]: 'K', [Rank.Ace]: 'A'
};

const Card: React.FC<CardProps> = ({ card, onClick, disabled, className = "", small }) => {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const rotateX = ((y - cy) / cy) * -20;
    const rotateY = ((x - cx) / cx) * 20;

    setTilt({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const isSelected = card.selected;
  const isDebuffed = card.isDebuffed;

  // Effects styles
  const getEditionStyle = () => {
      switch(card.edition) {
          case Edition.Foil: return 'shadow-[0_0_15px_rgba(59,130,246,0.8)] border-blue-400';
          case Edition.Holographic: return 'shadow-[0_0_15px_rgba(239,68,68,0.8)] border-red-400';
          case Edition.Polychrome: return 'shadow-[0_0_15px_rgba(234,179,8,0.8)] border-yellow-400 animate-pulse';
          default: return card.selected ? 'border-orange-400' : 'border-gray-300';
      }
  };

  const getTexture = () => {
      switch(card.enhancement) {
          case Enhancement.Stone: return 'bg-stone-300';
          case Enhancement.Gold: return 'bg-yellow-100';
          case Enhancement.Steel: return 'bg-slate-300';
          case Enhancement.Glass: return 'bg-blue-50/50 backdrop-blur-sm';
          default: return 'bg-white';
      }
  };

  return (
    <div 
      className={`perspective-1000 relative inline-block transition-all duration-200 ease-out 
        ${isSelected ? '-translate-y-8 z-50' : ''} 
        ${disabled || isDebuffed ? '' : 'cursor-pointer hover:z-50'} 
        ${className}
      `}
      style={{ 
        width: small ? '4rem' : '7.5rem', 
        height: small ? '5.5rem' : '10.5rem' 
      }}
      onClick={() => (!disabled) && onClick(card)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div 
        className={`
          w-full h-full rounded-xl border-2 relative shadow-xl preserve-3d transition-transform duration-100
          ${getEditionStyle()}
          ${getTexture()}
          ${isDebuffed ? 'grayscale opacity-60' : ''}
        `}
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${isSelected ? 1.05 : 1})`,
        }}
      >
        {/* Foil/Holo sheen overlay */}
        {(card.edition === Edition.Foil) && <div className="absolute inset-0 bg-blue-500/10 rounded-xl z-0" />}
        {(card.edition === Edition.Holographic) && <div className="absolute inset-0 bg-red-500/10 rounded-xl z-0" />}

        {/* Card Face */}
        <div className={`absolute inset-0 flex flex-col items-center justify-between p-2 select-none z-10 ${suitColors[card.suit]}`}>
            {/* Top Left */}
            <div className="flex flex-col items-center self-start leading-none">
                <span className={`${small ? 'text-sm' : 'text-xl'} font-black`}>{rankLabels[card.rank]}</span>
                <span className={small ? 'text-xs' : 'text-lg'}>{suitIcons[card.suit]}</span>
            </div>

            {/* Center */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${small ? 'text-2xl' : 'text-5xl'} drop-shadow-sm`}>
                {card.enhancement === Enhancement.Stone ? '🪨' : suitIcons[card.suit]}
            </div>

            {/* Debuffed X */}
            {isDebuffed && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-8xl text-red-600 font-bold opacity-80 rotate-12 drop-shadow-lg">❌</span>
                </div>
            )}

             {/* Bottom Right */}
             <div className="flex flex-col items-center self-end leading-none rotate-180">
                <span className={`${small ? 'text-sm' : 'text-xl'} font-black`}>{rankLabels[card.rank]}</span>
                <span className={small ? 'text-xs' : 'text-lg'}>{suitIcons[card.suit]}</span>
            </div>
        </div>

        {/* Shine Effect */}
        <div 
          className="absolute inset-0 rounded-xl pointer-events-none bg-gradient-to-br from-white/60 to-transparent opacity-0 mix-blend-overlay z-20"
          style={{ opacity: (Math.abs(tilt.x) + Math.abs(tilt.y)) / 25 }}
        />
      </div>
      
      {/* Chips Badge */}
      {card.chips > 0 && !small && !isDebuffed && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full shadow border border-blue-400 font-bold z-30 whitespace-nowrap">
          +{card.chips} Chips
        </div>
      )}
      {/* Mult Badge for enhancements */}
      {card.enhancement === Enhancement.Mult && !small && !isDebuffed && (
          <div className="absolute -top-3 right-0 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full shadow border border-red-400 font-bold z-30">
          +4 Mult
        </div>
      )}
    </div>
  );
};

export default Card;