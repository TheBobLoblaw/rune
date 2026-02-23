# Rune People Directory — Phase 2 (T-017, T-018)

## Goal
Add a `brokkr-mem who` command that provides rich people profiles by aggregating all facts related to a person.

## How It Works

### `brokkr-mem who <query>`
Searches all person/* facts and returns a formatted profile.

Example: `brokkr-mem who Liam`

Output:
```
╔══════════════════════════════════════╗
║  LIAM                                ║
╠══════════════════════════════════════╣
║  Discord: Leefree09 (1141561338...)  ║
║  Relation: Cory's son                ║
║  Status: Approved for DMs            ║
║                                      ║
║  Related Facts:                      ║
║  • Pulled ground beef from freezer   ║
║    (2026-02-23)                      ║
║  • Called himself "Human Agent 1"    ║
║                                      ║
║  Last Interaction: 2026-02-23        ║
╚══════════════════════════════════════╝
```

### Profile Assembly
1. Search all `person/*` facts where key or value matches the query
2. Find all relations linked to those facts
3. Pull any session summaries that mention the person
4. Format into a clean profile card

### `brokkr-mem who --list`
List all known people with one-line summaries.

### `brokkr-mem who --add <name>`
Interactive: prompts for discord ID, relationship, role, notes. Creates person/* facts.

### Auto-Profile from Extraction
When the extraction engine encounters a new person in a conversation:
1. Create person/<name>.name fact
2. Create person/<name>.relationship fact (if mentioned)
3. Create person/<name>.discord if a Discord ID/username is mentioned
4. Link to relevant project/decision facts

## Implementation Notes
- The `who` command just aggregates existing facts — no new tables needed
- Fuzzy match on person names: "liam", "Liam", "Leefree09" should all find the same person
- Add aliases: `brokkr-mem who --alias Leefree09 Liam` creates a lookup mapping
- Aliases stored as person/<alias>.alias = <canonical_name> facts

## Completion
1. `brokkr-mem who <name>` shows rich profile
2. `brokkr-mem who --list` shows all known people
3. Fuzzy matching works
4. npm install -g . works
5. Git commit: "feat(rune): people directory — who command, profiles, aliases"
6. Run: openclaw system event --text "Done: Rune people directory — who command with profile cards and aliases" --mode now
