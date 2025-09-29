import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, SafeAreaView } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <HomeScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
});
