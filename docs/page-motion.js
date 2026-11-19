(function gentlePageMotion() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const main = document.getElementById('mainContent');
  const pageClass = 'tab-opening';
  let openingSections = [];
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

  let pendingPage;
  let pageTimer;
  const closingDialogs = new Map();

  function finishPage() {
    clearTimeout(pageTimer);
    const change = pendingPage;
    pendingPage = undefined;
    main.classList.remove('tab-leaving');
    change?.();
  }

  window.mpLeavePage = change => {
    if (reduce.matches || document.body.classList.contains('entry-locked')) {
      change();
      return;
    }
    pendingPage = change;
    if (!main.classList.contains('tab-leaving')) {
      main.classList.add('tab-leaving');
      pageTimer = setTimeout(finishPage, 240);
    }
  };

  window.mpCloseDialog = (dialog, value) => {
    if (!dialog.open || closingDialogs.has(dialog)) return;
    if (reduce.matches) {
      dialog.close(value);
      return;
    }
    const finish = () => {
      clearTimeout(closingDialogs.get(dialog)?.timer);
      closingDialogs.delete(dialog);
      dialog.classList.remove('dialog-leaving');
      if (dialog.open) dialog.close(value);
    };
    dialog.classList.add('dialog-leaving');
    closingDialogs.set(dialog, { finish, timer: setTimeout(finish, 240) });
  };

  document.addEventListener('submit', event => {
    if (event.target.closest('dialog.dialog-leaving')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  document.addEventListener('submit', event => {
    const form = event.target;
    if (event.defaultPrevented || (event.submitter?.getAttribute('formmethod') || form.method) !== 'dialog') return;
    const dialog = form.closest('dialog[open]');
    if (!dialog) return;
    event.preventDefault();
    window.mpCloseDialog(dialog, event.submitter?.value);
  });
  document.addEventListener('cancel', event => {
    if (!event.target.matches('dialog[open]') || event.defaultPrevented) return;
    event.preventDefault();
    window.mpCloseDialog(event.target);
  }, true);

  function animatePage() {
    clearTimeout(pageTimer);
    pendingPage = undefined;
    main.classList.remove('tab-leaving');
    openingSections.forEach(section => section.classList.remove(pageClass));
    openingSections = [];
    cancel(scrollAnimations);
    if (reduce.matches || document.body.classList.contains('entry-locked') ||
        document.querySelector('#evolutionPortal.portal-active')) return;

    openingSections = [...main.querySelectorAll(':scope > [data-section]:not([hidden])')];
    // Restart even when two tabs share a section.
    void main.offsetWidth;
    openingSections.forEach(section => section.classList.add(pageClass));
  }

  main.addEventListener('animationend', event => {
    if (event.animationName === 'mp-tab-in') event.target.classList.remove(pageClass);
  });
  document.addEventListener('mp:page', animatePage);
  document.addEventListener('mp:entry-ready', animatePage, { once: true });

  if ('IntersectionObserver' in window && !reduce.matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(({ isIntersecting, target }) => {
        if (!isIntersecting || reduce.matches || !target.getBoundingClientRect().height) return;
        observer.unobserve(target);
        const opening = openingSections.some(section => section.classList.contains(pageClass) && section.contains(target));
        if (!opening && !document.querySelector('#evolutionPortal.portal-active')) {
          animate(target, [{ opacity: .65 }, { opacity: 1 }], 380, scrollAnimations);
        }
      });
    }, { threshold: .08 });
    main.querySelectorAll('.panel,.stats,.tip-grid article,.about-cards article').forEach(element => observer.observe(element));
  }

  reduce.addEventListener('change', () => {
    if (reduce.matches) {
      if (pendingPage) finishPage();
      closingDialogs.forEach(({ finish }) => finish());
      openingSections.forEach(section => section.classList.remove(pageClass));
      openingSections = [];
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
