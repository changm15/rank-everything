-- RankEverything — Community list seed batch 5
-- Paste into Supabase → SQL Editor → Run

insert into public.lists (id, name, items, owner_id, owner_name, is_public, created_at) values

-- ── Relationships & social ────────────────────────────────────────────
('lst_community_37', 'Green flags in a partner', ARRAY[
  'Has close friends they''ve kept for years',
  'Communicates openly without prompting',
  'Can laugh at themselves',
  'Apologizes and actually means it',
  'Has hobbies outside of the relationship',
  'Is kind to strangers and service workers',
  'Remembers small things you mention',
  'Gets along with their family',
  'Gives you space without making it weird',
  'Reads books',
  'Good with money',
  'Shows up when it counts'
], null, 'Community', true, now() - interval '1 days'),

('lst_community_38', 'Red flags in a person', ARRAY[
  'Never apologizes',
  'Rude to service workers',
  'Everything is someone else''s fault',
  'Can''t be alone for five minutes',
  'Love bombs then disappears',
  'Talks about their ex constantly',
  'Can''t handle any disagreement',
  'Never asks you questions about yourself',
  'Doesn''t have any long-term friends',
  'Cancels plans last minute, every time',
  'Makes everything a joke to avoid the real conversation',
  'Competitive about literally everything'
], null, 'Community', true, now() - interval '2 days'),

-- ── The friends-ranking lists ─────────────────────────────────────────
-- Rank which archetype each of your friends is — or have your partner
-- rank YOUR friend group using one of these as a template.

('lst_community_39', 'Friend archetypes — rank yours', ARRAY[
  'The one who''s always late',
  'The group chat admin',
  'The therapist friend',
  'The chaotic one',
  'The mom of the group',
  'The planner',
  'The one who keeps it real',
  'The hype person',
  'The one with all the hot takes',
  'The one who disappears for months then reappears like nothing happened',
  'The one who knows everyone',
  'The one who''s always traveling'
], null, 'Community', true, now() - interval '3 days'),

('lst_community_40', 'Best things a friend can do', ARRAY[
  'Show up to help you move without being asked',
  'Remember your coffee order',
  'Tell you when you''re wrong',
  'Hype you up before something scary',
  'Check in when you go quiet',
  'Keep your secrets',
  'Make you laugh until you cry',
  'Drop everything when you need them',
  'Remember the details from last time',
  'Introduce you to their other friends',
  'Be honest about your new partner',
  'Celebrate your wins like their own'
], null, 'Community', true, now() - interval '4 days'),

-- ── Dating & romance ──────────────────────────────────────────────────
('lst_community_41', 'First date ideas', ARRAY[
  'Coffee',
  'Cocktail bar',
  'Dinner',
  'Mini golf',
  'Hiking',
  'Museum',
  'Cooking class',
  'Bowling',
  'Live music',
  'Farmers market',
  'Comedy show',
  'Arcade',
  'Bookstore browse',
  'Picnic'
], null, 'Community', true, now() - interval '5 days'),

-- ── Music ─────────────────────────────────────────────────────────────
('lst_community_42', 'Taylor Swift albums', ARRAY[
  'Taylor Swift (debut)',
  'Fearless',
  'Speak Now',
  'Red',
  '1989',
  'Reputation',
  'Lover',
  'Folklore',
  'Evermore',
  'Midnights',
  'The Tortured Poets Department'
], null, 'Community', true, now() - interval '6 days'),

('lst_community_43', 'Best music decades', ARRAY[
  '1950s',
  '1960s',
  '1970s',
  '1980s',
  '1990s',
  '2000s',
  '2010s',
  '2020s'
], null, 'Community', true, now() - interval '7 days'),

-- ── Food ──────────────────────────────────────────────────────────────
('lst_community_44', 'Best fast food chains', ARRAY[
  'Chick-fil-A',
  'In-N-Out',
  'Chipotle',
  'Five Guys',
  'McDonald''s',
  'Whataburger',
  'Raising Cane''s',
  'Popeyes',
  'Shake Shack',
  'Wingstop',
  'Jersey Mike''s',
  'Taco Bell'
], null, 'Community', true, now() - interval '8 days'),

('lst_community_45', 'Comfort foods', ARRAY[
  'Mac and cheese',
  'Pizza',
  'Ramen',
  'Grilled cheese',
  'Fried chicken',
  'Soup',
  'Tacos',
  'Mashed potatoes',
  'Ice cream',
  'Pasta',
  'Burgers',
  'Fries'
], null, 'Community', true, now() - interval '9 days'),

-- ── Lifestyle ─────────────────────────────────────────────────────────
('lst_community_46', 'Best ways to spend a Sunday', ARRAY[
  'Sleep in until noon',
  'Brunch with friends',
  'Long walk or hike',
  'Binge a show in bed',
  'Cook a big meal',
  'Farmers market',
  'Read a book start to finish',
  'Sports or gym',
  'Explore a new neighborhood',
  'Meal prep for the week',
  'Lie in bed doing absolutely nothing',
  'Family time'
], null, 'Community', true, now() - interval '10 days'),

-- ── Fun hypotheticals ─────────────────────────────────────────────────
('lst_community_47', 'Superpowers', ARRAY[
  'Flight',
  'Invisibility',
  'Telepathy',
  'Teleportation',
  'Time travel',
  'Super strength',
  'Healing factor',
  'Seeing the future',
  'Shape-shifting',
  'Controlling time',
  'Mind control',
  'Never need sleep'
], null, 'Community', true, now() - interval '11 days'),

('lst_community_48', 'Best eras to have lived in', ARRAY[
  '1920s Paris',
  '1960s New York',
  '1970s London',
  '1980s Tokyo',
  '1990s anywhere',
  'Renaissance Italy',
  'Ancient Rome',
  'Victorian England',
  '1950s America',
  'Ancient Greece',
  'Roaring 20s America',
  'Right now'
], null, 'Community', true, now() - interval '12 days'),

-- ── Nostalgia ─────────────────────────────────────────────────────────
('lst_community_49', '90s & 2000s cartoons', ARRAY[
  'SpongeBob SquarePants',
  'Rugrats',
  'Hey Arnold!',
  'Dexter''s Laboratory',
  'The Powerpuff Girls',
  'Courage the Cowardly Dog',
  'Ed, Edd n Eddy',
  'Recess',
  'Animaniacs',
  'Kim Possible',
  'Avatar: The Last Airbender',
  'Phineas and Ferb'
], null, 'Community', true, now() - interval '13 days'),

-- ── Self-knowledge ────────────────────────────────────────────────────
('lst_community_50', 'Most important qualities in a person', ARRAY[
  'Kindness',
  'Honesty',
  'Loyalty',
  'Humor',
  'Ambition',
  'Emotional intelligence',
  'Curiosity',
  'Reliability',
  'Confidence',
  'Humility',
  'Creativity',
  'Patience'
], null, 'Community', true, now() - interval '14 days')

on conflict (id) do nothing;
