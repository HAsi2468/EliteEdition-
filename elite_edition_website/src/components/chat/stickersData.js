// Professional Curated Vector Stickers for Elite Edition Communication Panel
// Fully self-contained SVG Data URIs with zero network latency, retina-sharp display, and transparent background.

const encodeSvg = (svgString) => `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;

export const STICKER_PACKS = [
  { id: 'workplace', name: '🏢 Office & Approvals', icon: 'CheckCircle' },
  { id: 'greetings', name: '🇮🇳 Desi & Greetings', icon: 'Smile' },
  { id: 'reactions', name: '🔥 Big 3D Reactions', icon: 'Sparkles' },
  { id: 'textile', name: '🧵 Textile & Factory', icon: 'Layers' },
  { id: 'mascots', name: '🐼 Memes & Mascots', icon: 'Smile' },
  { id: 'custom', name: '✨ My Stickers', icon: 'Image' }
];

export const STICKERS = [
  // ==========================================
  // PACK 1: WORKPLACE & APPROVALS (22 Stickers)
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
        </defs>
        <circle cx="90" cy="90" r="78" fill="url(#gApp)" stroke="#6ee7b7" stroke-width="3" stroke-dasharray="6 3"/>
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
        </defs>
        <polygon points="90,12 165,150 15,150" fill="url(#gRush)" stroke="#fca5a5" stroke-width="3" stroke-linejoin="round"/>
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
    id: 'stk_urgent_sos',
    title: 'Urgent SOS 🚨',
    pack: 'workplace',
    tags: ['sos', 'urgent', 'alert', 'help', 'critical', 'danger'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <defs>
          <radialGradient id="gSos" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#f87171"/>
            <stop offset="100%" stop-color="#b91c1c"/>
          </radialGradient>
        </defs>
        <rect x="15" y="15" width="150" height="150" rx="30" fill="url(#gSos)" stroke="#fecaca" stroke-width="4"/>
        <text x="90" y="85" text-anchor="middle" font-size="44">🚨</text>
        <text x="90" y="135" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="18" fill="#ffffff" letter-spacing="2">URGENT SOS</text>
      </svg>
    `)
  },
  {
    id: 'stk_rejected',
    title: 'Rejected ❌',
    pack: 'workplace',
    tags: ['rejected', 'no', 'decline', 'cancel', 'failed', 'cross'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fef2f2" stroke="#ef4444" stroke-width="4"/>
        <circle cx="90" cy="90" r="66" fill="#fee2e2"/>
        <path d="M62 62 L118 118 M118 62 L62 118" stroke="#dc2626" stroke-width="12" stroke-linecap="round"/>
        <text x="90" y="150" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#991b1b" letter-spacing="2">REJECTED</text>
      </svg>
    `)
  },
  {
    id: 'stk_priority_one',
    title: 'Priority #1 🥇',
    pack: 'workplace',
    tags: ['priority', 'top', 'first', 'one', 'gold', 'vip'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <defs>
          <linearGradient id="gP1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f59e0b"/>
            <stop offset="100%" stop-color="#d97706"/>
          </linearGradient>
        </defs>
        <polygon points="90,15 110,60 160,65 122,100 132,150 90,125 48,150 58,100 20,65 70,60" fill="url(#gP1)" stroke="#fde68a" stroke-width="3"/>
        <text x="90" y="105" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="28" fill="#ffffff">#1</text>
        <text x="90" y="172" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#78350f" letter-spacing="1">PRIORITY</text>
      </svg>
    `)
  },
  {
    id: 'stk_payment_received',
    title: 'Payment Received 💰',
    pack: 'workplace',
    tags: ['payment', 'paid', 'cash', 'money', 'received', 'bank', 'neft'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#ecfdf5" stroke="#10b981" stroke-width="4"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">💵</text>
        <text x="90" y="128" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#065f46" letter-spacing="1">PAYMENT</text>
        <text x="90" y="148" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#047857" letter-spacing="1">RECEIVED ✅</text>
      </svg>
    `)
  },
  {
    id: 'stk_target_met',
    title: 'Target Met 🎯',
    pack: 'workplace',
    tags: ['target', 'goal', 'bullseye', 'achieved', 'sales', 'win'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#eff6ff" stroke="#3b82f6" stroke-width="3"/>
        <text x="90" y="90" text-anchor="middle" font-size="52">🎯</text>
        <text x="90" y="142" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#1e40af" letter-spacing="1">TARGET MET 🎯</text>
      </svg>
    `)
  },
  {
    id: 'stk_under_review',
    title: 'Under Review 🧐',
    pack: 'workplace',
    tags: ['review', 'checking', 'audit', 'inspect', 'verify', 'wait'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fefce8" stroke="#ca8a04" stroke-width="3"/>
        <text x="90" y="90" text-anchor="middle" font-size="50">🧐</text>
        <text x="90" y="142" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#854d0e" letter-spacing="1">UNDER REVIEW</text>
      </svg>
    `)
  },
  {
    id: 'stk_deal_closed',
    title: 'Deal Closed 🤝',
    pack: 'workplace',
    tags: ['deal', 'handshake', 'contract', 'agreement', 'partner'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#f0fdf4" stroke="#22c55e" stroke-width="3"/>
        <text x="90" y="90" text-anchor="middle" font-size="52">🤝</text>
        <text x="90" y="142" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#15803d" letter-spacing="1">DEAL CLOSED!</text>
      </svg>
    `)
  },
  {
    id: 'stk_roger_that',
    title: 'Roger That 🫡',
    pack: 'workplace',
    tags: ['roger', 'salute', 'noted', 'yes', 'copy', 'acknowledged'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#f1f5f9" stroke="#64748b" stroke-width="3"/>
        <text x="90" y="90" text-anchor="middle" font-size="52">🫡</text>
        <text x="90" y="142" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#334155" letter-spacing="1">ROGER THAT!</text>
      </svg>
    `)
  },
  {
    id: 'stk_qc_passed',
    title: 'Quality Passed 🏆',
    pack: 'workplace',
    tags: ['quality', 'qc', 'passed', 'tested', 'perfect', 'gold'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fffbeb" stroke="#f59e0b" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="48">🏆</text>
        <text x="90" y="128" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#b45309" letter-spacing="1">QC PASSED</text>
        <text x="90" y="146" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" fill="#d97706">100% VERIFIED</text>
      </svg>
    `)
  },
  {
    id: 'stk_meeting_now',
    title: 'Meeting Now 📅',
    pack: 'workplace',
    tags: ['meeting', 'calendar', 'call', 'discuss', 'conference'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <rect x="20" y="20" width="140" height="140" rx="28" fill="#eff6ff" stroke="#3b82f6" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="46">📅</text>
        <text x="90" y="135" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#1d4ed8" letter-spacing="1">MEETING NOW</text>
      </svg>
    `)
  },
  {
    id: 'stk_noted',
    title: 'Noted 📝',
    pack: 'workplace',
    tags: ['noted', 'written', 'pencil', 'record', 'got it'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fdf4ff" stroke="#c084fc" stroke-width="3"/>
        <text x="90" y="88" text-anchor="middle" font-size="50">📝</text>
        <text x="90" y="142" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#7e22ce" letter-spacing="1">NOTED ✍️</text>
      </svg>
    `)
  },
  {
    id: 'stk_invoice_cleared',
    title: 'Invoice Cleared 🧾',
    pack: 'workplace',
    tags: ['invoice', 'bill', 'receipt', 'cleared', 'paid', 'accounts'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <rect x="25" y="20" width="130" height="140" rx="16" fill="#ecfdf5" stroke="#059669" stroke-width="3"/>
        <text x="90" y="80" text-anchor="middle" font-size="46">🧾</text>
        <text x="90" y="125" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#047857" letter-spacing="1">INVOICE</text>
        <text x="90" y="145" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#065f46" letter-spacing="1">CLEARED ✅</text>
      </svg>
    `)
  },
  {
    id: 'stk_looking_into',
    title: 'Looking Into It 🔍',
    pack: 'workplace',
    tags: ['search', 'investigate', 'check', 'audit', 'examining'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#f8fafc" stroke="#475569" stroke-width="3"/>
        <text x="90" y="88" text-anchor="middle" font-size="50">🔍</text>
        <text x="90" y="142" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#1e293b" letter-spacing="1">LOOKING INTO IT</text>
      </svg>
    `)
  },
  {
    id: 'stk_pending_dispatch',
    title: 'Pending Dispatch ⏳',
    pack: 'workplace',
    tags: ['pending', 'wait', 'dispatch', 'hourglass', 'time'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fff7ed" stroke="#ea580c" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="48">⏳</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#c2410c" letter-spacing="1">PENDING</text>
        <text x="90" y="148" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="11" fill="#9a3412">DISPATCH</text>
      </svg>
    `)
  },
  {
    id: 'stk_dispatched',
    title: 'Dispatched 🚚',
    pack: 'workplace',
    tags: ['dispatched', 'truck', 'shipped', 'on the way', 'delivery'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#f0fdf4" stroke="#16a34a" stroke-width="3"/>
        <text x="90" y="88" text-anchor="middle" font-size="50">🚚</text>
        <text x="90" y="142" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#15803d" letter-spacing="1">DISPATCHED! 🚀</text>
      </svg>
    `)
  },
  {
    id: 'stk_call_me',
    title: 'Call Me 📞',
    pack: 'workplace',
    tags: ['call', 'phone', 'ring', 'urgent', 'speak'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#eff6ff" stroke="#2563eb" stroke-width="3"/>
        <text x="90" y="88" text-anchor="middle" font-size="50">📞</text>
        <text x="90" y="142" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#1e40af" letter-spacing="1">CALL ME ASAP</text>
      </svg>
    `)
  },
  {
    id: 'stk_coffee_break',
    title: 'Chai Break ☕',
    pack: 'workplace',
    tags: ['coffee', 'tea', 'chai', 'break', 'relax'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fffbeb" stroke="#b45309" stroke-width="3"/>
        <text x="90" y="88" text-anchor="middle" font-size="50">☕</text>
        <text x="90" y="142" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#92400e" letter-spacing="1">CHAI BREAK ☕</text>
      </svg>
    `)
  },
  {
    id: 'stk_confidential',
    title: 'Confidential 🔒',
    pack: 'workplace',
    tags: ['secret', 'lock', 'secure', 'private', 'confidential'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#f8fafc" stroke="#334155" stroke-width="3"/>
        <text x="90" y="88" text-anchor="middle" font-size="50">🔒</text>
        <text x="90" y="142" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#0f172a" letter-spacing="1">STRICTLY PRIVATE</text>
      </svg>
    `)
  },

  // ==========================================
  // PACK 2: INDIAN & DAILY GREETINGS (22 Stickers)
  // ==========================================
  {
    id: 'stk_namaste',
    title: 'Namaste 🙏',
    pack: 'greetings',
    tags: ['namaste', 'pranam', 'hello', 'respect', 'indian', 'welcome'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <defs>
          <linearGradient id="gNam" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffedd5"/>
            <stop offset="100%" stop-color="#fed7aa"/>
          </linearGradient>
        </defs>
        <circle cx="90" cy="90" r="76" fill="url(#gNam)" stroke="#ea580c" stroke-width="3.5"/>
        <text x="90" y="88" text-anchor="middle" font-size="52">🙏</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="16" fill="#c2410c" letter-spacing="2">NAMASTE</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" fill="#ea580c">नमस्ते 🙏</text>
      </svg>
    `)
  },
  {
    id: 'stk_jsk',
    title: 'Jai Shri Krishna 🪷',
    pack: 'greetings',
    tags: ['jsk', 'krishna', 'radhe', 'blessing', 'greeting', 'mumbai', 'gujarat'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fdf4ff" stroke="#a855f7" stroke-width="3.5"/>
        <text x="90" y="84" text-anchor="middle" font-size="46">🪷</text>
        <text x="90" y="128" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#7e22ce" letter-spacing="1">JAI SHRI KRISHNA</text>
        <text x="90" y="148" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12" fill="#9333ea">जय श्री कृष्णा ✨</text>
      </svg>
    `)
  },
  {
    id: 'stk_radhe_radhe',
    title: 'Radhe Radhe ✨',
    pack: 'greetings',
    tags: ['radhe', 'vrindavan', 'krishna', 'peace', 'bhakti', 'pure'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fff1f2" stroke="#f43f5e" stroke-width="3"/>
        <text x="90" y="84" text-anchor="middle" font-size="48">✨</text>
        <text x="90" y="128" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="15" fill="#be123c" letter-spacing="1.5">RADHE RADHE</text>
        <text x="90" y="148" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12" fill="#e11d48">राधे राधे 🪷</text>
      </svg>
    `)
  },
  {
    id: 'stk_shabaash',
    title: 'Shabaash! 👏',
    pack: 'greetings',
    tags: ['shabaash', 'well done', 'kudos', 'bravo', 'applause', 'desi'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#ecfdf5" stroke="#059669" stroke-width="3.5"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">👏</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="16" fill="#047857" letter-spacing="1">SHABAASH!</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12" fill="#059669">शाबाश! 🌟</text>
      </svg>
    `)
  },
  {
    id: 'stk_badhai_ho',
    title: 'Badhai Ho! 🎉',
    pack: 'greetings',
    tags: ['badhai', 'congrats', 'celebrate', 'mubarak', 'party', 'happy'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fdf2f8" stroke="#db2777" stroke-width="3.5"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">🎉</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="16" fill="#be185d" letter-spacing="1">BADHAI HO!</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12" fill="#e11d48">बधाई हो 🎊</text>
      </svg>
    `)
  },
  {
    id: 'stk_chai_time',
    title: 'Garam Chai ☕',
    pack: 'greetings',
    tags: ['chai', 'garam', 'tea', 'tapri', 'refresh', 'desi'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fef3c7" stroke="#d97706" stroke-width="3.5"/>
        <text x="90" y="85" text-anchor="middle" font-size="52">☕</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="15" fill="#92400e" letter-spacing="1">CHAI TIME ☕</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12" fill="#b45309">गरम चाय!</text>
      </svg>
    `)
  },
  {
    id: 'stk_arre_waah',
    title: 'Arre Waah! 🤩',
    pack: 'greetings',
    tags: ['arre', 'waah', 'super', 'awesome', 'wow', 'mindblowing', 'desi'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#f0fdfa" stroke="#0d9488" stroke-width="3.5"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">🤩</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="16" fill="#0f766e" letter-spacing="1">ARRE WAAH!</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12" fill="#14b8a6">अरे वाह! ⭐</text>
      </svg>
    `)
  },
  {
    id: 'stk_shukriya',
    title: 'Dil Se Shukriya 🙏',
    pack: 'greetings',
    tags: ['shukriya', 'thank you', 'thanks', 'gratitude', 'heart', 'dil'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fef2f2" stroke="#e11d48" stroke-width="3.5"/>
        <text x="90" y="85" text-anchor="middle" font-size="48">❤️</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#9f1239" letter-spacing="1">DIL SE SHUKRIYA</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12" fill="#e11d48">शुक्रिया 🙏</text>
      </svg>
    `)
  },
  {
    id: 'stk_good_morning',
    title: 'Shubh Prabhat ☀️',
    pack: 'greetings',
    tags: ['morning', 'shubh', 'prabhat', 'sun', 'sunrise', 'day'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fffbeb" stroke="#f59e0b" stroke-width="3.5"/>
        <text x="90" y="85" text-anchor="middle" font-size="52">☀️</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#b45309" letter-spacing="1">GOOD MORNING</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12" fill="#d97706">शुभ प्रभात 🌅</text>
      </svg>
    `)
  },
  {
    id: 'stk_good_night',
    title: 'Shubh Ratri 🌙',
    pack: 'greetings',
    tags: ['night', 'shubh', 'ratri', 'moon', 'sleep', 'stars'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#0f172a" stroke="#38bdf8" stroke-width="3.5"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">🌙</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#38bdf8" letter-spacing="1">GOOD NIGHT</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12" fill="#93c5fd">शुभ रात्रि ✨</text>
      </svg>
    `)
  },
  {
    id: 'stk_welcome',
    title: 'Padharo / Welcome 🌸',
    pack: 'greetings',
    tags: ['welcome', 'padharo', 'swagat', 'guest', 'hello'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#faf5ff" stroke="#a855f7" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">🌸</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="15" fill="#6b21a8" letter-spacing="1">WELCOME!</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12" fill="#9333ea">पधारो सा 🌺</text>
      </svg>
    `)
  },
  {
    id: 'stk_ram_ram',
    title: 'Ram Ram Ji 🕉️',
    pack: 'greetings',
    tags: ['ram', 'ram ram', 'greeting', 'bhakti', 'peace', 'ayodhya'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fff7ed" stroke="#f97316" stroke-width="3.5"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">🕉️</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="15" fill="#c2410c" letter-spacing="1.5">RAM RAM JI</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12" fill="#ea580c">जय श्री राम 🚩</text>
      </svg>
    `)
  },
  {
    id: 'stk_mithai',
    title: 'Mooh Meetha Karo 🍬',
    pack: 'greetings',
    tags: ['mithai', 'sweet', 'sugar', 'celebrate', 'treat', 'happy'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fffbeb" stroke="#f59e0b" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">🍬</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#b45309" letter-spacing="1">SWEET NEWS!</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12" fill="#d97706">मुंह मीठा करो 🍭</text>
      </svg>
    `)
  },
  {
    id: 'stk_bohot_badiya',
    title: 'Bohot Badiya 👍',
    pack: 'greetings',
    tags: ['bohot', 'badiya', 'great', 'super', 'thumbs up', 'mast'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#eff6ff" stroke="#3b82f6" stroke-width="3.5"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">👍</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#1d4ed8" letter-spacing="1">BOHOT BADIYA</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12" fill="#2563eb">बहुत बढ़िया ⭐</text>
      </svg>
    `)
  },
  {
    id: 'stk_blessings',
    title: 'Ashirwad 🪔',
    pack: 'greetings',
    tags: ['ashirwad', 'diya', 'puja', 'festival', 'diwali', 'light'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fff7ed" stroke="#ea580c" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">🪔</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#c2410c" letter-spacing="1">BLESSINGS</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12" fill="#ea580c">सदा विजयी भव 🪔</text>
      </svg>
    `)
  },
  {
    id: 'stk_mahadev',
    title: 'Har Har Mahadev 🔱',
    pack: 'greetings',
    tags: ['shiva', 'mahadev', 'trishul', 'bholenath', 'har har'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#eff6ff" stroke="#1d4ed8" stroke-width="3.5"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">🔱</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#1e40af" letter-spacing="1">HAR HAR MAHADEV</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12" fill="#2563eb">हर हर महादेव 🕉️</text>
      </svg>
    `)
  },
  {
    id: 'stk_congrats_desi',
    title: 'Mubarak Ho 🎊',
    pack: 'greetings',
    tags: ['mubarak', 'congrats', 'eid', 'diwali', 'celebration'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#f0fdf4" stroke="#16a34a" stroke-width="3.5"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">🎊</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#15803d" letter-spacing="1">MUBARAK HO!</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12" fill="#16a34a">मुबारक हो ✨</text>
      </svg>
    `)
  },
  {
    id: 'stk_dhanyawad',
    title: 'Dhanyawad 💐',
    pack: 'greetings',
    tags: ['dhanyawad', 'thanks', 'bouquet', 'flowers', 'grateful'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fdf2f8" stroke="#ec4899" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">💐</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#be185d" letter-spacing="1">DHANYAWAD</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12" fill="#db2777">धन्यवाद 🌸</text>
      </svg>
    `)
  },
  {
    id: 'stk_jugaad',
    title: 'Genius Solution 💡',
    pack: 'greetings',
    tags: ['jugaad', 'idea', 'genius', 'bulb', 'solution', 'fast'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fefce8" stroke="#eab308" stroke-width="3.5"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">💡</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#854d0e" letter-spacing="1">GENIUS IDEA</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12" fill="#ca8a04">देसी जुगाड़ 🔥</text>
      </svg>
    `)
  },
  {
    id: 'stk_mast',
    title: 'Ekdum Mast 👌',
    pack: 'greetings',
    tags: ['mast', 'perfect', 'ok', 'super', 'first class'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#f5f3ff" stroke="#8b5cf6" stroke-width="3.5"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">👌</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#6d28d9" letter-spacing="1">EKDUM MAST!</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12" fill="#7c3aed">एकदम मस्त ✨</text>
      </svg>
    `)
  },
  {
    id: 'stk_salaam',
    title: 'Salaam 🤲',
    pack: 'greetings',
    tags: ['salaam', 'peace', 'dua', 'prayer', 'respect'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#ecfdf5" stroke="#10b981" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">🤲</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#047857" letter-spacing="1">SALAAM</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12" fill="#059669">दुआ में याद रखना 🌙</text>
      </svg>
    `)
  },
  {
    id: 'stk_shubh_din',
    title: 'Shubh Din 🌅',
    pack: 'greetings',
    tags: ['shubh', 'din', 'auspicious', 'good luck', 'day'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fff7ed" stroke="#f97316" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">🌅</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#c2410c" letter-spacing="1">SHUBH DIN</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="12" fill="#ea580c">शुभ दिन हो 🌸</text>
      </svg>
    `)
  },

  // ==========================================
  // PACK 3: 3D REACTIONS & MEGA EMOJIS (22 Stickers)
  // ==========================================
  {
    id: 'stk_super_heart',
    title: 'Big Love ❤️',
    pack: 'reactions',
    tags: ['heart', 'love', 'red', 'romance', 'care'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <defs>
          <radialGradient id="gHeart" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#ff4d4f"/>
            <stop offset="60%" stop-color="#f5222d"/>
            <stop offset="100%" stop-color="#cf1322"/>
          </radialGradient>
        </defs>
        <path d="M90 40 C75 10 25 10 25 60 C25 105 85 145 90 150 C95 145 155 105 155 60 C155 10 105 10 90 40 Z" fill="url(#gHeart)" stroke="#ff7875" stroke-width="3"/>
        <ellipse cx="60" cy="50" rx="14" ry="7" transform="rotate(-35 60 50)" fill="#ffffff" opacity="0.45"/>
      </svg>
    `)
  },
  {
    id: 'stk_super_fire',
    title: 'Fire Level 🔥',
    pack: 'reactions',
    tags: ['fire', 'flame', 'lit', 'hot', 'amazing', 'burn'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <defs>
          <linearGradient id="gFire" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="#ef4444"/>
            <stop offset="50%" stop-color="#f97316"/>
            <stop offset="100%" stop-color="#facc15"/>
          </linearGradient>
        </defs>
        <path d="M90 15 C105 45 125 55 125 80 C125 125 145 120 145 145 C145 165 120 175 90 175 C60 175 35 165 35 145 C35 120 55 125 55 80 C55 55 75 45 90 15 Z" fill="url(#gFire)" stroke="#fed7aa" stroke-width="2"/>
        <path d="M90 85 C100 105 110 115 110 130 C110 155 70 155 70 130 C70 115 80 105 90 85 Z" fill="#ffffff" opacity="0.6"/>
      </svg>
    `)
  },
  {
    id: 'stk_hundred',
    title: '100% Solid 💯',
    pack: 'reactions',
    tags: ['100', 'hundred', 'perfect', 'full', 'score', 'pure'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <rect x="15" y="15" width="150" height="150" rx="30" fill="#fef2f2" stroke="#dc2626" stroke-width="3"/>
        <text x="90" y="105" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="64" fill="#dc2626" letter-spacing="-2">100</text>
        <line x1="40" y1="130" x2="140" y2="130" stroke="#dc2626" stroke-width="8" stroke-linecap="round"/>
        <line x1="40" y1="145" x2="140" y2="145" stroke="#dc2626" stroke-width="8" stroke-linecap="round"/>
      </svg>
    `)
  },
  {
    id: 'stk_mind_blown',
    title: 'Mind Blown 🤯',
    pack: 'reactions',
    tags: ['mind', 'blown', 'shock', 'explode', 'unbelievable'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fffbeb" stroke="#f59e0b" stroke-width="3"/>
        <text x="90" y="100" text-anchor="middle" font-size="68">🤯</text>
        <text x="90" y="155" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#b45309" letter-spacing="1">MIND BLOWN!</text>
      </svg>
    `)
  },
  {
    id: 'stk_party_time',
    title: 'Party Popper 🥳',
    pack: 'reactions',
    tags: ['party', 'celebrate', 'popper', 'fun', 'happy'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fdf2f8" stroke="#ec4899" stroke-width="3"/>
        <text x="90" y="100" text-anchor="middle" font-size="68">🥳</text>
        <text x="90" y="155" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#be185d" letter-spacing="1">PARTY TIME!</text>
      </svg>
    `)
  },
  {
    id: 'stk_cool_shades',
    title: 'Cool Swag 😎',
    pack: 'reactions',
    tags: ['cool', 'glasses', 'swag', 'boss', 'attitude'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#eff6ff" stroke="#2563eb" stroke-width="3"/>
        <text x="90" y="100" text-anchor="middle" font-size="68">😎</text>
        <text x="90" y="155" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#1d4ed8" letter-spacing="1">LIKE A BOSS</text>
      </svg>
    `)
  },
  {
    id: 'stk_dead_laugh',
    title: 'Dead Laugh 💀',
    pack: 'reactions',
    tags: ['dead', 'skull', 'dying', 'laugh', 'lmao'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#f1f5f9" stroke="#475569" stroke-width="3"/>
        <text x="90" y="100" text-anchor="middle" font-size="68">💀</text>
        <text x="90" y="155" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#334155" letter-spacing="1">I AM DEAD 😂</text>
      </svg>
    `)
  },
  {
    id: 'stk_cry_laugh',
    title: 'Laughing Tears 😂',
    pack: 'reactions',
    tags: ['laugh', 'cry', 'funny', 'tears', 'joke', 'rofl'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fffbeb" stroke="#f59e0b" stroke-width="3"/>
        <text x="90" y="100" text-anchor="middle" font-size="68">😂</text>
        <text x="90" y="155" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#b45309" letter-spacing="1">HAHAHA! 🤣</text>
      </svg>
    `)
  },
  {
    id: 'stk_big_hug',
    title: 'Warm Hug 🫂',
    pack: 'reactions',
    tags: ['hug', 'care', 'support', 'friends', 'comfort'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fdf4ff" stroke="#c084fc" stroke-width="3"/>
        <text x="90" y="100" text-anchor="middle" font-size="68">🫂</text>
        <text x="90" y="155" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#7e22ce" letter-spacing="1">BIG HUG FOR YOU</text>
      </svg>
    `)
  },
  {
    id: 'stk_clapping',
    title: 'Bravo Clap 👏',
    pack: 'reactions',
    tags: ['clap', 'applause', 'bravo', 'cheer', 'respect'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#ecfdf5" stroke="#10b981" stroke-width="3"/>
        <text x="90" y="100" text-anchor="middle" font-size="68">👏</text>
        <text x="90" y="155" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#047857" letter-spacing="1">BRAVO! 🌟</text>
      </svg>
    `)
  },
  {
    id: 'stk_chef_kiss',
    title: "Chef's Kiss 👌",
    pack: 'reactions',
    tags: ['chef', 'kiss', 'perfect', 'masterpiece', 'taste'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fef2f2" stroke="#ef4444" stroke-width="3"/>
        <text x="90" y="100" text-anchor="middle" font-size="68">🤌</text>
        <text x="90" y="155" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#b91c1c" letter-spacing="1">CHEF'S KISS</text>
      </svg>
    `)
  },
  {
    id: 'stk_strong_biceps',
    title: 'Super Strong 💪',
    pack: 'reactions',
    tags: ['strong', 'power', 'gym', 'biceps', 'muscle'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fff7ed" stroke="#ea580c" stroke-width="3"/>
        <text x="90" y="100" text-anchor="middle" font-size="68">💪</text>
        <text x="90" y="155" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#c2410c" letter-spacing="1">STAY STRONG</text>
      </svg>
    `)
  },
  {
    id: 'stk_thinking',
    title: 'Big Brain 🤔',
    pack: 'reactions',
    tags: ['think', 'ponder', 'hmm', 'curious', 'smart'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fefce8" stroke="#ca8a04" stroke-width="3"/>
        <text x="90" y="100" text-anchor="middle" font-size="68">🤔</text>
        <text x="90" y="155" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#854d0e" letter-spacing="1">LET ME THINK...</text>
      </svg>
    `)
  },
  {
    id: 'stk_rocket',
    title: 'Rocket Speed 🚀',
    pack: 'reactions',
    tags: ['rocket', 'launch', 'fast', 'moon', 'speed', 'up'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#0f172a" stroke="#f43f5e" stroke-width="3"/>
        <text x="90" y="100" text-anchor="middle" font-size="68">🚀</text>
        <text x="90" y="155" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#fb7185" letter-spacing="1">TO THE MOON!</text>
      </svg>
    `)
  },
  {
    id: 'stk_star_struck',
    title: 'Star Struck 🤩',
    pack: 'reactions',
    tags: ['star', 'wow', 'excited', 'amazing', 'super'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fffbeb" stroke="#f59e0b" stroke-width="3"/>
        <text x="90" y="100" text-anchor="middle" font-size="68">🤩</text>
        <text x="90" y="155" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#b45309" letter-spacing="1">AMAZING! ⭐</text>
      </svg>
    `)
  },
  {
    id: 'stk_crown',
    title: 'Boss King 👑',
    pack: 'reactions',
    tags: ['crown', 'king', 'queen', 'leader', 'royal', 'boss'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fffbeb" stroke="#eab308" stroke-width="3"/>
        <text x="90" y="100" text-anchor="middle" font-size="68">👑</text>
        <text x="90" y="155" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#a16207" letter-spacing="1">TRUE LEADER 👑</text>
      </svg>
    `)
  },
  {
    id: 'stk_diamond',
    title: 'Diamond Quality 💎',
    pack: 'reactions',
    tags: ['diamond', 'gem', 'luxury', 'precious', 'rich'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#eff6ff" stroke="#3b82f6" stroke-width="3"/>
        <text x="90" y="100" text-anchor="middle" font-size="68">💎</text>
        <text x="90" y="155" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#1d4ed8" letter-spacing="1">TOP QUALITY 💎</text>
      </svg>
    `)
  },
  {
    id: 'stk_warning',
    title: 'Danger Alert ⚠️',
    pack: 'reactions',
    tags: ['warning', 'alert', 'caution', 'danger', 'stop'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fff7ed" stroke="#ea580c" stroke-width="3"/>
        <text x="90" y="100" text-anchor="middle" font-size="68">⚠️</text>
        <text x="90" y="155" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#c2410c" letter-spacing="1">TAKE CAUTION!</text>
      </svg>
    `)
  },
  {
    id: 'stk_sleeping',
    title: 'Sleeping Snooze 😴',
    pack: 'reactions',
    tags: ['sleep', 'tired', 'snooze', 'zzz', 'exhausted'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#f1f5f9" stroke="#64748b" stroke-width="3"/>
        <text x="90" y="100" text-anchor="middle" font-size="68">😴</text>
        <text x="90" y="155" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#334155" letter-spacing="1">TIRED... ZZZ</text>
      </svg>
    `)
  },
  {
    id: 'stk_pleading',
    title: 'Please Cute 🥺',
    pack: 'reactions',
    tags: ['please', 'cute', 'pleading', 'puppy eyes', 'request'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fff1f2" stroke="#f43f5e" stroke-width="3"/>
        <text x="90" y="100" text-anchor="middle" font-size="68">🥺</text>
        <text x="90" y="155" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#be123c" letter-spacing="1">PLEASE MANJAO</text>
      </svg>
    `)
  },
  {
    id: 'stk_money_mouth',
    title: 'Rich Cash 🤑',
    pack: 'reactions',
    tags: ['money', 'rich', 'dollar', 'profit', 'cash'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#ecfdf5" stroke="#10b981" stroke-width="3"/>
        <text x="90" y="100" text-anchor="middle" font-size="68">🤑</text>
        <text x="90" y="155" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#047857" letter-spacing="1">PAISA HI PAISA</text>
      </svg>
    `)
  },
  {
    id: 'stk_applause',
    title: 'Standing Ovation 🙌',
    pack: 'reactions',
    tags: ['applause', 'praise', 'hooray', 'ovation', 'celebrate'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fdf4ff" stroke="#a855f7" stroke-width="3"/>
        <text x="90" y="100" text-anchor="middle" font-size="68">🙌</text>
        <text x="90" y="155" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#7e22ce" letter-spacing="1">OUTSTANDING!</text>
      </svg>
    `)
  },

  // ==========================================
  // PACK 4: TEXTILE & FACTORY PRO (20 Stickers)
  // ==========================================
  {
    id: 'stk_elite_fabric',
    title: 'Elite Fabric 🧵',
    pack: 'textile',
    tags: ['fabric', 'cloth', 'elite', 'textile', 'spool', 'thread', 'mill'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <defs>
          <linearGradient id="gFab" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#8b5cf6"/>
            <stop offset="100%" stop-color="#4c1d95"/>
          </linearGradient>
        </defs>
        <circle cx="90" cy="90" r="76" fill="url(#gFab)" stroke="#c4b5fd" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="52">🧵</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#ffffff" letter-spacing="1">ELITE FABRIC</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" fill="#ddd6fe">PREMIUM GRADE</text>
      </svg>
    `)
  },
  {
    id: 'stk_stitch_perfect',
    title: 'Stitch Perfect 🪡',
    pack: 'textile',
    tags: ['stitch', 'sewing', 'needle', 'tailor', 'garment', 'perfect'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#eff6ff" stroke="#3b82f6" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">🪡</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#1e40af" letter-spacing="1">STITCH PERFECT</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" fill="#3b82f6">NO DEFECTS</text>
      </svg>
    `)
  },
  {
    id: 'stk_cutting_done',
    title: 'Cutting Done ✂️',
    pack: 'textile',
    tags: ['cutting', 'scissors', 'cut', 'pieces', 'pattern'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fff7ed" stroke="#f97316" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">✂️</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#c2410c" letter-spacing="1">CUTTING DONE</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" fill="#ea580c">READY FOR STITCH</text>
      </svg>
    `)
  },
  {
    id: 'stk_textile_qc',
    title: 'Mill QC Passed 🏅',
    pack: 'textile',
    tags: ['qc', 'mill', 'passed', 'testing', 'quality', 'audit'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#f0fdf4" stroke="#16a34a" stroke-width="3.5"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">🏅</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#15803d" letter-spacing="1">MILL QC PASSED</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" fill="#22c55e">GRADE A STANDARD</text>
      </svg>
    `)
  },
  {
    id: 'stk_dispatch_today',
    title: 'Dispatch Today 🚛',
    pack: 'textile',
    tags: ['dispatch', 'delivery', 'truck', 'shipment', 'today'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#ecfeff" stroke="#0891b2" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">🚛</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#155e75" letter-spacing="1">DISPATCH TODAY</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" fill="#0891b2">ON SCHEDULE</text>
      </svg>
    `)
  },
  {
    id: 'stk_fabric_inward',
    title: 'Fabric Inward 📦',
    pack: 'textile',
    tags: ['inward', 'goods', 'package', 'roll', 'warehouse', 'stock'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fef3c7" stroke="#d97706" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">📦</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#92400e" letter-spacing="1">FABRIC INWARD</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" fill="#b45309">STOCK RECEIVED</text>
      </svg>
    `)
  },
  {
    id: 'stk_mill_ready',
    title: 'Mill Ready 🏭',
    pack: 'textile',
    tags: ['mill', 'factory', 'production', 'loom', 'weaving'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#f1f5f9" stroke="#475569" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">🏭</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#1e293b" letter-spacing="1">MILL READY</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" fill="#475569">FULL CAPACITY</text>
      </svg>
    `)
  },
  {
    id: 'stk_dyeing_process',
    title: 'Dyeing In Process 🎨',
    pack: 'textile',
    tags: ['dyeing', 'color', 'shade', 'palette', 'processing', 'rfd'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fdf2f8" stroke="#db2777" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">🎨</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#9d174d" letter-spacing="1">DYEING IN PROCESS</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" fill="#db2777">SHADE MATCHING</text>
      </svg>
    `)
  },
  {
    id: 'stk_sample_approved',
    title: 'Sample Approved 🏷️',
    pack: 'textile',
    tags: ['sample', 'tag', 'swatch', 'approved', 'buyer', 'ready'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#ecfdf5" stroke="#10b981" stroke-width="3.5"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">🏷️</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#065f46" letter-spacing="1">SAMPLE APPROVED</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" fill="#047857">PROCEED TO BULK</text>
      </svg>
    `)
  },
  {
    id: 'stk_bale_packed',
    title: 'Bale Packed 📦',
    pack: 'textile',
    tags: ['bale', 'packed', 'rolls', 'carton', 'dispatch', 'secure'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#f8fafc" stroke="#334155" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">📦</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#0f172a" letter-spacing="1">BALE PACKED</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" fill="#475569">BARCODED & SEALED</text>
      </svg>
    `)
  },
  {
    id: 'stk_meter_count',
    title: 'Meter Checked 📏',
    pack: 'textile',
    tags: ['meter', 'length', 'ruler', 'measure', 'accurate'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#eff6ff" stroke="#2563eb" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">📏</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#1e40af" letter-spacing="1">METER CHECKED</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" fill="#3b82f6">100% ACCURATE</text>
      </svg>
    `)
  },
  {
    id: 'stk_yarn_spinning',
    title: 'Yarn Spun 🧶',
    pack: 'textile',
    tags: ['yarn', 'wool', 'spinning', 'thread', 'fiber'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fdf4ff" stroke="#c084fc" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">🧶</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#7e22ce" letter-spacing="1">YARN READY</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" fill="#a855f7">HIGH TENSILE</text>
      </svg>
    `)
  },
  {
    id: 'stk_heavy_gsm',
    title: 'Heavy GSM Grade ⚖️',
    pack: 'textile',
    tags: ['gsm', 'weight', 'density', 'thick', 'heavy'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fffbeb" stroke="#f59e0b" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">⚖️</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#b45309" letter-spacing="1">HEAVY GSM</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" fill="#d97706">DENSE WEAVE</text>
      </svg>
    `)
  },
  {
    id: 'stk_fast_color',
    title: 'Fast Color 🌈',
    pack: 'textile',
    tags: ['color', 'fast', 'rainbow', 'wash', 'solid'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#f0fdfa" stroke="#14b8a6" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">🌈</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#0f766e" letter-spacing="1">FAST COLOR</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" fill="#0d9488">NO BLEEDING</text>
      </svg>
    `)
  },
  {
    id: 'stk_grey_inward',
    title: 'Grey Inward 🏬',
    pack: 'textile',
    tags: ['grey', 'fabric', 'unprocessed', 'loom', 'arrival'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#f1f5f9" stroke="#64748b" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">🏬</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#334155" letter-spacing="1">GREY INWARD</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" fill="#64748b">MILL BATCH OK</text>
      </svg>
    `)
  },
  {
    id: 'stk_print_ok',
    title: 'Printing Passed 🖨️',
    pack: 'textile',
    tags: ['print', 'screen', 'rotary', 'digital', 'pattern'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#ecfdf5" stroke="#059669" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">🖨️</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#065f46" letter-spacing="1">PRINTING PASSED</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" fill="#047857">SHARP DEFINITION</text>
      </svg>
    `)
  },
  {
    id: 'stk_iron_press',
    title: 'Iron & Finish 👔',
    pack: 'textile',
    tags: ['iron', 'finish', 'folding', 'packing', 'shirt'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#eff6ff" stroke="#3b82f6" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">👔</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#1e40af" letter-spacing="1">IRON & FINISH</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" fill="#2563eb">SHOWROOM READY</text>
      </svg>
    `)
  },
  {
    id: 'stk_roll_packed',
    title: 'Roll Packed 🗞️',
    pack: 'textile',
    tags: ['roll', 'pipe', 'plastic', 'secure', 'packing'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fafafa" stroke="#a1a1aa" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">🗞️</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#27272a" letter-spacing="1">ROLL PACKED</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" fill="#71717a">DOUBLE WRAPPED</text>
      </svg>
    `)
  },
  {
    id: 'stk_export_quality',
    title: 'Export Quality 🌐',
    pack: 'textile',
    tags: ['export', 'international', 'globe', 'standard', 'world'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#eff6ff" stroke="#1d4ed8" stroke-width="3.5"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">🌐</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#1e40af" letter-spacing="1">EXPORT QUALITY</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" fill="#3b82f6">GLOBAL TESTED</text>
      </svg>
    `)
  },
  {
    id: 'stk_lot_ready',
    title: 'Lot Ready 📋',
    pack: 'textile',
    tags: ['lot', 'ready', 'batch', 'inventory', 'challan'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#ecfdf5" stroke="#10b981" stroke-width="3"/>
        <text x="90" y="85" text-anchor="middle" font-size="50">📋</text>
        <text x="90" y="132" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#065f46" letter-spacing="1">LOT READY</text>
        <text x="90" y="152" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" fill="#047857">TAGGED & READY</text>
      </svg>
    `)
  },

  // ==========================================
  // PACK 5: MEMES & MASCOTS (20 Stickers)
  // ==========================================
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
    id: 'stk_salute_panda',
    title: 'Roger Panda 🐼',
    pack: 'mascots',
    tags: ['panda', 'salute', 'cute', 'roger', 'bear'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="3"/>
        <text x="90" y="98" text-anchor="middle" font-size="56">🐼</text>
        <text x="90" y="150" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#334155" letter-spacing="1">YES BOSS! 🫡</text>
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
  },
  {
    id: 'stk_popcorn',
    title: 'Watching Drama 🍿',
    pack: 'mascots',
    tags: ['popcorn', 'drama', 'movie', 'watching', 'interesting'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fffbeb" stroke="#fef08a" stroke-width="3"/>
        <text x="90" y="98" text-anchor="middle" font-size="56">🍿</text>
        <text x="90" y="150" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#a16207" letter-spacing="1">EATING POPCORN</text>
      </svg>
    `)
  },
  {
    id: 'stk_bear_thumbs',
    title: 'Bear Hugs 🐻',
    pack: 'mascots',
    tags: ['bear', 'hug', 'cute', 'warm', 'friendly'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fef3c7" stroke="#fbbf24" stroke-width="3"/>
        <text x="90" y="98" text-anchor="middle" font-size="56">🐻</text>
        <text x="90" y="150" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#92400e" letter-spacing="1">BEAR HUG! 🧸</text>
      </svg>
    `)
  },
  {
    id: 'stk_bunny_tea',
    title: 'Tea Bunny 🐰',
    pack: 'mascots',
    tags: ['bunny', 'rabbit', 'tea', 'cute', 'chilling'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fdf2f8" stroke="#fbcfe8" stroke-width="3"/>
        <text x="90" y="98" text-anchor="middle" font-size="56">🐰</text>
        <text x="90" y="150" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#be185d" letter-spacing="1">CHILLING OUT 🍵</text>
      </svg>
    `)
  },
  {
    id: 'stk_lion_king',
    title: 'Leader Lion 🦁',
    pack: 'mascots',
    tags: ['lion', 'king', 'brave', 'power', 'leader'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fffbeb" stroke="#f59e0b" stroke-width="3"/>
        <text x="90" y="98" text-anchor="middle" font-size="56">🦁</text>
        <text x="90" y="150" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#b45309" letter-spacing="1">ROAR OF A LION!</text>
      </svg>
    `)
  },
  {
    id: 'stk_speedy_cheetah',
    title: 'Fast Cheetah 🐆',
    pack: 'mascots',
    tags: ['cheetah', 'fast', 'speed', 'rush', 'sprint'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fff7ed" stroke="#fed7aa" stroke-width="3"/>
        <text x="90" y="98" text-anchor="middle" font-size="56">🐆</text>
        <text x="90" y="150" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#c2410c" letter-spacing="1">SUPER FAST! ⚡</text>
      </svg>
    `)
  },
  {
    id: 'stk_smart_owl',
    title: 'Night Owl 🦉',
    pack: 'mascots',
    tags: ['owl', 'night', 'smart', 'wise', 'late'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#eff6ff" stroke="#bfdbfe" stroke-width="3"/>
        <text x="90" y="98" text-anchor="middle" font-size="56">🦉</text>
        <text x="90" y="150" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#1e40af" letter-spacing="1">NIGHT OWL 🦉</text>
      </svg>
    `)
  },
  {
    id: 'stk_busy_bee',
    title: 'Busy Bee 🐝',
    pack: 'mascots',
    tags: ['bee', 'busy', 'worker', 'honey', 'active'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fefce8" stroke="#fef08a" stroke-width="3"/>
        <text x="90" y="98" text-anchor="middle" font-size="56">🐝</text>
        <text x="90" y="150" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#854d0e" letter-spacing="1">BUSY AS A BEE</text>
      </svg>
    `)
  },
  {
    id: 'stk_lucky_elephant',
    title: 'Royal Hathi 🐘',
    pack: 'mascots',
    tags: ['elephant', 'hathi', 'lucky', 'royal', 'ganesha', 'strength'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#f8fafc" stroke="#e2e8f0" stroke-width="3"/>
        <text x="90" y="98" text-anchor="middle" font-size="56">🐘</text>
        <text x="90" y="150" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#334155" letter-spacing="1">ROYAL STRENGTH</text>
      </svg>
    `)
  },
  {
    id: 'stk_fox_clever',
    title: 'Clever Fox 🦊',
    pack: 'mascots',
    tags: ['fox', 'clever', 'smart', 'cunning', 'sharp'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fff7ed" stroke="#fdba74" stroke-width="3"/>
        <text x="90" y="98" text-anchor="middle" font-size="56">🦊</text>
        <text x="90" y="150" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#c2410c" letter-spacing="1">SUPER SHARP!</text>
      </svg>
    `)
  },
  {
    id: 'stk_monkey_see',
    title: 'See No Evil 🙈',
    pack: 'mascots',
    tags: ['monkey', 'oops', 'shy', 'cute', 'giggle'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fdf2f8" stroke="#fbcfe8" stroke-width="3"/>
        <text x="90" y="98" text-anchor="middle" font-size="56">🙈</text>
        <text x="90" y="150" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#be185d" letter-spacing="1">OOPS DIDN'T SEE</text>
      </svg>
    `)
  },
  {
    id: 'stk_frog_vibing',
    title: 'Vibing Frog 🐸',
    pack: 'mascots',
    tags: ['frog', 'vibe', 'chill', 'meme', 'cool'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#f0fdf4" stroke="#bbf7d0" stroke-width="3"/>
        <text x="90" y="98" text-anchor="middle" font-size="56">🐸</text>
        <text x="90" y="150" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#15803d" letter-spacing="1">VIBING HARD</text>
      </svg>
    `)
  },
  {
    id: 'stk_unicorn_magic',
    title: 'Pure Magic 🦄',
    pack: 'mascots',
    tags: ['unicorn', 'magic', 'sparkle', 'wonder', 'dream'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#faf5ff" stroke="#e9d5ff" stroke-width="3"/>
        <text x="90" y="98" text-anchor="middle" font-size="56">🦄</text>
        <text x="90" y="150" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#7e22ce" letter-spacing="1">PURE MAGIC ✨</text>
      </svg>
    `)
  },
  {
    id: 'stk_sloth_chill',
    title: 'Chill Sloth 🦥',
    pack: 'mascots',
    tags: ['sloth', 'slow', 'chill', 'relax', 'weekend'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#fef3c7" stroke="#fde68a" stroke-width="3"/>
        <text x="90" y="98" text-anchor="middle" font-size="56">🦥</text>
        <text x="90" y="150" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#92400e" letter-spacing="1">TAKE IT EASY 🌿</text>
      </svg>
    `)
  },
  {
    id: 'stk_otter_love',
    title: 'Otterly Loved 🦦',
    pack: 'mascots',
    tags: ['otter', 'cute', 'love', 'sweet', 'friends'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#f0fdfa" stroke="#99f6e4" stroke-width="3"/>
        <text x="90" y="98" text-anchor="middle" font-size="56">🦦</text>
        <text x="90" y="150" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#0f766e" letter-spacing="1">OTTERLY AWESOME</text>
      </svg>
    `)
  },
  {
    id: 'stk_raccoon_snack',
    title: 'Snack Time 🦝',
    pack: 'mascots',
    tags: ['raccoon', 'snack', 'food', 'hungry', 'nom'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="3"/>
        <text x="90" y="98" text-anchor="middle" font-size="56">🦝</text>
        <text x="90" y="150" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#334155" letter-spacing="1">SNACK ATTACK!</text>
      </svg>
    `)
  },
  {
    id: 'stk_duck_quack',
    title: 'Cool Duck 🦆',
    pack: 'mascots',
    tags: ['duck', 'quack', 'cool', 'bird', 'vibes'],
    url: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="76" fill="#ecfdf5" stroke="#a7f3d0" stroke-width="3"/>
        <text x="90" y="98" text-anchor="middle" font-size="56">🦆</text>
        <text x="90" y="150" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#047857" letter-spacing="1">QUACK QUACK!</text>
      </svg>
    `)
  }
];

// Helper functions for Custom Stickers
export const loadCustomStickers = () => {
  try {
    const raw = localStorage.getItem('phoenix_custom_stickers');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error loading custom stickers', e);
  }
  return [];
};

export const saveCustomSticker = (sticker) => {
  try {
    const existing = loadCustomStickers();
    const updated = [sticker, ...existing.filter((s) => s.id !== sticker.id)];
    localStorage.setItem('phoenix_custom_stickers', JSON.stringify(updated.slice(0, 50)));
    return updated;
  } catch (e) {
    console.error('Error saving custom sticker', e);
    return [];
  }
};

export const deleteCustomSticker = (id) => {
  try {
    const existing = loadCustomStickers();
    const updated = existing.filter((s) => s.id !== id);
    localStorage.setItem('phoenix_custom_stickers', JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Error deleting custom sticker', e);
    return [];
  }
};
