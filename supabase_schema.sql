-- 📋 TonTap — Supabase Schema

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users table (extends auth.users)
CREATE TABLE public.users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  phone           TEXT UNIQUE NOT NULL,
  ton_wallet      TEXT UNIQUE NOT NULL,
  country         TEXT NOT NULL,
  total_points    INTEGER DEFAULT 0,
  role            TEXT DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  status          TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'BANNED', 'SUSPENDED')),
  is_flagged      BOOLEAN DEFAULT FALSE,
  registration_ip TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tasks table
CREATE TABLE public.tasks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title             TEXT NOT NULL,
  url               TEXT NOT NULL,
  exposure_seconds  INTEGER DEFAULT 30,
  points_reward     INTEGER NOT NULL,
  is_active         BOOLEAN DEFAULT TRUE,
  sort_order        INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Task Sessions table
CREATE TABLE public.task_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id       UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  status        TEXT DEFAULT 'IN_PROGRESS'
                  CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'FAILED')),
  ip_address    TEXT,
  user_agent    TEXT,
  captcha_valid BOOLEAN DEFAULT FALSE,
  session_date  DATE DEFAULT CURRENT_DATE,
  UNIQUE (user_id, task_id, session_date)
);

-- 4. Point Transactions table
CREATE TABLE public.point_transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('EARN', 'WITHDRAW', 'BONUS', 'PENALTY')),
  amount          INTEGER NOT NULL,
  balance_after   INTEGER NOT NULL,
  reference_id    UUID,  -- task_session_id o withdrawal_request_id
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Withdrawal Requests table
CREATE TABLE public.withdrawal_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  points_amount   INTEGER NOT NULL,
  ton_amount      NUMERIC(18, 9) NOT NULL,
  ton_rate        NUMERIC(18, 9) NOT NULL,
  ton_wallet      TEXT NOT NULL,
  status          TEXT DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'APPROVED', 'COMPLETED', 'REJECTED')),
  tx_hash         TEXT,
  admin_notes     TEXT,
  requested_at    TIMESTAMPTZ DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
);

-- 6. System Configuration table
CREATE TABLE public.system_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Initial Config Data
INSERT INTO public.system_config (key, value, description) VALUES
  ('ton_per_point',          '0.00001',   'Equivalencia TON por punto'),
  ('min_withdrawal_points',  '10000',     'Mínimo de puntos para retirar'),
  ('daily_task_limit',       '15',        'Máximo de tareas por día por usuario'),
  ('maintenance_mode',       'false',     'Modo mantenimiento activo'),
  ('recaptcha_enabled',      'true',      'reCAPTCHA obligatorio'),
  ('global_banner_message',  '',          'Mensaje de aviso global (vacío = oculto)');

-- 7. Fraud Flags table
CREATE TABLE public.fraud_flags (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  details     JSONB,
  resolved    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 8. IP Registry table
CREATE TABLE public.ip_registry (
  ip_address  TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  seen_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (ip_address, user_id)
);

-- RLS POLICIES
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

ALTER TABLE public.task_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own sessions" ON public.task_sessions FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view tasks" ON public.tasks FOR SELECT USING (true);

ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own point transactions" ON public.point_transactions FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own withdrawal requests" ON public.withdrawal_requests FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view system configurations" ON public.system_config FOR SELECT USING (true);

ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;
-- Restricted to Admin only (access via service role key)

ALTER TABLE public.ip_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own IP registry" ON public.ip_registry FOR SELECT USING (auth.uid() = user_id);

-- Trigger to restrict client-side modification of sensitive fields in public.users
CREATE OR REPLACE FUNCTION public.check_user_columns_restrictions()
RETURNS TRIGGER AS $$
BEGIN
  -- Restrict client-side updates/inserts (auth.uid() is not null)
  IF auth.uid() IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      -- Enforce default values for sensitive fields on client-side insert
      NEW.role := 'USER';
      NEW.total_points := 0;
      NEW.is_flagged := FALSE;
      NEW.status := 'ACTIVE';
    ELSIF TG_OP = 'UPDATE' THEN
      -- Block updating sensitive fields on client-side update
      IF NEW.role IS DISTINCT FROM OLD.role OR
         NEW.total_points IS DISTINCT FROM OLD.total_points OR
         NEW.status IS DISTINCT FROM OLD.status OR
         NEW.is_flagged IS DISTINCT FROM OLD.is_flagged OR
         NEW.registration_ip IS DISTINCT FROM OLD.registration_ip OR
         NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'You are not allowed to modify restricted fields (role, points, status, etc.)';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_check_user_columns_restrictions
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.check_user_columns_restrictions();


-- 9. Atomic Task Completion Function
CREATE OR REPLACE FUNCTION public.complete_task_secure(
  p_user_id UUID,
  p_task_id UUID,
  p_session_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_session RECORD;
  v_task RECORD;
  v_user RECORD;
  v_points_reward INTEGER;
  v_new_total_points INTEGER;
  v_elapsed_seconds INTEGER;
  v_required_seconds INTEGER;
BEGIN
  -- 1. Get and lock the session to prevent race conditions / double completion
  SELECT * INTO v_session
  FROM public.task_sessions
  WHERE id = p_session_id AND user_id = p_user_id AND task_id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Session not found');
  END IF;

  IF v_session.status = 'COMPLETED' THEN
    RETURN jsonb_build_object('error', 'Task already completed');
  END IF;

  -- 2. Get task details
  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Task not found');
  END IF;

  -- 3. Verify exposure time (with 2-second grace period)
  v_elapsed_seconds := EXTRACT(EPOCH FROM (NOW() - v_session.started_at));
  v_required_seconds := COALESCE(v_task.exposure_seconds, 30);

  IF v_elapsed_seconds < (v_required_seconds - 2) THEN
    RETURN jsonb_build_object('error', 'Exposure time not met');
  END IF;

  -- 4. Get and lock user profile
  SELECT * INTO v_user
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  v_points_reward := COALESCE(v_task.points_reward, 0);
  v_new_total_points := v_user.total_points + v_points_reward;

  -- 5. Update user's points (bypass client restrictions trigger since this runs as SECURITY DEFINER owner)
  UPDATE public.users
  SET total_points = v_new_total_points,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- 6. Mark session as completed
  UPDATE public.task_sessions
  SET status = 'COMPLETED',
      completed_at = NOW(),
      captcha_valid = TRUE
  WHERE id = p_session_id;

  -- 7. Create point transaction record
  INSERT INTO public.point_transactions (
    user_id,
    type,
    amount,
    balance_after,
    reference_id,
    description,
    created_at
  ) VALUES (
    p_user_id,
    'EARN',
    v_points_reward,
    v_new_total_points,
    p_session_id,
    'Completed task: ' || p_task_id::text,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'newTotalPoints', v_new_total_points
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

