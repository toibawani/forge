-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users profile table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  skills TEXT[] DEFAULT '{}',
  role TEXT DEFAULT 'practitioner' CHECK (role IN ('practitioner', 'recruiter', 'admin')),
  company_name TEXT,
  is_verified BOOLEAN DEFAULT false,
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('public', 'private', 'recruiters_only')),
  allow_recruiter_contact BOOLEAN DEFAULT true,
  profile_views_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Challenges table
CREATE TABLE public.challenges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  category TEXT NOT NULL,
  content JSONB NOT NULL,
  expected_output JSONB,
  time_limit_seconds INTEGER,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  is_active BOOLEAN DEFAULT true
);

-- Challenge attempts table
CREATE TABLE public.challenge_attempts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE NOT NULL,
  submission JSONB NOT NULL,
  score INTEGER CHECK (score >= 0 AND score <= 100),
  time_spent_seconds INTEGER NOT NULL,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'abandoned')),
  ip_address TEXT,
  user_agent TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Streaks table
CREATE TABLE public.streaks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_practice_date DATE,
  total_practice_days INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Recruiter pipeline table
CREATE TABLE public.recruiter_pipelines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recruiter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Pipeline candidates table
CREATE TABLE public.pipeline_candidates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pipeline_id UUID REFERENCES public.recruiter_pipelines(id) ON DELETE CASCADE NOT NULL,
  candidate_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  stage TEXT DEFAULT 'new' CHECK (stage IN ('new', 'contacted', 'screening', 'interview', 'offer', 'rejected', 'hired')),
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(pipeline_id, candidate_id)
);

-- Audit log table
CREATE TABLE public.audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Profile views table
CREATE TABLE public.profile_views (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  viewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(viewer_id, profile_id, viewed_at)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiter_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can view public profiles"
  ON public.profiles FOR SELECT
  USING (visibility = 'public');

CREATE POLICY "Recruiters can view recruiter_only profiles"
  ON public.profiles FOR SELECT
  USING (
    visibility = 'recruiters_only' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'recruiter'
    )
  );

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Challenge attempts RLS policies
CREATE POLICY "Users can view their own attempts"
  ON public.challenge_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own attempts"
  ON public.challenge_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attempts"
  ON public.challenge_attempts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Streaks RLS policies
CREATE POLICY "Users can view their own streak"
  ON public.streaks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own streak"
  ON public.streaks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own streak"
  ON public.streaks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Recruiter pipelines RLS policies
CREATE POLICY "Recruiters can view their own pipelines"
  ON public.recruiter_pipelines FOR SELECT
  USING (auth.uid() = recruiter_id);

CREATE POLICY "Recruiters can insert their own pipelines"
  ON public.recruiter_pipelines FOR INSERT
  WITH CHECK (auth.uid() = recruiter_id);

CREATE POLICY "Recruiters can update their own pipelines"
  ON public.recruiter_pipelines FOR UPDATE
  USING (auth.uid() = recruiter_id)
  WITH CHECK (auth.uid() = recruiter_id);

CREATE POLICY "Recruiters can delete their own pipelines"
  ON public.recruiter_pipelines FOR DELETE
  USING (auth.uid() = recruiter_id);

-- Pipeline candidates RLS policies
CREATE POLICY "Recruiters can view their pipeline candidates"
  ON public.pipeline_candidates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.recruiter_pipelines
      WHERE id = pipeline_id AND recruiter_id = auth.uid()
    )
  );

CREATE POLICY "Recruiters can insert pipeline candidates"
  ON public.pipeline_candidates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recruiter_pipelines
      WHERE id = pipeline_id AND recruiter_id = auth.uid()
    )
  );

CREATE POLICY "Recruiters can update pipeline candidates"
  ON public.pipeline_candidates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.recruiter_pipelines
      WHERE id = pipeline_id AND recruiter_id = auth.uid()
    )
  );

CREATE POLICY "Recruiters can delete pipeline candidates"
  ON public.pipeline_candidates FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.recruiter_pipelines
      WHERE id = pipeline_id AND recruiter_id = auth.uid()
    )
  );

-- Audit logs RLS policies
CREATE POLICY "Admins can view all audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can view their own audit logs"
  ON public.audit_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Profile views RLS policies
CREATE POLICY "Users can view views of their own profile"
  ON public.profile_views FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert their own profile views"
  ON public.profile_views FOR INSERT
  WITH CHECK (auth.uid() = viewer_id);

-- Challenges table (no RLS needed - public read-only)
CREATE POLICY "Anyone can view active challenges"
  ON public.challenges FOR SELECT
  USING (is_active = true);

-- Create indexes for performance
CREATE INDEX idx_profiles_visibility ON public.profiles(visibility);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_skills ON public.profiles USING GIN(skills);
CREATE INDEX idx_attempts_user_id ON public.challenge_attempts(user_id);
CREATE INDEX idx_attempts_challenge_id ON public.challenge_attempts(challenge_id);
CREATE INDEX idx_attempts_created_at ON public.challenge_attempts(created_at DESC);
CREATE INDEX idx_attempts_idempotency ON public.challenge_attempts(idempotency_key);
CREATE INDEX idx_challenges_difficulty ON public.challenges(difficulty);
CREATE INDEX idx_challenges_category ON public.challenges(category);
CREATE INDEX idx_streaks_user_id ON public.streaks(user_id);
CREATE INDEX idx_pipelines_recruiter_id ON public.recruiter_pipelines(recruiter_id);
CREATE INDEX idx_pipeline_candidates_pipeline_id ON public.pipeline_candidates(pipeline_id);
CREATE INDEX idx_pipeline_candidates_candidate_id ON public.pipeline_candidates(candidate_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_profile_views_profile_id ON public.profile_views(profile_id);
CREATE INDEX idx_profile_views_viewed_at ON public.profile_views(viewed_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_challenges_updated_at
  BEFORE UPDATE ON public.challenges
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_streaks_updated_at
  BEFORE UPDATE ON public.streaks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pipelines_updated_at
  BEFORE UPDATE ON public.recruiter_pipelines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pipeline_candidates_updated_at
  BEFORE UPDATE ON public.pipeline_candidates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, split_part(NEW.email, '@', 1));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to log profile views
CREATE OR REPLACE FUNCTION public.log_profile_view()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profile_views (viewer_id, profile_id, viewed_at)
  VALUES (NEW.viewer_id, NEW.profile_id, NEW.viewed_at)
  ON CONFLICT (viewer_id, profile_id, viewed_at) DO NOTHING;
  
  UPDATE public.profiles
  SET profile_views_count = profile_views_count + 1
  WHERE id = NEW.profile_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
