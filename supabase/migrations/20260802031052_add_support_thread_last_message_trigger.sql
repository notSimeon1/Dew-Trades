-- Auto-update last_message_at on support_threads when a new message is inserted
CREATE OR REPLACE FUNCTION update_support_thread_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE support_threads
  SET last_message_at = NEW.created_at
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_thread_last_message_at
  AFTER INSERT ON support_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_support_thread_last_message_at();
