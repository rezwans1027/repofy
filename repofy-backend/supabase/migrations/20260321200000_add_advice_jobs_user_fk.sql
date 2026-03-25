-- Add missing FK on advice_jobs.user_id so rows are cleaned up on user deletion.
-- The original CREATE TABLE migration was fixed too, but this ALTER handles
-- databases where the table already exists.
ALTER TABLE public.advice_jobs
  ADD CONSTRAINT advice_jobs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
