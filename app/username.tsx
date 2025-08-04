import LogoKarleta from '@/components/LogoKarleta';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function UsernameScreen() {
  const [username, setUsername] = useState('');
  const router = useRouter();

  const handleStart = () => {
    if (username.trim() !== '') {
      router.push(`/president?username=${encodeURIComponent(username)}`);
    }
  };

  return (
    <View style={styles.container}>

     <LogoKarleta style={styles.logo} />

      <Text style={styles.title}>Entre ton pseudo</Text>
      <TextInput
        placeholder=""
        placeholderTextColor="#aaa"
        value={username}
        onChangeText={setUsername}
        style={styles.input}
      />
      <Pressable style={styles.button} onPress={handleStart}>
        <Text style={styles.buttonText}>Commencer la partie</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#021020',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logo: {
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    color: 'white',
    marginBottom: 20,
  },
  input: {
    borderColor: '#fff',
    borderWidth: 1,
    padding: 10,
    width: '80%',
    borderRadius: 8,
    color: 'white',
    marginBottom: 20,
  },
  button: {
    backgroundColor: 'black',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
  },
});