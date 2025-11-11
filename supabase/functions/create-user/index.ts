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

  let createdUserId: string | null = null;
  
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

    console.log('Creating user:', { email, role, metadata })

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
      console.error('Error creating auth user:', createError)
      throw createError
    }

    if (!userData.user) {
      throw new Error('Failed to create user')
    }

    createdUserId = userData.user.id;
    console.log('Auth user created:', createdUserId)

    // Create role entry
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userData.user.id,
        role: role
      })

    if (roleError) {
      console.error('Error creating role:', roleError)
      // Rollback: delete the user
      await supabaseAdmin.auth.admin.deleteUser(createdUserId)
      throw new Error('Falha ao criar role do usuário')
    }

    console.log('Role created:', role)

    // Create employee or store record based on role
    if (role === 'employee' && metadata) {
      console.log('Creating employee record:', metadata)
      
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
        console.error('Error creating employee:', employeeError)
        // Rollback: delete the user
        await supabaseAdmin.auth.admin.deleteUser(createdUserId)
        
        // Check for specific errors
        if (employeeError.code === '23505') {
          if (employeeError.message.includes('cpf')) {
            throw new Error('Já existe um funcionário cadastrado com este CPF')
          }
          if (employeeError.message.includes('email')) {
            throw new Error('Já existe um funcionário cadastrado com este email')
          }
        }
        
        throw new Error('Falha ao criar registro do funcionário: ' + employeeError.message)
      }
      
      console.log('Employee record created successfully')
    } else if (role === 'store' && metadata) {
      console.log('Creating store record:', metadata)
      
      const { error: storeError } = await supabaseAdmin
        .from('stores')
        .insert({
          user_id: userData.user.id,
          name: metadata.name,
          address: metadata.address,
          max_daily_capacity: metadata.max_daily_capacity || 10
        })

      if (storeError) {
        console.error('Error creating store:', storeError)
        // Rollback: delete the user
        await supabaseAdmin.auth.admin.deleteUser(createdUserId)
        throw new Error('Falha ao criar registro da loja: ' + storeError.message)
      }
      
      console.log('Store record created successfully')
    }

    console.log('User creation completed successfully')

    return new Response(
      JSON.stringify({ user: userData.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    // Check for specific error types
    let status = 400
    let userMessage = errorMessage
    
    if (errorMessage.includes('email address has already been registered') || errorMessage.includes('User already registered')) {
      status = 409
      userMessage = 'Já existe um usuário cadastrado com este email'
    }
    
    console.error('Error in create-user function:', errorMessage)
    
    return new Response(
      JSON.stringify({ 
        error: userMessage,
        details: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status 
      }
    )
  }
})
