
-- Tighten consumers: only agents/supervisors/admins can insert/update (all roles can, but must be authenticated with a role)
DROP POLICY "Authenticated can insert consumers" ON public.consumers;
DROP POLICY "Authenticated can update consumers" ON public.consumers;
CREATE POLICY "Role holders can insert consumers" ON public.consumers FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'agent'));
CREATE POLICY "Role holders can update consumers" ON public.consumers FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'agent'));

-- Tighten tickets insert/update
DROP POLICY "Authenticated can insert tickets" ON public.tickets;
DROP POLICY "Authenticated can update tickets" ON public.tickets;
CREATE POLICY "Role holders can insert tickets" ON public.tickets FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'agent'));
CREATE POLICY "Role holders can update tickets" ON public.tickets FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'agent'));

-- Tighten audit logs insert to role holders
DROP POLICY "Authenticated can insert audit logs" ON public.audit_logs;
CREATE POLICY "Role holders can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'agent'));
