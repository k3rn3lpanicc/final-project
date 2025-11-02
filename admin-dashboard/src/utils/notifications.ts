export function showNotification(message: string, type: 'success' | 'error') {
  const notification = document.createElement('div');
  notification.className = `toast-notification ${type}`;
  notification.textContent = message;
  notification.style.position = 'fixed';
  notification.style.right = '20px';
  notification.style.zIndex = '2000';
  notification.style.minWidth = '250px';
  notification.style.animation = 'slideIn 0.3s ease-out';

  const existingToasts = document.querySelectorAll('.toast-notification');
  let topPosition = 20;
  existingToasts.forEach((toast) => {
    const toastElement = toast as HTMLElement;
    const toastRect = toastElement.getBoundingClientRect();
    const toastBottom = parseInt(toastElement.style.top || '20') + toastRect.height;
    if (toastBottom + 10 > topPosition) {
      topPosition = toastBottom + 10;
    }
  });

  notification.style.top = `${topPosition}px`;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      notification.remove();
      repositionToasts();
    }, 300);
  }, 3000);
}

function repositionToasts() {
  const toasts = document.querySelectorAll('.toast-notification');
  let currentTop = 20;
  toasts.forEach((toast) => {
    const toastElement = toast as HTMLElement;
    toastElement.style.transition = 'top 0.3s ease-out';
    toastElement.style.top = `${currentTop}px`;
    const toastRect = toastElement.getBoundingClientRect();
    currentTop += toastRect.height + 10;
  });
}
