/**
 * Movie Emoji Guessing Game — Question Bank
 *
 * Structure per question:
 *   id         — unique slug
 *   difficulty — 'easy' | 'medium' | 'hard'
 *   emojis     — string displayed on TV (space-separated for readability)
 *   answer
 *     title    — correct movie name
 *     actor    — lead actor(s), null for easy
 *     quote    — famous quote or song, null for easy/medium
 *   points
 *     title    — points for title component
 *     actor    — points for actor component (0 for easy)
 *     quote    — points for quote component (0 for easy/medium)
 *     total    — sum
 *   altTitles  — alternative accepted titles (aliases, articles stripped, etc.)
 */

const MOVIE_EMOJI_QUESTIONS = {

  /* ===========================================================
     EASY  — 10 pts total, movie title only
     =========================================================== */
  easy: [
    {
      id: 'e-01',
      difficulty: 'easy',
      emojis: '🦁 👑',
      answer: { title: 'The Lion King', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: ['lion king'],
    },
    {
      id: 'e-02',
      difficulty: 'easy',
      emojis: '❄️ 👸 ✨',
      answer: { title: 'Frozen', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: [],
    },
    {
      id: 'e-03',
      difficulty: 'easy',
      emojis: '🚢 💏',
      answer: { title: 'Titanic', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: [],
    },
    {
      id: 'e-04',
      difficulty: 'easy',
      emojis: '🦈 🩸 🏖️',
      answer: { title: 'Jaws', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: [],
    },
    {
      id: 'e-05',
      difficulty: 'easy',
      emojis: '🐟 🔍 🌊',
      answer: { title: 'Finding Nemo', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: ['nemo'],
    },
    {
      id: 'e-06',
      difficulty: 'easy',
      emojis: '🦖 🌿 🏝️',
      answer: { title: 'Jurassic Park', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: ['jurassic world'],
    },
    {
      id: 'e-07',
      difficulty: 'easy',
      emojis: '👽 🌿 🚲 🌙',
      answer: { title: 'E.T. the Extra-Terrestrial', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: ['e.t.', 'et', 'extra terrestrial'],
    },
    {
      id: 'e-08',
      difficulty: 'easy',
      emojis: '⚡ 🧙‍♂️ 📚',
      answer: { title: 'Harry Potter', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: ["harry potter and the philosopher's stone", 'harry potter and the sorcerer\'s stone'],
    },
    {
      id: 'e-09',
      difficulty: 'easy',
      emojis: '🤠 🧸 🌈',
      answer: { title: 'Toy Story', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: [],
    },
    {
      id: 'e-10',
      difficulty: 'easy',
      emojis: '🎸 💀 🇲🇽',
      answer: { title: 'Coco', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: [],
    },
    {
      id: 'e-11',
      difficulty: 'easy',
      emojis: '🧞‍♂️ 🪔 ✨',
      answer: { title: 'Aladdin', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: [],
    },
    {
      id: 'e-12',
      difficulty: 'easy',
      emojis: '🌹 🏰 🦁',
      answer: { title: 'Beauty and the Beast', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: ['beauty & the beast'],
    },
    {
      id: 'e-13',
      difficulty: 'easy',
      emojis: '🦇 🌃 🤵',
      answer: { title: 'Batman', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: ['the batman', 'batman begins'],
    },
    {
      id: 'e-14',
      difficulty: 'easy',
      emojis: '🕷️ 🕸️ 🏙️',
      answer: { title: 'Spider-Man', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: ['spiderman', 'spider man'],
    },
    {
      id: 'e-15',
      difficulty: 'easy',
      emojis: '👣 🍫 🏃',
      answer: { title: 'Forrest Gump', actor: null, quote: null },
      points: { title: 10, actor: 0, quote: 0, total: 10 },
      altTitles: ['forest gump'],
    },
  ],

  /* ===========================================================
     MEDIUM — 20 pts total (10 title + 10 actor)
     =========================================================== */
  medium: [
    {
      id: 'm-01',
      difficulty: 'medium',
      emojis: '🌻 💑 📓',
      answer: { title: 'The Notebook', actor: 'Ryan Gosling & Rachel McAdams', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: ['notebook'],
    },
    {
      id: 'm-02',
      difficulty: 'medium',
      emojis: '🃏 😈 🌆',
      answer: { title: 'The Dark Knight', actor: 'Heath Ledger & Christian Bale', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: ['dark knight'],
    },
    {
      id: 'm-03',
      difficulty: 'medium',
      emojis: '🎵 💃 🌴 🎬',
      answer: { title: 'La La Land', actor: 'Ryan Gosling & Emma Stone', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: ['lalaland'],
    },
    {
      id: 'm-04',
      difficulty: 'medium',
      emojis: '💍 🧙‍♂️ 🌋',
      answer: { title: 'The Lord of the Rings', actor: 'Elijah Wood & Ian McKellen', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: ['lord of the rings', 'lotr', 'fellowship of the ring'],
    },
    {
      id: 'm-05',
      difficulty: 'medium',
      emojis: '🥊 🏆 🇺🇸',
      answer: { title: 'Rocky', actor: 'Sylvester Stallone', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: [],
    },
    {
      id: 'm-06',
      difficulty: 'medium',
      emojis: '👸 💋 🛍️ 🌹',
      answer: { title: 'Pretty Woman', actor: 'Julia Roberts & Richard Gere', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: [],
    },
    {
      id: 'm-07',
      difficulty: 'medium',
      emojis: '🧑‍🚀 🌍 😱',
      answer: { title: 'Gravity', actor: 'Sandra Bullock & George Clooney', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: [],
    },
    {
      id: 'm-08',
      difficulty: 'medium',
      emojis: '🔫 🤵 🍸',
      answer: { title: 'Casino Royale', actor: 'Daniel Craig & Eva Green', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: ['james bond', '007'],
    },
    {
      id: 'm-09',
      difficulty: 'medium',
      emojis: '🎭 🎩 🌟 🎪',
      answer: { title: 'The Greatest Showman', actor: 'Hugh Jackman & Zac Efron', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: ['greatest showman'],
    },
    {
      id: 'm-10',
      difficulty: 'medium',
      emojis: '🍕 🕺 🔫 🎸',
      answer: { title: 'Pulp Fiction', actor: 'John Travolta & Uma Thurman', quote: null },
      points: { title: 10, actor: 10, quote: 0, total: 20 },
      altTitles: [],
    },
  ],

  /* ===========================================================
     HARD — 30 pts total (10 title + 10 actor + 10 quote/song)
     =========================================================== */
  hard: [
    {
      id: 'h-01',
      difficulty: 'hard',
      emojis: '🤖 🔴 💪',
      answer: {
        title: 'The Terminator',
        actor: 'Arnold Schwarzenegger',
        quote: '"I\'ll be back"',
      },
      points: { title: 10, actor: 10, quote: 10, total: 30 },
      altTitles: ['terminator'],
    },
    {
      id: 'h-02',
      difficulty: 'hard',
      emojis: '💃 🕺 🚫 👶',
      answer: {
        title: 'Dirty Dancing',
        actor: 'Patrick Swayze & Jennifer Grey',
        quote: '"Nobody puts Baby in a corner"',
      },
      points: { title: 10, actor: 10, quote: 10, total: 30 },
      altTitles: [],
    },
    {
      id: 'h-03',
      difficulty: 'hard',
      emojis: '👣 🍫 🏃 🪶',
      answer: {
        title: 'Forrest Gump',
        actor: 'Tom Hanks & Robin Wright',
        quote: '"Life is like a box of chocolates — you never know what you\'re gonna get"',
      },
      points: { title: 10, actor: 10, quote: 10, total: 30 },
      altTitles: ['forest gump'],
    },
    {
      id: 'h-04',
      difficulty: 'hard',
      emojis: '🧠 🦷 🍷 🐑',
      answer: {
        title: 'The Silence of the Lambs',
        actor: 'Anthony Hopkins & Jodie Foster',
        quote: '"Quid pro quo, Clarice"',
      },
      points: { title: 10, actor: 10, quote: 10, total: 30 },
      altTitles: ['silence of the lambs'],
    },
    {
      id: 'h-05',
      difficulty: 'hard',
      emojis: '🔒 🏃‍♂️ 🌅 🧱',
      answer: {
        title: 'The Shawshank Redemption',
        actor: 'Tim Robbins & Morgan Freeman',
        quote: '"Get busy living, or get busy dying"',
      },
      points: { title: 10, actor: 10, quote: 10, total: 30 },
      altTitles: ['shawshank redemption', 'shawshank'],
    },
    {
      id: 'h-06',
      difficulty: 'hard',
      emojis: '🏐 🌊 ✈️ 🏝️',
      answer: {
        title: 'Cast Away',
        actor: 'Tom Hanks',
        quote: '"Wilson! WILSON!"',
      },
      points: { title: 10, actor: 10, quote: 10, total: 30 },
      altTitles: ['castaway'],
    },
    {
      id: 'h-07',
      difficulty: 'hard',
      emojis: '🥊 👊 🤫 🧼',
      answer: {
        title: 'Fight Club',
        actor: 'Brad Pitt & Edward Norton',
        quote: '"The first rule of Fight Club is: you do not talk about Fight Club"',
      },
      points: { title: 10, actor: 10, quote: 10, total: 30 },
      altTitles: [],
    },
    {
      id: 'h-08',
      difficulty: 'hard',
      emojis: '🚢 💏 🌊 ❤️',
      answer: {
        title: 'Titanic',
        actor: 'Leonardo DiCaprio & Kate Winslet',
        quote: '"I\'m the king of the world!" / ♪ My Heart Will Go On',
      },
      points: { title: 10, actor: 10, quote: 10, total: 30 },
      altTitles: [],
    },
  ],
};

/**
 * Get all questions as a flat array.
 * @returns {Object[]}
 */
function getAllQuestions() {
  return [
    ...MOVIE_EMOJI_QUESTIONS.easy,
    ...MOVIE_EMOJI_QUESTIONS.medium,
    ...MOVIE_EMOJI_QUESTIONS.hard,
  ];
}

/**
 * Get questions by difficulty.
 * @param {'easy'|'medium'|'hard'} difficulty
 */
function getQuestionsByDifficulty(difficulty) {
  return MOVIE_EMOJI_QUESTIONS[difficulty] || [];
}
