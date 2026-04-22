-- Add starred column to chats table
ALTER TABLE public.chats
ADD COLUMN IF NOT EXISTS starred BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for faster starred-chat lookups per user
CREATE INDEX IF NOT EXISTS chats_user_id_starred_updated_at_idx
ON public.chats(user_id, starred, updated_at DESC)
WHERE starred = TRUE;
