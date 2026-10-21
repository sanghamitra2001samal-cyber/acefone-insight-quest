-- Create storage bucket for call recordings
INSERT INTO storage.buckets (id, name, public) VALUES ('call-recordings', 'call-recordings', false);

-- Allow authenticated users to upload recordings
CREATE POLICY "Authenticated users can upload recordings"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'call-recordings' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to view recordings
CREATE POLICY "Authenticated users can view recordings"
ON storage.objects FOR SELECT
USING (bucket_id = 'call-recordings' AND auth.uid() IS NOT NULL);

-- Allow agents to update their own interactions (for ending calls, adding disposition)
CREATE POLICY "Agents can update own interactions"
ON public.interactions FOR UPDATE
USING (auth.uid() = agent_id);
