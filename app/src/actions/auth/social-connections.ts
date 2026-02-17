'use server';

import { createClient } from '@/app/supabase/server';

export interface SocialConnectionStatus {
  linkedin: { connected: boolean; username: string | null };
}

export async function getSocialConnections(): Promise<{
  success: boolean;
  connections: SocialConnectionStatus;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        connections: {
          linkedin: { connected: false, username: null },
        },
      };
    }

    const { data: rows } = await supabase
      .from('social_platform_connections')
      .select('platform, connection_status, username')
      .eq('user_id', user.id)
      .in('platform', ['linkedin']);

    const connections: SocialConnectionStatus = {
      linkedin: { connected: false, username: null },
    };

    for (const row of rows || []) {
      const p = row.platform as keyof SocialConnectionStatus;
      if (connections[p]) {
        connections[p] = { connected: row.connection_status === 'active', username: row.username };
      }
    }

    return { success: true, connections };
  } catch (error) {
    console.error('Failed to load social connections:', error);
    return {
      success: false,
      connections: {
        linkedin: { connected: false, username: null },
      },
    };
  }
}
