-- Add media_url column to twitter_tweets for storing image URLs and video thumbnails
ALTER TABLE twitter_tweets ADD COLUMN media_url TEXT DEFAULT NULL;
