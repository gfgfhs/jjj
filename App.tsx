import React, { useState, useReducer, useEffect } from 'react';
import { 
  GameState, CardData, Blind, HandType, Joker, Consumable,
  Suit, Rank, Edition, Enhancement
} from './types';
import { 
  createDeck, evaluateHand, checkDebuffs, sortCards, getBlindConfig,
  JOKERS_DATA, PLANETS_DATA, TAROTS_DATA, INITIAL_HAND_LEVELS, HAND_DESCRIPTIONS, DECKS_DATA
} from './utils/engine';
import Background from './components/Background';
import Card from './components/Card';

// --- Constants ---
const INITIAL_MONEY = 4;
const HAND_SIZE = 8;
const BASE_DISCARDS = 3;
const BASE_HANDS = 4;

const INITIAL_STATE: GameState = {
  money: INITIAL_MONEY,
  round: 1,
  ante: 1,
  selectedDeckId: 'red_deck',
  handsLeft: BASE_HANDS,
  discardsLeft: BASE_DISCARDS,
  deck: [],
  hand: [],
  discardPile: [],
  jokers: [],
  jokerSlots: 5,
  consumables: [],
  consumableSlots: 2,
  handSize: HAND_SIZE,
  currentBlind: { name: 'Small Blind', scoreGoal: 300, reward: 3, isBoss: false },
  currentScore: 0,
  displayScore: 0,
  phase: 'MENU',
  shopInventory: [],
  handLevels: INITIAL_HAND_LEVELS,
  jokerState: {},
  activeEffects: []
};

// --- Reducer Actions ---
type Action = 
  | { type: 'GO_TO_DECK_SELECT' }
  | { type: 'START_GAME', deckId: string }
  | { type: 'SELECT_BLIND', blind: Blind }
  | { type: 'DEAL_HAND' }
  | { type: 'TOGGLE_CARD', cardId: string }
  | { type: 'SELECT_CONSUMABLE', id: string }
  | { type: 'USE_CONSUMABLE', id: string, targetCardId?: string }
  | { type: 'PLAY_HAND' }
  | { type: 'DISCARD_HAND' }
  | { type: 'SORT_HAND', sortBy: 'Rank' | 'Suit' }
  | { type: 'UPDATE_SCORE_VISUAL', score: number }
  | { type: 'FINISH_SCORING', points: number }
  | { type: 'END_ROUND' }
  | { type: 'BUY_ITEM', item: any, index: number }
  | { type: 'REROLL_SHOP' }
  | { type: 'NEXT_ROUND' }
  | { type: 'GAME_OVER' }
  | { type: 'LOG_EFFECT', message: string }
  | { type: 'CLEAR_LOGS' }
  | { type: 'UPDATE_JOKER_STATE', key: string, value: any };

function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'GO_TO_DECK_SELECT':
      return { ...INITIAL_STATE, phase: 'DECK_SELECT' };
      
    case 'START_GAME':
      const selectedDeck = DECKS_DATA.find(d => d.id === action.deckId)!;
      return {
        ...INITIAL_STATE,
        selectedDeckId: action.deckId,
        money: selectedDeck.stats.money,
        jokerSlots: selectedDeck.stats.jokerSlots,
        handSize: selectedDeck.stats.handSize,
        deck: createDeck(),
        phase: 'BLIND_SELECT',
        handLevels: JSON.parse(JSON.stringify(INITIAL_HAND_LEVELS))
      };

    case 'SELECT_BLIND': {
      const deckStats = DECKS_DATA.find(d => d.id === state.selectedDeckId)!.stats;
      return {
        ...state,
        currentBlind: action.blind,
        phase: 'PLAY_HAND',
        handsLeft: deckStats.hands,
        discardsLeft: deckStats.discards,
        currentScore: 0,
        displayScore: 0,
        discardPile: [],
        deck: createDeck(),
        hand: []
      };
    }

    case 'DEAL_HAND': {
      const currentHandSize = state.hand.length;
      const needed = state.handSize - currentHandSize;
      if (needed <= 0) return state;
      
      const newDeck = [...state.deck];
      let newHand = [...state.hand];
      
      for (let i = 0; i < needed; i++) {
        if (newDeck.length === 0) break;
        const randomIndex = Math.floor(Math.random() * newDeck.length);
        const card = newDeck[randomIndex];
        card.isDebuffed = checkDebuffs(card, state.currentBlind);
        newHand.push(card);
        newDeck.splice(randomIndex, 1);
      }
      
      newHand = sortCards(newHand, 'Rank');
      return { ...state, deck: newDeck, hand: newHand };
    }

    case 'TOGGLE_CARD':
      const selectedCount = state.hand.filter(c => c.selected).length;
      return {
        ...state,
        hand: state.hand.map(c => {
          if (c.id === action.cardId) {
            if (!c.selected && selectedCount >= 5) return c;
            return { ...c, selected: !c.selected };
          }
          return c;
        })
      };

    case 'DISCARD_HAND': {
      if (state.discardsLeft <= 0) return state;
      
      let newMoney = state.money;
      const effects: string[] = [];
      
      // Green Deck Logic: Earn $1 per discard
      if (state.selectedDeckId === 'green_deck') {
          newMoney += 1;
          effects.push("Green Deck +$1");
      }

      const kept = state.hand.filter(c => !c.selected);
      return {
        ...state,
        money: newMoney,
        hand: kept,
        discardsLeft: state.discardsLeft - 1,
        activeEffects: [...state.activeEffects, ...effects]
      };
    }

    case 'SORT_HAND':
        return {
            ...state,
            hand: sortCards(state.hand, action.sortBy)
        };

    case 'PLAY_HAND': 
        return { ...state, phase: 'SCORING' };
    
    case 'UPDATE_SCORE_VISUAL':
        return { ...state, displayScore: action.score };

    case 'FINISH_SCORING':
      const newScore = state.currentScore + action.points;
      const beatBlind = newScore >= state.currentBlind.scoreGoal;
      return {
        ...state,
        currentScore: newScore,
        displayScore: newScore,
        phase: beatBlind ? 'VICTORY' : 'PLAY_HAND',
        hand: state.hand.filter(c => !c.selected),
        handsLeft: state.handsLeft - 1
      };

    case 'END_ROUND':
        if (state.currentScore < state.currentBlind.scoreGoal) return { ...state, phase: 'GAME_OVER' };
        
        let money = state.money;
        
        // Green Deck Logic: No interest
        if (state.selectedDeckId === 'green_deck') {
            money += (state.handsLeft * 2);
        } else {
            const interest = Math.min(5, Math.floor(money / 5));
            money += interest;
        }

        const totalReward = state.currentBlind.reward;
        money += totalReward;

        return { 
            ...state, 
            phase: 'SHOP', 
            money: money,
            shopInventory: generateShop(state)
        };

    case 'BUY_ITEM':
        const item = action.item;
        if (state.money < item.cost) return state;
        
        const newShop = [...state.shopInventory];
        newShop.splice(action.index, 1);
        let newState = { ...state, money: state.money - item.cost, shopInventory: newShop };

        if (item.type === 'Tarot' || item.type === 'Planet') {
             if (newState.consumables.length < newState.consumableSlots) {
                 newState.consumables = [...newState.consumables, item];
             } else { return state; }
        } else {
             if (newState.jokers.length < newState.jokerSlots) {
                 newState.jokers = [...newState.jokers, item];
             } else { return state; }
        }
        return newState;

    case 'USE_CONSUMABLE': {
        const cons = state.consumables.find(c => c.id === action.id);
        if (!cons) return state;

        let modifiedState = { ...state };
        
        if (cons.type === 'Planet') {
             let handType = HandType.HighCard;
             if (cons.name === 'Mercury') handType = HandType.Pair;
             if (cons.name === 'Venus') handType = HandType.ThreeOfAKind;
             if (cons.name === 'Earth') handType = HandType.FullHouse;
             if (cons.name === 'Mars') handType = HandType.FourOfAKind;
             if (cons.name === 'Jupiter') handType = HandType.Flush;
             if (cons.name === 'Saturn') handType = HandType.Straight;
             if (cons.name === 'Uranus') handType = HandType.TwoPair;
             if (cons.name === 'Neptune') handType = HandType.StraightFlush;
             
             modifiedState.handLevels = {
                 ...modifiedState.handLevels,
                 [handType]: {
                     ...modifiedState.handLevels[handType],
                     level: modifiedState.handLevels[handType].level + 1,
                     chips: modifiedState.handLevels[handType].chips + (handType === HandType.Flush ? 15 : 10),
                     mult: modifiedState.handLevels[handType].mult + 1
                 }
             };
        } else if (cons.type === 'Tarot' && action.targetCardId) {
             modifiedState.hand = modifiedState.hand.map(c => {
                 if (c.id === action.targetCardId) {
                     if (cons.name === 'The Empress') return { ...c, enhancement: Enhancement.Mult };
                     if (cons.name === 'The Magician') return { ...c, enhancement: Enhancement.Gold };
                     if (cons.name === 'The Lovers') return { ...c, enhancement: Enhancement.Wild };
                     if (cons.name === 'The Chariot') return { ...c, enhancement: Enhancement.Steel };
                     if (cons.name === 'Strength') return { ...c, rank: c.rank < Rank.Ace ? c.rank + 1 : Rank.Ace };
                     if (cons.name === 'Death') return c;
                 }
                 return c;
             });
        }
        modifiedState.consumables = modifiedState.consumables.filter(c => c.id !== action.id);
        return modifiedState;
    }

    case 'REROLL_SHOP':
         if (state.money < 5) return state;
         return {
             ...state,
             money: state.money - 5,
             shopInventory: generateShop(state)
         };

    case 'NEXT_ROUND': {
        let nextRound = state.round + 1;
        let nextAnte = state.ante;
        
        if (state.round % 3 === 0) {
            nextAnte = state.ante + 1;
        }

        return {
            ...state,
            round: nextRound,
            ante: nextAnte,
            phase: 'BLIND_SELECT',
            currentScore: 0,
            displayScore: 0
        };
    }

    case 'GAME_OVER': return INITIAL_STATE;
    
    case 'LOG_EFFECT':
        return { ...state, activeEffects: [...state.activeEffects, action.message] };
    
    case 'CLEAR_LOGS':
        return { ...state, activeEffects: [] };

    case 'UPDATE_JOKER_STATE':
        return {
            ...state,
            jokerState: { ...state.jokerState, [action.key]: action.value }
        };

    default: return state;
  }
}

function generateShop(state: GameState): (Joker | Consumable)[] {
    const items: (Joker | Consumable)[] = [];
    for(let i=0; i<2; i++) items.push(JOKERS_DATA[Math.floor(Math.random() * JOKERS_DATA.length)]);
    items.push(PLANETS_DATA[Math.floor(Math.random() * PLANETS_DATA.length)]);
    items.push(TAROTS_DATA[Math.floor(Math.random() * TAROTS_DATA.length)]);
    return items;
}

// --- Components ---

const ScoringOverlay: React.FC<{ 
    active: boolean, chips: number, mult: number, total: number, log: string[]
}> = ({ active, chips, mult, total, log }) => {
    if (!active) return null;
    return (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-none">
            <div className="bg-black/90 backdrop-blur-xl p-10 rounded-3xl border-4 border-orange-500 shadow-[0_0_100px_rgba(249,115,22,0.4)] flex flex-col items-center animate-in fade-in zoom-in duration-300">
                <div className="text-3xl text-slate-300 mb-4 font-bold uppercase tracking-widest font-[JetBrains_Mono]">Hand Score</div>
                <div className="flex items-center gap-6 text-7xl font-black mb-6 font-[Crimson_Pro]">
                    <div className="flex flex-col items-center">
                        <span className="text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.8)]">{Math.floor(chips)}</span>
                        <span className="text-sm text-blue-300/50 uppercase tracking-widest font-sans mt-2">Chips</span>
                    </div>
                    <span className="text-white text-5xl opacity-50">X</span>
                    <div className="flex flex-col items-center">
                        <span className="text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">{mult.toFixed(1)}</span>
                        <span className="text-sm text-red-400/50 uppercase tracking-widest font-sans mt-2">Mult</span>
                    </div>
                </div>
                <div className="h-1 w-full bg-gradient-to-r from-transparent via-white/20 to-transparent mb-6"></div>
                <div className="text-9xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,1)] scale-110 transition-all font-[Crimson_Pro]">{Math.floor(total).toLocaleString()}</div>
                {total > 1000 && <div className="absolute inset-0 -z-10 overflow-hidden rounded-3xl"><div className="flame opacity-30 mix-blend-screen"></div></div>}
            </div>
            <div className="absolute bottom-40 flex flex-col items-center gap-2">
                {log.slice(-3).map((msg, i) => (
                    <div key={i} className="text-yellow-300 font-bold text-2xl drop-shadow-md animate-bounce bg-black/50 px-4 py-1 rounded-full backdrop-blur-sm border border-yellow-500/30">{msg}</div>
                ))}
            </div>
        </div>
    );
};

const RunInfoModal: React.FC<{ active: boolean; onClose: () => void; handLevels: GameState['handLevels']; deckId: string; }> = ({ active, onClose, handLevels, deckId }) => {
    if (!active) return null;
    const hands = Object.keys(handLevels) as HandType[];
    const deckDef = DECKS_DATA.find(d => d.id === deckId)!;

    return (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-slate-800 p-6 flex justify-between items-center border-b border-slate-700">
                    <h2 className="text-3xl font-black text-white uppercase tracking-wider">Run Info</h2>
                    <button onClick={onClose} className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-xl font-bold transition-all">CLOSE</button>
                </div>
                <div className="overflow-y-auto p-8 space-y-8">
                    <div className={`p-6 rounded-2xl border-l-8 ${deckDef.color.replace('bg-', 'border-')} bg-slate-800/50 flex items-center gap-6`}>
                        <div className={`w-20 h-32 ${deckDef.color} rounded-xl shadow-lg`}></div>
                        <div>
                            <div className="text-3xl font-bold text-white mb-2">{deckDef.name}</div>
                            <div className="text-slate-300 text-lg">{deckDef.description}</div>
                        </div>
                    </div>
                    <div>
                         <h3 className="text-2xl font-bold text-white mb-4">Hand Levels</h3>
                         <div className="grid grid-cols-1 gap-2">
                            {hands.map(handType => {
                                const level = handLevels[handType];
                                return (
                                    <div key={handType} className="grid grid-cols-12 gap-4 bg-slate-800/40 p-3 rounded-lg items-center border border-white/5">
                                        <div className="col-span-4 font-bold text-white">{handType}</div>
                                        <div className="col-span-2 font-bold text-blue-300 text-sm bg-blue-900/30 px-2 py-1 rounded text-center">Lvl.{level.level}</div>
                                        <div className="col-span-6 text-right font-black font-mono text-lg">
                                            <span className="text-blue-400">{level.chips}</span> <span className="text-white/40">X</span> <span className="text-red-400">{level.mult}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// --- Main App ---

const App: React.FC = () => {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);
  const [shake, setShake] = useState(false);
  const [showRunInfo, setShowRunInfo] = useState(false);
  const [scoringState, setScoringState] = useState<{active: boolean, chips: number, mult: number, total: number}>({ active: false, chips: 0, mult: 0, total: 0 });
  const [selectedConsumable, setSelectedConsumable] = useState<string | null>(null);
  const [triggeredJoker, setTriggeredJoker] = useState<string | null>(null);

  // --- Effects ---

  useEffect(() => {
    if (state.phase === 'PLAY_HAND' && state.hand.length < state.handSize && state.deck.length > 0) {
      const timeout = setTimeout(() => { dispatch({ type: 'DEAL_HAND' }); }, 300);
      return () => clearTimeout(timeout);
    }
  }, [state.phase, state.hand.length]);

  useEffect(() => {
    if (state.phase === 'PLAY_HAND' && state.handsLeft === 0 && state.hand.length === state.handSize) {
        if (state.currentScore < state.currentBlind.scoreGoal) {
             setTimeout(() => dispatch({ type: 'GAME_OVER' }), 1500);
        }
    }
  }, [state.handsLeft, state.currentScore, state.phase]);

  const runScoringSequence = async () => {
    dispatch({ type: 'PLAY_HAND' });
    const selectedCards = state.hand.filter(c => c.selected);
    const result = evaluateHand(selectedCards, state.handLevels);
    let chips = result.baseChips;
    let mult = result.baseMult;
    
    setScoringState({ active: true, chips, mult, total: chips * mult });
    const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

    // 1. Card Scoring Loop
    for (const card of result.scoringCards) {
        if (card.isDebuffed) continue;
        await wait(350);
        
        // Base Card Value
        chips += card.chips;
        
        // Enhancements
        if (card.enhancement === Enhancement.Bonus) chips += 30;
        if (card.enhancement === Enhancement.Mult) mult += 4;
        if (card.enhancement === Enhancement.Glass) { 
            mult *= 2; 
            dispatch({ type: 'LOG_EFFECT', message: 'Glass x2' }); 
        }
        
        // Editions
        if (card.edition === Edition.Foil) chips += 50;
        if (card.edition === Edition.Holographic) mult += 10;
        if (card.edition === Edition.Polychrome) mult *= 1.5;

        // Specific Card Triggers (e.g. Fibonacci)
        for (const joker of state.jokers) {
            const effect = joker.effect(state, { type: 'card_score', card, scoringHand: result });
            if (effect) {
                if (effect.chips) chips += effect.chips;
                if (effect.mult) mult += effect.mult;
                dispatch({ type: 'LOG_EFFECT', message: effect.message });
                setTriggeredJoker(joker.id);
                setTimeout(() => setTriggeredJoker(null), 300);
                await wait(200);
            }
        }
        setScoringState({ active: true, chips, mult, total: chips * mult });
    }

    // 2. Held in Hand Triggers
    const heldCards = state.hand.filter(c => !c.selected && !c.isDebuffed);
    for (const card of heldCards) {
        if (card.enhancement === Enhancement.Steel) {
            await wait(300);
            mult *= 1.5;
            dispatch({ type: 'LOG_EFFECT', message: 'Steel x1.5' });
            setScoringState({ active: true, chips, mult, total: chips * mult });
        }
    }

    // 3. Joker Global Triggers
    for (const joker of state.jokers) {
        const effect = joker.effect(state, { type: 'hand_score', scoringHand: result });
        if (effect) {
            await wait(500); // Slower pacing for impact
            setTriggeredJoker(joker.id);
            if (effect.chips) chips += effect.chips;
            if (effect.mult) mult += effect.mult;
            if (effect.x_mult) mult *= effect.x_mult;
            dispatch({ type: 'LOG_EFFECT', message: `${effect.message}` });
            setScoringState({ active: true, chips, mult, total: chips * mult });
            
            // Scaling Logic
            if (joker.id === 'j_runner' && result.type === HandType.Straight) {
                 const current = state.jokerState['j_runner_chips'] || 0;
                 dispatch({ type: 'UPDATE_JOKER_STATE', key: 'j_runner_chips', value: current + 10 });
            }
            if (joker.id === 'j_green') {
                 const current = state.jokerState['j_green_mult'] || 0;
                 dispatch({ type: 'UPDATE_JOKER_STATE', key: 'j_green_mult', value: current + 1 });
            }
            
            await wait(200);
            setTriggeredJoker(null);
        }
    }

    await wait(800);
    const finalScore = Math.floor(chips * mult);
    if (finalScore > state.currentBlind.scoreGoal * 0.25) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
    }
    setScoringState(prev => ({ ...prev, active: false }));
    dispatch({ type: 'CLEAR_LOGS' });
    dispatch({ type: 'FINISH_SCORING', points: finalScore });
  };

  const handleDiscard = async () => {
     if (state.phase !== 'PLAY_HAND' || state.discardsLeft <= 0) return;
     const greenJoker = state.jokers.find(j => j.id === 'j_green');
     if (greenJoker) {
         const current = state.jokerState['j_green_mult'] || 0;
         if (current > 0) {
            dispatch({ type: 'UPDATE_JOKER_STATE', key: 'j_green_mult', value: Math.max(0, current - 1) });
            dispatch({ type: 'LOG_EFFECT', message: 'Green Joker -1' });
            setTimeout(() => dispatch({ type: 'CLEAR_LOGS' }), 1000);
         }
     }
     dispatch({ type: 'DISCARD_HAND' });
  };

  const handleConsumableClick = (cons: Consumable) => {
      if (cons.type === 'Planet') dispatch({ type: 'USE_CONSUMABLE', id: cons.id });
      else {
          if (selectedConsumable === cons.id) setSelectedConsumable(null);
          else setSelectedConsumable(cons.id);
      }
  };

  const handleCardClick = (card: CardData) => {
      if (selectedConsumable) {
          dispatch({ type: 'USE_CONSUMABLE', id: selectedConsumable, targetCardId: card.id });
          setSelectedConsumable(null);
      } else dispatch({ type: 'TOGGLE_CARD', cardId: card.id });
  };

  // --- UI RENDER ---

  if (state.phase === 'MENU' || state.phase === 'GAME_OVER') {
    return (
      <div className="relative w-screen h-screen flex flex-col items-center justify-center text-white overflow-hidden">
        <Background />
        <h1 className="text-[10rem] font-black mb-4 tracking-tighter text-red-500 drop-shadow-[0_0_40px_rgba(239,68,68,0.6)] transform -rotate-3 font-[Crimson_Pro]">JIMBO</h1>
        <div className="text-3xl font-bold tracking-[1em] text-blue-300 mb-16 uppercase opacity-80">Roguelike Deckbuilder</div>
        {state.phase === 'GAME_OVER' && (
            <div className="bg-black/90 p-8 rounded-3xl border-2 border-red-500 text-center mb-8 animate-bounce backdrop-blur-md shadow-2xl">
                <h2 className="text-6xl font-bold text-white mb-2">GAME OVER</h2>
                <div className="text-2xl text-slate-400">Round {state.round} - Ante {state.ante}</div>
            </div>
        )}
        <button onClick={() => dispatch({ type: 'GO_TO_DECK_SELECT' })} className="group relative px-20 py-8 bg-gradient-to-br from-orange-400 to-orange-600 hover:from-orange-300 hover:to-orange-500 text-white font-black text-5xl rounded-2xl shadow-[0_0_50px_rgba(249,115,22,0.5)] transition-all hover:scale-105 active:scale-95 overflow-hidden">
            <span className="relative z-10 drop-shadow-md">PLAY</span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
        </button>
      </div>
    );
  }

  if (state.phase === 'DECK_SELECT') {
      return (
          <div className="relative w-screen h-screen flex flex-col items-center justify-center text-white p-8">
              <Background />
              <h2 className="text-5xl font-black mb-12 drop-shadow-lg">SELECT DECK</h2>
              <div className="flex gap-8 overflow-x-auto max-w-full p-8 pb-16 snap-x">
                  {DECKS_DATA.map(deck => (
                      <div key={deck.id} onClick={() => dispatch({ type: 'START_GAME', deckId: deck.id })}
                           className="w-72 h-96 bg-slate-800 rounded-3xl border-4 border-slate-600 hover:border-white cursor-pointer relative group transition-all hover:-translate-y-6 hover:shadow-[0_0_40px_rgba(255,255,255,0.2)] flex-shrink-0 snap-center overflow-hidden">
                           <div className={`absolute top-0 left-0 w-full h-1/2 ${deck.color} opacity-80 group-hover:opacity-100 transition-opacity`}></div>
                           <div className="absolute top-6 left-6 text-3xl font-black shadow-black drop-shadow-md z-10">{deck.name}</div>
                           <div className="absolute top-1/2 mt-6 px-6 w-full">
                               <div className="text-lg text-slate-300 font-bold mb-6 leading-tight">{deck.description}</div>
                               <div className="grid grid-cols-2 gap-3 text-xs text-slate-400 font-mono">
                                   <div className="bg-black/50 p-2 rounded-lg text-center"><span className="block text-blue-400 text-lg font-bold">{deck.stats.hands}</span> Hands</div>
                                   <div className="bg-black/50 p-2 rounded-lg text-center"><span className="block text-red-400 text-lg font-bold">{deck.stats.discards}</span> Discards</div>
                                   <div className="bg-black/50 p-2 rounded-lg text-center"><span className="block text-purple-400 text-lg font-bold">{deck.stats.jokerSlots}</span> Slots</div>
                                   <div className="bg-black/50 p-2 rounded-lg text-center"><span className="block text-yellow-400 text-lg font-bold">${deck.stats.money}</span> Start</div>
                               </div>
                           </div>
                      </div>
                  ))}
              </div>
          </div>
      )
  }

  if (state.phase === 'BLIND_SELECT') {
      const blindConfig = getBlindConfig(state.ante);
      const roundInAnte = ((state.round - 1) % 3) + 1;

      return (
        <div className="relative w-screen h-screen flex flex-col items-center justify-center text-white">
             <Background />
             <div className="absolute top-8 right-8">
                 <button onClick={() => setShowRunInfo(true)} className="bg-slate-800/80 hover:bg-slate-700 px-6 py-3 rounded-xl font-bold border border-white/10 backdrop-blur">Run Info</button>
             </div>
             
             <div className="flex flex-col items-center mb-16">
                 <div className="text-orange-500 font-bold tracking-[0.5em] mb-2 uppercase text-lg">Current Progress</div>
                 <h2 className="text-7xl font-black text-white drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]">ANTE {state.ante}</h2>
             </div>
             
             <div className="flex gap-10 perspective-1000">
                 {/* Blind 1 */}
                 <div onClick={() => roundInAnte === 1 && dispatch({ type: 'SELECT_BLIND', blind: { name: 'Small Blind', scoreGoal: blindConfig.small, reward: 3, isBoss: false } })}
                      className={`w-72 h-[28rem] bg-slate-800 rounded-3xl border-4 border-blue-500/50 p-8 flex flex-col items-center justify-between transition-all shadow-2xl relative group
                        ${roundInAnte === 1 ? 'hover:scale-105 hover:-translate-y-4 cursor-pointer hover:shadow-[0_0_40px_rgba(59,130,246,0.4)] opacity-100 border-blue-500' : 'opacity-40 grayscale pointer-events-none'}`}>
                     <div className="text-4xl font-bold text-blue-400">Small Blind</div>
                     <div className="text-6xl font-black tracking-tighter">{formatScore(blindConfig.small)}</div>
                     <div className="text-2xl font-bold text-white bg-blue-600/20 px-6 py-3 rounded-xl border border-blue-500/30">Reward: <span className="text-yellow-400">$3</span></div>
                     {roundInAnte > 1 && <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-3xl backdrop-blur-sm"><span className="text-green-500 font-black text-5xl -rotate-12 border-8 border-green-500 px-6 py-2 rounded-xl transform scale-110">DEFEATED</span></div>}
                 </div>

                 {/* Blind 2 */}
                 <div onClick={() => roundInAnte === 2 && dispatch({ type: 'SELECT_BLIND', blind: { name: 'Big Blind', scoreGoal: blindConfig.big, reward: 4, isBoss: false } })}
                      className={`w-72 h-[28rem] bg-slate-800 rounded-3xl border-4 border-orange-500/50 p-8 flex flex-col items-center justify-between transition-all shadow-2xl relative
                      ${roundInAnte === 2 ? 'hover:scale-105 hover:-translate-y-4 cursor-pointer hover:shadow-[0_0_40px_rgba(249,115,22,0.4)] opacity-100 border-orange-500' : 'opacity-40 grayscale pointer-events-none'}`}>
                     <div className="text-4xl font-bold text-orange-400">Big Blind</div>
                     <div className="text-6xl font-black tracking-tighter">{formatScore(blindConfig.big)}</div>
                     <div className="text-2xl font-bold text-white bg-orange-600/20 px-6 py-3 rounded-xl border border-orange-500/30">Reward: <span className="text-yellow-400">$4</span></div>
                     {roundInAnte > 2 && <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-3xl backdrop-blur-sm"><span className="text-green-500 font-black text-5xl -rotate-12 border-8 border-green-500 px-6 py-2 rounded-xl transform scale-110">DEFEATED</span></div>}
                 </div>

                 {/* Boss */}
                 <div onClick={() => roundInAnte === 3 && dispatch({ type: 'SELECT_BLIND', blind: { name: 'The Wall', scoreGoal: blindConfig.boss, reward: 5, isBoss: true, bossEffect: 'None' } })}
                      className={`w-72 h-[28rem] bg-slate-800 rounded-3xl border-4 border-red-600/50 p-8 flex flex-col items-center justify-between transition-all shadow-2xl relative overflow-hidden
                      ${roundInAnte === 3 ? 'hover:scale-105 hover:-translate-y-4 cursor-pointer hover:shadow-[0_0_50px_rgba(220,38,38,0.5)] opacity-100 border-red-600' : 'opacity-40 grayscale pointer-events-none'}`}>
                     <div className="absolute inset-0 bg-red-900/10 animate-pulse"></div>
                     <div className="text-4xl font-bold text-red-500 relative">The Boss</div>
                     <div className="text-6xl font-black tracking-tighter relative">{formatScore(blindConfig.boss)}</div>
                     <div className="text-center relative w-full">
                         <div className="text-red-300 font-bold mb-4 uppercase tracking-wider text-sm border-b border-red-500/30 pb-2">Random Ability</div>
                         <div className="text-2xl font-bold text-white bg-red-600/20 px-6 py-3 rounded-xl border border-red-500/30">Reward: <span className="text-yellow-400">$5</span></div>
                     </div>
                 </div>
             </div>
             <RunInfoModal active={showRunInfo} onClose={() => setShowRunInfo(false)} handLevels={state.handLevels} deckId={state.selectedDeckId} />
        </div>
      )
  }

  // --- SHOP ---
  if (state.phase === 'SHOP') {
      return (
          <div className="relative w-screen h-screen flex flex-col items-center pt-8 text-white">
               <Background />
               <div className="absolute top-8 right-8">
                 <button onClick={() => setShowRunInfo(true)} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg font-bold border border-white/20">Run Info</button>
               </div>
               <div className="w-full max-w-7xl flex justify-between items-center mb-12 px-8">
                    <div className="bg-slate-900/80 p-8 rounded-3xl backdrop-blur-xl border border-white/10 shadow-2xl">
                        <div className="text-sm text-slate-400 uppercase tracking-widest mb-1 font-bold">Welcome to</div>
                        <h2 className="text-6xl font-black text-yellow-400 drop-shadow-md">The Shop</h2>
                    </div>
                    <div className="flex gap-4">
                        <div className="bg-slate-900/80 px-10 py-6 rounded-3xl backdrop-blur-xl border border-green-500/30 shadow-2xl">
                            <div className="text-sm text-green-300 uppercase font-bold tracking-widest">Your Money</div>
                            <div className="text-5xl font-black text-green-400 drop-shadow-md">${state.money}</div>
                        </div>
                    </div>
               </div>
               <div className="grid grid-cols-4 gap-10 mb-12 max-w-7xl w-full px-8">
                   {state.shopInventory.map((item, idx) => (
                       <div key={idx} className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700" style={{animationDelay: `${idx * 100}ms`}}>
                           <div className={`w-full h-80 rounded-2xl border-4 ${item.visual.borderColor} ${item.visual.bgColor} flex flex-col items-center justify-center p-6 text-center shadow-2xl relative overflow-hidden group hover:scale-105 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]`}>
                                <div className="text-7xl mb-6 drop-shadow-2xl transform group-hover:rotate-12 transition-transform duration-300 scale-110">{item.visual.icon}</div>
                                <div className="text-2xl font-black mb-3 text-white uppercase drop-shadow-md">{item.name}</div>
                                <div className="text-sm text-white/90 font-bold bg-black/30 p-3 rounded-xl w-full backdrop-blur-sm">{item.description}</div>
                                <div className="absolute top-4 right-4 bg-yellow-400 text-black font-black px-3 py-1 rounded-full text-lg shadow-lg">${item.cost}</div>
                           </div>
                           <button onClick={() => dispatch({ type: 'BUY_ITEM', item, index: idx })} disabled={state.money < item.cost}
                                className={`w-full py-4 rounded-xl font-bold text-xl shadow-lg transition-all transform hover:-translate-y-1 active:translate-y-0 ${state.money >= item.cost ? 'bg-green-600 hover:bg-green-500 text-white shadow-green-600/40' : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-white/5'}`}>
                                BUY
                            </button>
                       </div>
                   ))}
               </div>
               <div className="flex gap-8 mt-auto mb-16">
                   <button onClick={() => dispatch({ type: 'REROLL_SHOP' })} className="px-12 py-6 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black text-2xl shadow-[0_0_30px_rgba(37,99,235,0.4)] transition-all hover:scale-105">Reroll ($5)</button>
                   <button onClick={() => dispatch({ type: 'NEXT_ROUND' })} className="px-12 py-6 bg-orange-600 hover:bg-orange-500 rounded-2xl font-black text-2xl shadow-[0_0_30px_rgba(234,88,12,0.4)] transition-all hover:scale-105">Next Round</button>
               </div>
               <RunInfoModal active={showRunInfo} onClose={() => setShowRunInfo(false)} handLevels={state.handLevels} deckId={state.selectedDeckId} />
          </div>
      )
  }

  // --- PLAY UI ---
  const selectedCount = state.hand.filter(c => c.selected).length;
  const bestHand = evaluateHand(state.hand.filter(c => c.selected), state.handLevels);

  return (
    <div className={`relative w-screen h-screen overflow-hidden text-white ${shake ? 'shake-screen' : ''}`}>
      <Background />
      <ScoringOverlay {...scoringState} log={state.activeEffects} />
      <RunInfoModal active={showRunInfo} onClose={() => setShowRunInfo(false)} handLevels={state.handLevels} deckId={state.selectedDeckId} />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-10 pointer-events-none">
        <div className="flex flex-col gap-2 bg-slate-900/80 p-6 rounded-3xl backdrop-blur-xl border border-white/10 shadow-2xl min-w-[320px]">
            <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-1">
                <div className="text-xs uppercase text-slate-400 tracking-widest font-bold">Score to Beat</div>
                <div className="text-sm text-blue-300 font-bold bg-blue-900/30 px-2 py-1 rounded">{state.currentBlind.name}</div>
            </div>
            <div className="text-5xl font-black text-white font-[Crimson_Pro] flex items-baseline gap-2">
                <span className="text-white drop-shadow-md">{Math.floor(state.displayScore).toLocaleString()}</span> 
                <span className="text-3xl text-slate-600">/</span>
                <span className="text-red-500 drop-shadow-md">{formatScore(state.currentBlind.scoreGoal)}</span>
            </div>
        </div>
        <div className="flex flex-col gap-3 bg-slate-900/80 p-6 rounded-3xl backdrop-blur-xl border border-white/10 items-end shadow-2xl pointer-events-auto">
            <div className="flex gap-12">
                <div className="text-center"><div className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">Hands</div><div className="text-4xl font-black text-blue-400">{state.handsLeft}</div></div>
                <div className="text-center"><div className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">Discards</div><div className="text-4xl font-black text-red-400">{state.discardsLeft}</div></div>
                <div className="text-center"><div className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">Money</div><div className="text-4xl font-black text-yellow-400">${state.money}</div></div>
            </div>
            <div className="flex items-center gap-4 mt-2 w-full justify-end">
                <div className="text-xs font-bold bg-white/10 px-3 py-1 rounded-full text-slate-300">Ante {state.ante} <span className="mx-1 opacity-50">|</span> Round {state.round}</div>
                <button onClick={() => setShowRunInfo(true)} className="bg-slate-700 hover:bg-slate-600 px-4 py-1 rounded-lg font-bold text-xs border border-white/20 transition-colors">Run Info</button>
            </div>
        </div>
      </div>

      {/* Jokers Area */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 flex gap-4 z-20">
          {state.jokers.map((joker, i) => {
              const isTriggered = triggeredJoker === joker.id;
              return (
                <div key={i} className={`
                    w-24 h-36 border-4 ${joker.visual.borderColor} ${joker.visual.bgColor} rounded-xl shadow-xl 
                    flex flex-col items-center justify-center text-center p-2 relative group 
                    transition-all duration-300 cursor-help
                    ${isTriggered ? 'scale-125 z-50 shadow-[0_0_30px_white] brightness-125' : 'hover:scale-110 hover:-translate-y-2'}
                `}>
                    <div className={`text-5xl mb-2 filter drop-shadow-md ${isTriggered ? 'animate-bounce' : ''}`}>{joker.visual.icon}</div>
                    <span className="text-[10px] font-black leading-tight text-white drop-shadow-sm uppercase">{joker.name}</span>
                    <div className="absolute top-full mt-4 bg-slate-900 text-white text-xs p-4 rounded-xl shadow-2xl w-48 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity border border-white/20">
                        <div className="font-bold text-lg text-white mb-1">{joker.name}</div>
                        <div className="text-slate-300 font-medium">{joker.description}</div>
                        <div className="mt-2 text-[10px] text-slate-500 uppercase font-bold tracking-wider">{joker.rarity}</div>
                    </div>
                </div>
              );
          })}
          {Array.from({length: state.jokerSlots - state.jokers.length}).map((_, i) => (
              <div key={`empty-j-${i}`} className="w-24 h-36 border-2 border-dashed border-white/10 rounded-xl bg-black/20 flex items-center justify-center text-white/10 font-black text-sm tracking-widest">JOKER</div>
          ))}
      </div>

      {/* Consumables Area */}
      <div className="absolute top-[20%] right-8 flex flex-col gap-4 z-20 pointer-events-auto">
          {state.consumables.map((cons, i) => (
              <div key={i} onClick={() => handleConsumableClick(cons)}
                   className={`w-20 h-28 border-2 rounded-xl shadow-lg flex flex-col items-center justify-center text-center p-1 relative cursor-pointer hover:scale-110 transition-transform ${cons.visual.bgColor} ${cons.visual.borderColor} ${selectedConsumable === cons.id ? 'ring-4 ring-white animate-pulse shadow-[0_0_20px_white]' : ''}`}>
                  <div className="text-3xl mb-1 drop-shadow-md">{cons.visual.icon}</div>
                  <span className="text-[9px] font-black leading-tight uppercase tracking-wide">{cons.name}</span>
                  <div className="absolute right-full mr-4 bg-slate-900 text-white text-xs p-3 rounded-xl w-40 opacity-0 hover:opacity-100 pointer-events-none z-50 border border-white/20 shadow-xl">
                      <div className="font-bold mb-1">{cons.name}</div>
                      {cons.description}
                      {cons.type === 'Tarot' && <div className="text-yellow-400 mt-2 text-[10px] font-bold uppercase tracking-widest">Click to Use</div>}
                  </div>
              </div>
          ))}
          {Array.from({length: state.consumableSlots - state.consumables.length}).map((_, i) => (
               <div key={`empty-c-${i}`} className="w-20 h-28 border-2 border-dashed border-white/10 rounded-xl bg-black/20 flex items-center justify-center text-[10px] text-white/10 font-bold">ITEM</div>
          ))}
      </div>

      {/* Victory Modal */}
      {state.phase === 'VICTORY' && (
           <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl animate-in fade-in duration-500">
               <h1 className="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 mb-6 drop-shadow-[0_0_30px_rgba(234,179,8,0.5)] tracking-tighter">VICTORY</h1>
               <div className="text-5xl text-white mb-16 font-bold tracking-widest drop-shadow-lg">Score: {state.currentScore.toLocaleString()}</div>
               <button className="px-16 py-6 bg-blue-600 hover:bg-blue-500 rounded-2xl text-3xl font-black shadow-[0_0_40px_rgba(37,99,235,0.6)] transition-all hover:scale-110 active:scale-95" onClick={() => dispatch({ type: 'END_ROUND' })}>GO TO SHOP</button>
           </div>
      )}

      {/* Hand Area */}
      <div className="absolute bottom-0 w-full h-[500px] flex flex-col items-center justify-end pb-12 z-30 pointer-events-none">
          <div className="pointer-events-auto flex items-end gap-6 mb-10">
              <div className="flex flex-col gap-3">
                 <div className="flex gap-2 justify-center">
                    <button onClick={() => dispatch({ type: 'SORT_HAND', sortBy: 'Rank'})} className="bg-slate-800 hover:bg-slate-700 border border-white/10 px-4 py-2 rounded-lg font-bold text-xs shadow-lg transition-colors text-slate-300">Sort Rank</button>
                    <button onClick={() => dispatch({ type: 'SORT_HAND', sortBy: 'Suit'})} className="bg-slate-800 hover:bg-slate-700 border border-white/10 px-4 py-2 rounded-lg font-bold text-xs shadow-lg transition-colors text-slate-300">Sort Suit</button>
                 </div>
                 <div className="flex flex-col items-center bg-slate-900/90 p-5 rounded-2xl border border-white/10 w-72 shadow-2xl backdrop-blur-md">
                    <div className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Hand Type</div>
                    <div className="text-2xl font-black text-white mb-3 tracking-wide">{selectedCount > 0 ? bestHand.type : 'Select Cards'}</div>
                    <div className="flex gap-3 items-center bg-black/40 px-6 py-3 rounded-xl border border-white/5 w-full justify-center">
                        <span className="text-3xl font-black text-blue-400 drop-shadow">{bestHand.baseChips}</span>
                        <span className="text-sm text-slate-600 font-bold">X</span>
                        <span className="text-3xl font-black text-red-400 drop-shadow">{bestHand.baseMult}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-2 font-bold bg-white/5 px-2 py-1 rounded">Lvl.{state.handLevels[bestHand.type].level}</div>
                </div>
              </div>
              
              <div className="flex gap-4">
                  <button onClick={runScoringSequence} disabled={selectedCount === 0 || state.phase !== 'PLAY_HAND'} 
                      className={`px-12 py-8 rounded-3xl font-black text-4xl tracking-wider shadow-xl transition-all transform hover:-translate-y-2 active:translate-y-0 active:scale-95 flex flex-col items-center justify-center min-w-[200px] border-b-8
                      ${selectedCount > 0 ? 'bg-orange-500 text-white hover:bg-orange-400 shadow-orange-500/50 border-orange-700' : 'bg-slate-800 text-slate-600 cursor-not-allowed border-slate-900'}`}>
                      PLAY
                      <span className="text-xs font-bold opacity-60 mt-1 uppercase tracking-widest">Hand</span>
                  </button>
                  <button onClick={handleDiscard} disabled={selectedCount === 0 || state.discardsLeft === 0 || state.phase !== 'PLAY_HAND'} 
                      className={`px-8 py-6 rounded-3xl font-black text-2xl tracking-wide shadow-xl transition-all transform hover:-translate-y-2 active:translate-y-0 active:scale-95 flex flex-col items-center justify-center border-b-8
                      ${selectedCount > 0 && state.discardsLeft > 0 ? 'bg-red-600 text-white hover:bg-red-500 shadow-red-600/50 border-red-800' : 'bg-slate-800 text-slate-600 cursor-not-allowed border-slate-900'}`}>
                      DISCARD
                      <span className="text-xs font-bold opacity-60 mt-1 uppercase tracking-widest">Selected</span>
                  </button>
              </div>
          </div>
          
          <div className="pointer-events-auto flex justify-center items-end h-64 perspective-1000 w-full max-w-[90vw]">
              {state.hand.map((card, index) => {
                  const total = state.hand.length;
                  const middle = (total - 1) / 2;
                  const offset = index - middle;
                  const rot = offset * 4; // Slightly more fanned out
                  const yOff = Math.abs(offset) * 8; // Arch effect
                  return (
                    <div key={card.id} 
                        style={{ 
                            transform: `rotate(${rot}deg) translateY(${card.selected ? -50 : yOff}px)`, 
                            zIndex: index, 
                            marginLeft: '-35px' // Tighter overlap
                        }} 
                        className="transition-transform duration-200 hover:z-50"
                    >
                        <Card card={card} onClick={handleCardClick} disabled={state.phase !== 'PLAY_HAND'} className={selectedConsumable ? 'animate-pulse cursor-crosshair ring-4 ring-purple-500 rounded-xl' : ''} />
                    </div>
                  );
              })}
          </div>
      </div>
    </div>
  );
};

function formatScore(num: number): string {
    if (num >= 1000000000) return (num/1000000000).toFixed(2) + 'B';
    if (num >= 1000000) return (num/1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num/1000).toFixed(1) + 'k';
    return num.toString();
}

export default App;