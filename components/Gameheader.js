import { StyleSheet, Text, View } from 'react-native';

export default function GameHeader({ round = 1, role = 'Président', playerName = 'Joueur 1' }) {
  return (
    <View style={styles.container}>
      <Text style={styles.round}>Manche {round}</Text>
      <Text style={styles.playerName}>{playerName}</Text>
      <Text style={styles.role}>{role}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#021020',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  round: {
    fontSize: 18,
    color: '#ccc',
  },
  playerName: {
    fontSize: 22,
    color: '#fff',
    fontWeight: 'bold',
    marginVertical: 4,
  },
  role: {
    fontSize: 16,
    color: '#00cc66',
    fontStyle: 'italic',
  },
});
