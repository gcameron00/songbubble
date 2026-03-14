-- SongBubble — development seed data.
-- Replaces the old lyric-based seed with proper song records spanning the 1960s–2020s.
-- Safe to re-run: clears votes first, then replaces all songs.
--
-- Apply locally: npm run db:migrate:local
-- Do NOT apply to production — this is dev/test data only.

DELETE FROM votes;
DELETE FROM songs;

INSERT INTO songs (title, artist, album) VALUES

-- ── 1960s ────────────────────────────────────────────────────────────────────
  ('Hey Jude',                          'The Beatles',        NULL),
  ('Let It Be',                         'The Beatles',        'Let It Be'),
  ('Yesterday',                         'The Beatles',        'Help!'),
  ('Come Together',                     'The Beatles',        'Abbey Road'),
  ('(I Can''t Get No) Satisfaction',    'The Rolling Stones', 'Out of Our Heads'),
  ('Paint It Black',                    'The Rolling Stones', 'Aftermath'),
  ('The Sound of Silence',              'Simon & Garfunkel',  'Wednesday Morning, 3 A.M.'),
  ('Mrs Robinson',                      'Simon & Garfunkel',  'Bookends'),
  ('Light My Fire',                     'The Doors',          'The Doors'),
  ('Purple Haze',                       'Jimi Hendrix',       'Are You Experienced'),
  ('Good Vibrations',                   'The Beach Boys',     'Smiley Smile'),
  ('Respect',                           'Aretha Franklin',    'I Never Loved a Man the Way I Love You'),
  ('I Heard It Through the Grapevine',  'Marvin Gaye',        'In the Groove'),
  ('Like a Rolling Stone',              'Bob Dylan',          'Highway 61 Revisited'),
  ('(Sittin'' On) The Dock of the Bay', 'Otis Redding',       'The Dock of the Bay'),

-- ── 1970s ────────────────────────────────────────────────────────────────────
  ('Stairway to Heaven',                'Led Zeppelin',       'Led Zeppelin IV'),
  ('Bohemian Rhapsody',                 'Queen',              'A Night at the Opera'),
  ('We Will Rock You',                  'Queen',              'News of the World'),
  ('Hotel California',                  'Eagles',             'Hotel California'),
  ('Go Your Own Way',                   'Fleetwood Mac',      'Rumours'),
  ('The Chain',                         'Fleetwood Mac',      'Rumours'),
  ('Heroes',                            'David Bowie',        'Heroes'),
  ('Wish You Were Here',                'Pink Floyd',         'Wish You Were Here'),
  ('Rocket Man',                        'Elton John',         'Honky Château'),
  ('Superstition',                      'Stevie Wonder',      'Talking Book'),
  ('Dancing Queen',                     'ABBA',               'Arrival'),
  ('Stayin'' Alive',                    'Bee Gees',           'Saturday Night Fever'),
  ('Born to Run',                       'Bruce Springsteen',  'Born to Run'),
  ('I Feel the Earth Move',             'Carole King',        'Tapestry'),
  ('I Feel Love',                       'Donna Summer',       'I Remember Yesterday'),

-- ── 1980s ────────────────────────────────────────────────────────────────────
  ('Billie Jean',                       'Michael Jackson',    'Thriller'),
  ('Beat It',                           'Michael Jackson',    'Thriller'),
  ('Purple Rain',                       'Prince',             'Purple Rain'),
  ('Like a Prayer',                     'Madonna',            'Like a Prayer'),
  ('With or Without You',               'U2',                 'The Joshua Tree'),
  ('Where the Streets Have No Name',    'U2',                 'The Joshua Tree'),
  ('What''s Love Got to Do with It',    'Tina Turner',        'Private Dancer'),
  ('Girls Just Want to Have Fun',       'Cyndi Lauper',       'She''s So Unusual'),
  ('Take On Me',                        'a-ha',               'Hunting High and Low'),
  ('Sweet Child O'' Mine',              'Guns N'' Roses',     'Appetite for Destruction'),
  ('Lovesong',                          'The Cure',           'Disintegration'),
  ('Personal Jesus',                    'Depeche Mode',       'Violator'),
  ('Blue Monday',                       'New Order',          'Power, Corruption & Lies'),
  ('London Calling',                    'The Clash',          'London Calling'),
  ('Once in a Lifetime',                'Talking Heads',      'Remain in Light'),

-- ── 1990s ────────────────────────────────────────────────────────────────────
  ('Smells Like Teen Spirit',           'Nirvana',            'Nevermind'),
  ('Wonderwall',                        'Oasis',              '(What''s the Story) Morning Glory?'),
  ('Champagne Supernova',               'Oasis',              '(What''s the Story) Morning Glory?'),
  ('Losing My Religion',                'R.E.M.',             'Out of Time'),
  ('I Will Always Love You',            'Whitney Houston',    'The Bodyguard'),
  ('You Oughta Know',                   'Alanis Morissette',  'Jagged Little Pill'),
  ('Ironic',                            'Alanis Morissette',  'Jagged Little Pill'),
  ('Creep',                             'Radiohead',          'Pablo Honey'),
  ('Fake Plastic Trees',                'Radiohead',          'The Bends'),
  ('Black',                             'Pearl Jam',          'Ten'),
  ('Waterfalls',                        'TLC',                'CrazySexyCool'),
  ('Say My Name',                       'Destiny''s Child',   'The Writing''s on the Wall'),
  ('Doo Wop (That Thing)',              'Lauryn Hill',        'The Miseducation of Lauryn Hill'),
  ('Teardrop',                          'Massive Attack',     'Mezzanine'),
  ('Common People',                     'Pulp',               'Different Class'),

-- ── 2000s ────────────────────────────────────────────────────────────────────
  ('Crazy in Love',                     'Beyoncé',            'Dangerously in Love'),
  ('Rehab',                             'Amy Winehouse',      'Back to Black'),
  ('Back to Black',                     'Amy Winehouse',      'Back to Black'),
  ('The Scientist',                     'Coldplay',           'A Rush of Blood to the Head'),
  ('Clocks',                            'Coldplay',           'A Rush of Blood to the Head'),
  ('Mr Brightside',                     'The Killers',        'Hot Fuss'),
  ('Use Somebody',                      'Kings of Leon',      'Only by the Night'),
  ('Come Away with Me',                 'Norah Jones',        'Come Away with Me'),
  ('I Bet You Look Good on the Dancefloor', 'Arctic Monkeys', 'Whatever People Say I Am, That''s What I''m Not'),
  ('Hey Ya!',                           'OutKast',            'Speakerboxxx/The Love Below'),
  ('Seven Nation Army',                 'The White Stripes',  'Elephant'),
  ('99 Problems',                       'Jay-Z',              'The Black Album'),
  ('Lose Yourself',                     'Eminem',             '8 Mile'),
  ('Gold Digger',                       'Kanye West',         'Late Registration'),
  ('Chasing Pavements',                 'Adele',              '19'),

-- ── 2010s ────────────────────────────────────────────────────────────────────
  ('Rolling in the Deep',               'Adele',              '21'),
  ('Someone Like You',                  'Adele',              '21'),
  ('Shape of You',                      'Ed Sheeran',         '÷'),
  ('Castle on the Hill',                'Ed Sheeran',         '÷'),
  ('Shake It Off',                      'Taylor Swift',       '1989'),
  ('Blank Space',                       'Taylor Swift',       '1989'),
  ('One Dance',                         'Drake',              'Views'),
  ('HUMBLE.',                           'Kendrick Lamar',     'DAMN.'),
  ('Royals',                            'Lorde',              'Pure Heroine'),
  ('New Rules',                         'Dua Lipa',           'Dua Lipa'),
  ('This Is America',                   'Childish Gambino',   NULL),
  ('Take Me to Church',                 'Hozier',             'Hozier'),
  ('Stay with Me',                      'Sam Smith',          'In the Lonely Hour'),
  ('Uptown Funk',                       'Mark Ronson feat. Bruno Mars', 'Uptown Special'),
  ('Blinding Lights',                   'The Weeknd',         'After Hours'),

-- ── 2020s ────────────────────────────────────────────────────────────────────
  ('drivers license',                   'Olivia Rodrigo',     'SOUR'),
  ('good 4 u',                          'Olivia Rodrigo',     'SOUR'),
  ('As It Was',                         'Harry Styles',       'Harry''s House'),
  ('Watermelon Sugar',                  'Harry Styles',       'Fine Line'),
  ('Anti-Hero',                         'Taylor Swift',       'Midnights'),
  ('Me Porto Bonito',                   'Bad Bunny',          'Un Verano Sin Ti'),
  ('Leave the Door Open',               'Silk Sonic',         'An Evening with Silk Sonic'),
  ('Easy On Me',                        'Adele',              '30'),
  ('Kill Bill',                         'SZA',                'SOS'),
  ('Snooze',                            'SZA',                'SOS'),
  ('CUFF IT',                           'Beyoncé',            'Renaissance'),
  ('About Damn Time',                   'Lizzo',              'Special'),
  ('Chaise Longue',                     'Wet Leg',            'Wet Leg'),
  ('The Only Heartbreaker',             'Mitski',             'Laurel Hell'),
  ('There''d Better Be a Mirrorball',   'Arctic Monkeys',     'The Car');
