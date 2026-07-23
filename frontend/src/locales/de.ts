import type { Translations } from '../core/i18n';

/**
 * German UI strings. Partial by design — any key not present here falls back to
 * the English text in `en.ts`. Demonstrates the i18n pipeline with a second
 * locale; extend or add new locale files the same way.
 */
export const de: Partial<Translations> = {
  'app.initializing': 'NovaForge wird initialisiert…',
  'app.authenticating': 'Authentifizierung…',
  'app.startingDemo': 'Lokale Demo-Sitzung wird gestartet…',
  'app.rendererFailed': 'Renderer konnte nicht starten: {message}',

  'error.connect': 'Verbindung zum Spielserver fehlgeschlagen.',
  'error.noSession': 'Keine Spielsitzung. Bitte starten Sie das Spiel über Ihren Betreiber.',
  'error.spinFailed': 'Spin fehlgeschlagen.',
  'error.autoplayInsufficient': 'Autoplay gestoppt: Guthaben zu niedrig.',
  'error.renderLost': 'Grafik pausiert — wird wiederhergestellt…',

  'hud.balance': 'Guthaben',
  'hud.bet': 'Einsatz',
  'hud.win': 'Gewinn',
  'hud.freeSpins': 'FREISPIELE',
  'hud.clock': 'Ortszeit',
  'hud.maxWin': 'Max. Gewinn {max}×',
  'hud.spaceHint': 'Leertaste zum Drehen',

  'spin.label': 'Drehen',
  'spin.skip': 'Überspringen',
  'spin.lowBalance': 'Guthaben niedrig',

  'turbo.label': 'Turbo-Modus',
  'turbo.on': 'Turbo an',
  'turbo.off': 'Turbo aus',

  'win.big': 'GROSSER GEWINN',
  'win.mega': 'MEGA-GEWINN',
  'win.epic': 'EPISCHER GEWINN',
  'win.wincap': 'MAXIMALGEWINN',
  'win.tapToContinue': 'Tippen zum Fortfahren',

  'bet.decrease': 'Einsatz verringern',
  'bet.increase': 'Einsatz erhöhen',
  'bet.max': 'Maximaleinsatz setzen',
  'bet.maxShort': 'Max',

  'buyBonus.label': 'Freispiele kaufen',
  'buyBonus.confirmTitle': 'Freispiele kaufen?',
  'buyBonus.confirmBody': 'Bonus kaufen für {cost} ({multiplier}× Ihres Einsatzes).',
  'buyBonus.featSpins': 'Gewährt {min}–{max} Freispiele',
  'buyBonus.featLadder': 'Gewinnmultiplikator steigt bis ×{max}',
  'buyBonus.featWilds': 'Multiplikator- & expandierende Wilds',

  'freeSpins.won': 'Gewonnen {amount}',
  'freeSpins.awarded': '{count} Freispiele',
  'freeSpins.totalWin': 'Gesamtgewinn',

  'autoplay.label': 'Autoplay',
  'autoplay.auto': 'Auto',
  'autoplay.start': 'Autoplay starten',
  'autoplay.stop': 'Autoplay stoppen',
  'autoplay.stopShort': 'Stopp',
  'autoplay.spins': '{count} Spins',
  'autoplay.spinsLegend': 'Anzahl der Spins',
  'autoplay.lossLimit': 'Verlustlimit',
  'autoplay.singleWinLimit': 'Einzelgewinn-Limit',
  'autoplay.stopOnFeature': 'Bei Freispielen stoppen',
  'autoplay.off': 'Aus',
  'autoplay.stoppedLossLimit': 'Autoplay gestoppt: Verlustlimit erreicht.',
  'autoplay.stoppedWinLimit': 'Autoplay gestoppt: Gewinnlimit erreicht.',

  'sound.toggle': 'Ton umschalten',

  'paytable.open': 'Gewinntabelle',
  'paytable.close': 'Gewinntabelle schließen',
  'paytable.title': 'Symbol-Auszahlungen',
  'paytable.subtitle': 'Werte sind Vielfache des Gesamteinsatzes für eine Gewinnkombination.',
  'paytable.symbol': 'Symbol',
  'paytable.features': 'Funktionen',
  'paytable.scrollRegion': 'Gewinntabellen-Details, scrollbar',
  'paytable.ofAKind': '{count} gleiche',
  'paytable.scatterTitle': 'Scatter — {name}',
  'paytable.scatterBody': 'Zahlt überall. Ab {min} Scattern werden Freispiele ausgelöst.',
  'paytable.freeSpinsTitle': 'Freispiele',
  'paytable.freeSpinsBody': 'Mit {min}+ Scattern gewinnen Sie {minSpins}–{maxSpins} Freispiele.',
  'paytable.freeSpinsRetrigger': 'Erneute Auslösung vergibt weitere Freispiele.',
  'paytable.ladderTitle': 'Multiplikator-Leiter',
  'paytable.ladderBody':
    'Gewinne in den Freispielen erhöhen den globalen Multiplikator von ×{start} bis auf ×{max}.',
  'paytable.multiplierWildsTitle': 'Multiplikator-Wilds',
  'paytable.multiplierWildsBody': 'In den Freispielen tragen Wilds {values}×-Multiplikatoren.',
  'paytable.expandingWildsTitle': 'Expandierende Wilds',
  'paytable.expandingWildsBody': 'In den Freispielen können Wilds ihre gesamte Walze bedecken.',
  'paytable.bonusBuyTitle': 'Bonuskauf',
  'paytable.bonusBuyBody': 'Kaufen Sie Freispiele sofort für das {cost}-Fache Ihres Einsatzes.',
  'paytable.paylines': 'Gewinnlinien ({count})',
  'paytable.rtpLine': 'Theoretischer RTP: {rtp}% · Maximalgewinn: {maxWin}× · Volatilität: {volatility}',
  'paytable.desc.novaforged':
    'Ein hochwertiger 5×3-Video-Slot mit 20 Gewinnlinien im Neon-Kosmos-Stil — mit Multiplikator-Wilds, Scatter-Freispielen mit ansteigender Multiplikator-Leiter, expandierenden Wilds und Bonuskauf.',

  'volatility.low': 'Niedrig',
  'volatility.medium': 'Mittel',
  'volatility.high': 'Hoch',
  'volatility.veryHigh': 'Sehr hoch',

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

  'ageGate.title': 'Bevor Sie spielen',
  'ageGate.body':
    'Sie müssen mindestens {age} Jahre alt sein und den Bedingungen zustimmen, um dieses Spiel zu spielen.',
  'ageGate.confirm': 'Ich bin mindestens {age} Jahre alt und akzeptiere die Bedingungen.',
  'ageGate.enter': 'Spiel starten',

  'a11y.spinStart': 'Dreht.',
  'a11y.win': 'Sie haben {amount} gewonnen.',
  'a11y.noWin': 'Kein Gewinn.',
  'a11y.featureTriggered': 'Freispiele ausgelöst! {amount} vergeben.',
  'a11y.wincap': 'Maximaler Gewinn! {amount}.',
};
