import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// @ts-ignore - composant JS sans définitions de types
import CardJS from '@/components/card';

// @ts-ignore
import { chooseCardToPlay } from '@/bots/simpleBot';

const Card = CardJS as React.ComponentType<any>;

// Types de jeu (TS)
type Suit = 'spade' | 'heart' | 'diamond' | 'club';
type Value = 'A'|'K'|'Q'|'J'|'10'|'9'|'8'|'7'|'6'|'5'|'4'|'3'|'2';
type PlayingCard = { value: Value; suit: Suit };

const SUITS: Suit[] = ['spade', 'heart', 'diamond', 'club']; // ♠ ♥ ♦ ♣
const VALUES: Value[] = ['A','K','Q','J','10','9','8','7','6','5','4','3','2']; 
// ordre d’affichage pour le visuel; la logique du Président (2 > A > K...) vivra ailleurs

function buildDeck(): PlayingCard[] {
  const deck: PlayingCard[] = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ value, suit });
    }
  }
  return deck;
}

// Ordre de force pour le Président (du plus faible au plus fort)
const RANK_ORDER = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const rankIndex = (v: Value | string) => RANK_ORDER.indexOf(String(v).toUpperCase());

// Mélange Fisher–Yates (non mutatif)
function shuffle<T>(array: T[]): T[] {
  const a = array.slice(); // copie pour éviter de muter l'original
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Distribution en round-robin jusqu’à épuisement
function deal(deck: PlayingCard[], numPlayers: number): PlayingCard[][] {
  const hands: PlayingCard[][] = Array.from({ length: numPlayers }, () => []);
  let i = 0;
  while (deck.length) {
    hands[i % numPlayers].push(deck.pop()!);
    i++;
  }
  return hands;
}

export default function PartieScreen() {
  const NUM_PLAYERS = 5; // ajuste si besoin (2 à 6 typiquement)

  const [hands, setHands] = useState<PlayingCard[][]>([]);      // tableau de mains: [[], [], [], []]
  const [started, setStarted] = useState(false);
  const [selectedCards, setSelectedCards] = useState<PlayingCard[]>([]);
  const [centralPile, setCentralPile] = useState<PlayingCard[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState(0); // 0 = humain (toi)
  const [playerRank, setPlayerRank] = useState<number | null>(null);
  const [lastMoveMessage, setLastMoveMessage] = useState<string | null>(null);
  const [finishedOrder, setFinishedOrder] = useState<number[]>([]);

  // Enregistre l'ordre de sortie d'un joueur et calcule le rang du joueur humain (index 0)
  function finalizeIfFinished(playerIdx: number, nh: PlayingCard[][]) {
    if ((nh[playerIdx]?.length || 0) > 0) return; // le joueur a encore des cartes
    setFinishedOrder(prev => {
      if (prev.includes(playerIdx)) return prev; // déjà compté
      const newOrder = [...prev, playerIdx];

      if (playerIdx === 0) {
        const pos = newOrder.length; // 1er à finir => 1, 2e => 2, etc.
        if (pos === 1) setPlayerRank(1); // Président
        else if (pos === 2) setPlayerRank(2); // Vice-Président
        else if (pos === NUM_PLAYERS - 1) setPlayerRank(NUM_PLAYERS - 1); // Vice-Trou
        else if (pos === NUM_PLAYERS) setPlayerRank(NUM_PLAYERS); // Trou (dernier)
        else setPlayerRank(pos); // Neutre (pas de rôle)
      }
      return newOrder;
    });
  }

  const startOrResetGame = () => {
    const deck = buildDeck();
    const shuffled = shuffle(deck);
    const dealt = deal(shuffled, NUM_PLAYERS);
    console.log('[PRESIDENT] dealt hand sizes:', dealt.map(h => h.length), dealt);
    setHands(dealt);
    setCurrentPlayer(0);
    setStarted(true);
    setPlayerRank(null);
    setFinishedOrder([]);
    setLastMoveMessage(null);
    console.log('[PRESIDENT] started:', true);
  };

  // Initialise la partie au montage
  useEffect(() => {
    startOrResetGame();
  }, []);

  useEffect(() => {
    if (!started) return;
    if (!hands.length) return;

    // Si c'est le tour de l'humain, ne rien faire ici
    if (currentPlayer === 0) return;

    const botHand = hands[currentPlayer] || [];
    if (botHand.length === 0) {
      // Ce bot n'a plus de cartes: passer au suivant
      setCurrentPlayer(prev => nextPlayerIndex(prev, hands, NUM_PLAYERS));
      return;
    }

    const BOT_THINK_MS = 1800; // délai de réflexion des bots en millisecondes
    const t = setTimeout(() => {
      const card = chooseCardToPlay(botHand, centralPile) as PlayingCard;
      if (!card) {
        setCurrentPlayer(prev => nextPlayerIndex(prev, hands, NUM_PLAYERS));
        return;
      }
      const newPile = [...centralPile, card];
      const newHands = [...hands];
      newHands[currentPlayer] = newHands[currentPlayer].filter(
        c => !(c.value === card.value && c.suit === card.suit)
      );

      // Vérifie si le bot vient de finir
      finalizeIfFinished(currentPlayer, newHands);

      // Message du bot
      const botName = opponentNames[currentPlayer - 1] || `Bot ${currentPlayer}`;
      setLastMoveMessage(`${botName} a joué : ${card.value} ${card.suit === 'spade' ? '♠' : card.suit === 'heart' ? '♥' : card.suit === 'diamond' ? '♦' : '♣'}`);

      setCentralPile(newPile);
      setHands(newHands);
      setCurrentPlayer(prev => nextPlayerIndex(prev, newHands, NUM_PLAYERS));
    }, BOT_THINK_MS + Math.floor(Math.random() * 600));

    return () => clearTimeout(t);
  }, [currentPlayer, hands, centralPile, started]);



  // Main du joueur local (index 0)
  const myHand = useMemo<PlayingCard[]>(() => hands[0] || [], [hands]);

  // Tri d'affichage selon la hiérarchie du Président (2 le plus fort)
  const myHandSorted = useMemo(
    () => [...myHand].sort((a, b) => rankIndex(a.value) - rankIndex(b.value)),
    [myHand]
  );

  // --- Opponents mini-decks in corners ---
  type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

  // Placeholder opponent names
  const opponentNames = ['Axel', 'Elias', 'Tito', 'Karl'];

  function OpponentMini({
    hand,
    label,
    corner,
  }: {
    hand: PlayingCard[];
    label: string;
    corner: Corner;
  }) {
    return (
      <View
        style={[
          styles.opponentContainer,
          corner === 'topLeft' && styles.topLeft,
          corner === 'topRight' && styles.topRight,
          corner === 'bottomLeft' && styles.bottomLeft,
          corner === 'bottomRight' && styles.bottomRight,
        ]}
        pointerEvents="none"
      >
        <Text style={styles.opponentLabel}>{label}</Text>
        <View style={styles.miniDeckRow}>
          <View style={styles.backCard}>
            <Text style={styles.backCount}>{hand.length}</Text>
          </View>
        </View>
      </View>
    );
  }

  function nextPlayerIndex(current: number, allHands: PlayingCard[][], total: number) {
    let i = (current + 1) % total;
    // sauter les joueurs qui n'ont plus de cartes
    while ((allHands[i]?.length || 0) === 0 && i !== current) {
      i = (i + 1) % total;
    }
    return i;
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Affichage du dernier coup joué */}
      {lastMoveMessage && (
        <View style={{
          backgroundColor: '#1e2a40',
          paddingVertical: 10,
          paddingHorizontal: 16,
          alignItems: 'center',
          justifyContent: 'center',
          borderBottomWidth: 1,
          borderBottomColor: '#344b6b',
        }}>
          <Text style={{ color: '#cde2ff', fontWeight: 'bold', fontSize: 16 }}>{lastMoveMessage}</Text>
        </View>
      )}
      {/* MAIN AREA (does not include bottom controls/deck) */}
      <View style={styles.mainArea}>
        <View style={styles.container}>
          <Text style={styles.title}>Jeu du Président 🃏</Text>
        </View>
        {centralPile.length > 0 && (
          <View style={styles.centralPile}>
            {centralPile.slice(-5).map((c, idx, arr) => {
              // compute offset so earlier cards appear slightly lower and right
              const isLast = idx === arr.length - 1;
              const offset = (idx - (arr.length - 1)) * 6; // negative for lower layers
              return (
                <Card
                  key={`${c.suit}-${c.value}-${idx}`}
                  value={c.value}
                  suit={c.suit}
                  style={[
                    styles.centralCard,
                    { position: 'absolute', top: -offset, left: -offset, opacity: isLast ? 1 : 0.9 }
                  ]}
                />
              );
            })}
          </View>
        )}
        {/* Opponents in corners, confined to mainArea */}
        {started && (
          <View style={styles.opponentsLayer} pointerEvents="none">
            {hands[1] && (
              <OpponentMini hand={hands[1]} label={opponentNames[0]} corner="topLeft" />
            )}
            {hands[2] && (
              <OpponentMini hand={hands[2]} label={opponentNames[1]} corner="topRight" />
            )}
            {hands[3] && (
              <OpponentMini hand={hands[3]} label={opponentNames[2]} corner="bottomLeft" />
            )}
            {hands[4] && (
              <OpponentMini hand={hands[4]} label={opponentNames[3]} corner="bottomRight" />
            )}
          </View>
        )}
        {started && (
          <View style={styles.floatingSend}>
            <TouchableOpacity
              style={[
                styles.sendButton,
                (selectedCards.length === 0 || currentPlayer !== 0) && styles.sendButtonDisabled
              ]}
              disabled={selectedCards.length === 0 || currentPlayer !== 0}
              onPress={() => {
                if (currentPlayer !== 0) return; // Empêche de jouer hors de son tour
                if (selectedCards.length > 0) {
                  const newPile = [...centralPile, ...selectedCards];
                  // Calculer les mains mises à jour avant de set pour pouvoir déterminer le prochain joueur
                  const updatedHands = (() => {
                    const nh = [...hands];
                    const toRemove = selectedCards.map(c => `${c.value}-${c.suit}`);
                    nh[0] = nh[0].filter(c => !toRemove.includes(`${c.value}-${c.suit}`));
                    return nh;
                  })();
                  // Si le joueur humain vient de finir, calcule son rang immédiatement
                  finalizeIfFinished(0, updatedHands);
                  // Message pour le joueur humain
                  setLastMoveMessage(
                    `Vous avez joué : ${selectedCards.map(c =>
                      `${c.value} ${c.suit === 'spade' ? '♠' : c.suit === 'heart' ? '♥' : c.suit === 'diamond' ? '♦' : '♣'}`
                    ).join(', ')}`
                  );
                  setCentralPile(newPile);
                  setHands(updatedHands);
                  setSelectedCards([]);
                  setCurrentPlayer(prev => nextPlayerIndex(prev, updatedHands, NUM_PLAYERS));
                }
              }}
            >
              <Text style={styles.sendButtonText}>Envoyer</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      {/* BOTTOM AREA */}
      {started && (
        <>
          <View style={styles.deckContainer}>
            <FlatList
              horizontal
              data={myHandSorted}
              keyExtractor={(item: PlayingCard, idx) => `${item.suit}-${item.value}-${idx}`}
              contentContainerStyle={styles.handList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedCards(prev => {
                      // Toggle if already selected
                      const key = (c: PlayingCard) => `${c.value}-${c.suit}`;
                      const exists = prev.some(c => key(c) === key(item));
                      if (exists) {
                        return prev.filter(c => key(c) !== key(item));
                      }
                      // If empty, start selection with this card
                      if (prev.length === 0) return [item];
                      // Enforce same value ("même chiffre")
                      if (prev[0].value !== item.value) {
                        // replace selection with this new value (or return prev to ignore)
                        return [item];
                      }
                      // Same value -> add to selection
                      return [...prev, item];
                    });
                  }}
                  disabled={currentPlayer !== 0}
                >
                  <Card
                    value={item.value}
                    suit={item.suit}
                    style={[
                      styles.card,
                      selectedCards.some(c => c.value === item.value && c.suit === item.suit) && styles.selectedCard,
                      currentPlayer !== 0 && { opacity: 0.5 }
                    ]}
                  />
                </TouchableOpacity>
              )}
              showsHorizontalScrollIndicator={false}
            />
          </View>
          {/* Affichage du message de fin de partie SOUS le deck */}
          {playerRank !== null && (
            <View style={{ alignItems: 'center', marginTop: 16 }}>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold' }}>
                {playerRank === 1 && "Bravo ! Vous êtes le Président 🎉"}
                {playerRank === 2 && "Vous êtes le Vice-Président 👏"}
                {playerRank > 2 && playerRank < NUM_PLAYERS - 1 && "Vous êtes Neutre — bien joué !"}
                {playerRank === NUM_PLAYERS - 1 && "Vous êtes le Vice-Trou 😅"}
                {playerRank === NUM_PLAYERS && "Perdu... Vous êtes le Trou 💩"}
              </Text>
            </View>
          )}
        </>
      )}
      {/* Suppression de l'overlay de fin de partie */}
    </View>
  );
}

const styles = StyleSheet.create({
  mainArea: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#021020',
  },
  container: {
    flex: 1,
    backgroundColor: '#021020',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 20,
    zIndex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 18,
    color: '#cde2ff',
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  usernameLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cde2ff',
    paddingHorizontal: 18,
    paddingBottom: 6,
  },
  handList: {
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  card: {
    marginRight: 10,
  },
  deckContainer: {
    marginTop: 'auto',
    paddingVertical: 10,
    paddingBottom: 20,
  },
  opponentsLayer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 2,
    elevation: 2,
  },
  opponentContainer: {
    position: 'absolute',
    maxWidth: 180,
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(2,16,32,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topLeft: { top: 100, left: 10 },
  topRight: { top: 100, right: 10 },
  bottomLeft: { bottom: 10, left: 10 },
  bottomRight: { bottom: 10, right: 10 },
  opponentLabel: {
    color: '#cde2ff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  miniDeckRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniCard: {
    width: 26,
    height: 38,
    borderRadius: 4,
    // on laisse le fond géré par le composant Card
    borderWidth: 1,
    borderColor: '#3b5573',
    overflow: 'hidden',
    backgroundColor: '#123a6b',
  },
  miniCardOverlap: {
    marginLeft: -12,
  },
  miniOverflow: {
    color: '#cde2ff',
    fontSize: 11,
    marginLeft: 6,
  },
  backCard: {
    width: 24,
    height: 36,
    borderRadius: 4,
    backgroundColor: '#0e223c', // dos de carte
    borderWidth: 1,
    borderColor: '#3b5573',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  backCount: {
    color: '#cde2ff',
    fontSize: 12,
    fontWeight: '700',
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: 'blue',
    borderRadius: 8
  },
  sendButton: {
    backgroundColor: '#007bff',
    padding: 10,
    marginTop: 10,
    borderRadius: 6,
    alignItems: 'center'
  },
  sendButtonDisabled: {
    backgroundColor: '#555'
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600'
  },
  centralPile: {
    position: 'absolute',
    top: '35%',
    left: '50%',
    width: 140,
    height: 200,
    transform: [{ translateX: -70 }],
    zIndex: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centralCard: {
    width: 130,
    height: 180,
    borderRadius: 8,
  },
  floatingSend: {
    position: 'absolute',
    bottom: 20,
    left: '56%',
    transform: [{ translateX: -60 }],
    zIndex: 4,
    elevation: 4,
  },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
    paddingHorizontal: 20,
  },
  overlayText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});