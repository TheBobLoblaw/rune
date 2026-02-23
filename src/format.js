const CATEGORY_TITLES = {
  person: 'People',
  project: 'Projects',
  preference: 'Preferences',
  decision: 'Decisions',
  lesson: 'Lessons',
  environment: 'Environment',
  tool: 'Tools'
};

export function titleForCategory(category) {
  if (CATEGORY_TITLES[category]) {
    return CATEGORY_TITLES[category];
  }
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function factsToMarkdown(facts) {
  const grouped = new Map();
  for (const fact of facts) {
    if (!grouped.has(fact.category)) {
      grouped.set(fact.category, []);
    }
    grouped.get(fact.category).push(fact);
  }

  const categories = [...grouped.keys()].sort((a, b) => a.localeCompare(b));
  const lines = ['# Known Facts', ''];

  for (const category of categories) {
    lines.push(`## ${titleForCategory(category)}`);
    for (const fact of grouped.get(category)) {
      lines.push(`- **${fact.key}**: ${fact.value}`);
    }
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}
