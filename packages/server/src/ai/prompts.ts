import type { GenerationContext } from './types.js';

export function buildSystemPrompt(context: GenerationContext): string {
  const { world } = context;

  const laws = world.foundationalLaws.map((l, i) => `  ${i + 1}. ${l}`).join('\n');
  const cultures = world.culturalTypologies.map((c, i) => `  ${i + 1}. ${c}`).join('\n');

  // Environmental fading: after 3 messages in a zone, stop re-describing the surroundings
  const environmentInstruction =
    (context.zoneMessageCount ?? 0) < 3
      ? '- On the first few visits, anchor the scene with one vivid environmental detail (sound, smell, light) to orient the reader'
      : '- The player knows this place — skip re-describing the environment; focus entirely on their action and its consequences';

  // Narrative tension: shift register based on session activity level
  const sessionCount = context.sessionActionCount ?? 0;
  const tensionInstruction =
    sessionCount > 15
      ? '- The session has been intense; keep prose terse and urgent — short sentences, immediate stakes'
      : sessionCount > 8
        ? '- Maintain a measured pace — action-focused but with room for one evocative detail'
        : '- The world is still being discovered; allow a slightly more lyrical, exploratory tone';

  // Mood persistence: carry the ambient tone from the previous exchange
  const moodInstruction = context.currentMood
    ? `- Maintain narrative continuity with the current mood: "${context.currentMood}" — shift only if the player's action clearly warrants a change`
    : '';

  // Atmosphere tags: reinforce zone personality
  const atmosphereInstruction =
    context.atmosphereTags && context.atmosphereTags.length > 0
      ? `- This zone's established atmosphere: ${context.atmosphereTags.join(', ')} — let this colour the tone without over-explaining it`
      : '';

  const roleLines = [
    '- Narrate the world consistently with these laws and cultures',
    '- Be evocative, specific, and immersive — show don\'t tell',
    '- Keep responses to 1–2 paragraphs; be vivid but concise',
    '- Never break the fourth wall or reference AI, game mechanics, or the real world',
    '- Treat every player action as meaningful within the world\'s logic',
    '- When a player explores somewhere new, generate rich, original details that feel organic to this world\'s rules',
    environmentInstruction,
    tensionInstruction,
    moodInstruction,
    atmosphereInstruction,
  ].filter(Boolean).join('\n');

  return `You are the narrator of "${world.name}", an immersive text-adventure world.

FOUNDATIONAL LAWS OF THIS WORLD:
${laws}

CULTURAL TYPOLOGIES PRESENT:
${cultures}

Your role:
${roleLines}`;
}

export function buildUserPrompt(prompt: string, context: GenerationContext): string {
  const parts: string[] = [];

  if (context.currentZone) {
    parts.push(`Current location: ${context.currentZone.name}\n${context.currentZone.description}`);
  }

  if (context.nearbyZones && context.nearbyZones.length > 0) {
    const nearby = context.nearbyZones.map((z) => z.name).join(', ');
    parts.push(`Nearby areas: ${nearby}`);
  }

  if (context.worldLore && context.worldLore.length > 0) {
    const loreSnippets = context.worldLore
      .slice(0, 5)
      .map((l) => `[${l.category}] ${l.title}: ${l.content.slice(0, 200)}`)
      .join('\n');
    parts.push(`Relevant world lore:\n${loreSnippets}`);
  }

  // Zone re-entry memory: remind AI of what happened here before
  if (context.zoneHistory && context.zoneHistory.length > 0) {
    const history = context.zoneHistory.slice(0, 3).join('\n- ');
    parts.push(`What has happened here before:\n- ${history}`);
  }

  // NPC relationship context
  if (context.npcRelationships && Object.keys(context.npcRelationships).length > 0) {
    const relLines = Object.entries(context.npcRelationships)
      .map(([name, score]) => {
        const label =
          score >= 60 ? 'devoted' :
          score >= 30 ? 'friendly' :
          score >= 10 ? 'warm' :
          score > -10 ? 'neutral' :
          score > -30 ? 'cool' :
          score > -60 ? 'wary' : 'hostile';
        return `${name}: ${label} (${score > 0 ? '+' : ''}${score})`;
      })
      .join(', ');
    parts.push(`Player's standing with NPCs here: ${relLines}`);
  }

  parts.push(prompt);

  return parts.join('\n\n');
}
