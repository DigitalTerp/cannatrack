export type StrainType = 'Indica' | 'Hybrid' | 'Sativa';
export type Method = 'Pre-Roll' | 'Bong' | 'Pipe' | 'Vape' | 'Dab';

/* -------------------- Cultivar (Strain) -------------------- */
export interface Strain {
  id: string;
  name: string;
  nameLower: string;
  type: StrainType;
  brand?: string;
  lineage?: string;
  thcPercent?: number;
  thcaPercent?: number;
  cbdPercent?: number;
  createdAt?: number;
  updatedAt?: number;
  effects?: string[];
  flavors?: string[];
  aroma?: string[];
  rating?: number;
  notes?: string;
}

/* -------------------- Entry (Session) -------------------- */
export interface Entry {
  id: string;
  userId: string;
  createdAt: number;
  updatedAt: number;

  time: number; // ms since epoch

  // Linkage / denormalized names for filtering
  strainId?: string;
  strainName: string;
  strainType: StrainType;
  strainNameLower?: string;

  brand?: string;
  brandLower?: string;
  lineage?: string;

  thcPercent?: number;
  thcaPercent?: number;
  cbdPercent?: number;

  method: Method;
  weight?: number; // grams

  moodBefore?: string;
  moodAfter?: string;
  effects?: string[];
  flavors?: string[];
  aroma?: string[];
  rating?: number;
  notes?: string;
}

export type CreateEntryInput = Omit<Entry, 'id' | 'createdAt' | 'updatedAt' | 'userId'>;
