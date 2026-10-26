const BANNER_KEY = 'oyw-work-device-banner-dismissed';

const banner = document.querySelector<HTMLElement>('[data-work-device-banner]');
if (banner) {
  if (localStorage.getItem(BANNER_KEY) === '1') {
    banner.hidden = true;
  } else {
    banner
      .querySelector<HTMLElement>('[data-dismiss]')
      ?.addEventListener('click', () => {
        localStorage.setItem(BANNER_KEY, '1');
        banner.hidden = true;
      });
  }
}