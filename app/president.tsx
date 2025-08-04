import Card from '@/components/card';
import GameHeader from '@/components/Gameheader';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function PartieScreen() {
  const { username } = useLocalSearchParams();
  const playerName = Array.isArray(username) ? username[0] : username;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Jeu du Président 🃏</Text>
      <GameHeader round={2} role="Trou duc" playerName={playerName || 'Joueur'} />
      <Card value="5" suit="spade" style={styles.card} />
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
  card: {
    marginTop: 30,
  },
});