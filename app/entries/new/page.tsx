import AddEntryForm from '@/components/AddEntryForm';
import styles from './NewEntryPage.module.css';

export default function NewEntryPage() {
  return (
    <div className="container">
      <div className={styles.header}>
        <h1 className={styles.title}>Log Session</h1>
        <a className={`btn btn-ghost ${styles.back}`} href="/">Back</a>
      </div>

      <AddEntryForm />
    </div>
  );
}
