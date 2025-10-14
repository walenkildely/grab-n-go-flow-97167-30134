import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { email, password, full_name, role, metadata } = await req.json()

    // Create user with admin privileges
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name
      }
    })

    if (createError) {
      throw createError
    }

    if (!userData.user) {
      throw new Error('Failed to create user')
    }

    // Create role entry
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userData.user.id,
        role: role
      })

    if (roleError) {
      throw roleError
    }

    // Create employee or store record based on role
    if (role === 'employee' && metadata) {
      const { error: employeeError } = await supabaseAdmin
        .from('employees')
        .insert({
          user_id: userData.user.id,
          name: metadata.name,
          email: metadata.email,
          cpf: metadata.cpf,
          monthly_limit: metadata.monthly_limit || 2,
          current_month_pickups: 0,
          last_reset_month: new Date().toISOString().slice(0, 7)
        })

      if (employeeError) {
        throw employeeError
      }
    } else if (role === 'store' && metadata) {
      const { error: storeError } = await supabaseAdmin
        .from('stores')
        .insert({
          user_id: userData.user.id,
          name: metadata.name,
          address: metadata.address,
          max_daily_capacity: metadata.max_daily_capacity || 10
        })

      if (storeError) {
        throw storeError
      }
    }

    return new Response(
      JSON.stringify({ user: userData.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
