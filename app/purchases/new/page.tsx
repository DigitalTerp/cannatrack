'use client';

import PurchaseForm from '@/components/PurchaseForm';
import styles from './NewPurchasePage.module.css';

export default function NewPurchasePage() {
  return (
    <div className="container">
      <div className={styles.header}>
        <h1 className={styles.title}>Log A Purchase</h1>
        <a className={`btn btn-ghost ${styles.back}`} href="/purchases">Back</a>
      </div>

      <PurchaseForm />
    </div>
  );
}
