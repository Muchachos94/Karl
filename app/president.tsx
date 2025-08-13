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
    setHands(dealt);
    setStarted(true);
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

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.container}>
        {/* Statistiques rapides des autres joueurs */}
        {started && (
          <View style={styles.tableInfo}>
            {hands.slice(1).map((h, i) => (
              <Text key={i} style={styles.infoText}>
                Joueur {i + 2} : {h.length} cartes
              </Text>
            ))}
          </View>
        )}
        <Text style={styles.title}>Jeu du Président 🃏</Text>
        <GameHeader
          round={1}
          role="En jeu"
          playerName={playerName || 'Joueur'}
        />
        <Text onPress={startOrResetGame} style={{ color: '#9fb6d0', marginTop: 8, alignSelf: 'flex-start', textDecorationLine: 'underline' }}>
          Rémélanger et redistribuer
        </Text>

        {started ? (
          <>
            <Text style={styles.subtitle}>Ta main ({myHand.length} cartes)</Text>
            {/* Other content can go here */}
          </>
        ) : (
          <Text style={styles.infoText}>Préparation du paquet…</Text>
        )}
      </View>
      {started && (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#021020',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 20,
  },
  subtitle: {
    fontSize: 18,
    color: '#cde2ff',
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  handList: {
    paddingVertical: 16,
  },
  card: {
    marginRight: 10,
  },
  tableInfo: {
    position: 'absolute',
    bottom: 20,
    right: 10,
    gap: 4,
  },
  infoText: {
    color: '#9fb6d0',
    fontSize: 14,
  },
  deckContainer: {
    marginTop: 'auto',
    paddingVertical: 16,
  },
});