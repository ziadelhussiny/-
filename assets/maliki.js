class MalikiCarousel extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('[data-mk-track]');
    this.querySelectorAll('[data-mk-scroll]').forEach((button) => {
      button.addEventListener('click', () => {
        if (!this.track) return;
        const direction = Number(button.dataset.mkScroll || 1);
        const directionFactor = getComputedStyle(this).direction === 'rtl' ? -1 : 1;
        this.track.scrollBy({
          left: direction * directionFactor * this.track.clientWidth * 0.72,
          behavior: 'smooth',
        });
      });
    });
  }
}

if (!customElements.get('maliki-carousel')) customElements.define('maliki-carousel', MalikiCarousel);

const menuDrawer = document.querySelector('[data-mk-menu]');
const menuOpener = document.querySelector('[data-mk-menu-open]');

function setMenuOpen(open) {
  if (!menuDrawer) return;
  menuDrawer.hidden = !open;
  menuOpener?.setAttribute('aria-expanded', String(open));
  document.documentElement.classList.toggle('mk-menu-is-open', open);
  if (open) menuDrawer.querySelector('[data-mk-menu-close]')?.focus();
  else menuOpener?.focus();
}

document.addEventListener('click', (event) => {
  const opener = event.target.closest('[data-mk-menu-open]');
  const closer = event.target.closest('[data-mk-menu-close]');
  const drawer = document.querySelector('[data-mk-menu]');
  if (!drawer || (!opener && !closer)) return;

  setMenuOpen(Boolean(opener));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuDrawer && !menuDrawer.hidden) setMenuOpen(false);
});
