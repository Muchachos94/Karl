import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

const SUIT_SYMBOLS = { spade: '♠', heart: '♥', diamond: '♦', club: '♣' };
const COLOR_BY_SUIT = { spade: '#1f9acb', club: '#1f9acb', heart: '#e94c4c', diamond: '#e94c4c' };

function normalizeSuit(suit) {
  const s = String(suit).toLowerCase();
  if (s.startsWith('spa')) return 'spade';
  if (s.startsWith('hea')) return 'heart';
  if (s.startsWith('dia')) return 'diamond';
  return 'club';
}

// "A","K","Q","J","10","9"... -> "AS","KH","0D","..." (10 => "0")
function toDeckCode(rawValue, rawSuit) {
  const suit = normalizeSuit(rawSuit);
  const v = String(rawValue).toUpperCase();   // supporte 10 (number) ou "10"
  const valueCode =
    v === 'A' ? 'A' :
    v === 'K' ? 'K' :
    v === 'Q' ? 'Q' :
    v === 'J' ? 'J' :
    v === '10' ? '0' :
    v; // 2..9
  const suitCode = suit === 'spade' ? 'S' : suit === 'heart' ? 'H' : suit === 'diamond' ? 'D' : 'C';
  return `${valueCode}${suitCode}`;
}

function imageUrlFromCode(code) {
  return `https://deckofcardsapi.com/static/img/${code}.png`;
}

export default function Card({ value, suit, style, imageUrl, forceTextFallback }) {
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);

  const code = useMemo(() => toDeckCode(value, suit), [value, suit]);
  const remoteUrl = useMemo(() => imageUrl || imageUrlFromCode(code), [imageUrl, code]);

  const ns = normalizeSuit(suit);
  const symbol = SUIT_SYMBOLS[ns];
  const color = COLOR_BY_SUIT[ns];
  const showImage = !forceTextFallback && !imgError;

  return (
    <View style={[styles.card, style]} accessibilityLabel={`Carte ${String(value)} de ${ns}`}>
      {showImage ? (
        <>
          {imgLoading && (
            <View style={styles.loaderWrap}>
              <ActivityIndicator />
            </View>
          )}
          <Image
            source={{ uri: remoteUrl }}
            style={styles.image}
            resizeMode="cover"
            onLoadEnd={() => setImgLoading(false)}
            onError={() => { setImgLoading(false); setImgError(true); }}
          />
        </>
      ) : (
        <>
          <Text style={[styles.cornerText, { color }]}>{String(value)}</Text>
          <Text style={[styles.symbol, { color }]}>{symbol}</Text>
          <Text style={[styles.cornerText, { color, transform: [{ rotate: '180deg' }] }]}>
            {String(value)}
          </Text>
        </>
      )}
    </View>
  );
}

// Taille carte
const CARD_W = 80, CARD_H = 120;
// Inset visuel pour décoller l'image des bords
const INSET = 0;

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 10,
    backgroundColor: '#fffbe7',
    borderColor: '#1a1a1a',
    borderWidth: 2,                 // <- remis pour avoir une vraie bordure
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 5,
    overflow: 'hidden',
  },
  // Image légèrement plus petite avec marges internes
  image: {
    position: 'absolute',
    top: INSET,
    left: INSET,
    right: INSET,
    bottom: INSET,
  },
  loaderWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center'
  },
  // Fallback texte un peu plus petit pour respirer
  cornerText: {
    fontSize: 16,
    fontWeight: 'bold',
    alignSelf: 'flex-start',
    marginLeft: 2,
    marginRight: 2,
  },
  symbol: {
    fontSize: 28,
    fontWeight: 'bold',
  },
});