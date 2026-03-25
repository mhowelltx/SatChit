import type { PrismaClient } from '@prisma/client';
import type { World } from '@satchit/shared';
import type { IAIProvider } from '../ai/index.js';
import { AnthropicProvider } from '../ai/providers/anthropic.js';

// ── Template shape types ───────────────────────────────────────────────────

export interface TemplateAttributeOption {
  value: string;
  label: string;
}

export type TemplateAttributeType = 'text' | 'textarea' | 'select' | 'multiselect' | 'number';

export interface TemplateAttribute {
  key: string;
  label: string;
  type: TemplateAttributeType;
  description: string;
  options?: string[];         // for select / multiselect
  min?: number;               // for number
  max?: number;               // for number
  required?: boolean;
  placeholder?: string;
}

export interface TemplateStat {
  key: string;
  label: string;
  description: string;
  min: number;
  max: number;
  default: number;
}

export interface TemplateSkillCategory {
  key: string;
  label: string;
  description: string;
  examples: string[];
}

export interface WorldCharacterTemplate {
  worldId: string;
  factions: Array<{ id: string; name: string; description: string }>;
  customAttributes: TemplateAttribute[];
  stats: TemplateStat[];
  affinities: string[];
  traitSuggestions: string[];
  skillCategories: TemplateSkillCategory[];
}

// Example shape fed to generateStructured so AI knows the schema to return
const TEMPLATE_SHAPE: Omit<WorldCharacterTemplate, 'worldId'> = {
  factions: [
    { id: 'faction_id', name: 'Faction Name', description: 'Brief description of this group.' },
  ],
  customAttributes: [
    {
      key: 'attribute_key',
      label: 'Display Label',
      type: 'select',
      description: 'What this attribute means in this world.',
      options: ['Option A', 'Option B'],
      required: false,
      placeholder: 'Choose one…',
    },
    {
      key: 'another_key',
      label: 'Another Field',
      type: 'textarea',
      description: 'What this field captures.',
      placeholder: 'Describe…',
    },
  ],
  stats: [
    {
      key: 'stat_key',
      label: 'Stat Name',
      description: 'What this stat represents.',
      min: 1,
      max: 10,
      default: 5,
    },
  ],
  affinities: ['Affinity One', 'Affinity Two', 'Affinity Three'],
  traitSuggestions: ['trait one', 'trait two', 'trait three'],
  skillCategories: [
    {
      key: 'skill_category_key',
      label: 'Skill Category',
      description: 'What types of skills fall here.',
      examples: ['example skill 1', 'example skill 2'],
    },
  ],
};

export class WorldTemplateService {
  constructor(
    private prisma: PrismaClient,
    private ai: IAIProvider,
  ) {}

  private providerFor(world: World): IAIProvider {
    if (world.anthropicApiKey) {
      return new AnthropicProvider(world.anthropicApiKey);
    }
    return this.ai;
  }

  /**
   * Return the template for a world, generating it with AI if it doesn't exist yet.
   */
  async getOrGenerate(world: World): Promise<WorldCharacterTemplate> {
    const existing = await this.prisma.worldCharacterTemplate.findUnique({
      where: { worldId: world.id },
    });

    if (existing) {
      return { worldId: world.id, ...(existing.templateJson as unknown as Omit<WorldCharacterTemplate, 'worldId'>) };
    }

    return this.generate(world);
  }

  /**
   * Force-regenerate and persist a new template for the world.
   */
  async generate(world: World): Promise<WorldCharacterTemplate> {
    const ai = this.providerFor(world);

    const prompt = `
You are designing a character creation form for players entering the world of "${world.name}".

World description:
${world.description}

Foundational laws of this world:
${(world.foundationalLaws ?? []).map((l, i) => `${i + 1}. ${l}`).join('\n')}

Cultural groups / typologies:
${(world.culturalTypologies ?? []).map((c, i) => `${i + 1}. ${c}`).join('\n')}

Design a character creation template that captures what makes a character unique and alive in THIS world specifically.
Guidelines:
- Factions should map directly to the world's cultural groups (use their actual names).
- Custom attributes should capture world-specific lore beyond generic fantasy fields. Include 4–8 attributes.
  Use "select" for constrained choices, "textarea" for open narrative fields, "text" for short answers, "multiselect" for multiple selections.
- Stats should replace generic combat stats with values that matter in this world (4–6 stats, scored 1–10).
- Affinities are special abilities or bonds unique to this world (6–12 options, players can pick multiple).
- Trait suggestions should be 10–16 personality traits flavored by this world's cultures.
- Skill categories should group the kinds of skills players develop here (3–5 categories).
- All keys must be snake_case, all labels must be human-readable.
`.trim();

    const context = {
      world: {
        name: world.name,
        foundationalLaws: world.foundationalLaws,
        culturalTypologies: world.culturalTypologies,
      },
    };

    const generated = await ai.generateStructured(prompt, context, TEMPLATE_SHAPE);

    if (!generated) {
      throw new Error(`AI failed to generate character template for world ${world.id}`);
    }

    // Persist
    await this.prisma.worldCharacterTemplate.upsert({
      where: { worldId: world.id },
      create: { worldId: world.id, templateJson: generated as object },
      update: { templateJson: generated as object },
    });

    return { worldId: world.id, ...generated };
  }
}
