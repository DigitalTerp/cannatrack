import AddEntryForm from '@/components/AddEntryForm';

export default function NewEntryPage() {
  return (
    <div className="container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h1>Log Session</h1>
        <a className="btn btn-ghost" href="/">Back</a>
      </div>

      <AddEntryForm />
    </div>
  );
}
