export function choiceCard(group, id, name, image, checked, onSelect) {
  const card = document.createElement('label');
  card.className = 'roster-card';
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = group;
  radio.value = id;
  radio.checked = checked;
  card.classList.toggle('is-selected', checked);
  radio.addEventListener('change', () => {
    card.parentElement.querySelector('.is-selected')?.classList.remove('is-selected');
    card.classList.add('is-selected');
    onSelect(id);
  });
  const preview = document.createElement(image ? 'img' : 'span');
  preview.className = 'roster-portrait';
  if (image) {
    preview.loading = 'lazy';
    preview.decoding = 'async';
    preview.src = image;
    preview.alt = '';
  } else {
    preview.textContent = '?';
    preview.setAttribute('aria-hidden', 'true');
  }
  const label = document.createElement('span');
  label.textContent = name;
  card.append(radio, preview, label);
  return card;
}
