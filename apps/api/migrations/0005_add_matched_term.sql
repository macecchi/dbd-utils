-- Add matched_term column to store the exact term that was identified in the message
ALTER TABLE requests ADD COLUMN matched_term TEXT;
