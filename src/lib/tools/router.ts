/**
 * T1 Router logic (plans/03-private-tools.md §T1).
 * Pure function: six answers -> route decision. No DOM, no network.
 * Q4 = yes (punished for speaking up) always wins: the 6-month ULP clock.
 */

export interface RouterAnswers {
  /** Q1 employer kind */
  employer: 'company' | 'nonprofit' | 'airline-rail' | 'church' | 'government';
  /** Q3 talked to coworkers? */
  talked: 'no' | 'few' | 'committee';
  /** Q4 punished for speaking up? */
  punished: boolean;
  /** Q5 existing union or drive? */
  union: 'no' | 'drive' | 'union';
}

export interface RouterResult {
  /** Primary route (localized path prefix added by the UI). */
  href: string;
  /** Secondary links shown under the primary. */
  also: { href: string; key: string }[];
  /** Out-of-scope notice key (government). */
  notice?: 'government';
  /** EWOC handoff enabled (normal private-sector paths). */
  ewoc: boolean;
}

const also = (href: string, key: string) => ({ href, key });

export function route(answers: RouterAnswers): RouterResult {
  // Q4 = yes wins over everything (hard rule in the spec).
  if (answers.punished) {
    return {
      href: '/help/retaliation',
      also: [also('/help/file-a-charge', 'fileCharge'), also('/toolkit/deadlines', 'deadlines')],
      ewoc: true,
    };
  }

  if (answers.employer === 'government') {
    return {
      href: '/rights/am-i-covered',
      also: [also('/help/worker-centers', 'workerCenters')],
      notice: 'government',
      ewoc: false,
    };
  }

  if (answers.employer === 'airline-rail') {
    return {
      href: '/rights/am-i-covered/airlines-rail',
      also: [also('/organize/first-conversation', 'firstConversation')],
      ewoc: true,
    };
  }

  if (answers.employer === 'church') {
    return {
      href: '/rights/am-i-covered/religious-employers',
      also: [also('/organize/first-conversation', 'firstConversation')],
      ewoc: true,
    };
  }

  if (answers.union === 'union') {
    return {
      href: '/run/stewards',
      also: [also('/rights/section-7', 'section7'), also('/run/grievances', 'grievances')],
      ewoc: false,
    };
  }

  if (answers.union === 'drive') {
    return {
      href: '/organize/committee',
      also: [also('/unions/how-to-pick', 'howToPick')],
      ewoc: true,
    };
  }

  if (answers.talked === 'no') {
    return {
      href: '/organize/first-conversation',
      also: [also('/organize/map-your-workplace', 'mapping')],
      ewoc: true,
    };
  }

  if (answers.talked === 'few') {
    return {
      href: '/organize/committee',
      also: [also('/organize/map-your-workplace', 'mapping'), also('/organize/leaders', 'leaders')],
      ewoc: true,
    };
  }

  // Committee exists -> matcher, pre-filled by the UI via query params.
  return {
    href: '/unions/matcher',
    also: [also('/unions/profiles', 'profiles'), also('/unions/how-to-pick', 'howToPick')],
    ewoc: true,
  };
}

/** EWOC paste payload from answers (max 3000 chars, plain text). */
export function ewocPayload(
  answers: RouterAnswers & { state?: string; job?: string; headcount?: string; situation?: string },
  lang: 'en' | 'es',
): string {
  const t =
    lang === 'es'
      ? {
          job: 'Trabajo y empleador', head: 'Aprox. compañeros', state: 'Estado',
          talked: 'Ya habló con compañeros', punished: 'Alguien castigado por hablar',
          union: '¿Sindicato o campaña existente?', situation: 'Situación',
        }
      : {
          job: 'Job and employer', head: 'Approx. coworkers', state: 'State',
          talked: 'Talked to coworkers yet', punished: 'Anyone punished for speaking up',
          union: 'Existing union or drive?', situation: 'Situation',
        };
  const yes = lang === 'es' ? 'sí' : 'yes';
  const no = lang === 'es' ? 'no' : 'no';
  const body = [
    `${t.job}: ${answers.job ?? '-'}`,
    `${t.head}: ${answers.headcount ?? '-'}`,
    `${t.state}: ${answers.state ?? '-'}`,
    `${t.talked}: ${answers.talked}`,
    `${t.punished}: ${answers.punished ? yes : no}`,
    `${t.union}: ${answers.union}`,
    `${t.situation}: ${(answers.situation ?? '').slice(0, 3000)}`,
  ].join('\n');
  return body.slice(0, 3000);
}
