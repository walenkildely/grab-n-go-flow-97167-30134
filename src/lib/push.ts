import { supabase } from '@/integrations/supabase/client';

type PushEnabledUser = {
  id: string;
  role: 'admin' | 'store' | 'employee';
};

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
};

export const registerPushNotifications = async (user: PushEnabledUser | null | undefined) => {
  if (typeof window === 'undefined' || !user) {
    return null;
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications are not supported in this browser.');
    return null;
  }

  if (!('Notification' in window)) {
    console.warn('Notifications API not available in this environment.');
    return null;
  }

  if (Notification.permission === 'denied') {
    console.warn('Notification permission has been denied by the user.');
    return null;
  }

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

  if (!vapidKey) {
    console.warn('VAPID public key not configured.');
    return null;
  }

  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    console.warn('Notification permission not granted.');
    return null;
  }

  await navigator.serviceWorker.register('/sw.js');
  const readyRegistration = await navigator.serviceWorker.ready;
  let subscription = await readyRegistration.pushManager.getSubscription();

  if (!subscription) {
    try {
      subscription = await readyRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });
    } catch (error) {
      console.error('Failed to subscribe to push manager', error);
      throw error;
    }
  }

  if (!subscription) {
    return null;
  }

  const subscriptionJson = subscription.toJSON();

  const { error } = await supabase.functions.invoke('save-push-subscription', {
    body: {
      userId: user.id,
      role: user.role,
      subscription: subscriptionJson,
    },
  });

  if (error) {
    console.error('Failed to persist push subscription', error);
    throw error;
  }

  return subscriptionJson;
};
