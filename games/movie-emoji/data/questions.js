/**
 * Movie Emoji Guessing Game — Question Bank
 *
 * 47 questions total: 33 Bollywood (70%) + 14 Hollywood (30%)
 * Hollywood entries are all 2015 or newer (except timeless family classics in Easy).
 * Each movie appears in EXACTLY ONE difficulty tier.
 *
 * Per-question shape:
 *   id         — unique slug
 *   difficulty — 'easy' | 'medium' | 'hard'
 *   origin     — 'bollywood' | 'hollywood'
 *   genre      — primary genre string (see GENRES constant)
 *   emojis     — emoji clue string shown on TV
 *   answer
 *     title    — correct movie title
 *     actor    — lead actor(s); null for easy
 *     quote    — famous dialogue or song title; null for easy/medium
 *   points     — { title, actor, quote, total }
 *   altTitles  — accepted alternate spellings / abbreviations
 */

const GENRES = ['romance','action','comedy','drama','thriller','sci-fi','sports','musical','family'];

const MOVIE_EMOJI_QUESTIONS = {

  /* ==================================================================
     EASY — 10 pts  |  Movie title only
     14 Bollywood + 6 Hollywood = 20 questions
     ================================================================== */
  easy: [

    /* ── BOLLYWOOD ── */
    {
      id: 'b-e-01', difficulty: 'easy', origin: 'bollywood', genre: 'romance',
      emojis: '🚂 🌻 💍',
      answer: { title: 'Dilwale Dulhania Le Jayenge', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: ['ddlj', 'dilwale dulhania', 'dilwale'],
    },
    {
      id: 'b-e-02', difficulty: 'easy', origin: 'bollywood', genre: 'action',
      emojis: '🔥 🐴 🏜️',
      answer: { title: 'Sholay', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: [],
    },
    {
      id: 'b-e-03', difficulty: 'easy', origin: 'bollywood', genre: 'comedy',
      emojis: '3️⃣ 🎓 🤣',
      answer: { title: '3 Idiots', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: ['three idiots'],
    },
    {
      id: 'b-e-04', difficulty: 'easy', origin: 'bollywood', genre: 'sports',
      emojis: '🤼‍♀️ 🏅 👨‍👧‍👧',
      answer: { title: 'Dangal', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: [],
    },
    {
      id: 'b-e-05', difficulty: 'easy', origin: 'bollywood', genre: 'drama',
      emojis: '👑 🕌 💔',
      answer: { title: 'Mughal-E-Azam', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: ['mughal e azam', 'the great mughal'],
    },
    {
      id: 'b-e-06', difficulty: 'easy', origin: 'bollywood', genre: 'romance',
      emojis: '💌 🏫 ❤️‍🔥',
      answer: { title: 'Kuch Kuch Hota Hai', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: ['kkhh', 'kuch kuch'],
    },
    {
      id: 'b-e-07', difficulty: 'easy', origin: 'bollywood', genre: 'sports',
      emojis: '🏏 🌧️ 🌾',
      answer: { title: 'Lagaan', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: ['lagaan once upon a time in india'],
    },
    {
      id: 'b-e-08', difficulty: 'easy', origin: 'bollywood', genre: 'drama',
      emojis: '🥃 💔 🌹',
      answer: { title: 'Devdas', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: [],
    },
    {
      id: 'b-e-09', difficulty: 'easy', origin: 'bollywood', genre: 'comedy',
      emojis: '3️⃣ 👨‍👨‍👦 🏖️',
      answer: { title: 'Dil Chahta Hai', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: ['dch', 'dil chahta'],
    },
    {
      id: 'b-e-10', difficulty: 'easy', origin: 'bollywood', genre: 'drama',
      emojis: '🏠 👨‍👩‍👧‍👦 😢',
      answer: { title: 'Kabhi Khushi Kabhie Gham', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: ['k3g', 'kabhi khushi kabhi gham', 'k 3 g'],
    },
    {
      id: 'b-e-11', difficulty: 'easy', origin: 'bollywood', genre: 'romance',
      emojis: '💃 📼 💒',
      answer: { title: 'Hum Aapke Hain Koun', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: ['hahk', 'hum aapke hain kaun'],
    },
    {
      id: 'b-e-12', difficulty: 'easy', origin: 'bollywood', genre: 'romance',
      emojis: '🌅 💔 🗽',
      answer: { title: 'Kal Ho Naa Ho', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: ['khnh', 'kal ho na ho'],
    },
    {
      id: 'b-e-13', difficulty: 'easy', origin: 'bollywood', genre: 'drama',
      emojis: '🎬 🌟 🔄',
      answer: { title: 'Om Shanti Om', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: ['oso'],
    },
    {
      id: 'b-e-14', difficulty: 'easy', origin: 'bollywood', genre: 'comedy',
      emojis: '👽 📡 ❓',
      answer: { title: 'PK', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: ['pk film', 'peekay'],
    },

    /* ── HOLLYWOOD ── */
    {
      id: 'h-e-01', difficulty: 'easy', origin: 'hollywood', genre: 'family',
      emojis: '❄️ 👸 ✨',
      answer: { title: 'Frozen', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: [],
    },
    {
      id: 'h-e-02', difficulty: 'easy', origin: 'hollywood', genre: 'family',
      emojis: '🦁 👑 🌅',
      answer: { title: 'The Lion King', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: ['lion king'],
    },
    {
      id: 'h-e-03', difficulty: 'easy', origin: 'hollywood', genre: 'family',
      emojis: '🤠 🧸 🗺️',
      answer: { title: 'Toy Story 4', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: ['toy story'],
    },
    {
      id: 'h-e-04', difficulty: 'easy', origin: 'hollywood', genre: 'family',
      emojis: '🌊 ⚓ 🌺',
      answer: { title: 'Moana', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: [],
    },
    {
      id: 'h-e-05', difficulty: 'easy', origin: 'hollywood', genre: 'family',
      emojis: '🎸 💀 🌼',
      answer: { title: 'Coco', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: [],
    },
    {
      id: 'h-e-06', difficulty: 'easy', origin: 'hollywood', genre: 'action',
      emojis: '🕷️ 🌆 🎨',
      answer: { title: 'Spider-Man: Into the Spider-Verse', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: ['into the spider verse', 'spider verse', 'spiderman spider verse'],
    },
  ],

  /* ==================================================================
     MEDIUM — 20 pts  |  Movie title (10) + Lead actor/actress (10)
     11 Bollywood + 4 Hollywood = 15 questions
     ================================================================== */
  medium: [

    /* ── BOLLYWOOD ── */
    {
      id: 'b-m-01', difficulty: 'medium', origin: 'bollywood', genre: 'drama',
      emojis: '🛳️ 👨‍👩‍👧‍👦 🌊',
      answer: { title: 'Dil Dhadakne Do', actor: 'Ranveer Singh & Priyanka Chopra', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: ['ddd', 'dil dhadkne do'],
    },
    {
      id: 'b-m-02', difficulty: 'medium', origin: 'bollywood', genre: 'drama',
      emojis: '👑 ✈️ 🗼',
      answer: { title: 'Queen', actor: 'Kangana Ranaut', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: [],
    },
    {
      id: 'b-m-03', difficulty: 'medium', origin: 'bollywood', genre: 'drama',
      emojis: '🎭 🧩 🇫🇷',
      answer: { title: 'Tamasha', actor: 'Ranbir Kapoor & Deepika Padukone', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: [],
    },
    {
      id: 'b-m-04', difficulty: 'medium', origin: 'bollywood', genre: 'comedy',
      emojis: '🏄 🇪🇸 ☀️',
      answer: { title: 'Zindagi Na Milegi Dobara', actor: 'Hrithik Roshan, Farhan Akhtar & Abhay Deol', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: ['znmd', 'zindagi na milegi'],
    },
    {
      id: 'b-m-05', difficulty: 'medium', origin: 'bollywood', genre: 'drama',
      emojis: '🙏 🇵🇰 🧒',
      answer: { title: 'Bajrangi Bhaijaan', actor: 'Salman Khan & Kareena Kapoor Khan', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: ['bajrangi bhai jaan'],
    },
    {
      id: 'b-m-06', difficulty: 'medium', origin: 'bollywood', genre: 'romance',
      emojis: '🌂 😶 🌸',
      answer: { title: 'Barfi!', actor: 'Ranbir Kapoor & Priyanka Chopra', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: ['barfi'],
    },
    {
      id: 'b-m-07', difficulty: 'medium', origin: 'bollywood', genre: 'drama',
      emojis: '🍽️ ✈️ 🇺🇸',
      answer: { title: 'English Vinglish', actor: 'Sridevi', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: [],
    },
    {
      id: 'b-m-08', difficulty: 'medium', origin: 'bollywood', genre: 'drama',
      emojis: '🖌️ 🧒 🏫',
      answer: { title: 'Taare Zameen Par', actor: 'Aamir Khan & Darsheel Safary', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: ['tzp', 'like stars on earth', 'taare zameen'],
    },
    {
      id: 'b-m-09', difficulty: 'medium', origin: 'bollywood', genre: 'comedy',
      emojis: '2️⃣ 🤣 💰',
      answer: { title: 'Andaz Apna Apna', actor: 'Aamir Khan & Salman Khan', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: ['aaa', 'andaz apna apna'],
    },
    {
      id: 'b-m-10', difficulty: 'medium', origin: 'bollywood', genre: 'drama',
      emojis: '🕯️ 🌾 🇮🇳',
      answer: { title: 'Rang De Basanti', actor: 'Aamir Khan & Siddharth', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: ['rdb'],
    },
    {
      id: 'b-m-11', difficulty: 'medium', origin: 'bollywood', genre: 'romance',
      emojis: '⚔️ 💃 🏯',
      answer: { title: 'Bajirao Mastani', actor: 'Ranveer Singh & Deepika Padukone', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: ['bajirao'],
    },

    /* ── HOLLYWOOD (2015+) ── */
    {
      id: 'h-m-01', difficulty: 'medium', origin: 'hollywood', genre: 'romance',
      emojis: '💎 🇸🇬 👰',
      answer: { title: 'Crazy Rich Asians', actor: 'Henry Golding & Constance Wu', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: [],
    },
    {
      id: 'h-m-02', difficulty: 'medium', origin: 'hollywood', genre: 'thriller',
      emojis: '🌿 🌀 ☕',
      answer: { title: 'Get Out', actor: 'Daniel Kaluuya', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: [],
    },
    {
      id: 'h-m-03', difficulty: 'medium', origin: 'hollywood', genre: 'musical',
      emojis: '🎵 💃 🌃',
      answer: { title: 'La La Land', actor: 'Ryan Gosling & Emma Stone', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: ['lalaland'],
    },
    {
      id: 'h-m-04', difficulty: 'medium', origin: 'hollywood', genre: 'thriller',
      emojis: '🔪 🏚️ 🔍',
      answer: { title: 'Knives Out', actor: 'Daniel Craig & Ana de Armas', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: [],
    },
  ],

  /* ==================================================================
     HARD — 30 pts  |  Title (10) + Actor (10) + Quote / Song (10)
     8 Bollywood + 4 Hollywood = 12 questions
     ================================================================== */
  hard: [

    /* ── BOLLYWOOD ── */
    {
      id: 'b-h-01', difficulty: 'hard', origin: 'bollywood', genre: 'drama',
      emojis: '🧱 🤵 🆚',
      answer: {
        title: 'Deewar',
        actor: 'Amitabh Bachchan & Shashi Kapoor',
        quote: '"Mere paas maa hai"',
      },
      points: { title: 10, actor: 10, quote: 10, total: 30 },
      altTitles: ['deewaar'],
    },
    {
      id: 'b-h-02', difficulty: 'hard', origin: 'bollywood', genre: 'drama',
      emojis: '✈️ 💔 🌃',
      answer: {
        title: 'Kabhi Alvida Naa Kehna',
        actor: 'Shah Rukh Khan & Rani Mukerji',
        quote: '♪ "Alvida"',
      },
      points: { title: 10, actor: 10, quote: 10, total: 30 },
      altTitles: ['kank', 'kabhi alvida na kehna'],
    },
    {
      id: 'b-h-03', difficulty: 'hard', origin: 'bollywood', genre: 'musical',
      emojis: '🎸 💔 🔥',
      answer: {
        title: 'Rockstar',
        actor: 'Ranbir Kapoor & Nargis Fakhri',
        quote: '♪ "Sadda Haq"',
      },
      points: { title: 10, actor: 10, quote: 10, total: 30 },
      altTitles: [],
    },
    {
      id: 'b-h-04', difficulty: 'hard', origin: 'bollywood', genre: 'drama',
      emojis: '🕯️ 🏞️ 🌊',
      answer: {
        title: 'Masaan',
        actor: 'Vicky Kaushal & Richa Chadha',
        quote: '♪ "Mann Kasturi Re"',
      },
      points: { title: 10, actor: 10, quote: 10, total: 30 },
      altTitles: ['masaan 2015'],
    },
    {
      id: 'b-h-05', difficulty: 'hard', origin: 'bollywood', genre: 'drama',
      emojis: '🚀 🌾 💡',
      answer: {
        title: 'Swades',
        actor: 'Shah Rukh Khan',
        quote: '♪ "Yeh Jo Des Hai Tera"',
      },
      points: { title: 10, actor: 10, quote: 10, total: 30 },
      altTitles: ['swades we the people'],
    },
    {
      id: 'b-h-06', difficulty: 'hard', origin: 'bollywood', genre: 'drama',
      emojis: '🌸 😄 💉',
      answer: {
        title: 'Anand',
        actor: 'Rajesh Khanna & Amitabh Bachchan',
        quote: '"Zindagi badi honi chahiye, lambi nahi"',
      },
      points: { title: 10, actor: 10, quote: 10, total: 30 },
      altTitles: [],
    },
    {
      id: 'b-h-07', difficulty: 'hard', origin: 'bollywood', genre: 'action',
      emojis: '🪖 💥 🇮🇳',
      answer: {
        title: 'URI: The Surgical Strike',
        actor: 'Vicky Kaushal & Paresh Rawal',
        quote: '"How\'s the josh?" / "High sir!"',
      },
      points: { title: 10, actor: 10, quote: 10, total: 30 },
      altTitles: ['uri', 'uri the surgical strike', 'uri surgical strike'],
    },
    {
      id: 'b-h-08', difficulty: 'hard', origin: 'bollywood', genre: 'musical',
      emojis: '🎤 🏘️ ✊',
      answer: {
        title: 'Gully Boy',
        actor: 'Ranveer Singh & Alia Bhatt',
        quote: '♪ "Apna Time Aayega"',
      },
      points: { title: 10, actor: 10, quote: 10, total: 30 },
      altTitles: [],
    },

    /* ── HOLLYWOOD (2015+) ── */
    {
      id: 'h-h-01', difficulty: 'hard', origin: 'hollywood', genre: 'thriller',
      emojis: '🪨 🏠 🪳',
      answer: {
        title: 'Parasite',
        actor: 'Song Kang-ho & Choi Woo-shik',
        quote: '"You know what kind of plan never fails? No plan."',
      },
      points: { title: 10, actor: 10, quote: 10, total: 30 },
      altTitles: ['gisaengchung'],
    },
    {
      id: 'h-h-02', difficulty: 'hard', origin: 'hollywood', genre: 'sci-fi',
      emojis: '🛸 🌀 🔤',
      answer: {
        title: 'Arrival',
        actor: 'Amy Adams & Jeremy Renner',
        quote: '"Language is the first weapon drawn in a conflict"',
      },
      points: { title: 10, actor: 10, quote: 10, total: 30 },
      altTitles: [],
    },
    {
      id: 'h-h-03', difficulty: 'hard', origin: 'hollywood', genre: 'drama',
      emojis: '🥁 😤 🩸',
      answer: {
        title: 'Whiplash',
        actor: 'Miles Teller & J.K. Simmons',
        quote: '"Not quite my tempo"',
      },
      points: { title: 10, actor: 10, quote: 10, total: 30 },
      altTitles: [],
    },
    {
      id: 'h-h-04', difficulty: 'hard', origin: 'hollywood', genre: 'sci-fi',
      emojis: '👁️ 🌀 🥟',
      answer: {
        title: 'Everything Everywhere All at Once',
        actor: 'Michelle Yeoh & Ke Huy Quan',
        quote: '"In another life, I would have really liked just doing laundry and taxes with you"',
      },
      points: { title: 10, actor: 10, quote: 10, total: 30 },
      altTitles: ['eeaao', 'everything everywhere'],
    },
  ],
};

/* ── Helper functions ────────────────────────────────────── */

/** Flat array of all questions. */
function getAllQuestions() {
  return [
    ...MOVIE_EMOJI_QUESTIONS.easy,
    ...MOVIE_EMOJI_QUESTIONS.medium,
    ...MOVIE_EMOJI_QUESTIONS.hard,
  ];
}

/** Questions for one difficulty tier. */
function getQuestionsByDifficulty(difficulty) {
  return MOVIE_EMOJI_QUESTIONS[difficulty] || [];
}

/**
 * Filter questions by origin and/or genre.
 * @param {Object[]} questions
 * @param {'all'|'bollywood'|'hollywood'} origin
 * @param {string[]} genres  — ['all'] means no genre filter
 */
function filterQuestions(questions, origin = 'all', genres = ['all']) {
  return questions.filter(q => {
    if (origin !== 'all' && q.origin !== origin) return false;
    if (!genres.includes('all') && !genres.includes(q.genre)) return false;
    return true;
  });
}

/**
 * Build a shuffled random playlist across all difficulties.
 * @param {number} total  — desired question count (10 | 15 | 20 | 25)
 * @param {'all'|'bollywood'|'hollywood'} origin
 * @param {string[]} genres
 */
function buildRandomPlaylist(total, origin = 'all', genres = ['all']) {
  const dist = { 10: [4,4,2], 15: [5,6,4], 20: [7,8,5], 25: [8,10,7] };
  const [easyN, medN, hardN] = dist[total] || [Math.round(total*0.35), Math.round(total*0.40), Math.round(total*0.25)];

  function pick(cat, n) {
    const pool = filterQuestions(MOVIE_EMOJI_QUESTIONS[cat] || [], origin, genres);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  }

  const playlist = [
    ...pick('easy', easyN),
    ...pick('medium', medN),
    ...pick('hard', hardN),
  ].sort(() => Math.random() - 0.5); // final shuffle mixes difficulties

  return playlist;
}
