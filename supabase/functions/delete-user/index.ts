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

    const { user_id, role } = await req.json()

    if (!user_id || !role) {
      throw new Error('user_id and role are required')
    }

    console.log(`Starting deletion process for user ${user_id} with role ${role}`)

    // Delete based on role
    if (role === 'employee') {
      // Get employee ID
      const { data: empData } = await supabaseAdmin
        .from('employees')
        .select('id')
        .eq('user_id', user_id)
        .maybeSingle()

      if (empData) {
        console.log(`Deleting pickups for employee ${empData.id}`)
        // Delete all pickup_schedules for this employee
        await supabaseAdmin
          .from('pickup_schedules')
          .delete()
          .eq('employee_id', empData.id)

        console.log(`Deleting employee record ${empData.id}`)
        // Delete employee record
        await supabaseAdmin
          .from('employees')
          .delete()
          .eq('id', empData.id)
      }
    } else if (role === 'store') {
      // Get store ID
      const { data: storeData } = await supabaseAdmin
        .from('stores')
        .select('id')
        .eq('user_id', user_id)
        .maybeSingle()

      if (storeData) {
        console.log(`Deleting pickups for store ${storeData.id}`)
        // Delete all pickup_schedules for this store
        await supabaseAdmin
          .from('pickup_schedules')
          .delete()
          .eq('store_id', storeData.id)

        console.log(`Deleting store record ${storeData.id}`)
        // Delete store record
        await supabaseAdmin
          .from('stores')
          .delete()
          .eq('id', storeData.id)
      }
    }

    console.log(`Deleting user_roles for user ${user_id}`)
    // Delete user_roles
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', user_id)

    console.log(`Deleting auth user ${user_id}`)
    // Delete from auth.users using admin API
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user_id)
    
    if (authError) {
      console.error('Error deleting auth user:', authError)
      throw new Error('Falha ao deletar usuário do sistema de autenticação: ' + authError.message)
    }

    console.log(`Successfully deleted user ${user_id}`)

    return new Response(
      JSON.stringify({ success: true, message: 'Usuário deletado com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Error in delete-user function:', errorMessage)
    
    return new Response(
      JSON.stringify({ 
        error: 'Falha ao deletar usuário',
        details: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 400 
      }
    )
  }
})
