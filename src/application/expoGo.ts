import Constants from 'expo-constants';

function readFlag(key: 'appOwnership' | 'executionEnvironment'): string | undefined {
  return (Constants as any)?.[key];
}

export function isExpoGo(): boolean {
  return readFlag('appOwnership') === 'expo' || readFlag('executionEnvironment') === 'storeClient';
}
