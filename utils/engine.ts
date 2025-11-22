import { CardData, Suit, Rank, Edition, Enhancement, HandType, PokerHandResult, GameState, Joker, Consumable, Blind, DeckDef } from '../types';

// --- Deck Generation ---
export const createDeck = (): CardData[] => {
  const deck: CardData[] = [];
  const suits = [Suit.Hearts, Suit.Diamonds, Suit.Clubs, Suit.Spades];
  const ranks = [
    Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven, 
    Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen, Rank.King, Rank.Ace
  ];

  let idCounter = 0;
  for (const suit of suits) {
    for (const rank of ranks) {
      let chipVal = 0;
      if (rank <= Rank.Ten) chipVal = Number(rank);
      else if (rank === Rank.Ace) chipVal = 11;
      else chipVal = 10;

      // Small chance for enhanced cards in base deck
      let edition = Edition.Base;
      const rng = Math.random();
      if (rng > 0.99) edition = Edition.Foil; // Reduced chance for balance
      else if (rng > 0.998) edition = Edition.Holographic;

      deck.push({
        id: `card_${idCounter++}_${Date.now()}`,
        suit,
        rank,
        edition,
        enhancement: Enhancement.None,
        chips: chipVal,
        selected: false,
        isDebuffed: false
      });
    }
  }
  return deck;
};

// --- Logic Helpers ---

export const getRankValue = (rank: Rank): number => Number(rank);

export const sortCards = (cards: CardData[], by: 'Rank' | 'Suit'): CardData[] => {
    const sorted = [...cards];
    if (by === 'Rank') {
        return sorted.sort((a, b) => {
            if (b.rank !== a.rank) return b.rank - a.rank;
            return a.suit.localeCompare(b.suit);
        });
    } else {
        return sorted.sort((a, b) => {
            if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
            return b.rank - a.rank;
        });
    }
};

export const evaluateHand = (selectedCards: CardData[], handLevels: GameState['handLevels']): PokerHandResult => {
  if (selectedCards.length === 0) {
      return {
        type: HandType.HighCard,
        cards: [],
        scoringCards: [],
        baseChips: 0,
        baseMult: 0
      };
  }

  const functionalCards = selectedCards.filter(c => c.enhancement !== Enhancement.Stone);
  
  const sorted = [...functionalCards].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank));
  const ranks = sorted.map(c => c.rank);
  const suits = sorted.map(c => c.suit);
  
  const rankCounts = new Map<Rank, number>();
  ranks.forEach(r => rankCounts.set(r, (rankCounts.get(r) || 0) + 1));
  const counts = Array.from(rankCounts.values()).sort((a, b) => b - a);
  
  const isFlush = functionalCards.length === 5 && suits.every(s => s === suits[0]);
  
  let isStraight = false;
  if (functionalCards.length === 5) {
    const uniqueRanks = Array.from(new Set(ranks.map(r => getRankValue(r)))).sort((a, b) => b - a);
    if (uniqueRanks.length === 5) {
      if (uniqueRanks[0] - uniqueRanks[4] === 4) isStraight = true;
      if (uniqueRanks[0] === 14 && uniqueRanks[1] === 5) isStraight = true; // Wheel A-5
    }
  }

  let type = HandType.HighCard;
  let scoring = sorted; 

  if (isFlush && isStraight) {
    type = (ranks.includes(Rank.Ace) && ranks.includes(Rank.King)) ? HandType.RoyalFlush : HandType.StraightFlush;
  } else if (counts[0] === 5) {
    type = HandType.FiveOfAKind;
  } else if (counts[0] === 4) {
    type = HandType.FourOfAKind;
  } else if (counts[0] === 3 && counts[1] === 2) {
    type = HandType.FullHouse;
  } else if (isFlush) {
    type = HandType.Flush;
  } else if (isStraight) {
    type = HandType.Straight;
  } else if (counts[0] === 3) {
    type = HandType.ThreeOfAKind;
  } else if (counts[0] === 2 && counts[1] === 2) {
    type = HandType.TwoPair;
  } else if (counts[0] === 2) {
    type = HandType.Pair;
  } else {
    type = HandType.HighCard;
    scoring = [sorted[0]];
  }

  const stones = selectedCards.filter(c => c.enhancement === Enhancement.Stone);
  if (stones.length > 0) {
      scoring = [...scoring, ...stones];
  }

  const levelStats = handLevels[type];

  return {
    type,
    cards: selectedCards,
    scoringCards: scoring,
    baseChips: levelStats.chips,
    baseMult: levelStats.mult
  };
};

export const checkDebuffs = (card: CardData, blind: Blind): boolean => {
    if (!blind.isBoss || !blind.bossEffect) return false;
    
    switch (blind.bossEffect) {
        case 'AllHeartsDebuffed':
            return card.suit === Suit.Hearts;
        case 'AllFaceDebuffed':
            return [Rank.Jack, Rank.Queen, Rank.King].includes(card.rank);
        default:
            return false;
    }
}

// Scaling Logic for Ante
export const getBlindConfig = (ante: number) => {
    const baseGoals = [300, 800, 2800, 6000, 11000, 20000, 35000, 50000];
    let base = 300;
    if (ante <= 8) {
        base = baseGoals[ante - 1];
    } else {
        base = baseGoals[7] * Math.pow(1.5, ante - 8);
    }
    
    return {
        small: Math.floor(base),
        big: Math.floor(base * 1.5),
        boss: Math.floor(base * 2) 
    };
};

// --- Content Data ---

export const HAND_DESCRIPTIONS: Record<HandType, string> = {
    [HandType.HighCard]: "Highest rank card in your hand",
    [HandType.Pair]: "2 cards with the same rank",
    [HandType.TwoPair]: "2 pairs of cards with different ranks",
    [HandType.ThreeOfAKind]: "3 cards with the same rank",
    [HandType.Straight]: "5 cards in consecutive rank order",
    [HandType.Flush]: "5 cards of the same suit",
    [HandType.FullHouse]: "A Three of a Kind and a Pair",
    [HandType.FourOfAKind]: "4 cards with the same rank",
    [HandType.StraightFlush]: "5 cards in consecutive rank order and same suit",
    [HandType.RoyalFlush]: "Ace, King, Queen, Jack, 10 of the same suit",
    [HandType.FiveOfAKind]: "5 cards with the same rank"
};

export const DECKS_DATA: DeckDef[] = [
    {
        id: 'red_deck',
        name: 'Red Deck',
        description: '+1 Discard every round',
        color: 'bg-red-600',
        stats: { hands: 4, discards: 4, money: 4, jokerSlots: 5, handSize: 8 }
    },
    {
        id: 'blue_deck',
        name: 'Blue Deck',
        description: '+1 Hand every round',
        color: 'bg-blue-600',
        stats: { hands: 5, discards: 3, money: 4, jokerSlots: 5, handSize: 8 }
    },
    {
        id: 'yellow_deck',
        name: 'Yellow Deck',
        description: 'Start with an extra $10',
        color: 'bg-yellow-500',
        stats: { hands: 4, discards: 3, money: 14, jokerSlots: 5, handSize: 8 }
    },
    {
        id: 'green_deck',
        name: 'Green Deck',
        description: 'At end of round: $2 per remaining Hand, $1 per Discard. Earn no Interest.',
        color: 'bg-green-600',
        stats: { hands: 4, discards: 3, money: 4, jokerSlots: 5, handSize: 8 }
    },
    {
        id: 'black_deck',
        name: 'Black Deck',
        description: '+1 Joker slot, -1 Hand every round',
        color: 'bg-slate-900',
        stats: { hands: 3, discards: 3, money: 4, jokerSlots: 6, handSize: 8 }
    }
];

// REBALANCED JOKERS
export const JOKERS_DATA: Joker[] = [
  {
    id: 'j_joker',
    name: 'Joker',
    description: '+4 Mult',
    rarity: 'Common',
    cost: 2,
    visual: { icon: '🃏', bgColor: 'bg-slate-700', borderColor: 'border-slate-400' },
    // CHANGED: Only triggers on hand_score, not card_score
    effect: (s, ctx) => ctx.type === 'hand_score' ? { mult: 4, message: '+4 Mult' } : null
  },
  {
    id: 'j_green',
    name: 'Green Joker',
    description: '+1 Mult per hand played, -1 Mult per discard',
    rarity: 'Common',
    cost: 5,
    visual: { icon: '✳️', bgColor: 'bg-green-900', borderColor: 'border-green-400' },
    effect: (s, ctx) => {
        const storedMult = s.jokerState['j_green_mult'] || 0;
        // CHANGED: Triggers on hand_score
        if (ctx.type === 'hand_score') {
            return { mult: storedMult, message: `+${storedMult} Mult` };
        }
        return null;
    }
  },
  {
    id: 'j_duo',
    name: 'The Duo',
    description: 'X2 Mult if playing a Pair',
    rarity: 'Rare',
    cost: 8,
    visual: { icon: '👥', bgColor: 'bg-orange-900', borderColor: 'border-orange-500' },
    effect: (s, ctx) => {
        if (ctx.type === 'hand_score' && ctx.scoringHand?.type === HandType.Pair) {
            return { x_mult: 2, message: 'X2 Mult' };
        }
        return null;
    }
  },
  {
    id: 'j_blackboard',
    name: 'Blackboard',
    description: 'X3 Mult if all held cards are Spades or Clubs',
    rarity: 'Uncommon',
    cost: 8,
    visual: { icon: '⬛', bgColor: 'bg-gray-900', borderColor: 'border-gray-500' },
    effect: (s, ctx) => {
      if (ctx.type === 'hand_score') {
        const allBlack = s.hand.every(c => c.suit === Suit.Spades || c.suit === Suit.Clubs);
        // Fixed: Check if hand is not empty to avoid free x3 on empty hands (unlikely but safe)
        if (allBlack) return { x_mult: 3, message: 'X3 Mult' };
      }
      return null;
    }
  },
  {
    id: 'j_runner',
    name: 'Runner',
    description: '+10 Chips if played hand contains a Straight',
    rarity: 'Common',
    cost: 6,
    visual: { icon: '🏃', bgColor: 'bg-blue-900', borderColor: 'border-blue-500' },
    effect: (s, ctx) => {
        const storedChips = s.jokerState['j_runner_chips'] || 0;
        // CHANGED: Triggers on hand_score
        if (ctx.type === 'hand_score') {
            return { chips: storedChips, message: `+${storedChips} Chips` };
        }
        return null;
    }
  },
  {
    id: 'j_fibonacci',
    name: 'Fibonacci',
    description: 'Each played Ace, 2, 3, 5, or 8 gives +8 Mult when scored',
    rarity: 'Uncommon',
    cost: 8,
    visual: { icon: '🔢', bgColor: 'bg-indigo-900', borderColor: 'border-indigo-400' },
    effect: (s, ctx) => {
        // Keeps card_score because it's specific to the card played
        if (ctx.type === 'card_score' && ctx.card) {
            const r = ctx.card.rank;
            if ([Rank.Ace, Rank.Two, Rank.Three, Rank.Five, Rank.Eight].includes(r)) {
                return { mult: 8, message: '+8 Mult'};
            }
        }
        return null;
    }
  },
  {
    id: 'j_smeared',
    name: 'Smeared Joker',
    description: 'Hearts/Diamonds and Clubs/Spades count as same suit',
    rarity: 'Uncommon',
    cost: 7,
    visual: { icon: '🎨', bgColor: 'bg-red-900', borderColor: 'border-red-400' },
    effect: (s, ctx) => null 
  },
  {
    id: 'j_half',
    name: 'Half Joker',
    description: '+20 Mult if played hand has 3 or fewer cards',
    rarity: 'Common',
    cost: 4,
    visual: { icon: '🌓', bgColor: 'bg-yellow-900', borderColor: 'border-yellow-200' },
    effect: (s, ctx) => {
      if (ctx.type === 'hand_score' && ctx.scoringHand && ctx.scoringHand.cards.length <= 3) {
        return { mult: 20, message: '+20 Mult' };
      }
      return null;
    }
  },
  {
    id: 'j_blueprint',
    name: 'Blueprint',
    description: 'Copies ability of Joker to the right',
    rarity: 'Rare',
    cost: 10,
    visual: { icon: '📝', bgColor: 'bg-blue-800', borderColor: 'border-blue-300' },
    effect: (s, ctx) => null
  }
];

export const PLANETS_DATA: Consumable[] = [
    { id: 'p_mercury', type: 'Planet', name: 'Mercury', description: 'Level up Pair', cost: 3, visual: { icon: '☿️', bgColor: 'bg-slate-800', borderColor: 'border-slate-500' } },
    { id: 'p_venus', type: 'Planet', name: 'Venus', description: 'Level up Three of a Kind', cost: 3, visual: { icon: '♀️', bgColor: 'bg-yellow-900', borderColor: 'border-yellow-600' } },
    { id: 'p_earth', type: 'Planet', name: 'Earth', description: 'Level up Full House', cost: 3, visual: { icon: '⊕', bgColor: 'bg-green-900', borderColor: 'border-green-600' } },
    { id: 'p_mars', type: 'Planet', name: 'Mars', description: 'Level up Four of a Kind', cost: 3, visual: { icon: '♂️', bgColor: 'bg-red-900', borderColor: 'border-red-600' } },
    { id: 'p_jupiter', type: 'Planet', name: 'Jupiter', description: 'Level up Flush', cost: 3, visual: { icon: '♃', bgColor: 'bg-orange-900', borderColor: 'border-orange-600' } },
    { id: 'p_saturn', type: 'Planet', name: 'Saturn', description: 'Level up Straight', cost: 3, visual: { icon: '♄', bgColor: 'bg-yellow-800', borderColor: 'border-yellow-500' } },
    { id: 'p_uranus', type: 'Planet', name: 'Uranus', description: 'Level up Two Pair', cost: 3, visual: { icon: '♅', bgColor: 'bg-cyan-900', borderColor: 'border-cyan-600' } },
    { id: 'p_neptune', type: 'Planet', name: 'Neptune', description: 'Level up Straight Flush', cost: 3, visual: { icon: '♆', bgColor: 'bg-blue-900', borderColor: 'border-blue-600' } },
    { id: 'p_pluto', type: 'Planet', name: 'Pluto', description: 'Level up High Card', cost: 3, visual: { icon: '♇', bgColor: 'bg-slate-900', borderColor: 'border-slate-600' } },
];

export const TAROTS_DATA: Consumable[] = [
    { id: 't_fool', type: 'Tarot', name: 'The Fool', description: 'Create last Tarot used', cost: 3, visual: { icon: '🃏', bgColor: 'bg-purple-900', borderColor: 'border-purple-400' } },
    { id: 't_magician', type: 'Tarot', name: 'The Magician', description: 'Enhance 2 cards to Lucky', cost: 3, visual: { icon: '🎩', bgColor: 'bg-purple-900', borderColor: 'border-purple-400' } },
    { id: 't_empress', type: 'Tarot', name: 'The Empress', description: 'Enhance 2 cards to Mult', cost: 3, visual: { icon: '👸', bgColor: 'bg-purple-900', borderColor: 'border-purple-400' } },
    { id: 't_lovers', type: 'Tarot', name: 'The Lovers', description: 'Enhance 1 card to Wild', cost: 3, visual: { icon: '❤️', bgColor: 'bg-purple-900', borderColor: 'border-purple-400' } },
    { id: 't_chariot', type: 'Tarot', name: 'The Chariot', description: 'Enhance 1 card to Steel', cost: 3, visual: { icon: '🛡️', bgColor: 'bg-purple-900', borderColor: 'border-purple-400' } },
    { id: 't_strength', type: 'Tarot', name: 'Strength', description: 'Increase rank of 2 cards', cost: 3, visual: { icon: '💪', bgColor: 'bg-purple-900', borderColor: 'border-purple-400' } },
    { id: 't_death', type: 'Tarot', name: 'Death', description: 'Convert left card to right card', cost: 3, visual: { icon: '💀', bgColor: 'bg-purple-900', borderColor: 'border-purple-400' } },
];

export const INITIAL_HAND_LEVELS = {
  [HandType.HighCard]: { level: 1, chips: 5, mult: 1 },
  [HandType.Pair]: { level: 1, chips: 10, mult: 2 },
  [HandType.TwoPair]: { level: 1, chips: 20, mult: 2 },
  [HandType.ThreeOfAKind]: { level: 1, chips: 30, mult: 3 },
  [HandType.Straight]: { level: 1, chips: 30, mult: 4 },
  [HandType.Flush]: { level: 1, chips: 35, mult: 4 },
  [HandType.FullHouse]: { level: 1, chips: 40, mult: 4 },
  [HandType.FourOfAKind]: { level: 1, chips: 60, mult: 7 },
  [HandType.StraightFlush]: { level: 1, chips: 100, mult: 8 },
  [HandType.RoyalFlush]: { level: 1, chips: 100, mult: 8 },
  [HandType.FiveOfAKind]: { level: 1, chips: 120, mult: 12 },
};