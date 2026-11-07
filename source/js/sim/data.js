// Static catalogs: characters, parties, countries, laws, executive orders, research.
// Game state copies the mutable parts at setup; these definitions never change at runtime.

// Bird appearance: used by js/render/bird.js. Colours are hex strings.
export const LOOKS = {
  abbas:     { type: 'lovebird',  body: '#3f9b3a', back: '#2f7d32', belly: '#7cc24a', face: '#ff5a24', forehead: '#ff3d12', cheek: '#ff7a3a', wing: '#2e8a35', wingTip: '#1f5f2a', tail: '#2a7fc4', rump: '#3a8fd8', beak: '#f2d9b0', eyeRing: null },
  silver:    { type: 'lovebird',  body: '#c9ced3', back: '#9aa2aa', belly: '#eef0f2', face: '#f4f5f6', forehead: '#e2e5e8', cheek: '#eceef0', wing: '#8f979f', wingTip: '#5f666d', tail: '#7d858d', rump: '#a9b1b8', beak: '#f0d7c0', eyeRing: '#ffffff' },
  cookie:    { type: 'cockatiel', body: '#f4f1e8', back: '#e8e3d6', belly: '#f8f6ef', face: '#f7d23a', forehead: '#f5c923', cheek: '#f28a2e', wing: '#ece7da', wingTip: '#d9d2c0', tail: '#e9e4d5', rump: '#efeadf', beak: '#9aa0a6', crest: '#f4cf2c', eyeRing: null },
  snowflake: { type: 'dove',      body: '#f7f8fa', back: '#eceef2', belly: '#ffffff', face: '#fbfbfd', forehead: '#f3f4f7', cheek: '#f3f4f7', wing: '#e8eaef', wingTip: '#d6dae1', tail: '#eef0f4', rump: '#f2f3f6', beak: '#e7b7a3', eyeRing: '#f0d5cc' },
  pikachu:   { type: 'cockatiel', body: '#f7e9a8', back: '#f1dd88', belly: '#faf0c4', face: '#f9cf2a', forehead: '#f7c61c', cheek: '#f27a24', wing: '#f3e2a0', wingTip: '#e8d27a', tail: '#f2e19a', rump: '#f5e6a6', beak: '#d9c7a8', crest: '#f6c81e', eyeRing: null },
};

const PALETTES = [
  { type: 'finch', body: '#b5653a', back: '#7a4a2e', belly: '#e8c9a4', face: '#c4473a', forehead: '#a93a30', cheek: '#d9846a', wing: '#6b4430', wingTip: '#3b2a20', tail: '#4a3426', rump: '#8a5a3a', beak: '#c9a07a' },
  { type: 'corvid', body: '#22252b', back: '#1a1c21', belly: '#2c3038', face: '#262a31', forehead: '#1b1d22', cheek: '#2a2e35', wing: '#181a1f', wingTip: '#0f1013', tail: '#15171b', rump: '#1d2026', beak: '#121316' },
  { type: 'owl', body: '#8a6b4a', back: '#6e5338', belly: '#d8c29a', face: '#e6d6b4', forehead: '#7a5c3e', cheek: '#d2bd94', wing: '#6a4f36', wingTip: '#4b3826', tail: '#5e4630', rump: '#7a5f43', beak: '#4b4038' },
  { type: 'bluejay', body: '#4f7fcf', back: '#3a64b0', belly: '#dfe7f2', face: '#e9eef6', forehead: '#3f6cc0', cheek: '#c8d4e6', wing: '#2f56a0', wingTip: '#1b2f5a', tail: '#3560b5', rump: '#4672c4', beak: '#1f2328' },
  { type: 'robin', body: '#6f6a62', back: '#5c5750', belly: '#e0703a', face: '#d86232', forehead: '#58534c', cheek: '#e07a44', wing: '#55504a', wingTip: '#3a3632', tail: '#4b4741', rump: '#625d56', beak: '#e1b04a' },
  { type: 'kingfisher', body: '#1f8fb8', back: '#167aa0', belly: '#e88a3a', face: '#f09a4a', forehead: '#1a7ea5', cheek: '#f3f0e8', wing: '#1b6f96', wingTip: '#10506e', tail: '#1882aa', rump: '#3ab4dd', beak: '#202226' },
  { type: 'macaw', body: '#c9262b', back: '#b11f24', belly: '#d8352f', face: '#f1ece4', forehead: '#c22126', cheek: '#f3ede6', wing: '#2f6fd1', wingTip: '#f0c419', tail: '#c22126', rump: '#3c7ee0', beak: '#e8e2d6' },
];

// Core characters requested by the player + generated officials.
export const CORE_CHARS = [
  { id: 'abbas', name: 'Abbas', species: 'Peach-faced Lovebird', competence: 78, charisma: 86, integrity: 82, loyalty: 92, ambition: 70, econ: -0.15, social: -0.2, specialty: 'leadership',
    trait: 'Charismatic unifier', bio: 'A green-and-orange lovebird with a fiery orange-red face. Warm, decisive and beloved by younger voters.' },
  { id: 'silver', name: 'Silver', species: 'Grey-white Lovebird', competence: 84, charisma: 80, integrity: 52, loyalty: 25, ambition: 96, econ: 0.5, social: 0.45, specialty: 'leadership',
    trait: 'Ruthless strategist', bio: 'A grey-and-white lovebird. He is a brilliant debater and the most dangerous rival in national politics.' },
  { id: 'cookie', name: 'Cookie', species: 'Cockatiel', competence: 72, charisma: 78, integrity: 76, loyalty: 82, ambition: 45, econ: 0.05, social: -0.05, specialty: 'communications',
    trait: 'Fast but lazy', bio: 'A white cockatiel with a yellow face and crest and bright orange cheeks. Lightning-quick when it matters, allergic to paperwork.' },
  { id: 'snowflake', name: 'Snowflake', species: 'White Dove', competence: 81, charisma: 64, integrity: 94, loyalty: 78, ambition: 35, econ: -0.35, social: -0.3, specialty: 'health',
    trait: 'Incorruptible administrator', bio: 'A pure white dove. Calm, meticulous and trusted across party lines.' },
  { id: 'pikachu', name: 'Pikachu', species: 'Lutino Cockatiel', competence: 77, charisma: 72, integrity: 66, loyalty: 70, ambition: 82, econ: 0.3, social: 0.0, specialty: 'economy',
    trait: 'Energetic reformer', bio: 'A lutino cockatiel: creamy yellow, with a golden crest and orange cheeks. She is full of ideas and impatient with bureaucracy.' },
];

export const NPC_NAMES = [
  ['Marlow Kestrel', 'economy'], ['Juno Finch', 'diplomacy'], ['Rex Harrier', 'military'], ['Ada Wren', 'education'],
  ['Otto Plover', 'admin'], ['Lena Sparrow', 'health'], ['Bruno Gannet', 'military'], ['Iris Heron', 'justice'],
  ['Felix Merlin', 'economy'], ['Nora Starling', 'diplomacy'], ['Hugo Crane', 'admin'], ['Vera Swift', 'security'],
  ['Theo Rook', 'security'], ['Clara Linnet', 'education'], ['Silas Grebe', 'justice'], ['Mira Tanager', 'economy'],
];
export const NPC_SPECIES = { finch: 'Rosefinch', corvid: 'Raven', owl: 'Tawny Owl', bluejay: 'Blue Jay', robin: 'Robin', kingfisher: 'Kingfisher', macaw: 'Scarlet Macaw' };
export { PALETTES };

export const POSITIONS = [
  { id: 'vp', name: 'Vice President', dept: 'Office of the Vice President', spec: ['leadership', 'communications', 'admin'] },
  { id: 'finance', name: 'Minister of Finance', dept: 'Treasury & Finance', spec: ['economy'] },
  { id: 'foreign', name: 'Minister of Foreign Affairs', dept: 'Foreign Affairs', spec: ['diplomacy', 'communications'] },
  { id: 'defense', name: 'Minister of Defense', dept: 'Defense', spec: ['military', 'security'] },
  { id: 'interior', name: 'Minister of the Interior', dept: 'Interior & Public Safety', spec: ['security', 'admin'] },
  { id: 'health', name: 'Minister of Health', dept: 'Health', spec: ['health'] },
  { id: 'education', name: 'Minister of Education', dept: 'Education', spec: ['education'] },
  { id: 'trade', name: 'Minister of Trade & Industry', dept: 'Trade & Industry', spec: ['economy', 'diplomacy'] },
  { id: 'justice', name: 'Minister of Justice', dept: 'Justice', spec: ['justice', 'admin'] },
];

export const PARTIES = [
  { id: 'unity', name: 'Unity Wing Party', short: 'UWP', color: '#3b82f6', econ: -0.3, social: -0.2, desc: 'Centre-left. Public services, pragmatic reform.' },
  { id: 'nest', name: 'Nest Conservative Party', short: 'NCP', color: '#dc2626', econ: 0.5, social: 0.5, desc: 'Centre-right. Low taxes, tradition, strong defence.' },
  { id: 'canopy', name: 'Green Canopy', short: 'GC', color: '#0d9488', econ: -0.6, social: -0.7, desc: 'Green left. Environment, equality, climate action.' },
  { id: 'free', name: 'Free Sky Liberals', short: 'FSL', color: '#d97706', econ: 0.65, social: -0.55, desc: 'Liberal. Free markets, civil liberties, open borders.' },
  { id: 'talon', name: 'Talon National Front', short: 'TNF', color: '#8b5cf6', econ: 0.1, social: 0.9, desc: 'Nationalist. Border control, security, protectionism.' },
];

export const CITIES = ['Plumeria', 'Port Wren', 'Featherfall', 'Cliffnest', 'Reedmouth', 'Sunperch'];
export const SECTORS = ['Agriculture', 'Industry', 'Services', 'Technology', 'Public sector'];
export const EDU = ['Primary', 'Secondary', 'University', 'Postgraduate'];

// Fictional nations. Map positions are 0..1 on the world grid.
export const COUNTRIES = [
  { id: 'aviania', name: 'Republic of Aviania', short: 'Aviania', adj: 'Avianian', species: 'Mixed flock', gov: 'democracy', capital: 'Plumeria', color: '#2f80c9',
    pos: [0.42, 0.52], size: 1.0, gdp: 1400, pop: 38, debtPct: 62, exportShare: 0.28, importShare: 0.27, flag: ['#0f5e8c', '#f0b429', '#ffffff'] },
  { id: 'corvid', name: 'Corvid Union', short: 'Corvidia', adj: 'Corvid', species: 'Ravens & crows', gov: 'autocracy', capital: 'Nightspire', color: '#5b5f6b',
    pos: [0.58, 0.3], size: 1.35, gdp: 2100, pop: 95, debtPct: 45, exportShare: 0.24, importShare: 0.2, flag: ['#1b1d22', '#8b0f1a', '#c9ccd3'],
    leader: { name: 'Marshal Grax Vorn', aggression: 0.75, trade: 0.35, econ: 0.2, social: 0.8, charisma: 60 } },
  { id: 'psitt', name: 'Psittacine Republic', short: 'Psittacia', adj: 'Psittacine', species: 'Parrots', gov: 'democracy', capital: 'Verdana', color: '#2fa36b',
    pos: [0.27, 0.68], size: 0.85, gdp: 900, pop: 24, debtPct: 55, exportShare: 0.36, importShare: 0.33, flag: ['#1f8a4c', '#e6352b', '#f4d03f'],
    leader: { name: 'President Lorena Macaw', aggression: 0.2, trade: 0.85, econ: 0.1, social: -0.3, charisma: 74 } },
  { id: 'strigia', name: 'Strigian Federation', short: 'Strigia', adj: 'Strigian', species: 'Owls', gov: 'federation', capital: 'Duskhollow', color: '#8a6d4b',
    pos: [0.74, 0.58], size: 1.15, gdp: 1600, pop: 42, debtPct: 70, exportShare: 0.3, importShare: 0.28, flag: ['#3d2c1e', '#d9b46a', '#f2ecdf'],
    leader: { name: 'Chancellor Odile Strix', aggression: 0.3, trade: 0.6, econ: 0.25, social: 0.1, charisma: 66 } },
  { id: 'falcon', name: 'Falcon Dominion', short: 'Falconreach', adj: 'Falconese', species: 'Falcons & hawks', gov: 'monarchy', capital: 'Highcliff', color: '#b5533c',
    pos: [0.82, 0.26], size: 0.85, gdp: 700, pop: 20, debtPct: 40, exportShare: 0.25, importShare: 0.24, flag: ['#7a1f12', '#e3b04b', '#1b1b1b'],
    leader: { name: 'King Aldric Peregrine', aggression: 0.62, trade: 0.4, econ: 0.4, social: 0.7, charisma: 70 } },
  { id: 'anser', name: 'Anserine Kingdom', short: 'Anseria', adj: 'Anserine', species: 'Geese & swans', gov: 'democracy', capital: 'Lakemere', color: '#4f6fb0',
    pos: [0.2, 0.33], size: 1.0, gdp: 1200, pop: 30, debtPct: 80, exportShare: 0.32, importShare: 0.31, flag: ['#ffffff', '#24418f', '#c8102e'],
    leader: { name: 'Prime Minister Wilhelmina Swan', aggression: 0.15, trade: 0.7, econ: -0.1, social: -0.2, charisma: 69 } },
  { id: 'pelican', name: 'Pelecan Isles', short: 'Pelecan Isles', adj: 'Pelecan', species: 'Seabirds', gov: 'democracy', capital: 'Saltharbor', color: '#27a3b5',
    pos: [0.52, 0.85], size: 0.4, island: true, gdp: 250, pop: 6, debtPct: 50, exportShare: 0.45, importShare: 0.48, flag: ['#0e7c8c', '#f6f1e1', '#f39c34'],
    leader: { name: 'Premier Tomas Pelecan', aggression: 0.1, trade: 0.9, econ: 0.3, social: -0.1, charisma: 62 } },
  { id: 'passer', name: 'Passerine Commonwealth', short: 'Passeria', adj: 'Passerine', species: 'Sparrows & finches', gov: 'democracy', capital: 'Grainfield', color: '#c99a2e',
    pos: [0.6, 0.72], size: 1.2, gdp: 1100, pop: 160, debtPct: 50, exportShare: 0.26, importShare: 0.25, flag: ['#d68a00', '#1c6b3c', '#fdf6e3'],
    leader: { name: 'President Amara Weaver', aggression: 0.25, trade: 0.55, econ: -0.3, social: 0.2, charisma: 71 } },
];

export const LEADER_FIRST = ['Corin', 'Talia', 'Rurik', 'Selene', 'Bram', 'Odessa', 'Caspian', 'Ione', 'Dorian', 'Maren', 'Lucan', 'Petra', 'Evander', 'Liesel', 'Orrin', 'Wynne'];
export const LEADER_LAST = ['Quill', 'Talonworth', 'Brightwing', 'Ashcrest', 'Duskfeather', 'Stormbeak', 'Reedley', 'Hollowell', 'Marsh', 'Ironclaw', 'Sablewing', 'Pinion'];

// Laws: econ/social = ideological position (-1 left/progressive .. +1 right/traditional).
// fx: modifier contributions while active (see economy.js / citizens.js for meaning).
export const LAWS = [
  { id: 'healthcare', name: 'Universal Avian Healthcare Act', cat: 'Health', econ: -0.7, social: -0.2, desc: 'Guarantees public healthcare for every citizen.', fx: { spendHealth: 1.5, health: 14, popGrowth: 0.1 } },
  { id: 'minwage', name: 'Living Wage Act', cat: 'Labour', econ: -0.6, social: -0.1, desc: 'Raises the national minimum wage by 18%.', fx: { uStar: 0.6, infl: 0.3, lowIncome: 0.12, wage: 0.4 } },
  { id: 'corptax', name: 'Corporate Competitiveness Act', cat: 'Economy', econ: 0.7, social: 0.1, desc: 'Cuts corporate tax by 5 points and simplifies filing.', fx: { corpTaxDelta: -5, gStar: 0.3, confidence: 4 } },
  { id: 'carbon', name: 'Clean Skies Carbon Levy', cat: 'Environment', econ: -0.3, social: -0.6, desc: 'Prices carbon emissions; revenue funds green transition.', fx: { extraRev: 0.5, gStar: -0.1, infl: 0.2, sectorMood: { 1: -6 }, ideoMood: { canopy: 10 } } },
  { id: 'infra', name: 'National Infrastructure Act', cat: 'Economy', econ: -0.2, social: 0.0, desc: 'Ten-year programme for rail, ports and broadband.', fx: { spendInfra: 1.0, housing: 4, gStar: 0.25 } },
  { id: 'anticorr', name: 'Anti-Corruption Commission Act', cat: 'Justice', econ: 0.0, social: -0.2, desc: 'Independent commission with investigative powers.', fx: { corruption: -30, compliance: 0.04, scandalDetect: 0.6 } },
  { id: 'press', name: 'Press Freedom Act', cat: 'Rights', econ: 0.0, social: -0.5, desc: 'Shields journalists and opens government records.', fx: { freedom: 10, media: 10 } },
  { id: 'policing', name: 'Public Safety & Policing Act', cat: 'Security', econ: 0.1, social: 0.6, desc: 'More officers, tougher sentencing.', fx: { spendSecurity: 0.4, safety: 12, freedom: -5 } },
  { id: 'openskies', name: 'Open Skies Migration Act', cat: 'Migration', econ: 0.3, social: -0.7, desc: 'Expands work visas and refugee intake.', fx: { popGrowth: 0.4, gStar: 0.2, uStar: 0.2 }, excludes: 'border' },
  { id: 'border', name: 'Border Integrity Act', cat: 'Migration', econ: 0.1, social: 0.8, desc: 'Strict migration caps and new border patrols.', fx: { popGrowth: -0.3, safety: 4, gStar: -0.1 }, excludes: 'openskies' },
  { id: 'education', name: 'Education Excellence Act', cat: 'Education', econ: -0.3, social: -0.1, desc: 'Smaller classes, free university tuition.', fx: { spendEducation: 1.0, eduBoost: 1 } },
  { id: 'housing', name: 'Affordable Nests Housing Act', cat: 'Housing', econ: -0.5, social: -0.1, desc: '200,000 new public homes and rent stabilisation.', fx: { spendWelfare: 0.6, housing: 14, col: -0.04 } },
  { id: 'dereg', name: 'Business Deregulation Act', cat: 'Economy', econ: 0.8, social: 0.2, desc: 'Removes 40% of business regulations.', fx: { gStar: 0.35, safety: -2, corruption: 10, confidence: 5 } },
  { id: 'pension', name: 'Pension Reform Act', cat: 'Welfare', econ: 0.55, social: 0.2, desc: 'Raises the retirement age to 68.', fx: { spendWelfare: -1.0, pension: -0.12 } },
  { id: 'service', name: 'National Service Act', cat: 'Defense', econ: 0.1, social: 0.65, desc: 'One year of mandatory national service.', fx: { personnel: 0.5, freedom: -6, uStar: -0.3, youthMood: -8 } },
  { id: 'cbind', name: 'Central Bank Independence Act', cat: 'Economy', econ: 0.35, social: 0.0, desc: 'Locks in an independent, inflation-targeting central bank.', fx: { credibility: 0.35 } },
  { id: 'tariffs', name: 'Protective Tariffs Act', cat: 'Trade', econ: 0.0, social: 0.5, desc: '15% tariff on imported manufactured goods.', fx: { importMod: -0.15, tariffRev: 0.004, infl: 0.4, sectorMood: { 1: 8 }, tradeAnger: 8 } },
  { id: 'digital', name: 'Digital Government Initiative', cat: 'Admin', econ: 0.1, social: -0.1, desc: 'Moves all public services online.', fx: { compliance: 0.04, spendAdmin: -0.2, gStar: 0.05 } },
];

export const ORDERS = [
  { id: 'relief', name: 'Emergency Relief Payments', pc: 12, days: 1, desc: 'One-off ℗ payments to low-income households (0.5% of GDP).', court: 0.0 },
  { id: 'freeze', name: 'Public Hiring Freeze', pc: 8, days: 180, desc: 'Cuts administrative spending; slightly raises unemployment.', court: 0.05 },
  { id: 'pricecap', name: 'Price Controls on Staples', pc: 15, days: 90, desc: 'Caps food prices. Lowers inflation now, risks shortages.', court: 0.25 },
  { id: 'reserves', name: 'Release Strategic Grain Reserves', pc: 6, days: 60, desc: 'Eases food costs for two months.', court: 0.0 },
  { id: 'borderlock', name: 'Tighten Border Controls', pc: 10, days: 120, desc: 'Boosts border security; irritates neighbours and slows trade.', court: 0.1 },
  { id: 'fasttrack', name: 'Fast-Track Infrastructure Permits', pc: 10, days: 365, desc: 'Speeds construction; angers environmental groups.', court: 0.2 },
  { id: 'paybump', name: 'Public Sector Pay Raise', pc: 8, days: 365, desc: 'Raises public wages 4%; costs 0.3% of GDP per year.', court: 0.0 },
  { id: 'lobbyban', name: 'Ban Lobbyist Gifts', pc: 9, days: 365, desc: 'Reduces corruption; annoys parliamentarians.', court: 0.1 },
  { id: 'stimulus', name: 'Business Stimulus Grants', pc: 14, days: 180, desc: 'Grants worth 0.6% of GDP/yr to firms. Boosts demand.', court: 0.05 },
  { id: 'curfew', name: 'Nationwide Curfew', pc: 18, days: 30, desc: 'Emergency only. Suppresses unrest, sharply curbs freedom.', court: 0.3, emergency: true },
];

export const RESEARCH = [
  { id: 'drones', name: 'Autonomous Drone Wings', cost: 6, months: 8, desc: 'Air power +15%.', fx: { air: 0.15 } },
  { id: 'radar', name: 'Integrated Radar Network', cost: 4, months: 6, desc: 'Border security +15, air defence.', fx: { border: 15, air: 0.05 } },
  { id: 'stealth', name: 'Stealth Plumage Coating', cost: 9, months: 12, desc: 'Air power +12%, technology +1.', fx: { air: 0.12, tech: 1 } },
  { id: 'carriers', name: 'Nest-class Carriers', cost: 12, months: 14, desc: 'Naval power +25%.', fx: { navy: 0.25 } },
  { id: 'armor', name: 'Talon Armoured Corps', cost: 7, months: 9, desc: 'Ground power +20%.', fx: { ground: 0.2 } },
  { id: 'cyber', name: 'Cyber Command', cost: 5, months: 7, desc: 'Technology +1, protects against cyber attacks.', fx: { tech: 1, cyber: 1 } },
];

export const OUTLETS = [
  { id: 'herald', name: 'The Plumeria Herald', slant: 0 },
  { id: 'nest', name: 'Nest Daily', slant: 1 },
  { id: 'canopy', name: 'The Canopy Times', slant: -1 },
  { id: 'biz', name: 'Aviania Business Wire', slant: 0.3 },
  { id: 'wws', name: 'World Wing Service', slant: 0, intl: true },
];

export const BUDGET_KEYS = ['health', 'education', 'welfare', 'infrastructure', 'defense', 'security', 'research', 'admin'];
export const BUDGET_LABELS = { health: 'Health', education: 'Education', welfare: 'Welfare & pensions', infrastructure: 'Infrastructure', defense: 'Defense', security: 'Police & security', research: 'Research', admin: 'Administration' };
export const DEFAULT_BUDGET = { health: 4.5, education: 4.0, welfare: 5.2, infrastructure: 2.5, defense: 2.0, security: 1.0, research: 0.7, admin: 1.3 };
export const DEFAULT_TAXES = { income: 28, corporate: 21, sales: 11 };
