/**
 * T5 Conversation builder logic (plans/03-private-tools.md §T5).
 * Issues in -> a personal first-conversation script out.
 * Sequence: Listen -> Agitate -> Plan -> Inoculate -> Ask -> Follow up.
 * Adapted from the Labor Notes organizing-conversation handout (Tier 3).
 */

export const ISSUES = [
  'pay',
  'scheduling',
  'safety',
  'respect',
  'benefits',
  'turnover',
] as const;

export type Issue = (typeof ISSUES)[number];

interface Copy {
  opener: (issue: string) => string;
  dig: string;
  agitate: string;
  plan: string;
  inoculate: string;
  ask: string;
  followUp: string;
}

const EN: Copy = {
  opener: (issue) => `Hey — quick thing. ${issue[0].toUpperCase()}${issue.slice(1)}'s been on my mind lately. Does it ever get to you too?`,
  dig: 'When did that start? Who else is feeling it?',
  agitate: 'Is that just how it has to be here, or is it a choice they\'re making?',
  plan: 'A few of us are talking about acting together on this — not a union thing at first, just getting something fixed. Would you be in for that?',
  inoculate: 'Fair warning: when they notice, they\'ll get friendlier, maybe promise something, maybe ask who\'s behind it. That\'s the script. It usually means it\'s working.',
  ask: 'Can I check back with you Friday? I\'ll tell you what we find out.',
  followUp: '(Friday) Hey — remember what we talked about? Here\'s where it stands…',
};

const ES: Copy = {
  opener: (issue) => `Oye, rápido. Lo de ${issue} me trae de cabeza. ¿A ti también te molesta?`,
  dig: '¿Desde cuándo? ¿Quién más lo está sintiendo?',
  agitate: '¿Así tiene que ser siempre aquí, o es una decisión de ellos?',
  plan: 'Algunos estamos hablando de actuar juntos con esto — al principio no es nada de sindicato, solo arreglar algo. ¿Te animas?',
  inoculate: 'Aviso: cuando se den cuenta, se pondrán amigables, prometerán algo, preguntarán quién está detrás. Es el guion. Casi siempre significa que está funcionando.',
  ask: '¿Te veo el viernes? Te cuento qué averiguamos.',
  followUp: '(Viernes) Oye — ¿lo que hablamos? Esto es lo que hay…',
};

const ISSUE_ES: Record<Issue, string> = {
  pay: 'el sueldo',
  scheduling: 'los horarios',
  safety: 'la seguridad',
  respect: 'el respeto',
  benefits: 'los beneficios',
  turnover: 'la rotación',
};

export interface Script {
  issue: Issue;
  steps: { key: string; text: string }[];
}

export function buildScript(issues: Issue[], lang: 'en' | 'es'): Script[] {
  const copy = lang === 'es' ? ES : EN;
  const label = (issue: Issue) => (lang === 'es' ? ISSUE_ES[issue] : issue);
  return issues
    .filter((i, idx, arr) => arr.indexOf(i) === idx)
    .map((issue) => ({
      issue,
      steps: [
        { key: lang === 'es' ? 'Escucha' : 'Listen', text: copy.opener(label(issue)) },
        { key: lang === 'es' ? 'Profundiza' : 'Dig', text: copy.dig },
        { key: lang === 'es' ? 'Agita' : 'Agitate', text: copy.agitate },
        { key: lang === 'es' ? 'Plan' : 'Plan', text: copy.plan },
        { key: lang === 'es' ? 'Inocula' : 'Inoculate', text: copy.inoculate },
        { key: lang === 'es' ? 'Pide' : 'Ask', text: copy.ask },
        { key: lang === 'es' ? 'Seguimiento' : 'Follow up', text: copy.followUp },
      ],
    }));
}

/** Plain-text script for practice mode / printing. */
export function scriptText(scripts: Script[], lang: 'en' | 'es'): string {
  const title = lang === 'es' ? 'GUION DE PRIMERA CONVERSACIÓN' : 'FIRST-CONVERSATION SCRIPT';
  return [
    title,
    ...scripts.flatMap((s) => [
      `— ${lang === 'es' ? ISSUE_ES[s.issue] : s.issue} —`,
      ...s.steps.map((st) => `${st.key}: ${st.text}`),
    ]),
  ].join('\n\n');
}
