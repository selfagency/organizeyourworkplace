/**
 * T6 Inoculation builder logic (plans/03-private-tools.md §T6).
 * Employer's likely moves -> a "what they'll say / the truth" sheet.
 * Output is plain text meant to be shared in person or printed.
 */

export const MOVES = [
  'captive-meeting',
  'third-party',
  'dues-scare',
  'sudden-raises',
  'closure-talk',
  'supervisor-one-on-ones',
  'letters-emails',
  'delay',
] as const;

export type Move = (typeof MOVES)[number];

interface MoveCopy {
  say: string;
  truth: string;
}

/** EN copy; the component keeps the ES mirror keyed the same way. */
export const MOVE_COPY_EN: Record<Move, MoveCopy> = {
  'captive-meeting': {
    say: 'A "mandatory meeting" where a consultant explains the dangers of unions.',
    truth: 'You can be required to attend, but you can\'t be disciplined for staying silent or disagreeing. Threats or promises made there are illegal — write down the exact words.',
  },
  'third-party': {
    say: '"The union is an outside third party that doesn\'t know your job."',
    truth: 'The union is you and your coworkers. The actual outsider is the paid consultant running the campaign.',
  },
  'dues-scare': {
    say: '"Dues are expensive and you\'ll pay them forever."',
    truth: 'Dues usually start only after you vote on and win a contract, and members set them by vote. Raises and contract terms are also written down — that\'s the difference.',
  },
  'sudden-raises': {
    say: 'A raise or benefit is announced in the middle of the campaign.',
    truth: 'Legal to grant raises; illegal to promise them to reward a "no" vote. Note the date, who announced it, and the exact words.',
  },
  'closure-talk': {
    say: '"Companies like this close because of unions."',
    truth: 'Businesses close for business reasons. Union contracts require notice and severance — that\'s protection, not risk.',
  },
  'supervisor-one-on-ones': {
    say: 'Your supervisor starts one-on-one chats about "how you feel" about the union.',
    truth: 'They are gathering names and pressure points. You can say "I\'d rather not discuss it" and end the chat. Your answer can\'t be held against you.',
  },
  'letters-emails': {
    say: 'Letters and emails about "the facts" of union dues, strikes and outsiders.',
    truth: 'Read them for the fear angle, then check it. Most are technically-true scare lines. Share them with your committee and answer together.',
  },
  delay: {
    say: 'Petitions, "open door" committees, and promises of review — anything that slows you down.',
    truth: 'Delay is a strategy: campaigns fade when they stall. Keep one-on-ones going while any "review" runs.',
  },
};

export interface SheetLine {
  move: Move;
  say: string;
  truth: string;
}

/** Build the sheet in the picked order, EN or ES. */
export function buildSheet(moves: Move[], lang: 'en' | 'es'): SheetLine[] {
  const es: Record<Move, MoveCopy> = {
    'captive-meeting': {
      say: 'Una "reunión obligatoria" donde un consultor explica los peligros de los sindicatos.',
      truth: 'Pueden exigirte asistir, pero no pueden disciplinarte por callarte o discrepar. Las amenazas o promesas dichas ahí son ilegales — anota las palabras exactas.',
    },
    'third-party': {
      say: '"El sindicato es un tercero ajeno que no conoce tu trabajo."',
      truth: 'El sindicato son tú y tus compañeros. El ajeno de verdad es el consultor pagado que dirige la campaña.',
    },
    'dues-scare': {
      say: '"Las cuotas son caras y las pagarás por siempre."',
      truth: 'Las cuotas suelen empezar solo tras votar y ganar un contrato, y las fija la membresía por voto. Los aumentos y términos del contrato también quedan por escrito — esa es la diferencia.',
    },
    'sudden-raises': {
      say: 'Un aumento o beneficio se anuncia a mitad de la campaña.',
      truth: 'Dar aumentos es legal; prometerlos para premiar un voto "no" es ilegal. Anota la fecha, quién lo anunció y las palabras exactas.',
    },
    'closure-talk': {
      say: '"Hay empresas como esta que cierran por los sindicatos."',
      truth: 'Los negocios cierran por razones de negocio. Los contratos sindicales exigen aviso e indemnización — eso es protección, no riesgo.',
    },
    'supervisor-one-on-ones': {
      say: 'Tu supervisor empieza pláticas uno a uno sobre "cómo te sientes" con el sindicato.',
      truth: 'Están juntando nombres y puntos de presión. Puedes decir "prefiero no hablar de eso" y terminar la plática. Tu respuesta no puede usarse contra ti.',
    },
    'letters-emails': {
      say: 'Cartas y correos sobre "los datos" de cuotas, huelgas y ajenos.',
      truth: 'Léelas buscando el ángulo de miedo y verifícalo. La mayoría son sustos técnicamente ciertos. Compártelas con tu comité y respondan juntos.',
    },
    delay: {
      say: 'Peticiones, "comités de puerta abierta" y promesas de revisión — lo que te haga perder tiempo.',
      truth: 'El retraso es estrategia: las campañas se apagan cuando se estancan. Sigue con los uno a uno mientras corra cualquier "revisión".',
    },
  };
  const copy = lang === 'es' ? es : MOVE_COPY_EN;
  return moves
    .filter((m, i, arr) => arr.indexOf(m) === i)
    .map((move) => ({ move, ...copy[move] }));
}

/** Plain-text sheet, ready to print or read aloud. */
export function sheetText(lines: SheetLine[], lang: 'en' | 'es'): string {
  const title = lang === 'es' ? 'LO QUE DIRÁN — Y LA VERDAD' : "WHAT THEY'LL SAY — AND THE TRUTH";
  return [title, ...lines.map((l) => `• "${l.say}"\n  ${l.truth}`)].join('\n\n');
}
