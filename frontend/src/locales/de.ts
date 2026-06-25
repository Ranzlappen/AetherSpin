import type { Translations } from '../core/i18n';

/**
 * German UI strings. Partial by design — any key not present here falls back to
 * the English text in `en.ts`. Demonstrates the i18n pipeline with a second
 * locale; extend or add new locale files the same way.
 */
export const de: Partial<Translations> = {
  'app.initializing': 'NovaForged wird initialisiert…',
  'app.authenticating': 'Authentifizierung…',
  'app.startingDemo': 'Lokale Demo-Sitzung wird gestartet…',
  'app.rendererFailed': 'Renderer konnte nicht starten: {message}',

  'error.connect': 'Verbindung zum Spielserver fehlgeschlagen.',
  'error.spinFailed': 'Spin fehlgeschlagen.',
  'error.autoplayInsufficient': 'Autoplay gestoppt: Guthaben zu niedrig.',
  'error.renderLost': 'Grafik pausiert — wird wiederhergestellt…',

  'hud.balance': 'Guthaben',
  'hud.bet': 'Einsatz',
  'hud.win': 'Gewinn',
  'hud.freeSpins': 'FREISPIELE',

  'spin.label': 'Drehen',
  'spin.lowBalance': 'Guthaben niedrig',

  'bet.decrease': 'Einsatz verringern',
  'bet.increase': 'Einsatz erhöhen',

  'buyBonus.label': 'Freispiele kaufen',
  'buyBonus.confirmTitle': 'Freispiele kaufen?',
  'buyBonus.confirmBody': 'Bonus kaufen für {cost} ({multiplier}× Ihres Einsatzes).',

  'freeSpins.won': 'Gewonnen {amount}',

  'autoplay.label': 'Autoplay',
  'autoplay.auto': 'Auto',
  'autoplay.start': 'Autoplay starten',
  'autoplay.stop': 'Autoplay stoppen',
  'autoplay.stopShort': 'Stopp',
  'autoplay.spins': '{count} Spins',

  'sound.toggle': 'Ton umschalten',

  'paytable.open': 'Gewinntabelle',
  'paytable.close': 'Gewinntabelle schließen',
  'paytable.title': 'Symbol-Auszahlungen',
  'paytable.subtitle': 'Werte sind Vielfache des Gesamteinsatzes für eine Gewinnkombination.',
  'paytable.symbol': 'Symbol',
  'paytable.features': 'Funktionen',
  'paytable.scrollRegion': 'Gewinntabellen-Details, scrollbar',

  'common.dismiss': 'Schließen',
  'common.close': 'Schließen',
  'common.confirm': 'Bestätigen',
  'common.cancel': 'Abbrechen',

  'rg.title': 'Realitäts-Check',
  'rg.sessionTime': 'Sie spielen seit {minutes} Min.',
  'rg.netWin': 'Nettoergebnis dieser Sitzung: +{amount}',
  'rg.netLoss': 'Nettoergebnis dieser Sitzung: −{amount}',
  'rg.netEven': 'Nettoergebnis dieser Sitzung: {amount}',
  'rg.disclaimer': 'Glücksspiel sollte unterhalten, kein Weg sein, Geld zu verdienen.',
  'rg.help': 'Hilfe erhalten & Limits setzen',
  'rg.continue': 'Weiterspielen',
  'rg.quit': 'Pause machen',
  'rg.ended': 'Sitzung beendet. Sie können dieses Fenster schließen.',

  'a11y.spinStart': 'Dreht.',
  'a11y.win': 'Sie haben {amount} gewonnen.',
  'a11y.noWin': 'Kein Gewinn.',
  'a11y.featureTriggered': 'Freispiele ausgelöst! {amount} vergeben.',
  'a11y.wincap': 'Maximaler Gewinn! {amount}.',
};
