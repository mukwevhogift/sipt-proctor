import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/create-admin
 *
 * Creates an admin account. Hit this from Postman once to seed your admin user.
 *
 * Body (JSON):
 * {
 *   "email": "admin@sipt.ac.za",
 *   "password": "YourSecurePassword123",
 *   "full_name": "Admin User",
 *   "staff_number": "STF001"
 * }
 *
 * Optional header:
 *   X-Admin-Secret: <value of ADMIN_SECRET env var>  (if you set one)
 */
export async function POST(req: NextRequest) {
  try {
    // ── Guard: optional secret to prevent random people from hitting this ──
    const secret = process.env.ADMIN_SECRET;
    if (secret) {
      const provided = req.headers.get('x-admin-secret');
      if (provided !== secret) {
        return NextResponse.json({ error: 'Invalid admin secret' }, { status: 401 });
      }
    }

    // ── Parse body ──
    const body = await req.json();
    const { email, password, full_name, staff_number } = body as {
      email?: string;
      password?: string;
      full_name?: string;
      staff_number?: string;
    };

    if (!email || !password) {
      return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: 'Supabase env vars not configured' }, { status: 500 });
    }

    // ── 1. Create auth user (anon key is fine for signUp) ──
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await anonClient.auth.signUp({
      email,
      password,
    });

    if (authError) {
      return NextResponse.json({ error: `Auth signup failed: ${authError.message}` }, { status: 400 });
    }

    const userId = authData.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'User created but no ID returned' }, { status: 500 });
    }

    // ── 2. Insert profile with role = 'admin' ──
    // Service role key bypasses RLS. If not set, sign in as the user to satisfy RLS.
    let insertClient;
    if (serviceKey) {
      insertClient = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    } else {
      // Sign in as the new user so auth.uid() matches the profile id for RLS
      const { error: signInError } = await anonClient.auth.signInWithPassword({
        email: email!,
        password: password!,
      });
      if (signInError) {
        return NextResponse.json({
          error: `User created but sign-in failed (email confirmation may be required): ${signInError.message}`,
          fix: 'Add SUPABASE_SERVICE_ROLE_KEY to .env.local, or disable email confirmation in Supabase Dashboard → Auth → Settings.',
          user_id: userId,
        }, { status: 500 });
      }
      insertClient = anonClient;
    }

    const { error: profileError } = await insertClient.from('profiles').insert({
      id: userId,
      full_name: full_name ?? 'Admin',
      staff_number: staff_number ?? 'ADMIN',
      role: 'admin',
    });

    if (profileError) {
      return NextResponse.json({
        error: `Profile insert failed: ${profileError.message}`,
        note: 'Auth user was created — you can manually set the role in Supabase.',
        user_id: userId,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user_id: userId,
      email,
      role: 'admin',
      message: 'Admin account created. You can now log in at /login.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}
