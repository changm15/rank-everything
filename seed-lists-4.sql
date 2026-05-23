-- RankEverything — Community list seed batch 4
-- Paste into Supabase → SQL Editor → Run

insert into public.lists (id, name, items, owner_id, owner_name, is_public, created_at) values

-- ── Disney ────────────────────────────────────────────────────────
('lst_community_32', 'Disney Princesses', ARRAY[
  'Moana','Mulan','Rapunzel','Tiana','Ariel',
  'Belle','Cinderella','Jasmine','Merida','Snow White',
  'Aurora','Raya','Asha','Pocahontas','Elsa'
], null, 'Community', true, now() - interval '1 days'),

('lst_community_33', 'Disney Movies', ARRAY[
  'The Lion King','Moana','Encanto','Ratatouille','Up',
  'Coco','Zootopia','Tangled','Lilo & Stitch','The Little Mermaid',
  'Beauty and the Beast','Aladdin','Mulan','Frozen','Toy Story'
], null, 'Community', true, now() - interval '2 days'),

-- ── Marvel ────────────────────────────────────────────────────────
('lst_community_34', 'Marvel Superheroes', ARRAY[
  'Spider-Man','Iron Man','Black Panther','Thor','Captain America',
  'Doctor Strange','Shang-Chi','Ms. Marvel','Wolverine','Deadpool',
  'Black Widow','Hawkeye','Scarlet Witch','Ant-Man','Star-Lord'
], null, 'Community', true, now() - interval '3 days'),

-- ── Travel ────────────────────────────────────────────────────────
('lst_community_35', 'Honeymoon Destinations', ARRAY[
  'Maldives','Santorini','Bali','Amalfi Coast','Bora Bora',
  'Tuscany','Kyoto','Maui','Seychelles','Patagonia',
  'Positano','Queenstown','Cape Town','St. Lucia','Fiji'
], null, 'Community', true, now() - interval '4 days'),

-- ── Money ─────────────────────────────────────────────────────────
('lst_community_36', 'Credit Cards', ARRAY[
  'Amex Platinum','Chase Sapphire Reserve','Capital One Venture X',
  'Amex Gold','Chase Sapphire Preferred','Citi Double Cash',
  'Apple Card','Chase Freedom Unlimited','Amex Blue Cash Preferred',
  'Discover it','Wells Fargo Autograph','Capital One SavorOne'
], null, 'Community', true, now() - interval '5 days')

on conflict (id) do nothing;
