import { toast, type ToastType } from 'bulma-toast';

export function showToast(message: string, type: ToastType = 'is-success'): void {
  const body = document.createElement('span');
  body.textContent = message;
  toast({
    message: body,
    type,
    position: 'bottom-right',
    duration: 3200,
    dismissible: true,
    pauseOnHover: true,
    closeOnClick: false,
    extraClasses: 'is-light ck-toast',
  });
}
