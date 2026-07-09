/**
 * Canonical English UI strings. This object is the source of truth for both the
 * set of translation keys and the fallback text; other locales are typed against
 * it and may be partial (missing keys fall back to English).
 *
 * Placeholders use `{name}` syntax and are filled by the `t()` helper.
 */
export const en = {
  'app.initializing': 'Initializing NovaForged…',
  'app.authenticating': 'Authenticating…',
  'app.startingDemo': 'Starting local demo session…',
  'app.rendererFailed': 'Renderer failed to start: {message}',

  'error.connect': 'Failed to connect to the game server.',
  'error.spinFailed': 'Spin failed.',
  'error.autoplayInsufficient': 'Autoplay stopped: insufficient balance.',
  'error.renderLost': 'Graphics paused — restoring…',

  'hud.balance': 'Balance',
  'hud.bet': 'Bet',
  'hud.win': 'Win',
  'hud.freeSpins': 'FREE SPINS',
  'hud.demoBadge': 'DEMO · mock RGS · {fps} fps',
  'hud.demoTitle': 'No RGS params detected — running on the local mock RGS',

  'spin.label': 'Spin',
  'spin.skip': 'Skip',
  'spin.lowBalance': 'Low balance',

  'turbo.label': 'Turbo mode',
  'turbo.on': 'Turbo on',
  'turbo.off': 'Turbo off',

  'win.big': 'BIG WIN',
  'win.mega': 'MEGA WIN',
  'win.epic': 'EPIC WIN',
  'win.wincap': 'MAX WIN',
  'win.tapToContinue': 'Tap to continue',

  'bet.decrease': 'Decrease bet',
  'bet.increase': 'Increase bet',

  'buyBonus.label': 'Buy Free Spins',
  'buyBonus.confirmTitle': 'Buy Free Spins?',
  'buyBonus.confirmBody': 'Purchase the bonus for {cost} ({multiplier}× your bet).',

  'freeSpins.won': 'Won {amount}',
  'freeSpins.awarded': '{count} free spins',

  'autoplay.label': 'Autoplay',
  'autoplay.auto': 'Auto',
  'autoplay.start': 'Start autoplay',
  'autoplay.stop': 'Stop autoplay',
  'autoplay.stopShort': 'Stop',
  'autoplay.spins': '{count} spins',
  'autoplay.spinsLegend': 'Number of spins',
  'autoplay.lossLimit': 'Loss limit',
  'autoplay.singleWinLimit': 'Single win limit',
  'autoplay.stopOnFeature': 'Stop on free spins',
  'autoplay.off': 'Off',
  'autoplay.stoppedLossLimit': 'Autoplay stopped: loss limit reached.',
  'autoplay.stoppedWinLimit': 'Autoplay stopped: win limit reached.',

  'sound.toggle': 'Toggle sound',

  'paytable.open': 'Paytable',
  'paytable.close': 'Close paytable',
  'paytable.title': 'Symbol Payouts',
  'paytable.subtitle': 'Values shown are multiples of the total bet for a winning combination.',
  'paytable.symbol': 'Symbol',
  'paytable.features': 'Features',
  'paytable.scrollRegion': 'Paytable details, scrollable',
  'paytable.ofAKind': '{count} of a kind',
  'paytable.scatterTitle': 'Scatter — {name}',
  'paytable.scatterBody': 'Pays anywhere. {min}+ trigger free spins.',
  'paytable.freeSpinsTitle': 'Free Spins',
  'paytable.freeSpinsBody': 'Land {min}+ scatters to win {minSpins}–{maxSpins} spins.',
  'paytable.freeSpinsRetrigger': 'Retriggers award more spins.',
  'paytable.ladderTitle': 'Multiplier Ladder',
  'paytable.ladderBody': 'Wins during free spins step the global multiplier from ×{start} up to ×{max}.',
  'paytable.multiplierWildsTitle': 'Multiplier Wilds',
  'paytable.multiplierWildsBody': 'In free spins, wilds carry {values}× multipliers.',
  'paytable.expandingWildsTitle': 'Expanding Wilds',
  'paytable.expandingWildsBody': 'In free spins, wilds can expand to cover their entire reel.',
  'paytable.bonusBuyTitle': 'Buy Bonus',
  'paytable.bonusBuyBody': 'Buy free spins instantly for {cost}× your bet.',
  'paytable.paylines': 'Paylines ({count})',
  'paytable.rtpLine': 'Theoretical RTP: {rtp}% · Max win: {maxWin}× · Volatility: {volatility}',
  'paytable.desc.novaforged':
    'A premium 5×3, 20-line neon-cosmic video slot featuring multiplier wilds, scatter-triggered free spins with an escalating multiplier ladder, expanding wilds, and a bonus buy.',
  'paytable.desc.cosmicways':
    'A 5×3, 243-ways neon-cosmic video slot. Symbols pay on any adjacent reels from the left, with scatter-triggered free spins.',
  'paytable.desc.stellarclusters':
    'A 5×3 cluster-pays neon-cosmic slot: connected groups of a symbol (wilds substitute) pay by size, with scatter-triggered free spins.',

  'volatility.low': 'Low',
  'volatility.medium': 'Medium',
  'volatility.high': 'High',
  'volatility.veryHigh': 'Very high',

  'common.dismiss': 'Dismiss',
  'common.close': 'Close',
  'common.confirm': 'Confirm',
  'common.cancel': 'Cancel',

  // Responsible gaming.
  'rg.title': 'Reality check',
  'rg.sessionTime': 'You have been playing for {minutes} min.',
  'rg.netWin': 'Net result this session: +{amount}',
  'rg.netLoss': 'Net result this session: −{amount}',
  'rg.netEven': 'Net result this session: {amount}',
  'rg.disclaimer': 'Gambling should be entertaining, not a way to make money.',
  'rg.help': 'Get help & set limits',
  'rg.continue': 'Continue playing',
  'rg.quit': 'Take a break',
  'rg.ended': 'Session ended. You can safely close this window.',

  // Age / legal acknowledgement (shown only when a game opts in).
  'ageGate.title': 'Before you play',
  'ageGate.body': 'You must be {age} or older and agree to the terms to play this game.',
  'ageGate.confirm': 'I am {age} or older and accept the terms.',
  'ageGate.enter': 'Enter game',

  // Screen-reader announcements (aria-live).
  'a11y.spinStart': 'Spinning.',
  'a11y.win': 'You won {amount}.',
  'a11y.noWin': 'No win.',
  'a11y.featureTriggered': 'Free spins triggered! {amount} awarded.',
  'a11y.wincap': 'Maximum win! {amount}.',
} as const;
