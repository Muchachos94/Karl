// app/partie.jsx (ou le fichier de ta page)
import GameHeader from '@/components/Gameheader';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
// @ts-ignore - composant JS sans définitions de types
import CardJS from '@/components/card';

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
  const { username } = useLocalSearchParams();
  const playerName = Array.isArray(username) ? username[0] : username;

  const NUM_PLAYERS = 5; // ajuste si besoin (2 à 6 typiquement)

  const [hands, setHands] = useState<PlayingCard[][]>([]);      // tableau de mains: [[], [], [], []]
  const [started, setStarted] = useState(false);

  const startOrResetGame = () => {
    const deck = buildDeck();
    const shuffled = shuffle(deck);
    const dealt = deal(shuffled, NUM_PLAYERS);
    console.log('[PRESIDENT] dealt hand sizes:', dealt.map(h => h.length), dealt);
    setHands(dealt);
    setStarted(true);
    console.log('[PRESIDENT] started:', true);
  };

  // Initialise la partie au montage
  useEffect(() => {
    startOrResetGame();
  }, []);

  // Main du joueur local (index 0)
  const myHand = useMemo<PlayingCard[]>(() => hands[0] || [], [hands]);

  // Tri d'affichage selon la hiérarchie du Président (2 le plus fort)
  const myHandSorted = useMemo(
    () => [...myHand].sort((a, b) => rankIndex(a.value) - rankIndex(b.value)),
    [myHand]
  );

  // --- Opponents mini-decks in corners ---
  type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

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

  return (
    <View style={{ flex: 1 }}>
      {/* MAIN AREA (does not include bottom controls/deck) */}
      <View style={styles.mainArea}>
        <View style={styles.container}>
          <Text style={styles.title}>Jeu du Président 🃏</Text>
          <GameHeader
            round={1}
            role="En jeu"
            playerName={playerName || 'Joueur'}
          />
        </View>
        {/* Opponents in corners, confined to mainArea */}
        {started && (
          <View style={styles.opponentsLayer} pointerEvents="none">
            {hands[1] && (
              <OpponentMini hand={hands[1]} label="Joueur 2" corner="topLeft" />
            )}
            {hands[2] && (
              <OpponentMini hand={hands[2]} label="Joueur 3" corner="topRight" />
            )}
            {hands[3] && (
              <OpponentMini hand={hands[3]} label="Joueur 4" corner="bottomLeft" />
            )}
            {hands[4] && (
              <OpponentMini hand={hands[4]} label="Joueur 5" corner="bottomRight" />
            )}
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
                <Card value={item.value} suit={item.suit} style={styles.card} />
              )}
              showsHorizontalScrollIndicator={false}
            />
          </View>
        </>
      )}
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
    backgroundColor: 'rgba(2,16,32,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  topLeft: { top: 10, left: 10, alignItems: 'flex-start' },
  topRight: { top: 10, right: 10, alignItems: 'flex-end' },
  bottomLeft: { bottom: 10, left: 10, alignItems: 'flex-start' },
  bottomRight: { bottom: 10, right: 10, alignItems: 'flex-end' },
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
    width: 32,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#0e223c', // dos de carte
    borderWidth: 1,
    borderColor: '#3b5573',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  backCount: {
    color: '#cde2ff',
    fontSize: 14,
    fontWeight: '700',
  },
});