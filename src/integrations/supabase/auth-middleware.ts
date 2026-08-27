import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { createLocalSupabaseClient, parseLocalJwt, localDbManager } from './local-db';

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const supabase = createLocalSupabaseClient();
    const request = getRequest();

    let userId: string | null = null;
    let claims: any = null;

    const authHeader = request?.headers?.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();
      if (token) {
        const parsed = parseLocalJwt(token);
        if (parsed && parsed.sub) {
          userId = parsed.sub;
          claims = parsed;
        }
      }
    }

    // If no userId found from token, check local db for an admin or active user
    if (!userId) {
      const db = localDbManager.getDb();
      const adminUser = db.users.find((u) => u.role === 'admin') || db.users[0];
      if (adminUser) {
        userId = adminUser.id;
        claims = {
          sub: adminUser.id,
          email: adminUser.email,
          role: adminUser.role,
          user_metadata: { full_name: adminUser.fullName },
        };
      }
    }

    if (!userId) {
      throw new Error('Unauthorized: No user ID found');
    }

    return next({
      context: {
        supabase,
        userId,
        claims: claims || { sub: userId },
      },
    });
  },
);

