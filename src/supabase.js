const SUPABASE_URL  = document.querySelector('meta[name="supabase-url"]')?.content  || 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON = document.querySelector('meta[name="supabase-anon"]')?.content || 'YOUR_ANON_KEY';

let _supabasePromise = null;

async function getSupabase() {
  if (!_supabasePromise) {
    _supabasePromise = (async () => {
      let sbUrl  = document.querySelector('meta[name="supabase-url"]')?.content;
      let sbAnon = document.querySelector('meta[name="supabase-anon"]')?.content;

if (!sbUrl || sbUrl.includes('YOUR_PROJECT') || !sbAnon || sbAnon.includes('YOUR_ANON_KEY')) {
        try {
          const res = await fetch('/api/config');
          const data = await res.json();
          if (data.supabaseUrl) sbUrl = data.supabaseUrl;
          if (data.supabaseAnon) sbAnon = data.supabaseAnon;
        } catch (e) {
          console.error('[Supabase] Failed to fetch config via API', e);
        }
      }

      sbUrl  = sbUrl  || 'https://YOUR_PROJECT.supabase.co';
      sbAnon = sbAnon || 'YOUR_ANON_KEY';

      const sb = supabase.createClient(sbUrl, sbAnon, {
        auth: {
          persistSession: true,       
          autoRefreshToken: true,     
          detectSessionInUrl: true,   
          storageKey: 'avishu-supabase-auth',  
        }
      });

sb.auth.onAuthStateChange((event, session) => {
        console.log('[Supabase Auth]', event, session?.user?.email);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session) {
            localStorage.setItem('avishu_token', session.access_token);
            localStorage.setItem('avishu_refresh_token', session.refresh_token);

            const role = session.user.user_metadata?.role || localStorage.getItem('avishu_role') || 'client';
            localStorage.setItem('avishu_role', role);
            localStorage.setItem('avishu_user', JSON.stringify({
              id: session.user.id,
              email: session.user.email,
              role: role,
              display_name: session.user.user_metadata?.display_name || session.user.email.split('@')[0],
            }));
          }
        }

        if (event === 'SIGNED_OUT') {
          localStorage.removeItem('avishu_token');
          localStorage.removeItem('avishu_refresh_token');
          localStorage.removeItem('avishu_role');
          localStorage.removeItem('avishu_user');
        }
      });

      return sb;
    })();
  }
  return _supabasePromise;
}

async function restoreSession() {
  const sb = await getSupabase();

const { data: { session: existingSession } } = await sb.auth.getSession();
  if (existingSession) {
    
    localStorage.setItem('avishu_token', existingSession.access_token);
    localStorage.setItem('avishu_refresh_token', existingSession.refresh_token);
    return existingSession;
  }

const accessToken  = localStorage.getItem('avishu_token');
  const refreshToken = localStorage.getItem('avishu_refresh_token');

  if (accessToken && refreshToken && accessToken !== 'demo_token') {
    try {
      const { data, error } = await sb.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        console.warn('[Supabase] Session restore failed:', error.message);
        
        clearAuthData();
        return null;
      }

      return data.session;
    } catch (err) {
      console.error('[Supabase] Session restore exception:', err);
      clearAuthData();
      return null;
    }
  }

  return null;
}

async function setSessionFromTokens(accessToken, refreshToken) {
  if (!accessToken || !refreshToken) return null;

  const sb = await getSupabase();
  try {
    const { data, error } = await sb.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      console.warn('[Supabase] setSession error:', error.message);
      return null;
    }

return data.session;
  } catch (err) {
    console.error('[Supabase] setSession exception:', err);
    return null;
  }
}

function clearAuthData() {
  localStorage.removeItem('avishu_token');
  localStorage.removeItem('avishu_refresh_token');
  localStorage.removeItem('avishu_role');
  localStorage.removeItem('avishu_user');
}

async function authRegister(email, password, role = 'client', displayName = '') {
  const sb = await getSupabase();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: role,
        display_name: displayName || email.split('@')[0],
        registration_method: 'email',
      }
    }
  });

  if (!error && data.session) {
    
    localStorage.setItem('avishu_role', role);  
  }

  return { user: data?.user, session: data?.session, error };
}

async function authLogin(email, password) {
  const sb = await getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (!error && data.session) {
    
    const role = data.user.user_metadata?.role || 'client';
    localStorage.setItem('avishu_role', role);

sb.rpc('update_last_login', { user_id: data.user.id }).catch(() => {});
  }

  return { user: data?.user, session: data?.session, error };
}

async function authLogout() {
  try {
    const sb = await getSupabase();
    await sb.auth.signOut();
  } catch (error) {
    console.warn('[Supabase] authLogout Error:', error);
  } finally {
    clearAuthData();
    window.location.href = 'registration.html';
  }
}

async function authGetSession() {
  const sb = await getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('avishu_user'));
  } catch {
    return null;
  }
}

function getCurrentRole() {
  return localStorage.getItem('avishu_role') || 'client';
}

function isLoggedIn() {
  return !!localStorage.getItem('avishu_token');
}

function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = 'registration.html';
    return false;
  }
  return true;
}

function demoLoginAs(role) {
  localStorage.setItem('avishu_token', 'demo_token');
  localStorage.setItem('avishu_refresh_token', '');
  localStorage.setItem('avishu_role', role);
  localStorage.setItem('avishu_user', JSON.stringify({
    id: 'demo-user',
    email: 'demo@avishu.kz',
    role: role,
    display_name: 'Демо-пользователь',
  }));
  window.location.href = role === 'client' ? 'demo.html' : 'dashboards.html';
}

(function autoRestore() {
  const token = localStorage.getItem('avishu_token');
  if (token && token !== 'demo_token') {
    restoreSession().then(session => {
      if (!session) {
        console.warn('[Supabase] No valid session found — redirecting if on protected page.');
        
      }
    });
  }
})();
