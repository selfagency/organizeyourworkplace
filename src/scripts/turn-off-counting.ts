const COUNTING_KEY = 'oyw-counting-off';

// Umami (R0.8) checks this flag before sending. Setting it here is
// immediate; the confirmation label comes from the element's data attribute.
const link = document.querySelector<HTMLElement>('[data-turn-off-counting]');
link?.addEventListener('click', (event) => {
  event.preventDefault();
  localStorage.setItem(COUNTING_KEY, '1');
  const confirm = link.dataset.countingOffConfirm;
  if (confirm) link.textContent = confirm;
});