export enum Suit {
  Hearts = 'Hearts',
  Diamonds = 'Diamonds',
  Clubs = 'Clubs',
  Spades = 'Spades'
}

export enum Rank {
  Two = 2, Three, Four, Five, Six, Seven, Eight, Nine, Ten, Jack, Queen, King, Ace
}

export enum Edition {
  Base = 'Base',
  Foil = 'Foil', // +50 Chips
  Holographic = 'Holographic', // +10 Mult
  Polychrome = 'Polychrome', // x1.5 Mult
  Negative = 'Negative' // +1 Joker Slot
}

export enum Enhancement {
  None = 'None',
  Bonus = 'Bonus', // +30 Chips
  Mult = 'Mult', // +4 Mult
  Wild = 'Wild', // All suits
  Glass = 'Glass', // X2 Mult, 1/4 break chance
  Steel = 'Steel', // x1.5 Mult while in hand
  Stone = 'Stone', // +50 Chips, no rank/suit
  Gold = 'Gold' // Earn $3 end of round
}

export interface CardData {
  id: string;
  suit: Suit;
  rank: Rank;
  edition: Edition;
  enhancement: Enhancement;
  chips: number;
  selected: boolean;
  isDebuffed: boolean;
}

export enum HandType {
  HighCard = 'High Card',
  Pair = 'Pair',
  TwoPair = 'Two Pair',
  ThreeOfAKind = 'Three of a Kind',
  Straight = 'Straight',
  Flush = 'Flush',
  FullHouse = 'Full House',
  FourOfAKind = 'Four of a Kind',
  StraightFlush = 'Straight Flush',
  RoyalFlush = 'Royal Flush',
  FiveOfAKind = 'Five of a Kind'
}

export interface PokerHandResult {
  type: HandType;
  cards: CardData[];
  scoringCards: CardData[];
  baseChips: number;
  baseMult: number;
}

export interface ItemVisual {
  icon: string;
  bgColor: string;
  borderColor: string;
}

export interface Joker {
  id: string;
  name: string;
  description: string;
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Legendary';
  cost: number;
  visual: ItemVisual;
  effect: (state: GameState, context: TriggerContext) => TriggerResult | null;
}

export interface Consumable {
  id: string;
  type: 'Tarot' | 'Planet' | 'Spectral';
  name: string;
  description: string;
  cost: number;
  visual: ItemVisual;
  effect?: (state: GameState, context?: any) => Partial<GameState> | null;
}

export interface Blind {
  name: string;
  scoreGoal: number;
  reward: number;
  isBoss: boolean;
  bossEffect?: 'AllHeartsDebuffed' | 'AllFaceDebuffed' | 'MustPlay5' | 'Discard2Random' | 'None';
  bossDescription?: string;
}

export interface DeckDef {
  id: string;
  name: string;
  description: string;
  color: string;
  stats: {
    hands: number;
    discards: number;
    money: number;
    jokerSlots: number;
    handSize: number;
  };
}

export type GamePhase = 'MENU' | 'DECK_SELECT' | 'BLIND_SELECT' | 'PLAY_HAND' | 'SCORING' | 'SHOP' | 'GAME_OVER' | 'VICTORY';

export interface GameState {
  money: number;
  round: number;
  ante: number;
  selectedDeckId: string;
  handsLeft: number;
  discardsLeft: number;
  deck: CardData[];
  hand: CardData[];
  discardPile: CardData[];
  jokers: Joker[];
  jokerSlots: number;
  consumables: Consumable[];
  consumableSlots: number;
  handSize: number;
  currentBlind: Blind;
  currentScore: number;
  displayScore: number;
  phase: GamePhase;
  selectedBlindIndex?: number;
  shopInventory: (Joker | Consumable)[];
  handLevels: Record<HandType, { level: number; chips: number; mult: number }>;
  jokerState: Record<string, any>;
  activeEffects: string[];
}

export interface TriggerContext {
  type: 'card_score' | 'hand_score' | 'held_in_hand' | 'discard' | 'round_end' | 'joker_sell' | 'shop_reroll';
  card?: CardData;
  scoringHand?: PokerHandResult;
  pokerHand?: HandType;
}

export interface TriggerResult {
  chips?: number;
  mult?: number;
  x_mult?: number;
  message: string;
}