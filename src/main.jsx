import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function BrokenForm() {
  const [status, setStatus] = useState('');
  return <section className="panel">
    <span className="pill bad">Before · intentionally broken</span>
    <h2>Scholarship application</h2>
    <p className="muted">Unlabeled controls and an inert submission action.</p>
    <form onSubmit={event => { event.preventDefault(); setStatus(''); }}>
      <input name="fullName" placeholder="Full name" />
      <input name="email" placeholder="Email address" />
      <select name="program" defaultValue=""><option value="">Select a program</option><option value="engineering">Engineering</option></select>
      <button type="button">Submit application</button>
    </form>
    <p className="muted" role="status">{status}</p>
  </section>;
}

function RepairedForm() {
  const [submitted, setSubmitted] = useState(false);
  return <section className="panel">
    <span className="pill good">After · reference repair</span>
    <h2>Scholarship application</h2>
    <p className="muted">Labeled, validated controls and working submission.</p>
    <form onSubmit={event => { event.preventDefault(); setSubmitted(true); }}>
      <label htmlFor="fullName">Full name</label>
      <input id="fullName" name="fullName" autoComplete="name" required />
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="email" required />
      <label htmlFor="program">Program</label>
      <select id="program" name="program" required defaultValue=""><option value="" disabled>Select a program</option><option value="engineering">Engineering</option></select>
      <button type="submit">Submit application</button>
    </form>
    <p role="status" aria-live="polite">{submitted ? 'Application submitted successfully.' : ''}</p>
  </section>;
}

function App() {
  const repaired = new URLSearchParams(window.location.search).get('variant') === 'repaired';
  return <main className="layout">
    <header><div className="brand">✳ FormForge <span>AI</span></div><p className="muted">Verified form repair · benchmark case 001</p></header>
    <div className="hero"><h1>{repaired ? 'A form that works.' : 'A form that blocks people.'}</h1><p>One reproducible defect case. One inspectable reference repair. Browser tests verify the difference.</p></div>
    {repaired ? <RepairedForm /> : <BrokenForm />}
    <nav aria-label="Benchmark variants"><a href="/?variant=broken">Broken baseline</a><a href="/?variant=repaired">Reference repair</a></nav>
    <footer>Reference repair is hand-authored; automated AI repair is not implemented yet.</footer>
  </main>;
}
createRoot(document.getElementById('root')).render(<App />);
