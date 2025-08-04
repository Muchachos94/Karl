import { StyleSheet, Text, View } from 'react-native';

export default function LogoKarletaText({ style }) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.mainText}>KARL</Text>
      <Text style={styles.subText}>ETA STUDIO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 10,
  },
  mainText: {
    fontSize: 120,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 3,
  },
  subText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 6,
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});