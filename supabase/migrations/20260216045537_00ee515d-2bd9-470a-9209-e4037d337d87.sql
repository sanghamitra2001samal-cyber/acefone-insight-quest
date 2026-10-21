
-- Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'supervisor', 'agent');

-- Agent status enum
CREATE TYPE public.agent_status AS ENUM ('ready', 'busy', 'wrap_up', 'break', 'offline');

-- Ticket status enum
CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'escalated', 'resolved', 'closed');

-- Disposition enum
CREATE TYPE public.disposition_type AS ENUM (
  'complaint_registered', 'information_provided', 'billing_clarification',
  'escalated_to_field', 'duplicate_complaint', 'call_dropped', 'wrong_number', 'no_response'
);

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  department TEXT,
  phone TEXT,
  status agent_status NOT NULL DEFAULT 'offline',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table (separate from profiles per security guidelines)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Consumers table
CREATE TABLE public.consumers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  billing_status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.consumers ENABLE ROW LEVEL SECURITY;

-- Disposition categories (configurable by admin)
CREATE TABLE public.disposition_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.disposition_categories ENABLE ROW LEVEL SECURITY;

-- Tickets table
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  consumer_id UUID REFERENCES public.consumers(id),
  agent_id UUID REFERENCES auth.users(id),
  category_id UUID REFERENCES public.disposition_categories(id),
  status ticket_status NOT NULL DEFAULT 'open',
  disposition disposition_type,
  remarks TEXT,
  priority TEXT DEFAULT 'medium',
  assigned_department TEXT,
  sla_deadline TIMESTAMPTZ,
  call_recording_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Ticket updates (audit trail)
CREATE TABLE public.ticket_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  old_status ticket_status,
  new_status ticket_status,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_updates ENABLE ROW LEVEL SECURITY;

-- Interactions / call logs
CREATE TABLE public.interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID REFERENCES public.consumers(id),
  ticket_id UUID REFERENCES public.tickets(id),
  agent_id UUID REFERENCES auth.users(id) NOT NULL,
  type TEXT NOT NULL DEFAULT 'call',
  direction TEXT NOT NULL DEFAULT 'inbound',
  duration_seconds INTEGER DEFAULT 0,
  disposition disposition_type,
  remarks TEXT,
  call_recording_ref TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

-- SLA configuration
CREATE TABLE public.sla_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL UNIQUE,
  threshold_value NUMERIC NOT NULL,
  threshold_unit TEXT NOT NULL DEFAULT 'seconds',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sla_config ENABLE ROW LEVEL SECURITY;

-- Audit logs (append-only)
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Queues
CREATE TABLE public.queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;

-- ===== RLS POLICIES =====

-- Profiles: users can read all profiles, update own
CREATE POLICY "Anyone authenticated can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- User roles: admins can manage, users can read own
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Consumers: all authenticated can read, agents+ can insert/update
CREATE POLICY "Authenticated can view consumers" ON public.consumers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert consumers" ON public.consumers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update consumers" ON public.consumers FOR UPDATE TO authenticated USING (true);

-- Disposition categories: all read, admin manage
CREATE POLICY "Authenticated can view categories" ON public.disposition_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage categories" ON public.disposition_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Tickets: all authenticated can read, agents can insert, agents+supervisors can update
CREATE POLICY "Authenticated can view tickets" ON public.tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert tickets" ON public.tickets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update tickets" ON public.tickets FOR UPDATE TO authenticated USING (true);

-- Ticket updates: all read, authenticated insert
CREATE POLICY "Authenticated can view ticket updates" ON public.ticket_updates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert ticket updates" ON public.ticket_updates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Interactions: all read, agents insert
CREATE POLICY "Authenticated can view interactions" ON public.interactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Agents can insert interactions" ON public.interactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = agent_id);

-- SLA config: all read, admin manage
CREATE POLICY "Authenticated can view sla config" ON public.sla_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage sla config" ON public.sla_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Audit logs: admin only read, system insert
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Queues: all read, admin manage
CREATE POLICY "Authenticated can view queues" ON public.queues FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage queues" ON public.queues FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== TRIGGERS =====

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_consumers_updated_at BEFORE UPDATE ON public.consumers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-generate ticket number
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ticket_number = 'TKT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 99999)::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_ticket_number
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.generate_ticket_number();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;

-- Seed default SLA config
INSERT INTO public.sla_config (metric_name, threshold_value, threshold_unit, description) VALUES
  ('average_handling_time', 300, 'seconds', 'Target AHT of 5 minutes'),
  ('service_level', 80, 'percent', '80% calls answered within 20 seconds'),
  ('abandonment_rate', 5, 'percent', 'Max 5% call abandonment'),
  ('ticket_resolution_time', 86400, 'seconds', '24-hour ticket resolution target');

-- Seed default disposition categories
INSERT INTO public.disposition_categories (name, description) VALUES
  ('Billing Issue', 'Billing related complaints and queries'),
  ('Power Outage', 'Power supply interruption complaints'),
  ('New Connection', 'New connection requests'),
  ('Meter Issue', 'Meter reading or meter fault complaints'),
  ('Voltage Problem', 'Low/high voltage complaints'),
  ('General Enquiry', 'General information requests'),
  ('Payment Issue', 'Payment related queries'),
  ('Other', 'Other complaints not covered above');
