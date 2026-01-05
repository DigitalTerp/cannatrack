export type StrainType = 'Indica' | 'Hybrid' | 'Sativa';
export type Method = 'Pre-Roll' | 'Bong' | 'Pipe' | 'Vape' | 'Dab' | 'Edible';

/* -------------------- Edibles -------------------- */
export type EdibleType = 'Chocolate' | 'Gummy' | 'Pill' | 'Beverage';

/* -------------------- Smokeables -------------------- */
export type SmokeableKind = 'Flower' | 'Concentrate';
export type ConcentrateCategory = 'Cured' | 'Live Resin' | 'Live Rosin';
export type ConcentrateForm = 'Sugar' | 'Badder' | 'Crumble' | 'Diamonds and Sauce' | 'Hash Rosin' | 'Temple Ball' | 'Jam' | 'Full Melt' | 'Bubble Hash';

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

  time: number;
  method: Method;

  isEdible?: boolean;
  isEdibleSession?: boolean;

  smokeableKind?: SmokeableKind;                 
  concentrateCategory?: ConcentrateCategory;     
  concentrateForm?: ConcentrateForm;             
  strainId?: string;
  strainName?: string;
  strainType: StrainType;
  strainNameLower?: string;

  brand?: string;
  brandLower?: string;
  lineage?: string;

  thcPercent?: number;
  thcaPercent?: number;
  cbdPercent?: number;

  weight?: number; // grams (flower or concentrate)

  moodBefore?: string;
  moodAfter?: string;
  effects?: string[];
  flavors?: string[];
  aroma?: string[];
  rating?: number;
  notes?: string;

  /* Edible fields */
  edibleName?: string;
  edibleType?: EdibleType;
  edibleMg?: number; 
  thcMg?: number;   

  purchaseId?: string;
  journalType?: string;
  isPurchaseArchive?: boolean;
  hiddenFromDaily?: boolean;
}

export type CreateEntryInput = Omit<Entry, 'id' | 'createdAt' | 'updatedAt' | 'userId'>;

export interface Purchase {
  id: string;
  strainName: string;
  strainNameLower: string;
  strainType: StrainType;
  brand?: string;
  lineage?: string;
  thcPercent?: number;
  thcaPercent?: number;

  smokeableKind?: SmokeableKind;
  concentrateCategory?: ConcentrateCategory;
  concentrateForm?: ConcentrateForm;

  totalGrams: number;
  remainingGrams: number;
  totalCostCents: number;
  purchaseDate: string;
  status: 'active' | 'depleted';

  createdAt: number;
  updatedAt: number;
}
