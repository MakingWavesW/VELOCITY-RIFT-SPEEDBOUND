/** Native dialogs retain their focus restoration and keyboard semantics. */
export function installDialogMotion() {
  const close = HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.close = function (value?: string) {
    if (!this.open || this.dataset.closing) return;
    if (
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.body.classList.contains("reduced-motion")
    ) {
      close.call(this, value);
      return;
    }
    this.dataset.closing = "true";
    setTimeout(() => {
      delete this.dataset.closing;
      close.call(this, value);
    }, 160);
  };
  document.addEventListener(
    "cancel",
    (e) => {
      if (e.target instanceof HTMLDialogElement) {
        e.preventDefault();
        e.target.close();
      }
    },
    true,
  );
}
