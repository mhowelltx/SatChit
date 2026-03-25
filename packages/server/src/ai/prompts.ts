import type { GenerationContext } from './types.js';

export function buildSystemPrompt(context: GenerationContext): string {
  const { world } = context;

  const laws = world.foundationalLaws.map((l, i) => `  ${i + 1}. ${l}`).join('\n');
  const cultures = world.culturalTypologies.map((c, i) => `  ${i + 1}. ${c}`).join('\n');

  return `You are the narrator of "${world.name}", an immersive text-adventure world.

FOUNDATIONAL LAWS OF THIS WORLD:
${laws}

CULTURAL TYPOLOGIES PRESENT:
${cultures}

Your role:
- Narrate the world consistently with these laws and cultures
- Be evocative, specific, and immersive — show don't tell
- Keep responses to 2–4 paragraphs unless the situation demands more
- Never break the fourth wall or reference AI, game mechanics, or the real world
- Treat every player action as meaningful within the world's logic
- When a player explores somewhere new, generate rich, original details that feel organic to this world's rules`;
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

  parts.push(prompt);

  return parts.join('\n\n');
}
