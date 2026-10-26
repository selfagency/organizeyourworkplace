export const en = {
  'site.name': 'Organize Your Workplace',
  'nav.start': 'Start Here',
  'nav.rights': 'Your Rights',
  'nav.organize': 'Organize',
  'nav.unions': 'Find a Union',
  'nav.vote': 'Win the Vote',
  'nav.contract': 'Win the Contract',
  'nav.run': 'Run Your Union',
  'nav.toolkit': 'Toolkit',
  'nav.case': 'Make the Case',
  'nav.help': 'Get Help',
  'cta.retaliation': 'Boss retaliating? →',
  'banner.workDevice':
    'On a work laptop, work phone, or work Wi-Fi? Close this and come back on your own phone.',
  'banner.dismiss': 'Got it',
  'quickExit.button': 'Quick Exit',
  'quickExit.aria': 'Leave this site immediately',
  'leave.title': "You're leaving Organize Your Workplace",
  'leave.body':
    "{domain} isn't run by us. It may keep records of your visit. On a work phone, work computer or work Wi-Fi? Go back.",
  'leave.goBack': 'Go back',
  'leave.continue': 'Continue to {domain}',
  'leave.intake':
    'Organizers will contact you. Use a personal phone number and email.',
  'leave.noscript':
    'Links on this page go to other websites. On a work device, be careful.',
  'footer.notLegalAdvice': 'Not legal advice',
  'footer.privacy': 'Privacy',
  'footer.sources': 'Sources & methods',
  'footer.changelog': 'Changelog',
  'footer.turnOffCounting': 'Turn off counting',
  'footer.countingLine':
    'We count page visits without cookies or your IP address. The tools and the workspace are never counted.',
  'legal.statusAsOf': 'Status as of {date}',
  'legal.whatsChanged': "What's changed →",
  'legal.notLegalAdvice':
    'Not legal advice. Talk to a worker-side lawyer or worker center →',
  'page.nextSteps': 'Your next 3 steps',
  'page.sources': 'Sources',
  'page.watchOut': 'Watch out',
  'page.whatToDoNow': 'What to do now',
  'page.whatThisMeans': 'What this means for you',
} as const;

export type Catalog = typeof en;
export type StringKey = keyof Catalog;