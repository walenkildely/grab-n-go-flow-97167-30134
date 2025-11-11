import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.5.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const vapidPublicKey = Deno.env.get('VITE_VAPID_PUBLIC_KEY') ?? '';
const vapidPrivateKey = Deno.env.get('SERVICE_VAPID_PRIVATE_KEY') ?? '';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails('mailto:support@example.com', vapidPublicKey, vapidPrivateKey);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: 'VAPID keys are not configured on the server.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const { storeId, pickupToken, pickupDate, quantity, employeeName } = await req.json();

    if (!storeId || !pickupToken || !pickupDate) {
      return new Response(
        JSON.stringify({ error: 'Missing required payload data.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: store, error: storeError } = await supabaseAdmin
      .from('stores')
      .select('id, name, user_id')
      .eq('id', storeId)
      .maybeSingle();

    if (storeError || !store) {
      console.error('Failed to load store for push notification', storeError);
      return new Response(
        JSON.stringify({ error: 'Store not found.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', store.user_id);

    if (subscriptionsError) {
      console.error('Failed to load store subscriptions', subscriptionsError);
      return new Response(
        JSON.stringify({ error: 'Could not load push subscriptions.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const payload = JSON.stringify({
      title: 'Novo pedido de retirada',
      body: `${employeeName ?? 'Um funcionário'} agendou uma retirada para ${pickupDate}.`,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: {
        token: pickupToken,
        url: '/',
        quantity,
        pickupDate,
        employeeName,
      },
    });

    const failedEndpoints: string[] = [];

    await Promise.all((subscriptions ?? []).map(async (subscription) => {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        }, payload);
      } catch (error) {
        console.error('Failed to send push notification to store', error);
        failedEndpoints.push(subscription.endpoint);
      }
    }));

    return new Response(
      JSON.stringify({ success: true, failed: failedEndpoints }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Unexpected error sending push notification to store', error);
    return new Response(
      JSON.stringify({ error: 'Unexpected error sending notification.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
