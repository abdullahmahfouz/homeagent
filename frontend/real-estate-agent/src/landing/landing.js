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
