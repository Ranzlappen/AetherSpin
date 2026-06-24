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

  'hud.balance': 'Balance',
  'hud.bet': 'Bet',
  'hud.win': 'Win',
  'hud.freeSpins': 'FREE SPINS',
  'hud.demoBadge': 'DEMO · mock RGS · {fps} fps',
  'hud.demoTitle': 'No RGS params detected — running on the local mock RGS',

  'spin.label': 'Spin',
  'spin.lowBalance': 'Low balance',

  'bet.decrease': 'Decrease bet',
  'bet.increase': 'Increase bet',

  'buyBonus.label': 'Buy Free Spins',
  'buyBonus.confirmTitle': 'Buy Free Spins?',
  'buyBonus.confirmBody': 'Purchase the bonus for {cost} ({multiplier}× your bet).',

  'freeSpins.won': 'Won {amount}',

  'autoplay.label': 'Autoplay',
  'autoplay.auto': 'Auto',
  'autoplay.start': 'Start autoplay',
  'autoplay.stop': 'Stop autoplay',
  'autoplay.stopShort': 'Stop',
  'autoplay.spins': '{count} spins',

  'sound.toggle': 'Toggle sound',

  'paytable.open': 'Paytable',
  'paytable.close': 'Close paytable',
  'paytable.title': 'Symbol Payouts',
  'paytable.subtitle': 'Values shown are multiples of the total bet for a winning line.',
  'paytable.symbol': 'Symbol',
  'paytable.features': 'Features',

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

  // Screen-reader announcements (aria-live).
  'a11y.spinStart': 'Spinning.',
  'a11y.win': 'You won {amount}.',
  'a11y.noWin': 'No win.',
  'a11y.featureTriggered': 'Free spins triggered! {amount} awarded.',
  'a11y.wincap': 'Maximum win! {amount}.',
} as const;
