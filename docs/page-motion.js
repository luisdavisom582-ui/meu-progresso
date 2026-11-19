(function gentlePageMotion() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const main = document.getElementById('mainContent');
  const pageAnimations = new Map();
  const scrollAnimations = new Map();

  function animate(element, frames, duration, group) {
    if (typeof element.animate !== 'function') return;
    group.get(element)?.cancel();
    const animation = element.animate(frames, { duration, easing: 'cubic-bezier(.2,.65,.3,1)' });
    group.set(element, animation);
    animation.finished.catch(() => {}).finally(() => {
      if (group.get(element) === animation) group.delete(element);
    });
  }

  function cancel(group) {
    group.forEach(animation => animation.cancel());
    group.clear();
  }

  function animatePage() {
    cancel(pageAnimations);
    cancel(scrollAnimations);
    if (reduce.matches || document.body.classList.contains('entry-locked') ||
        document.querySelector('#evolutionPortal.portal-active')) return;

    main.querySelectorAll(':scope > [data-section]:not([hidden])').forEach(section => {
      animate(section, [{ opacity: .55, translate: '0 7px' }, { opacity: 1, translate: '0 0' }], 290, pageAnimations);
    });
  }

  document.addEventListener('mp:page', animatePage);
  document.addEventListener('mp:entry-ready', animatePage, { once: true });

  if ('IntersectionObserver' in window && !reduce.matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(({ isIntersecting, target }) => {
        if (!isIntersecting || reduce.matches || !target.getBoundingClientRect().height) return;
        observer.unobserve(target);
        const opening = [...pageAnimations.keys()].some(section => section.contains(target));
        if (!opening && !document.querySelector('#evolutionPortal.portal-active')) {
          animate(target, [{ opacity: .65 }, { opacity: 1 }], 380, scrollAnimations);
        }
      });
    }, { threshold: .08 });
    main.querySelectorAll('.panel,.stats,.tip-grid article,.about-cards article').forEach(element => observer.observe(element));
  }

  reduce.addEventListener('change', () => {
    if (reduce.matches) {
      cancel(pageAnimations);
      cancel(scrollAnimations);
    }
  });

  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const light = document.createElement('div');
  light.className = 'cursor-light';
  light.setAttribute('aria-hidden', 'true');
  document.body.append(light);
  document.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || reduce.matches) return;
    light.style.transform = 'translate3d(' + event.clientX + 'px,' + event.clientY + 'px,0)';
    light.classList.add('visible');
  }, { passive: true });

  function hide() { light.classList.remove('visible'); }
  document.documentElement.addEventListener('pointerleave', hide);
  window.addEventListener('blur', hide);
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
  reduce.addEventListener('change', () => { if (reduce.matches) hide(); });
})();
