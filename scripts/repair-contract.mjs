// A strictly limited form-repair artifact. Never execute model-generated JavaScript.
export const requiredFields = Object.freeze(['fullName', 'email', 'program']);
export const allowedTypes = new Set(['text', 'email', 'tel']);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const exactKeys = (o, keys) => Object.keys(o).length === keys.length && keys.every(k => own(o, k));
const safeText = (v, max = 90) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[<>\u0000-\u001f]/.test(v);

export function validateRepair(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
    !exactKeys(input, ['version', 'formTitle', 'fields', 'submitLabel', 'successMessage'])) {
    throw new Error('Invalid repair artifact shape');
  }
  if (input.version !== 1 || !safeText(input.formTitle) || !safeText(input.submitLabel) || !safeText(input.successMessage, 160)) {
    throw new Error('Invalid repair metadata');
  }
  if (!Array.isArray(input.fields) || input.fields.length !== requiredFields.length) {
    throw new Error('All original fields must be preserved');
  }
  const names = input.fields.map(field => field?.name);
  if (new Set(names).size !== requiredFields.length || !requiredFields.every(name => names.includes(name))) {
    throw new Error('Field names must match the original form');
  }
  for (const field of input.fields) {
    if (!field || typeof field !== 'object' || Array.isArray(field) ||
      !exactKeys(field, ['name', 'label', 'type', 'required', 'options']) ||
      !safeText(field.label) || field.required !== true) {
      throw new Error('Invalid field definition');
    }
    if (field.name === 'program') {
      if (field.type !== 'select' || !Array.isArray(field.options) || field.options.length !== 1 ||
        !exactKeys(field.options[0], ['value', 'label']) ||
        field.options[0].value !== 'engineering' || !safeText(field.options[0].label)) {
        throw new Error('Original program option must be preserved');
      }
    } else if (!allowedTypes.has(field.type) || field.options !== null) {
      throw new Error('Invalid text field');
    }
    if (field.name === 'email' && field.type !== 'email') {
      throw new Error('Email must use native email validation');
    }
  }
  return input;
}

export function extractJsonResponse(text) {
  if (typeof text !== 'string' || text.length > 16000) throw new Error('Response size exceeded');
  return validateRepair(JSON.parse(text));
}
