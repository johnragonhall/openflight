import { useContext } from 'react';
import { UnitPreferenceContext } from './UnitPreferenceContext';

export function useUnitPreference() {
  return useContext(UnitPreferenceContext);
}
