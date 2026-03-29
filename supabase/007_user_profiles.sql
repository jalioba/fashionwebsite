-- ============================================================
-- AVISHU CRM — 007_user_profiles.sql
-- Таблица пользователей: профили, роли, способ регистрации
-- Привязана к auth.users (Supabase Auth)
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1. USER_PROFILES — Профили пользователей
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT NOT NULL,
  display_name        TEXT,
  phone               TEXT,
  role                TEXT NOT NULL DEFAULT 'client'
                        CHECK (role IN ('client', 'franchisee', 'admin')),
  registration_method TEXT NOT NULL DEFAULT 'email'
                        CHECK (registration_method IN ('email', 'google', 'demo', 'github')),
  franchisee_id       UUID REFERENCES franchisees(id) ON DELETE SET NULL,
  avatar_url          TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  last_login_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role   ON user_profiles (role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email  ON user_profiles (email);

-- ══════════════════════════════════════════════════════════════
-- 2. ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики (если есть)
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Service role full access" ON user_profiles;

-- Пользователь видит только свой профиль
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Пользователь может обновить только свой профиль
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Вставка: только через триггер (service_role) или при auth.uid() = id
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Полный доступ для service_role (серверные операции)
CREATE POLICY "Service role full access" ON user_profiles
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════
-- 3. TRIGGER — Автосоздание профиля при регистрации
-- ══════════════════════════════════════════════════════════════

-- Функция триггера
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name, role, registration_method)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    COALESCE(NEW.raw_user_meta_data->>'registration_method', 
      CASE 
        WHEN NEW.raw_app_meta_data->>'provider' = 'google' THEN 'google'
        WHEN NEW.raw_app_meta_data->>'provider' = 'github' THEN 'github'
        ELSE 'email'
      END
    )
  );
  RETURN NEW;
END;
$$;

-- Создаём триггер на auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ══════════════════════════════════════════════════════════════
-- 4. ФУНКЦИЯ — Обновление last_login_at
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_last_login(user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_profiles
  SET last_login_at = now()
  WHERE id = user_id;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 5. ФУНКЦИЯ — Получить профиль текущего пользователя
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS TABLE (
  user_id             UUID,
  email               TEXT,
  display_name        TEXT,
  phone               TEXT,
  role                TEXT,
  registration_method TEXT,
  franchisee_id       UUID,
  avatar_url          TEXT,
  created_at          TIMESTAMPTZ,
  last_login_at       TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT
      p.id,
      p.email,
      p.display_name,
      p.phone,
      p.role,
      p.registration_method,
      p.franchisee_id,
      p.avatar_url,
      p.created_at,
      p.last_login_at
    FROM user_profiles p
    WHERE p.id = auth.uid();
END;
$$;
