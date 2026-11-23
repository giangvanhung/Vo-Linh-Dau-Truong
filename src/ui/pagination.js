export function addPagination(container, labels, showPage, itemsId) {
  let page = 0;
  const pager = document.createElement('nav');
  pager.className = 'page-navigation';
  pager.setAttribute('aria-label', 'Chuyển trang');
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Chọn trang');
  select.setAttribute('aria-controls', itemsId);
  labels.forEach((label, index) => {
    const number = `${index + 1}/${labels.length}`;
    select.add(new Option(label ? `${number} · ${label}` : `Trang ${number}`, index));
  });
  const previous = pageButton('‹ Trước', -1);
  const next = pageButton('Sau ›', 1);
  const status = document.createElement('span');
  status.className = 'page-announcement';
  status.setAttribute('role', 'status');
  pager.append(previous, select, next, status);
  select.addEventListener('change', () => show(Number(select.value)));
  pager.hidden = labels.length < 2;
  container.append(pager);
  show(0);
  return show;

  function pageButton(label, step) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'panel-button';
    button.textContent = label;
    button.setAttribute('aria-controls', itemsId);
    button.addEventListener('click', () => show(page + step));
    return button;
  }

  function show(index) {
    page = index;
    showPage(page);
    select.value = page;
    if (document.activeElement !== select) status.textContent = select.selectedOptions[0].text;
    const atFirst = page === 0;
    const atLast = page === labels.length - 1;
    if ((atFirst && document.activeElement === previous) || (atLast && document.activeElement === next)) {
      select.focus({ preventScroll: true });
    }
    previous.disabled = atFirst;
    next.disabled = atLast;
  }
}

export function connectSectionButtons(navigation) {
  const buttons = [...navigation.querySelectorAll('button[aria-controls]')];
  const sections = buttons.map(button => document.getElementById(button.getAttribute('aria-controls')));
  function show(id) {
    buttons.forEach((button, index) => {
      const section = sections[index];
      const visible = section.id === id;
      button.setAttribute('aria-pressed', String(visible));
      if (!visible && section.contains(document.activeElement)) {
        buttons[sections.findIndex(item => item.id === id)].focus({ preventScroll: true });
      }
      section.hidden = !visible;
      if (visible) section.scrollTop = 0;
    });
  }
  buttons.forEach((button, index) => button.addEventListener('click', () => show(sections[index].id)));
  return show;
}
