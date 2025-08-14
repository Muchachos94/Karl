// src/bots/simpleBot.js

// Ordre faible -> fort (tu peux le remplacer plus tard par vos règles)
const RANK_ORDER = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const rankIndex = (v) => RANK_ORDER.indexOf(String(v).toUpperCase());

/**
 * Choisit une carte à jouer depuis la main du bot.
 * Pour l’instant: joue la carte la plus faible (1 seule carte).
 * @param {Array<{value:string, suit:string}>} hand
 * @param {Array<{value:string, suit:string}>} centralPile
 * @returns {{value:string, suit:string} | null}
 */
export function chooseCardToPlay(hand, centralPile) {
  if (!Array.isArray(hand) || hand.length === 0) return null;
  // Ex: stratégie très simple = plus faible
  const sorted = [...hand].sort((a, b) => rankIndex(a.value) - rankIndex(b.value));
  return sorted[0] || null;
}