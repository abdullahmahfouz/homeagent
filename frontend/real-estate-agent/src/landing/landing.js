/* HomeAgent landing page behaviour.
 *
 * IntersectionObserver only. No scroll listeners, no rAF loop, no state that
 * updates per frame. Elements stay revealed once seen and are unobserved, so
 * the observer empties itself as the reader moves down the page.
 */

// Mark JS as live before first paint so the reveal start-state applies only
// when there is something to finish it. Without JS the page renders fully.
document.documentElement.classList.add('js');

const targets = document.querySelectorAll('[data-reveal]');

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (reduced || !('IntersectionObserver' in window)) {
  targets.forEach((el) => el.classList.add('is-in'));
} else {
  const io = new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.15 }
  );

  targets.forEach((el) => io.observe(el));

  // Anything already in view on load reveals immediately rather than waiting
  // for the first callback tick.
  requestAnimationFrame(() => {
    targets.forEach((el) => {
      const box = el.getBoundingClientRect();
      if (box.top < window.innerHeight * 0.9) {
        el.classList.add('is-in');
        io.unobserve(el);
      }
    });
  });
}

/* "How it works" split-slider: arrows and dots step through Ask/Watch/Compare.
 * User-driven only, no autoplay, no keyboard capture (this lives inside a
 * scrolling page, not a fullscreen background, so hijacking ArrowUp/Down
 * would fight normal page scroll).
 */
const splitRoot = document.querySelector('[data-split]');
if (splitRoot) {
  const textSlides = splitRoot.querySelectorAll('.split-slide');
  const mediaSlides = splitRoot.querySelectorAll('.split-media-slide');
  const dots = splitRoot.querySelectorAll('[data-split-dot]');
  const prevBtn = splitRoot.querySelector('[data-split-prev]');
  const nextBtn = splitRoot.querySelector('[data-split-next]');
  const count = textSlides.length;
  let active = 0;

  const showStep = (index) => {
    active = (index + count) % count;
    textSlides.forEach((el, i) => el.classList.toggle('is-active', i === active));
    mediaSlides.forEach((el, i) => el.classList.toggle('is-active', i === active));
    dots.forEach((el, i) => {
      const isActive = i === active;
      el.classList.toggle('is-active', isActive);
      el.setAttribute('aria-selected', String(isActive));
    });
  };

  prevBtn?.addEventListener('click', () => showStep(active - 1));
  nextBtn?.addEventListener('click', () => showStep(active + 1));
  dots.forEach((dot, i) => dot.addEventListener('click', () => showStep(i)));
}

/* "Search by neighborhood": hovering, focusing, or tapping a name crossfades
 * the full-bleed photo behind the list. Click covers touch devices, which
 * have no hover state.
 */
const exploreRoot = document.querySelector('[data-explore]');
if (exploreRoot) {
  const items = exploreRoot.querySelectorAll('[data-explore-item]');
  const slides = exploreRoot.querySelectorAll('.explore-media-slide');

  const showNeighborhood = (index) => {
    items.forEach((el, i) => el.classList.toggle('is-active', i === index));
    slides.forEach((el, i) => el.classList.toggle('is-active', i === index));
  };

  items.forEach((item, i) => {
    item.addEventListener('mouseenter', () => showNeighborhood(i));
    item.addEventListener('focus', () => showNeighborhood(i));
    item.addEventListener('click', () => showNeighborhood(i));
  });
}
