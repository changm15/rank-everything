-- RankEverything — Extra community lists (fruits + airports)
-- Paste into Supabase → SQL Editor → Run

insert into public.lists (id, name, items, owner_id, owner_name, is_public, created_at) values

('lst_community_25', 'Fruits from around the world', ARRAY[
  -- Everyday classics
  'Apple',
  'Orange',
  'Banana',
  'Strawberry',
  'Watermelon',
  'Grape',
  'Pineapple',
  'Mango',
  'Peach',
  'Pear',
  'Cherry',
  'Lemon',
  'Lime',
  'Raspberry',
  'Blackberry',
  'Plum',
  'Kiwi',
  'Coconut',
  'Grapefruit',
  'Avocado',
  -- North American
  'Blueberry',
  'Cranberry',
  'Concord Grape',
  'Pawpaw',
  'Huckleberry',
  -- European
  'Blackcurrant',
  'Gooseberry',
  'Quince',
  'Damson Plum',
  'Cloudberry',
  'Lingonberry',
  -- Asian
  'Lychee',
  'Dragon Fruit',
  'Rambutan',
  'Durian',
  'Mangosteen',
  'Jackfruit',
  'Longan',
  'Starfruit',
  'Pomelo',
  'Yuzu',
  'Loquat'
], null, 'Community', true, now() - interval '1 hour'),

('lst_community_26', 'Best airports in the world', ARRAY[
  'Singapore Changi',
  'Tokyo Haneda',
  'Seoul Incheon',
  'Zurich',
  'Helsinki',
  'Tokyo Narita',
  'Munich',
  'Hong Kong',
  'Amsterdam Schiphol',
  'Vancouver',
  'Hamad (Doha)',
  'Dubai',
  'Sydney',
  'Paris CDG',
  'London Heathrow',
  'Toronto Pearson',
  'LAX',
  'JFK',
  'Chicago O''Hare',
  'Denver'
], null, 'Community', true, now() - interval '30 minutes')

on conflict (id) do update set items = excluded.items;
