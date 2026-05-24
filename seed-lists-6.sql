-- RankEverything — Community list seed batch 6: juicy & social
-- Paste into Supabase → SQL Editor → Run

insert into public.lists (id, name, items, owner_id, owner_name, is_public, created_at) values

-- ── Rank the people in your life ─────────────────────────────────────────
-- These are TEMPLATES. The fun is swapping each role onto a real person.
-- Couples play by entering the same list and comparing who they picked.

('lst_community_51', 'Rank your kids (you know you have a favorite)', ARRAY[
  'The one most like you',
  'The one who calls home the most',
  'The one who needs the most help',
  'The golden child',
  'The chaos agent',
  'The funny one',
  'The one who costs the most',
  'The one you worry about',
  'The one who got away with everything',
  'The one who''ll take care of you when you''re old'
], null, 'Community', true, now() - interval '1 days'),

('lst_community_52', 'Rank your siblings', ARRAY[
  'The responsible one',
  'The favorite (officially denied)',
  'The one who got away with everything growing up',
  'The drama magnet',
  'The one who calls mom the most',
  'The one most likely to lend you money',
  'The one you''d call in a real crisis',
  'The one who turned out most differently than expected',
  'The funniest one',
  'The overachiever'
], null, 'Community', true, now() - interval '2 days'),

('lst_community_53', 'Rank your coworkers (be honest)', ARRAY[
  'The one who actually does the work',
  'The one who takes credit for others'' work',
  'The one who makes every meeting longer',
  'The gossip hub',
  'The one you''d want on your team in a crisis',
  'The teacher''s pet',
  'The one who''s somehow always fine',
  'The one you''d take to a desert island',
  'The one who should have been fired years ago',
  'The one everyone secretly likes'
], null, 'Community', true, now() - interval '3 days'),

('lst_community_54', 'Rank your in-laws', ARRAY[
  'The one you actually like',
  'The one who asks too many questions',
  'The one who pretends to like you',
  'The funny one',
  'The one who takes your partner''s side every time',
  'The one you can vent to',
  'The one who''d be your friend if you met randomly',
  'The most dramatic one',
  'The one who gives the best gifts',
  'The one most likely to start something at Christmas'
], null, 'Community', true, now() - interval '4 days'),

-- ── Confessions & guilty pleasures ───────────────────────────────────────

('lst_community_55', 'Things you''ve done but won''t admit IRL', ARRAY[
  'Pretended not to see a text and then "just saw it"',
  'Fully stalked an ex''s new partner',
  'Laughed at something you absolutely should not have',
  'Liked someone from years back while snooping their profile',
  'Blamed someone else for something that was your fault',
  'Secretly hoped an ex had a rough glow-up',
  'Been the toxic one in a relationship',
  'Said you were "almost there" while still at home',
  'Used "I''m busy" when you just didn''t want to go',
  'Read someone''s message, had thoughts, and said nothing'
], null, 'Community', true, now() - interval '5 days'),

('lst_community_56', 'Things people lie about', ARRAY[
  'How much they make',
  'How many people they''ve been with',
  'How much they drink',
  'How okay they are',
  'How long it takes them to get ready',
  'Whether they''ve actually read the book',
  'How much they exercise',
  'How much they like their job',
  'How much they care about what people think',
  'Whether they''ve seen the movie'
], null, 'Community', true, now() - interval '6 days'),

('lst_community_57', 'Things you secretly judge people for', ARRAY[
  'Leaving dishes in the sink',
  'Being rude to waitstaff',
  'Talking loudly on the phone in public',
  'Not reading before forming strong opinions',
  'Letting their dog up on restaurant chairs',
  'Being on their phone during dinner',
  'Not tipping well',
  'Wearing sunglasses indoors',
  'Name-dropping constantly',
  'Having a dirty car interior'
], null, 'Community', true, now() - interval '7 days'),

-- ── Relationships ─────────────────────────────────────────────────────────

('lst_community_58', 'Red flags you''ve personally ignored', ARRAY[
  'They were rude to the waiter',
  'They talked about their ex the entire first date',
  'They had no close friends',
  'They were weirdly secretive about their phone',
  'Their family clearly didn''t like them',
  'They love-bombed you immediately',
  'Their last three exes were "crazy"',
  'They couldn''t take any criticism',
  'They never apologized for anything',
  'You just had a bad feeling'
], null, 'Community', true, now() - interval '8 days'),

('lst_community_59', 'Most attractive qualities (be honest)', ARRAY[
  'Confidence without arrogance',
  'Makes you laugh',
  'Actually listens',
  'Smells good',
  'Has their life together',
  'Physically fit',
  'Ambitious',
  'Kind to strangers',
  'Has a great smile',
  'Doesn''t need to be the center of attention'
], null, 'Community', true, now() - interval '9 days'),

('lst_community_60', 'Dealbreakers in a relationship', ARRAY[
  'Different views on having kids',
  'Won''t go to therapy',
  'Doesn''t get along with your friends',
  'No ambition',
  'Bad with money',
  'Jealous or controlling',
  'Bad in bed and refuses to talk about it',
  'Smokes',
  'Hates your pet',
  'Completely different life goals'
], null, 'Community', true, now() - interval '10 days'),

-- ── Self-knowledge (the uncomfortable kind) ───────────────────────────────

('lst_community_61', 'Times you were the villain in the story', ARRAY[
  'A friendship that ended because of you',
  'A lie you told that you never came clean about',
  'Something you said that you knew would hurt',
  'A time you took credit you didn''t earn',
  'A relationship you stayed in too long and hurt them more',
  'A time you were jealous instead of happy for someone',
  'Something you did when no one was watching',
  'A time you should have spoken up and didn''t',
  'Something you blamed on circumstances that was actually you',
  'A bridge you burned that maybe you shouldn''t have'
], null, 'Community', true, now() - interval '11 days'),

('lst_community_62', 'Guilty pleasures — rank yours', ARRAY[
  'Reality TV you watch alone',
  'Fast food after saying you''re eating healthy',
  'Rewatching the same comfort show instead of anything new',
  'Reading celebrity gossip',
  'Singing full concert in the car alone',
  'Doom-scrolling for an hour before getting up',
  'Buying something you don''t need that was on sale',
  'Sleeping in way too late on a weekend',
  'Drunk-texting people you shouldn''t',
  'Staying up until 2am doing nothing important'
], null, 'Community', true, now() - interval '12 days'),

-- ── Hot takes ─────────────────────────────────────────────────────────────

('lst_community_63', 'Hot takes that might lose you friends', ARRAY[
  'Pineapple on pizza is fine actually',
  'Die Hard is not a Christmas movie',
  'The office is overrated',
  'People who say they don''t watch TV are annoying',
  'Brunch is a scam',
  'Most people aren''t good drivers',
  'Astrology is just therapy for people who won''t go to therapy',
  'Open offices are a terrible idea',
  'Networking events are mostly a waste of time',
  'Most weddings are for the parents not the couple'
], null, 'Community', true, now() - interval '13 days')

on conflict (id) do nothing;
