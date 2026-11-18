
document.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const dialogs = [...document.querySelectorAll('.modal-backdrop.open [role="dialog"], .profile-crop-modal[role="dialog"]:not([hidden])')];
  const dialog = dialogs[dialogs.length - 1];
  if (!dialog) return;
  const focusable = [...dialog.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el => !el.hidden && el.getClientRects().length);
  if (!focusable.length) { event.preventDefault(); return; }
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
});
