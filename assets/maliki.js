class MalikiCarousel extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('[data-mk-track]');
    this.querySelectorAll('[data-mk-scroll]').forEach((button) => {
      button.addEventListener('click', () => {
        if (!this.track) return;
        const direction = Number(button.dataset.mkScroll || 1);
        this.track.scrollBy({ left: direction * this.track.clientWidth * 0.72, behavior: 'smooth' });
      });
    });
  }
}

if (!customElements.get('maliki-carousel')) customElements.define('maliki-carousel', MalikiCarousel);

document.addEventListener('click', (event) => {
  const opener = event.target.closest('[data-mk-menu-open]');
  const closer = event.target.closest('[data-mk-menu-close]');
  const drawer = document.querySelector('[data-mk-menu]');
  if (!drawer || (!opener && !closer)) return;

  const open = Boolean(opener);
  drawer.hidden = !open;
  document.documentElement.classList.toggle('mk-menu-is-open', open);
});

