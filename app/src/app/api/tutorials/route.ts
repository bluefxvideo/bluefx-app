import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/app/supabase/server';

async function isAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  return profile?.role === 'admin' || user.email === 'contact@bluefx.net';
}

export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const searchParams = request.nextUrl.searchParams;
    const featured = searchParams.get('featured');

    let query = adminClient
      .from('tutorials')
      .select('*')
      .order('created_at', { ascending: false });

    if (featured === 'true') {
      query = query.eq('tool_name', 'featured').limit(1);
    } else {
      query = query.neq('tool_name', 'featured');
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (featured === 'true') {
      return NextResponse.json(data?.[0] || null);
    }

    return NextResponse.json(data || []);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const adminClient = createAdminClient();

    if (body.id) {
      // Update
      const { data, error } = await adminClient
        .from('tutorials')
        .update({
          title: body.title,
          description: body.description,
          video_url: body.video_url,
          tool_name: body.tool_name,
        })
        .eq('id', body.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    } else {
      // Create
      const { data, error } = await adminClient
        .from('tutorials')
        .insert({
          title: body.title,
          description: body.description,
          video_url: body.video_url,
          tool_name: body.tool_name,
          content: '',
          category: 'tutorial',
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save tutorial' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await request.json();
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from('tutorials')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete tutorial' },
      { status: 500 }
    );
  }
}
