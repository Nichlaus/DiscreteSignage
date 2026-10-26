export function brandColoursView() {
  return `<fieldset><legend>Brand colours (optional)</legend>
    <p class="field-note">Choose up to three colours using the swatches, or enter your brand’s hex codes. Leave them empty to let AI choose. Clear a colour to remove it.</p>
    ${['#174f43', '#f4e9d8', '#ffffff'].map((colour, i) => `<div data-brand-colour class="brand-colour-row">
      <label>Choose colour ${i + 1}<input type="color" value="${colour}" aria-label="Choose colour ${i + 1}"></label>
      <label>Colour ${i + 1} hex<input name="colourHex" maxlength="7" placeholder="Not selected" pattern="#[0-9a-fA-F]{6}" title="Enter # followed by six hexadecimal characters, for example #174F43." autocomplete="off" spellcheck="false"></label>
      <button type="button" class="secondary" aria-label="Clear colour ${i + 1}">Clear</button>
    </div>`).join('')}
    <p class="field-note">A swatch is only included once you choose it or enter a code. AI artwork may vary from these colours.</p></fieldset>`;
}

export function bindBrandColours(form) {
  for (const row of form.querySelectorAll('[data-brand-colour]')) {
    const picker = row.querySelector('[type="color"]'), hex = row.querySelector('[name="colourHex"]');
    picker.oninput = () => { hex.value = picker.value.toUpperCase(); };
    hex.oninput = () => {
      if (/^#[0-9a-f]{6}$/i.test(hex.value)) picker.value = hex.value;
    };
    row.querySelector('button').onclick = () => { hex.value = ''; hex.focus(); };
  }
}
