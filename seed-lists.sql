-- RankEverything — Community list seed
-- Paste into Supabase → SQL Editor → Run
-- These are public "Community" lists new users can explore, rank, and save.

insert into public.lists (id, name, items, owner_id, owner_name, is_public, created_at) values

-- ── Food & Drink ──────────────────────────────────────────────
('lst_community_01', 'Pizza toppings', ARRAY[
  'Pepperoni','Mushroom','Olives','Pineapple','Sausage',
  'Basil','Anchovy','Bell pepper','Jalapeño','Extra cheese'
], null, 'Community', true, now() - interval '5 days'),

('lst_community_02', 'Coffee orders', ARRAY[
  'Espresso','Flat white','Cappuccino','Cortado','Latte',
  'Pour-over','Cold brew','Iced latte','Americano','Macchiato'
], null, 'Community', true, now() - interval '4 days'),

('lst_community_03', 'Breakfast foods', ARRAY[
  'Pancakes','Bacon','Avocado toast','Bagels','Croissant',
  'Oatmeal','Eggs benedict','Fruit bowl','Yogurt','Cereal'
], null, 'Community', true, now() - interval '3 days'),

('lst_community_04', 'Fast food chains', ARRAY[
  'In-N-Out','Chick-fil-A','Popeyes','Five Guys','Shake Shack',
  'McDonald''s','Wendy''s','Taco Bell','Chipotle','Raising Cane''s'
], null, 'Community', true, now() - interval '6 days'),

('lst_community_05', 'Ice cream flavors', ARRAY[
  'Chocolate','Vanilla','Strawberry','Mint chip','Cookie dough',
  'Rocky road','Cookies and cream','Pistachio','Mango sorbet','Butter pecan'
], null, 'Community', true, now() - interval '2 days'),

('lst_community_06', 'Pasta dishes', ARRAY[
  'Carbonara','Cacio e pepe','Bolognese','Aglio e olio',
  'Pesto','Lasagna','Amatriciana','Arrabbiata','Mac and cheese','Fettuccine Alfredo'
], null, 'Community', true, now() - interval '1 day'),

('lst_community_07', 'Cocktails', ARRAY[
  'Negroni','Old fashioned','Margarita','Martini','Espresso martini',
  'Aperol spritz','Moscow mule','Whiskey sour','Daiquiri','Paloma'
], null, 'Community', true, now() - interval '3 days'),

-- ── Movies & TV ───────────────────────────────────────────────
('lst_community_08', 'Pixar movies', ARRAY[
  'Toy Story','Up','Ratatouille','WALL·E','The Incredibles',
  'Finding Nemo','Coco','Inside Out','Monsters Inc.','Soul'
], null, 'Community', true, now() - interval '7 days'),

('lst_community_09', 'A24 films', ARRAY[
  'Everything Everywhere All at Once','Midsommar','Hereditary',
  'The Witch','Moonlight','Lady Bird','Uncut Gems',
  'The Lighthouse','Minari','Ex Machina'
], null, 'Community', true, now() - interval '4 days'),

('lst_community_10', 'TV shows to binge', ARRAY[
  'The Bear','Succession','Severance','The Last of Us',
  'Fleabag','Breaking Bad','Arrested Development',
  'Halt and Catch Fire','The Wire','Seinfeld'
], null, 'Community', true, now() - interval '2 days'),

('lst_community_11', 'Superhero movies', ARRAY[
  'The Dark Knight','Spider-Man: Into the Spider-Verse',
  'Iron Man','Avengers: Endgame','Logan',
  'Black Panther','Guardians of the Galaxy','Thor: Ragnarok',
  'Doctor Strange','Captain America: Civil War'
], null, 'Community', true, now() - interval '5 days'),

-- ── Music ─────────────────────────────────────────────────────
('lst_community_12', 'Music genres', ARRAY[
  'Hip-hop','Indie rock','Jazz','R&B','Electronic',
  'Pop','Classical','Metal','Folk','Reggae'
], null, 'Community', true, now() - interval '6 days'),

('lst_community_13', 'Artists of the decade', ARRAY[
  'Taylor Swift','Kendrick Lamar','Beyoncé','Frank Ocean',
  'Billie Eilish','Tyler the Creator','Olivia Rodrigo',
  'Bad Bunny','Harry Styles','The Weeknd'
], null, 'Community', true, now() - interval '1 day'),

-- ── Sports & Activities ───────────────────────────────────────
('lst_community_14', 'Sports to play', ARRAY[
  'Basketball','Tennis','Soccer','Volleyball','Swimming',
  'Rock climbing','Cycling','Golf','Surfing','Pickleball'
], null, 'Community', true, now() - interval '4 days'),

('lst_community_15', 'Beach activities', ARRAY[
  'Swim','Read a book','Beach volleyball','Build a sandcastle',
  'Surf','Frisbee','Snorkel','Just nap','Kayak','Collect shells'
], null, 'Community', true, now() - interval '8 days'),

-- ── Travel ────────────────────────────────────────────────────
('lst_community_16', 'Cities to visit', ARRAY[
  'Tokyo','New York','Paris','Barcelona','Mexico City',
  'London','Bangkok','Cape Town','Buenos Aires','Seoul'
], null, 'Community', true, now() - interval '3 days'),

('lst_community_17', 'Travel experiences', ARRAY[
  'Safari in Africa','Road trip across the US','Island hopping in Greece',
  'Train across Europe','Backpacking Southeast Asia',
  'Northern lights in Iceland','Cherry blossoms in Japan',
  'Carnival in Brazil','Amalfi Coast by boat','Desert camping in Morocco'
], null, 'Community', true, now() - interval '2 days'),

-- ── Tech & Gaming ─────────────────────────────────────────────
('lst_community_18', 'Programming languages', ARRAY[
  'Python','TypeScript','Rust','Go','Swift',
  'Kotlin','C++','Ruby','Elixir','Zig'
], null, 'Community', true, now() - interval '5 days'),

('lst_community_19', 'Video games of all time', ARRAY[
  'The Legend of Zelda: Breath of the Wild','Red Dead Redemption 2',
  'The Last of Us','Minecraft','Elden Ring',
  'Stardew Valley','Portal 2','God of War','Hollow Knight','Celeste'
], null, 'Community', true, now() - interval '3 days'),

-- ── Random & Fun ──────────────────────────────────────────────
('lst_community_20', 'Things to do on a rainy day', ARRAY[
  'Watch a movie marathon','Cook a new recipe','Read a book',
  'Play board games','Take a nap','Call a friend',
  'Learn something new online','Reorganize your space','Journal','Play video games'
], null, 'Community', true, now() - interval '1 day'),

('lst_community_21', 'Productivity tools', ARRAY[
  'Notion','Obsidian','Linear','Figma','Slack',
  'Arc browser','Raycast','Superhuman','Todoist','Roam Research'
], null, 'Community', true, now() - interval '2 days'),

('lst_community_22', 'Dog breeds', ARRAY[
  'Golden Retriever','French Bulldog','Border Collie','Shiba Inu',
  'Labrador','Corgi','Poodle','Dachshund','Husky','Bernese Mountain Dog'
], null, 'Community', true, now() - interval '6 days'),

('lst_community_23', 'Ways to start your morning', ARRAY[
  'Workout first','Meditate','Read the news','Journal',
  'Cold shower','Coffee immediately','Walk outside',
  'No phone for first hour','Make a big breakfast','To-do list review'
], null, 'Community', true, now() - interval '4 days'),

('lst_community_24', 'Superpowers', ARRAY[
  'Flight','Invisibility','Time travel','Super strength',
  'Telepathy','Teleportation','Healing factor','Super speed',
  'Shape-shifting','Stop time'
], null, 'Community', true, now() - interval '9 days')

on conflict (id) do nothing;
