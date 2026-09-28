/**
 * ToastService — Non-blocking luxury floating toast notifications.
 * Replaces intrusive alert() dialogs with elegant mobile toasts.
 */
class ToastService {
  constructor() {
    this.container = null;
    this.currentTimer = null;
  }

  _getOrCreateContainer() {
    if (typeof document === 'undefined') return null;
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'aura-toast-container';
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  show(message, type = 'info', duration = 2800) {
    const container = this._getOrCreateContainer();
    if (!container) return;

    if (this.currentTimer) {
      clearTimeout(this.currentTimer);
    }

    container.innerHTML = '';
    const toast = document.createElement('div');
    toast.className = `aura-toast aura-toast-${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'heart') iconName = 'heart';
    if (type === 'download') iconName = 'download-cloud';
    if (type === 'error') iconName = 'alert-triangle';

    toast.innerHTML = `
      <i data-lucide="${iconName}" class="aura-toast-icon"></i>
      <span class="aura-toast-text">${message}</span>
    `;

    container.appendChild(toast);
    if (typeof window !== 'undefined' && window.lucide) {
      window.lucide.createIcons();
    }

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    this.currentTimer = setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => {
        if (toast.parentElement) toast.remove();
      }, 300);
    }, duration);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ToastService;
}
