'use client';

import React, { useState } from 'react';
import styles from './FormEntry.module.css';

type StrainType = 'Indica' | 'Sativa' | 'Hybrid';

type Props = {
  uid: string;
  purchaseId: string;
  initialValues: {
    strainName: string;
    strainType: StrainType | '';
    lineage: string;
    brand: string;
    thcPercent: string | number;
    thcaPercent: string | number;
    grams: string | number;
    dollars: string | number;
    purchaseDateISO: string;
    batchId: string;
  };
  onSaved?: () => void;
};

export default function EditPurchaseForm({ uid, purchaseId, initialValues, onSaved }: Props) {
  const [form, setForm] = useState(initialValues);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setBusy(true);
      console.log('Save purchase edits', { uid, purchaseId, form });
      onSaved?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <form onSubmit={onSubmit} className={styles.formRoot}>
        <h2 className={styles.heading}>Edit Purchase</h2>
        <div className={styles.field}>
          <label>Cultivar</label>
          <input
            className="input"
            value={form.strainName}
            onChange={(e) => setForm((f) => ({ ...f, strainName: e.target.value }))}
            required
          />
        </div>

        <div className={styles.gridAutoMed}>
          <div className={styles.field}>
            <label>Type</label>
            <select
              className="input"
              value={form.strainType}
              onChange={(e) =>
                setForm((f) => ({ ...f, strainType: e.target.value as StrainType }))
              }
            >
              <option>Indica</option>
              <option>Sativa</option>
              <option>Hybrid</option>
              <option>CBD</option>
              <option>Other</option>
            </select>
          </div>

          <div className={styles.field}>
            <label>Lineage</label>
            <input
              className="input"
              value={form.lineage}
              onChange={(e) => setForm((f) => ({ ...f, lineage: e.target.value }))}
            />
          </div>

          <div className={styles.field}>
            <label>Cultivator / Brand</label>
            <input
              className="input"
              value={form.brand}
              onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
            />
          </div>
        </div>

        <div className={styles.gridAutoMed}>
          <div className={styles.field}>
            <label>THC %</label>
            <input
              type="number"
              min="0"
              step="0.1"
              className="input"
              value={form.thcPercent}
              onChange={(e) => setForm((f) => ({ ...f, thcPercent: e.target.value }))}
            />
          </div>

          <div className={styles.field}>
            <label>THCa %</label>
            <input
              type="number"
              min="0"
              step="0.1"
              className="input"
              value={form.thcaPercent}
              onChange={(e) => setForm((f) => ({ ...f, thcaPercent: e.target.value }))}
            />
          </div>

          <div className={styles.field}>
            <label>Batch ID</label>
            <input
              className="input"
              value={form.batchId}
              onChange={(e) => setForm((f) => ({ ...f, batchId: e.target.value }))}
            />
          </div>

          <div className={styles.field}>
            <label>Purchase Date</label>
            <input
              type="date"
              className="input"
              value={form.purchaseDateISO}
              onChange={(e) => setForm((f) => ({ ...f, purchaseDateISO: e.target.value }))}
            />
          </div>
        </div>

        <div className={styles.gridTwo}>
          <div className={styles.field}>
            <label>Weight (g)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.grams}
              onChange={(e) => setForm((f) => ({ ...f, grams: e.target.value }))}
            />
          </div>

          <div className={styles.field}>
            <label>Amount Spent ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.dollars}
              onChange={(e) => setForm((f) => ({ ...f, dollars: e.target.value }))}
            />
          </div>
        </div>

        <div className={styles.actions}>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
