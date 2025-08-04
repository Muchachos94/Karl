import { StyleSheet, Text, View } from 'react-native';

const SUIT_SYMBOLS = {
  spade: '♠',
  heart: '♥',
  diamond: '♦',
  club: '♣',
};

const COLOR_BY_SUIT = {
  spade: '#1f9acb',
  club: '#1f9acb',
  heart: '#e94c4c',
  diamond: '#e94c4c',
};

export default function Card({ value, suit, style }) {
  const symbol = SUIT_SYMBOLS[suit];
  const color = COLOR_BY_SUIT[suit];

  return (
    <View style={[styles.card, style]}>
      <Text style={[styles.cornerText, { color }]}>{value}</Text>
      <Text style={[styles.symbol, { color }]}>{symbol}</Text>
      <Text style={[styles.cornerText, { color, transform: [{ rotate: '180deg' }] }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 80,
    height: 120,
    borderRadius: 10,
    backgroundColor: '#fffbe7',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  cornerText: {
    fontSize: 18,
    fontWeight: 'bold',
    alignSelf: 'flex-start',
  },
  symbol: {
    fontSize: 32,
    fontWeight: 'bold',
  },
});