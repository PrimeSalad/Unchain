import { Stack } from 'expo-router';

const gameOptions = {
  headerShown: false,
  gestureEnabled: false,
  fullScreenGestureEnabled: false,
  contentStyle: { backgroundColor: 'transparent' },
} as const;

export default function GamesLayout() {
  return (
    <Stack screenOptions={gameOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="achievements" />
      <Stack.Screen name="blocks" />
      <Stack.Screen name="checkers" />
      <Stack.Screen name="clarity" />
      <Stack.Screen name="gonogo" />
      <Stack.Screen name="sudoku" />
    </Stack>
  );
}
