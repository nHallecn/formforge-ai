import React from 'react';

// Deliberately broken and isolated from the app's working reference renderer.
export default function ScholarshipForm() {
  return <form>
    <h2>Scholarship application</h2>
    <input name="fullName" placeholder="Full name" />
    <input name="email" placeholder="Email address" />
    <select name="program" defaultValue="">
      <option value="">Choose program</option>
      <option value="engineering">Engineering</option>
    </select>
    <button type="button">Submit application</button>
  </form>;
}
