// lib/presidentRules.ts
export type Suit = "spade" | "heart" | "diamond" | "club";
export type Value =
  | "A"
  | "K"
  | "Q"
  | "J"
  | "10"
  | "9"
  | "8"
  | "7"
  | "6"
  | "5"
  | "4"
  | "3"
  | "2";
export type PlayingCard = { value: Value; suit: Suit };

export const SUITS: Suit[] = ["spade", "heart", "diamond", "club"];
export const RANK_VISUAL: Value[] = [
  "A",
  "K",
  "Q",
  "J",
  "10",
  "9",
  "8",
  "7",
  "6",
  "5",
  "4",
  "3",
  "2",
];
// Force (faible -> fort) pour le Président
export const RANK_ORDER: Value[] = [
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
  "2",
];
const rankIndex = (v: Value | string) =>
  RANK_ORDER.indexOf(String(v).toUpperCase() as Value);

// --- Deck helpers ---
export function buildDeck(): PlayingCard[] {
  const deck: PlayingCard[] = [];
  for (const suit of SUITS)
    for (const value of RANK_VISUAL) deck.push({ value, suit });
  return deck;
}
export function shuffle<T>(a: T[], rng: () => number = Math.random): T[] {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
export function deal(deck: PlayingCard[], numPlayers: number): PlayingCard[][] {
  const hands: PlayingCard[][] = Array.from({ length: numPlayers }, () => []);
  let i = 0;
  const pile = deck.slice();
  while (pile.length) {
    hands[i % numPlayers].push(pile.pop()!);
    i++;
  }
  return hands;
}

// --- Types moteur ---
export type PlayerState = { name: string; hand: PlayingCard[] };
export type LockState = {
  active: boolean;
  valueIdx?: number;
  targetIndex?: number;
};
export type TrickState = {
  currentIndex: number;
  patternCount: number | null; // 1..4
  topValueIdx: number | null; // idx dans RANK_ORDER
  pile: PlayingCard[]; // historique du pli (toutes les cartes jouées)
  lastPlayerIndex: number | null;
  lock: LockState; // verrou d’égalité
  folded: boolean[]; // couchés (dans le pli courant)
  mayFinishOnTwo: boolean; // déblocage exceptionnel
};
export type EngineState = {
  players: PlayerState[];
  trick: TrickState;
  ranking: string[];
  forcedLast: string | null;
};

// --- Timeline pour l’historique & animations ---
export type EngineEvent =
  | { kind: "startTrick"; starter: string }
  | { kind: "play"; player: string; cards: PlayingCard[] }
  | { kind: "pass"; player: string; reason: "lock" | "cantOpen" | "twoBlocked" }
  | { kind: "fold"; player: string; top?: Value }
  | { kind: "lockSet"; value: Value; target: string }
  | { kind: "lockClear" }
  | { kind: "cut"; value: Value } // carré coupe
  | { kind: "two"; player: string } // 2 termine le pli
  | { kind: "endTrick"; nextStarter: string }
  | { kind: "forcedLast"; player: string };

export class PresidentEngine {
  state: EngineState;
  rng: () => number;
  private events: EngineEvent[] = [];

  constructor(playerNames: string[], seed?: number) {
    // RNG seedée (xorshift32 simple)
    const _seed = seed ?? Math.floor(Math.random() * 2 ** 31);
    let x = _seed >>> 0;
    this.rng = () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return ((x >>> 0) % 1_000_000) / 1_000_000;
    };

    // Distribution
    const deck = shuffle(buildDeck(), this.rng);
    const hands = deal(deck, playerNames.length);

    const players: PlayerState[] = playerNames.map((name, i) => ({
      name,
      hand: sortByRank(hands[i]),
    }));

    // Dame de cœur commence : on place ce joueur en premier => starter = 0
    let startIdx = 0;
    players.forEach((p, i) => {
      if (p.hand.some((c) => c.value === "Q" && c.suit === "heart"))
        startIdx = i;
    });
    const rotated = players.slice(startIdx).concat(players.slice(0, startIdx));
    const starter = 0;

    this.state = {
      players: rotated,
      ranking: [],
      forcedLast: null,
      trick: newTrickState(rotated.length, starter),
    };
    this.events.push({ kind: "startTrick", starter: rotated[starter].name });
  }

  // --- Helpers ---
  private groupByValue(hand: PlayingCard[]): Map<number, PlayingCard[]> {
    const m = new Map<number, PlayingCard[]>();
    for (const c of hand) {
      const idx = rankIndex(c.value);
      const lst = m.get(idx) || [];
      lst.push(c);
      m.set(idx, lst);
    }
    return m;
  }

  private isLegalPlay(
    playerIndex: number,
    cards: PlayingCard[]
  ): string | null {
    const { trick } = this.state;
    if (!cards.length) return "Sélection vide.";
    const v0 = rankIndex(cards[0].value);
    if (cards.some((c) => rankIndex(c.value) !== v0))
      return "Toutes les cartes doivent être du même rang.";

    // Verrou éventuel
    if (trick.lock.active && trick.lock.targetIndex === playerIndex) {
      if (!(cards.length === 1 && v0 === trick.lock.valueIdx)) {
        return `🔒 Verrou actif : vous devez jouer exactement ${
          RANK_ORDER[trick.lock.valueIdx!]
        }.`;
      }
    }

    if (trick.patternCount !== null) {
      if (cards.length !== trick.patternCount)
        return `Ce pli se joue en ${trick.patternCount} carte(s).`;
      if (trick.topValueIdx !== null && v0 < trick.topValueIdx) {
        return `Trop faible : vous devez jouer au moins ${
          RANK_ORDER[trick.topValueIdx]
        }.`;
      }
    }
    // (ouverture: 1..4 OK)

    // Interdit de finir sur 2 (hors déblocage)
    const p = this.state.players[playerIndex];
    if (
      wouldEmpty(p, cards) &&
      cards.some((c) => c.value === "2") &&
      !trick.mayFinishOnTwo
    ) {
      return "Vous ne pouvez pas terminer votre main avec un 2.";
    }
    return null;
  }

  private chooseAIPlay(playerIndex: number): PlayingCard[] | null {
    const p = this.state.players[playerIndex];
    const tr = this.state.trick;
    const groups = this.groupByValue(p.hand);

    // Cible verrou ?
    if (tr.lock.active && tr.lock.targetIndex === playerIndex) {
      const arr = groups.get(tr.lock.valueIdx!) || [];
      if (arr.length >= 1) {
        const c = arr[0];
        if (!(wouldEmpty(p, [c]) && c.value === "2" && !tr.mayFinishOnTwo))
          return [c];
      }
      return null;
    }

    if (tr.patternCount === null) {
      // ouverture : toutes options 1..4
      const openings: PlayingCard[][] = [];
      for (let k = 1; k <= 4; k++) {
        for (const [v, arr] of [...groups.entries()].sort(
          (a, b) => a[0] - b[0]
        )) {
          if (arr.length >= k) {
            const cand = arr.slice(0, k);
            if (
              !(
                wouldEmpty(p, cand) &&
                cand.some((x) => x.value === "2") &&
                !tr.mayFinishOnTwo
              )
            ) {
              openings.push(cand);
            }
          }
        }
      }
      if (!openings.length) return null;
      openings.sort(
        (a, b) =>
          rankIndex(a[0].value) - rankIndex(b[0].value) || a.length - b.length
      );
      return openings[0];
    } else {
      const k = tr.patternCount;
      const opts: PlayingCard[][] = [];
      for (const [v, arr] of [...groups.entries()].sort(
        (a, b) => a[0] - b[0]
      )) {
        if (
          arr.length >= k &&
          (tr.topValueIdx === null || v >= tr.topValueIdx)
        ) {
          const cand = arr.slice(0, k);
          if (
            !(
              wouldEmpty(p, cand) &&
              cand.some((x) => x.value === "2") &&
              !tr.mayFinishOnTwo
            )
          ) {
            opts.push(cand);
          }
        }
      }
      if (!opts.length) return null;
      opts.sort((a, b) => rankIndex(a[0].value) - rankIndex(b[0].value));
      return opts[0];
    }
  }

  private applyPlay(
    playerIndex: number,
    cards: PlayingCard[]
  ): { trickEnd: boolean; cutPile: boolean } {
    const st = this.state,
      tr = st.trick,
      p = st.players[playerIndex];

    // retirer les cartes
    for (const c of cards) {
      const i = p.hand.findIndex(
        (h) => h.value === c.value && h.suit === c.suit
      );
      if (i >= 0) p.hand.splice(i, 1);
    }
    // pousser au tas
    tr.pile.push(...cards);
    tr.lastPlayerIndex = playerIndex;

    // log "play"
    this.events.push({
      kind: "play",
      player: p.name,
      cards: cards.map((c) => ({ ...c })),
    });

    // état précédent (pour verrou)
    const prevPattern = tr.patternCount;
    const prevTop = tr.topValueIdx;

    // pattern/top
    if (tr.patternCount === null) {
      tr.patternCount = cards.length;
      tr.topValueIdx = rankIndex(cards[0].value);
    } else {
      tr.topValueIdx = rankIndex(cards[0].value);
    }

    // Verrou (simple uniquement, sur égalisation)
    if (tr.patternCount === 1) {
      if (prevPattern === 1 && prevTop !== null) {
        if (rankIndex(cards[0].value) === prevTop) {
          tr.lock.active = true;
          tr.lock.valueIdx = prevTop;
          // prochain non couché
          let nxt = this.nextIndex(tr.currentIndex);
          while (tr.folded[nxt]) nxt = this.nextIndex(nxt);
          tr.lock.targetIndex = nxt;
          this.events.push({
            kind: "lockSet",
            value: RANK_ORDER[prevTop] as Value,
            target: this.state.players[nxt].name,
          });
        } else {
          if (tr.lock.active) this.events.push({ kind: "lockClear" });
          tr.lock = { active: false };
        }
      } else {
        if (tr.lock.active) this.events.push({ kind: "lockClear" });
        tr.lock = { active: false };
      }
    } else {
      if (tr.lock.active) this.events.push({ kind: "lockClear" });
      tr.lock = { active: false };
    }

    // 2 ferme le pli
    if (cards.some((c) => c.value === "2")) {
      this.events.push({ kind: "two", player: p.name });
      return { trickEnd: true, cutPile: false };
    }

    // carré coupe
    if (tr.pile.length >= 4) {
      const last4 = tr.pile.slice(-4);
      if (last4.every((c) => c.value === last4[0].value)) {
        this.events.push({ kind: "cut", value: last4[0].value });
        return { trickEnd: true, cutPile: true };
      }
    }

    return { trickEnd: false, cutPile: false };
  }

  private nextIndex(i: number): number {
    return (i + 1) % this.state.players.length;
  }

  // --- API ---
  getSnapshot() {
    const s = this.state;

    // verrou safe
    let safeLock = { ...s.trick.lock };
    if (safeLock.active) {
      const t = safeLock.targetIndex;
      if (t == null || t < 0 || t >= s.players.length) {
        safeLock = { active: false };
      }
    }

    return {
      players: s.players.map((p) => ({ name: p.name, hand: p.hand.slice() })),
      trick: {
        currentIndex: s.trick.currentIndex,
        patternCount: s.trick.patternCount,
        topValueIdx: s.trick.topValueIdx,
        lock: safeLock,
        folded: s.trick.folded.slice(),
        mayFinishOnTwo: s.trick.mayFinishOnTwo,
        pile: s.trick.pile.slice(), // 👈 pile complète
      },
      ranking: s.ranking.slice(),
      forcedLast: s.forcedLast,
    };
  }

  /** Récupère et vide la file d’événements (pour l’historique & animations) */
  popEvents(): EngineEvent[] {
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  humanPlay(cardsIdx: number[]): { ok: boolean; error?: string } {
    const st = this.state;
    const i = st.trick.currentIndex;
    const p = st.players[i];
    const cards = cardsIdx.map((idx) => p.hand[idx]);
    const err = this.isLegalPlay(i, cards);
    if (err) return { ok: false, error: err };

    const { trickEnd } = this.applyPlay(i, cards);
    if (trickEnd) this.endTrickAndRotate();
    else st.trick.currentIndex = this.nextIndex(i);
    return { ok: true };
  }

  humanPass(): { ok: boolean; error?: string } {
    const st = this.state;
    const i = st.trick.currentIndex;
    const tr = st.trick;
    if (tr.patternCount === null) {
      return {
        ok: false,
        error: "Vous devez ouvrir le pli (choisissez des cartes).",
      };
    }
    if (!(tr.lock.active && tr.lock.targetIndex === i)) {
      return {
        ok: false,
        error:
          "Passer n’est autorisé que lorsque vous êtes ciblé par le verrou.",
      };
    }
    this.events.push({
      kind: "pass",
      player: st.players[i].name,
      reason: "lock",
    });
    tr.currentIndex = this.nextIndex(i);
    tr.lock = { active: false }; // le verrou tombe quand la cible passe
    return { ok: true };
  }

  humanFold(): { ok: boolean; error?: string } {
    const st = this.state;
    const i = st.trick.currentIndex;
    const tr = st.trick;
    if (tr.patternCount === null) {
      return {
        ok: false,
        error:
          "Vous ne pouvez pas vous coucher en ouverture. Jouez des cartes.",
      };
    }
    if (tr.lock.active && tr.lock.targetIndex === i) {
      // si on se couche ici, on éteint le verrou
      tr.lock = { active: false };
    }
    this.events.push({
      kind: "fold",
      player: st.players[i].name,
      top:
        tr.topValueIdx != null
          ? (RANK_ORDER[tr.topValueIdx] as Value)
          : undefined,
    });
    tr.folded[i] = true;
    if (tr.patternCount !== null && tr.folded.filter((f) => !f).length <= 1) {
      this.endTrickAndRotate();
      return { ok: true };
    }
    tr.currentIndex = this.nextIndex(i);
    return { ok: true };
  }

  /** Laisse jouer l’IA jusqu’à ce que ce soit le tour d’un humain ou qu’un pli se termine. */
  advanceUntilHuman(humanNames: Set<string>): void {
    const st = this.state;
    const isHuman = (idx: number) => humanNames.has(st.players[idx].name);

    let passesAtOpening = 0;

    loop: while (true) {
      const i = st.trick.currentIndex;
      if (st.players.length <= 1) break;
      if (isHuman(i)) break;

      const p = st.players[i];

      // starter qui n’a qu’un 2 ⇒ perdant forcé
      if (st.trick.patternCount === null && i === st.trick.currentIndex) {
        if (p.hand.length === 1 && p.hand[0].value === "2") {
          this.state.forcedLast = p.name;
          this.events.push({ kind: "forcedLast", player: p.name });
          st.players.splice(i, 1);
          this.endTrickHardRotate(i);
          continue loop;
        }
      }

      const play = this.chooseAIPlay(i);
      if (!play) {
        if (st.trick.patternCount === null) {
          passesAtOpening++;
          this.events.push({
            kind: "pass",
            player: p.name,
            reason: "cantOpen",
          });
          if (passesAtOpening >= st.players.length) {
            st.trick.mayFinishOnTwo = true;
            passesAtOpening = 0;
          }
          st.trick.currentIndex = this.nextIndex(i);
          continue;
        }

        // en cours de pli
        if (st.trick.lock.active && st.trick.lock.targetIndex === i) {
          // passe (verrou)
          this.events.push({ kind: "pass", player: p.name, reason: "lock" });
          st.trick.currentIndex = this.nextIndex(i);
          st.trick.lock = { active: false };
          continue;
        } else {
          // se coucher
          this.events.push({
            kind: "fold",
            player: p.name,
            top:
              st.trick.topValueIdx != null
                ? (RANK_ORDER[st.trick.topValueIdx] as Value)
                : undefined,
          });
          st.trick.folded[i] = true;
          if (st.trick.folded.filter((f) => !f).length <= 1) {
            this.endTrickAndRotate();
            continue;
          }
          st.trick.currentIndex = this.nextIndex(i);
          continue;
        }
      }

      const err = this.isLegalPlay(i, play);
      if (err) {
        if (st.trick.patternCount === null) {
          passesAtOpening++;
          this.events.push({
            kind: "pass",
            player: p.name,
            reason: "cantOpen",
          });
          if (passesAtOpening >= st.players.length) {
            st.trick.mayFinishOnTwo = true;
            passesAtOpening = 0;
          }
          st.trick.currentIndex = this.nextIndex(i);
          continue;
        } else {
          if (st.trick.lock.active && st.trick.lock.targetIndex === i) {
            this.events.push({ kind: "pass", player: p.name, reason: "lock" });
            st.trick.currentIndex = this.nextIndex(i);
            st.trick.lock = { active: false };
            continue;
          } else {
            this.events.push({
              kind: "fold",
              player: p.name,
              top:
                st.trick.topValueIdx != null
                  ? (RANK_ORDER[st.trick.topValueIdx] as Value)
                  : undefined,
            });
            st.trick.folded[i] = true;
            if (st.trick.folded.filter((f) => !f).length <= 1) {
              this.endTrickAndRotate();
              continue;
            }
            st.trick.currentIndex = this.nextIndex(i);
            continue;
          }
        }
      }

      const { trickEnd } = this.applyPlay(i, play);
      if (trickEnd) this.endTrickAndRotate();
      else st.trick.currentIndex = this.nextIndex(i);
      if (isHuman(st.trick.currentIndex)) break;
    }
  }

  // --- Fin de pli / rotation ---
  private endTrickAndRotate() {
    const st = this.state;
    const tr = st.trick;
    const last = tr.lastPlayerIndex ?? tr.currentIndex;
    const lastName = st.players[last]?.name;

    // sortir les joueurs vides
    const survivors: PlayerState[] = [];
    for (const p of st.players) {
      if (p.hand.length === 0) st.ranking.push(p.name);
      else survivors.push(p);
    }
    st.players = survivors;

    if (st.players.length === 0) return;

    let starter = 0;
    if (lastName) {
      const idx = st.players.findIndex((p) => p.name === lastName);
      starter = idx >= 0 ? idx : 0;
    }

    this.events.push({
      kind: "endTrick",
      nextStarter: st.players[starter].name,
    });
    st.trick = newTrickState(st.players.length, starter);
    this.events.push({ kind: "startTrick", starter: st.players[starter].name });
  }

  private endTrickHardRotate(nextStarterIndexInOldList: number) {
    const st = this.state;
    if (st.players.length === 0) return;
    const starter = nextStarterIndexInOldList % st.players.length;
    st.trick = newTrickState(st.players.length, starter);
    this.events.push({ kind: "startTrick", starter: st.players[starter].name });
  }
}

// --- helpers ---
function sortByRank(hand: PlayingCard[]): PlayingCard[] {
  return hand.slice().sort((a, b) => rankIndex(a.value) - rankIndex(b.value));
}
function wouldEmpty(p: PlayerState, play: PlayingCard[]): boolean {
  return p.hand.length === play.length;
}
function newTrickState(nPlayers: number, starter: number): TrickState {
  return {
    currentIndex: starter,
    patternCount: null,
    topValueIdx: null,
    pile: [],
    lastPlayerIndex: null,
    lock: { active: false },
    folded: Array(nPlayers).fill(false),
    mayFinishOnTwo: false,
  };
}
