import { create } from 'zustand';

const DEFAULT_VARIATIONS = [25, 50, 75, 25, 0, 50, 75, 50, 25, 0];

interface ResistancePlanState {
  enabled: boolean;
  variations: number[];
  setEnabled: (enabled: boolean) => void;
  setVariations: (variations: number[]) => void;
}

export const useResistancePlanStore = create<ResistancePlanState>((set) => ({
  enabled: false,
  variations: [...DEFAULT_VARIATIONS],
  setEnabled: (enabled) => set({ enabled }),
  setVariations: (variations) => set({ variations }),
}));
