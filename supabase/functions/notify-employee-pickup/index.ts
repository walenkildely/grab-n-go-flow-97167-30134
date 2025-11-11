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

    const { employeeId, status, token, storeName, pickupDate, reason } = await req.json();

    if (!employeeId || !status) {
      return new Response(
        JSON.stringify({ error: 'Missing required payload data.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: employee, error: employeeError } = await supabaseAdmin
      .from('employees')
      .select('id, name, user_id')
      .eq('id', employeeId)
      .maybeSingle();

    if (employeeError || !employee) {
      console.error('Failed to load employee for push notification', employeeError);
      return new Response(
        JSON.stringify({ error: 'Employee not found.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', employee.user_id);

    if (subscriptionsError) {
      console.error('Failed to load employee subscriptions', subscriptionsError);
      return new Response(
        JSON.stringify({ error: 'Could not load push subscriptions.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let title = 'Atualização do seu pedido';
    let body = `A loja ${storeName ?? ''} atualizou o status do seu pedido.`.trim();

    if (status === 'completed') {
      title = 'Pedido pronto!';
      body = `A loja ${storeName ?? ''} confirmou a retirada.`.trim();
    }

    if (status === 'cancelled') {
      title = 'Pedido cancelado';
      body = reason
        ? `A loja ${storeName ?? ''} cancelou a retirada: ${reason}`.trim()
        : `A loja ${storeName ?? ''} cancelou a retirada.`.trim();
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: {
        token,
        url: '/',
        pickupDate,
        status,
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
        console.error('Failed to send push notification to employee', error);
        failedEndpoints.push(subscription.endpoint);
      }
    }));

    return new Response(
      JSON.stringify({ success: true, failed: failedEndpoints }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Unexpected error sending push notification to employee', error);
    return new Response(
      JSON.stringify({ error: 'Unexpected error sending notification.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
