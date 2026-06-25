-- Create ApiMetrics table
CREATE TABLE IF NOT EXISTS public."ApiMetrics" (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    route TEXT NOT NULL,
    method TEXT NOT NULL,
    status INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    provider TEXT,
    cache TEXT
);

-- Enable RLS
ALTER TABLE public."ApiMetrics" ENABLE ROW LEVEL SECURITY;

-- Only service role can insert/read
CREATE POLICY "Service Role Full Access ApiMetrics" ON public."ApiMetrics"
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
