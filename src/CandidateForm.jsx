import React, { useEffect, useState } from 'react';

export default function CandidateForm() {
  const [candidate, setCandidate] = useState(null);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/repair-candidate.json', { cache: 'no-store' })
      .then(response => { if (!response.ok) throw Error('No candidate available'); return response.json(); })
      .then(data => { if (active) setCandidate(data); })
      .catch(() => { if (active) setError('No repair candidate found. Generate one using npm run repair.'); });
    return () => { active = false; };
  }, []);

  if (error) return <section className="panel" role="alert">{error}</section>;
  if (!candidate) return <section className="panel" role="status">Loading candidate…</section>;

  return <section className="panel">
    <span className="pill good">Candidate · verification required</span>
    <h2>{candidate.formTitle}</h2>
    <form onSubmit={event => { event.preventDefault(); setSubmitted(true); }}>
      {candidate.fields.map(field => <React.Fragment key={field.name}>
        <label htmlFor={'candidate-' + field.name}>{field.label}</label>
        {field.type === 'select'
          ? <select id={'candidate-' + field.name} name={field.name} required={field.required} defaultValue="">
              <option value="" disabled>Select {field.label.toLowerCase()}</option>
              {field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          : <input id={'candidate-' + field.name} name={field.name} type={field.type} required={field.required} />}
      </React.Fragment>)}
      <button type="submit">{candidate.submitLabel}</button>
    </form>
    <p role="status" aria-live="polite">{submitted ? candidate.successMessage : ''}</p>
  </section>;
}
