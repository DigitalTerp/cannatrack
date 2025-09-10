export type StrainType = 'Indica' | 'Hybrid' | 'Sativa';
export type Method = 'Pre-Roll' | 'Bong' | 'Pipe' | 'Vape' | 'Dab' | 'Edible';

/* -------------------- Edibles -------------------- */
export type EdibleType = 'Chocolate' | 'Gummy' | 'Pill' | 'Beverage';

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
  method: Method;

  // Linkage / denormalized names for filtering (smokeables)
  strainId?: string;
  strainName?: string;            // optional now; empty/undefined for edibles
  strainType: StrainType;         // still required (edibles also choose Indica/Hybrid/Sativa)
  strainNameLower?: string;

  brand?: string;
  brandLower?: string;
  lineage?: string;

  // Potency (smokeables)
  thcPercent?: number;
  thcaPercent?: number;
  cbdPercent?: number;

  // Amount (smokeables)
  weight?: number; // grams

  // Experience
  moodBefore?: string;
  moodAfter?: string;
  effects?: string[];
  flavors?: string[];
  aroma?: string[];
  rating?: number;
  notes?: string;

  /* --------------- Edible-specific fields --------------- */
  isEdible?: boolean;       // true when method === 'Edible'
  edibleName?: string;      // e.g., "Kiva Camino Watermelon"
  edibleType?: EdibleType;  // Chocolate | Gummy | Pill | Beverage
  thcMg?: number;           // total THC (mg) consumed in this session
}

export type CreateEntryInput = Omit<Entry, 'id' | 'createdAt' | 'updatedAt' | 'userId'>;
