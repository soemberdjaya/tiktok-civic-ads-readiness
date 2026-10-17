/** Scroll to the element only if it isn't visible, so the screen doesn't jump around. */
export function scrollToId(id: string) {
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const visible = r.top >= 64 && r.bottom <= window.innerHeight - 16;
    if (!visible) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}
