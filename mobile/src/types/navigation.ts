export type RootStackParamList = {
  MainTabs: undefined;
  Connection: undefined;
  Pair: undefined;
  SessionDetail: { sessionId: string; label: string };
  SettingsUnitsPicker: undefined;
  SettingsTemperature: undefined;
  SettingsLanguage: undefined;
  SettingsAccessibility: undefined;
  BagMain: undefined;
  BagAddClub: undefined;
  BagClubDetail: { clubId: string };
  BagSpareClubs: undefined;
};

export type MainTabParamList = {
  Live: undefined;
  History: undefined;
  Stats: undefined;
  Range: undefined;
  Settings: undefined;
};
