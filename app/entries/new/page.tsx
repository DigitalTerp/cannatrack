'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import AddEntryForm from '@/components/AddEntryForm';
import styles from './NewEntryPage.module.css';

import type {
  Method,
  StrainType,
  EdibleType,
  SmokeableKind,
  ConcentrateCategory,
  ConcentrateForm,
} from '@/lib/types';

type InitialPrefill = Partial<{
  purchaseId: string;

  strainName: string;
  strainType: StrainType;
  brand: string;
  lineage: string;
  thcPercent: string;
  thcaPercent: string;

  smokeableKind: SmokeableKind;
  concentrateCategory: ConcentrateCategory;
  concentrateForm: ConcentrateForm;

  method: Method;
  weight: string;

  edibleName: string;
  edibleType: EdibleType;
  thcMg: string;

  notes: string;
}>;

function firstParam(sp: URLSearchParams, keys: string[]) {
  for (const k of keys) {
    const v = sp.get(k);
    if (v != null && String(v).trim() !== '') return v;
  }
  return undefined;
}

function norm(v?: string) {
  return (v ?? '').trim();
}

export default function NewEntryPage() {
  const sp = useSearchParams();

  const initialPrefill: InitialPrefill | undefined = useMemo(() => {
    if (!sp) return undefined;

    const smokeableRaw = firstParam(sp, ['smokeableKind', 'smokeableType', 'productType', 'type']);
    const catRaw = firstParam(sp, ['concentrateCategory', 'category']);
    const formRaw = firstParam(sp, ['concentrateForm', 'form']);

    const pre: InitialPrefill = {
      purchaseId: norm(firstParam(sp, ['purchaseId'])) || undefined,

      strainName: norm(firstParam(sp, ['strainName', 'name'])) || undefined,
      strainType: norm(firstParam(sp, ['strainType'])) as any,

      brand: norm(firstParam(sp, ['brand'])) || undefined,
      lineage: norm(firstParam(sp, ['lineage'])) || undefined,
      thcPercent: norm(firstParam(sp, ['thcPercent'])) || undefined,
      thcaPercent: norm(firstParam(sp, ['thcaPercent'])) || undefined,

      smokeableKind: (smokeableRaw ? norm(smokeableRaw) : undefined) as any,
      concentrateCategory: (catRaw ? norm(catRaw) : undefined) as any,
      concentrateForm: (formRaw ? norm(formRaw) : undefined) as any,

      method: norm(firstParam(sp, ['method'])) as any,
      weight: norm(firstParam(sp, ['weight'])) || undefined,

      edibleName: norm(firstParam(sp, ['edibleName'])) || undefined,
      edibleType: norm(firstParam(sp, ['edibleType'])) as any,
      thcMg: norm(firstParam(sp, ['thcMg'])) || undefined,

      notes: norm(firstParam(sp, ['notes'])) || undefined,
    };

    const hasAny = Object.values(pre).some((v) => v != null && String(v).trim() !== '');
    return hasAny ? pre : undefined;
  }, [sp]);

  return (
    <div className="container">
      <div className={styles.header}>
        <h1 className={styles.title}>Log Session</h1>
        <a className={`btn btn-ghost ${styles.back}`} href="/">
          Back
        </a>
      </div>

      <AddEntryForm/>
    </div>
  );
}
