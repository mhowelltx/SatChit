export type TemplateAttributeType = 'text' | 'textarea' | 'select' | 'multiselect' | 'number';

export interface TemplateAttribute {
  key: string;
  label: string;
  type: TemplateAttributeType;
  description: string;
  options?: string[];   // for select / multiselect
  min?: number;         // for number
  max?: number;         // for number
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
