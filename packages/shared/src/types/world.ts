export type WorldVisibility = 'PUBLIC' | 'PRIVATE';

export interface World {
  id: string;
  creatorId: string;
  name: string;
  slug: string;
  description: string;
  visibility: WorldVisibility;
  foundationalLaws: string[];
  culturalTypologies: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WorldSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  visibility: WorldVisibility;
  creatorId: string;
  createdAt: Date;
}

export interface CreateWorldInput {
  name: string;
  description: string;
  visibility: WorldVisibility;
  foundationalLaws: string[];
  culturalTypologies: string[];
}
