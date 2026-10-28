// Professional Curated Vector Stickers for Elite Edition Communication Panel
// Fully self-contained SVG Data URIs with zero network latency, retina-sharp display, and transparent background.

const encodeSvg = (svgString) => `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;

export const STICKER_PACKS = [
  { id: 'workplace', name: '🏢 Office & Approvals', icon: 'CheckCircle' },
  { id: 'textile', name: '🧵 Textile & Factory', icon: 'Layers' },
  { id: 'reactions', name: '🔥 Big Reactions', icon: 'Sparkles' },
  { id: 'mascots', name: '🐼 Cute Mascots', icon: 'Smile' }
];

export const STICKERS = [
  // ==========================================
  // PACK 1: WORKPLACE & APPROVALS
  // ==========================================
  {
    id: 'stk_approved',
    title: 'Approved ✅',
    pack: 'workplace',
    tags: ['approved', 'yes', 'ok', 'verified', 'done', 'accept', 'green'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <defs>
          <linearGradient id="gApp" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#10b981"/>
            <stop offset="100%" stop-color="#047857"/>
          </linearGradient>
          <filter id="fApp" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#064e3b" flood-opacity="0.3"/>
          </filter>
        </defs>
        <circle cx="90" cy="90" r="78" fill="url(#gApp)" filter="url(#fApp)" stroke="#6ee7b7" stroke-width="3" stroke-dasharray="6 3"/>
        <circle cx="90" cy="90" r="68" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.5"/>
        <path d="M60 90 L80 110 L122 66" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="90" y="142" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#ffffff" letter-spacing="2">APPROVED</text>
        <polygon points="90,20 93,29 102,29 95,35 97,44 90,39 83,44 85,35 78,29 87,29" fill="#fbbf24"/>
      </svg>
    `)
  },
  {
    id: 'stk_rush_order',
    title: 'Rush Order ⚡',
    pack: 'workplace',
    tags: ['urgent', 'rush', 'sos', 'fast', 'asap', 'speed', 'priority', 'red'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <defs>
          <linearGradient id="gRush" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ef4444"/>
            <stop offset="100%" stop-color="#991b1b"/>
          </linearGradient>
          <filter id="fRush" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#7f1d1d" flood-opacity="0.35"/>
          </filter>
        </defs>
        <polygon points="90,12 165,150 15,150" fill="url(#gRush)" filter="url(#fRush)" stroke="#fca5a5" stroke-width="3" stroke-linejoin="round"/>
        <path d="M96 50 L74 96 L92 96 L82 135 L112 86 L94 86 Z" fill="#fbbf24" stroke="#ffffff" stroke-width="1.5"/>
        <text x="90" y="168" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#ffffff" letter-spacing="1">RUSH ORDER</text>
      </svg>
    `)
  },
  {
    id: 'stk_task_done',
    title: 'Completed ✅',
    pack: 'workplace',
    tags: ['done', 'completed', 'finished', 'task', 'ready', 'success'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <defs>
          <linearGradient id="gDone" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#3b82f6"/>
            <stop offset="100%" stop-color="#1d4ed8"/>
          </linearGradient>
        </defs>
        <rect x="20" y="20" width="140" height="140" rx="36" fill="url(#gDone)" stroke="#93c5fd" stroke-width="3"/>
        <circle cx="90" cy="78" r="38" fill="#ffffff" opacity="0.2"/>
        <path d="M66 80 L82 96 L116 60" fill="none" stroke="#ffffff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="90" y="138" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="15" fill="#ffffff" letter-spacing="1.5">TASK DONE</text>
      </svg>
    `)
  },
  {
    id: 'stk_in_progress',
    title: 'In Progress 🔄',
    pack: 'workplace',
    tags: ['progress', 'working', 'process', 'doing', 'update'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <defs>
          <linearGradient id="gProg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0ea5e9"/>
            <stop offset="100%" stop-color="#0369a1"/>
          </linearGradient>
        </defs>
        <circle cx="90" cy="90" r="76" fill="url(#gProg)" stroke="#bae6fd" stroke-width="3"/>
        <path d="M90 40 A50 50 0 1 1 45 105" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/>
        <polygon points="45,92 36,112 58,112" fill="#ffffff"/>
        <text x="90" y="98" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#ffffff" letter-spacing="1">IN PROGRESS</text>
      </svg>
    `)
  },
  {
    id: 'stk_on_it',
    title: "I'm On It ⚡",
    pack: 'workplace',
    tags: ['on it', 'working', 'taking care', 'fast', 'assigned', 'action'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#8b5cf6" stroke="#c4b5fd" stroke-width="3"/>
        <path d="M100 35 L65 95 L95 95 L80 145 L125 80 L95 80 Z" fill="#fde047" stroke="#ffffff" stroke-width="2"/>
        <text x="90" y="156" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#ffffff" letter-spacing="1.5">I'M ON IT! ⚡</text>
      </svg>
    `)
  },
  {
    id: 'stk_noted',
    title: 'Noted 📝',
    pack: 'workplace',
    tags: ['noted', 'ok', 'understood', 'copy that', 'record', 'write'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#0284c7" stroke="#7dd3fc" stroke-width="3"/>
        <rect x="55" y="45" width="70" height="85" rx="8" fill="#ffffff"/>
        <line x1="70" y1="65" x2="110" y2="65" stroke="#0284c7" stroke-width="4" stroke-linecap="round"/>
        <line x1="70" y1="80" x2="110" y2="80" stroke="#0284c7" stroke-width="4" stroke-linecap="round"/>
        <line x1="70" y1="95" x2="95" y2="95" stroke="#0284c7" stroke-width="4" stroke-linecap="round"/>
        <path d="M100 110 L130 80" stroke="#f59e0b" stroke-width="6" stroke-linecap="round"/>
        <text x="90" y="154" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#ffffff" letter-spacing="1.5">NOTED! 📝</text>
      </svg>
    `)
  },
  {
    id: 'stk_payment_received',
    title: 'Payment Received 💰',
    pack: 'workplace',
    tags: ['payment', 'paid', 'money', 'received', 'cash', 'invoice', 'bank'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#047857" stroke="#6ee7b7" stroke-width="3"/>
        <circle cx="90" cy="80" r="40" fill="#10b981" stroke="#ffffff" stroke-width="3"/>
        <text x="90" y="93" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="38" fill="#ffffff">₹</text>
        <rect x="25" y="132" width="130" height="26" rx="6" fill="#064e3b"/>
        <text x="90" y="150" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="11" fill="#a7f3d0" letter-spacing="1">PAYMENT RECEIVED</text>
      </svg>
    `)
  },
  {
    id: 'stk_target_met',
    title: 'Target Met 🎯',
    pack: 'workplace',
    tags: ['target', 'goal', 'hit', 'score', 'bullseye', 'achieve', 'win'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="85" r="70" fill="#f87171" stroke="#ffffff" stroke-width="3"/>
        <circle cx="90" cy="85" r="52" fill="#ffffff"/>
        <circle cx="90" cy="85" r="36" fill="#ef4444"/>
        <circle cx="90" cy="85" r="18" fill="#fbbf24"/>
        <polygon points="90,85 140,40 145,45 95,90" fill="#1e293b"/>
        <polygon points="135,35 155,30 150,50" fill="#e11d48"/>
        <rect x="25" y="145" width="130" height="26" rx="8" fill="#1e293b"/>
        <text x="90" y="163" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#fbbf24" letter-spacing="1.5">TARGET ACHIEVED</text>
      </svg>
    `)
  },
  {
    id: 'stk_deal_closed',
    title: 'Deal Closed 🤝',
    pack: 'workplace',
    tags: ['deal', 'handshake', 'partner', 'agreement', 'client', 'win'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#4f46e5" stroke="#c7d2fe" stroke-width="3"/>
        <path d="M45 100 L70 75 L85 90 L100 75 L135 105" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="90" cy="85" r="10" fill="#fbbf24"/>
        <rect x="35" y="128" width="110" height="24" rx="6" fill="#1e1b4b"/>
        <text x="90" y="145" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="11" fill="#c7d2fe" letter-spacing="1.5">DEAL CLOSED 🤝</text>
      </svg>
    `)
  },

  // ==========================================
  // PACK 2: TEXTILE & FACTORY
  // ==========================================
  {
    id: 'stk_elite_fabric',
    title: 'Elite Fabric 👑',
    pack: 'textile',
    tags: ['elite', 'fabric', 'luxury', 'royal', 'purple', 'textile', 'swatch'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <rect x="20" y="20" width="140" height="140" rx="30" fill="#7e22ce" stroke="#e9d5ff" stroke-width="3"/>
        <path d="M50 50 Q90 30 130 50 Q110 90 130 130 Q90 110 50 130 Q70 90 50 50 Z" fill="none" stroke="#fbcfe8" stroke-width="3" stroke-dasharray="4 3"/>
        <polygon points="65,95 75,70 90,85 105,70 115,95" fill="#fbbf24" stroke="#ffffff" stroke-width="1.5"/>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#ffffff" letter-spacing="2">ELITE EDITION</text>
        <text x="90" y="148" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="10" fill="#fde68a" letter-spacing="1">PREMIUM TEXTILE</text>
      </svg>
    `)
  },
  {
    id: 'stk_stitch_perfect',
    title: 'Stitch Perfect 🧵',
    pack: 'textile',
    tags: ['stitch', 'stitching', 'spool', 'thread', 'sewing', 'garment'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#0284c7" stroke="#bae6fd" stroke-width="3"/>
        <rect x="65" y="45" width="50" height="70" rx="6" fill="#e0f2fe"/>
        <ellipse cx="90" cy="45" rx="28" ry="10" fill="#94a3b8"/>
        <ellipse cx="90" cy="115" rx="28" ry="10" fill="#94a3b8"/>
        <line x1="65" y1="65" x2="115" y2="65" stroke="#0284c7" stroke-width="3"/>
        <line x1="65" y1="80" x2="115" y2="80" stroke="#0284c7" stroke-width="3"/>
        <line x1="65" y1="95" x2="115" y2="95" stroke="#0284c7" stroke-width="3"/>
        <path d="M125 50 L140 120" stroke="#fbbf24" stroke-width="4" stroke-linecap="round"/>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#ffffff" letter-spacing="1.5">STITCH PERFECT</text>
      </svg>
    `)
  },
  {
    id: 'stk_cutting_done',
    title: 'Cutting Done ✂️',
    pack: 'textile',
    tags: ['cutting', 'scissors', 'fabric', 'cut', 'done', 'job'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#0f766e" stroke="#99f6e4" stroke-width="3"/>
        <circle cx="68" cy="112" r="16" fill="none" stroke="#ffffff" stroke-width="6"/>
        <circle cx="112" cy="112" r="16" fill="none" stroke="#ffffff" stroke-width="6"/>
        <line x1="78" y1="100" x2="120" y2="52" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>
        <line x1="102" y1="100" x2="60" y2="52" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>
        <circle cx="90" cy="76" r="5" fill="#facc15"/>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#ffffff" letter-spacing="1.5">CUTTING READY</text>
      </svg>
    `)
  },
  {
    id: 'stk_qc_passed',
    title: 'QC Passed 🏅',
    pack: 'textile',
    tags: ['qc', 'quality', 'passed', 'inspection', 'gold', 'medal'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="75" r="55" fill="#f59e0b" stroke="#fef3c7" stroke-width="3"/>
        <circle cx="90" cy="75" r="44" fill="#d97706"/>
        <text x="90" y="70" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="24" fill="#ffffff">QC</text>
        <text x="90" y="90" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12" fill="#fef3c7" letter-spacing="1">PASSED</text>
        <polygon points="70,120 60,165 90,148 120,165 110,120" fill="#dc2626"/>
      </svg>
    `)
  },
  {
    id: 'stk_dispatch_today',
    title: 'Dispatch Today 🚚',
    pack: 'textile',
    tags: ['dispatch', 'truck', 'delivery', 'shipping', 'transport', 'today'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#1e293b" stroke="#475569" stroke-width="3"/>
        <rect x="40" y="65" width="55" height="40" rx="4" fill="#3b82f6"/>
        <path d="M95 75 L120 75 L130 90 L130 105 L95 105 Z" fill="#60a5fa"/>
        <circle cx="62" cy="110" r="10" fill="#fbbf24"/>
        <circle cx="115" cy="110" r="10" fill="#fbbf24"/>
        <text x="90" y="146" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#60a5fa" letter-spacing="1.5">DISPATCH TODAY</text>
      </svg>
    `)
  },

  // ==========================================
  // PACK 3: BIG REACTIONS
  // ==========================================
  {
    id: 'stk_thumbs_up_king',
    title: 'Superb! 👍',
    pack: 'reactions',
    tags: ['thumbs', 'up', 'great', 'awesome', 'like', 'super', 'gold'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#f59e0b" stroke="#fde68a" stroke-width="4"/>
        <g transform="translate(48, 42) scale(0.9)">
          <path d="M42 22 C42 12 36 6 28 6 C24 6 20 10 20 18 L20 32 L10 32 C4 32 0 36 0 42 L0 74 C0 80 4 84 10 84 L56 84 C64 84 72 78 74 70 L80 46 C82 38 76 32 68 32 L46 32 L46 22 Z" fill="#ffffff"/>
        </g>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#78350f" letter-spacing="1.5">SUPERB! 👍</text>
      </svg>
    `)
  },
  {
    id: 'stk_fire_lit',
    title: "It's Fire! 🔥",
    pack: 'reactions',
    tags: ['fire', 'flame', 'lit', 'hot', 'epic', 'trending', 'awesome'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#7c2d12" stroke="#ea580c" stroke-width="3"/>
        <path d="M90 25 C95 50 115 65 125 90 C135 115 120 145 90 148 C60 145 45 115 55 90 C65 65 85 50 90 25 Z" fill="#f97316"/>
        <path d="M90 60 C93 75 105 85 110 100 C115 115 105 135 90 138 C75 135 65 115 70 100 C75 85 87 75 90 60 Z" fill="#fde047"/>
        <text x="90" y="165" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#fed7aa" letter-spacing="1.5">IT'S FIRE! 🔥</text>
      </svg>
    `)
  },
  {
    id: 'stk_big_heart',
    title: 'Love It ❤️',
    pack: 'reactions',
    tags: ['love', 'heart', 'adore', 'care', 'sweet', 'red'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#be123c" stroke="#fecdd3" stroke-width="3"/>
        <path d="M90 130 C90 130 50 100 40 75 C30 50 50 35 70 45 C80 50 90 60 90 60 C90 60 100 50 110 45 C130 35 150 50 140 75 C130 100 90 130 90 130 Z" fill="#f43f5e" stroke="#ffffff" stroke-width="3"/>
        <text x="90" y="158" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#ffffff" letter-spacing="1.5">LOVE IT! ❤️</text>
      </svg>
    `)
  },
  {
    id: 'stk_rofl_laugh',
    title: 'LOL Hahaha 🤣',
    pack: 'reactions',
    tags: ['laugh', 'rofl', 'lol', 'funny', 'haha', 'joke', 'crying'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#eab308" stroke="#fef08a" stroke-width="3"/>
        <text x="90" y="100" text-anchor="middle" font-size="58">🤣</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#713f12" letter-spacing="1.5">HAHAHA! 🤣</text>
      </svg>
    `)
  },
  {
    id: 'stk_mind_blown',
    title: 'Mind Blown 🤯',
    pack: 'reactions',
    tags: ['mind', 'blown', 'shock', 'wow', 'insane', 'crazy', 'galaxy'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#312e81" stroke="#818cf8" stroke-width="3"/>
        <circle cx="90" cy="105" r="42" fill="#fbbf24"/>
        <circle cx="76" cy="98" r="6" fill="#1e1b4b"/>
        <circle cx="104" cy="98" r="6" fill="#1e1b4b"/>
        <ellipse cx="90" cy="120" rx="14" ry="10" fill="#1e1b4b"/>
        <polygon points="90,20 105,45 130,35 125,60 150,68 130,85 140,110 115,100 100,120 90,100 80,120 65,100 40,110 50,85 30,68 55,60 50,35 75,45" fill="#f43f5e"/>
        <text x="90" y="165" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#a5b4fc" letter-spacing="1">MIND BLOWN!</text>
      </svg>
    `)
  },
  {
    id: 'stk_applause',
    title: 'Bravo! 👏',
    pack: 'reactions',
    tags: ['bravo', 'applause', 'clap', 'clapping', 'hands', 'good job', 'well done'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#8b5cf6" stroke="#ddd6fe" stroke-width="3"/>
        <text x="90" y="95" text-anchor="middle" font-size="52">👏</text>
        <text x="90" y="145" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#ffffff" letter-spacing="2">BRAVO! ⭐</text>
      </svg>
    `)
  },
  {
    id: 'stk_thank_you',
    title: 'Thank You! 🙏',
    pack: 'reactions',
    tags: ['thanks', 'thank you', 'namaste', 'gratitude', 'bless', 'grateful'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#10b981" stroke="#a7f3d0" stroke-width="3"/>
        <text x="90" y="95" text-anchor="middle" font-size="52">🙏</text>
        <text x="90" y="145" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#ffffff" letter-spacing="1.5">THANK YOU!</text>
      </svg>
    `)
  },

  // ==========================================
  // PACK 4: CUTE MASCOTS & EMOTES
  // ==========================================
  {
    id: 'stk_salute_panda',
    title: 'Salute Panda 🐼',
    pack: 'mascots',
    tags: ['panda', 'salute', 'yes sir', 'roger', 'cute', 'animal'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="3"/>
        <circle cx="56" cy="54" r="18" fill="#1e293b"/>
        <circle cx="124" cy="54" r="18" fill="#1e293b"/>
        <circle cx="90" cy="94" r="48" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>
        <ellipse cx="72" cy="90" rx="12" ry="16" fill="#1e293b"/>
        <ellipse cx="108" cy="90" rx="12" ry="16" fill="#1e293b"/>
        <circle cx="74" cy="88" r="4" fill="#ffffff"/>
        <circle cx="106" cy="88" r="4" fill="#ffffff"/>
        <ellipse cx="90" cy="106" rx="6" ry="4" fill="#1e293b"/>
        <path d="M84 114 Q90 120 96 114" fill="none" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M125 110 L140 76 L118 78" fill="none" stroke="#1e293b" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="90" y="160" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="11" fill="#475569" letter-spacing="1">ROGER THAT! 🫡</text>
      </svg>
    `)
  },
  {
    id: 'stk_shiba_thumbs',
    title: 'Happy Doggo 🐕',
    pack: 'mascots',
    tags: ['shiba', 'dog', 'doggo', 'puppy', 'cute', 'thumbs up'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fef3c7" stroke="#fde68a" stroke-width="3"/>
        <text x="90" y="98" text-anchor="middle" font-size="56">🐶</text>
        <text x="90" y="150" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#b45309" letter-spacing="1">GOOD JOB! 🦴</text>
      </svg>
    `)
  },
  {
    id: 'stk_coding_cat',
    title: 'Hustle Cat 🐱',
    pack: 'mascots',
    tags: ['cat', 'kitten', 'hustle', 'work', 'typing', 'busy'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#e0e7ff" stroke="#c7d2fe" stroke-width="3"/>
        <text x="90" y="98" text-anchor="middle" font-size="56">🐱</text>
        <text x="90" y="150" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#4338ca" letter-spacing="1">HARD WORK! 💻</text>
      </svg>
    `)
  },
  {
    id: 'stk_party_penguin',
    title: 'Party Penguin 🐧',
    pack: 'mascots',
    tags: ['penguin', 'party', 'dance', 'fun', 'happy', 'cool'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#cffafe" stroke="#a5f3fc" stroke-width="3"/>
        <text x="90" y="98" text-anchor="middle" font-size="56">🐧</text>
        <text x="90" y="150" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#0e7490" letter-spacing="1">LET'S PARTY! 🎈</text>
      </svg>
    `)
  }
];
