export type ItemType = 'weapon' | 'armor' | 'consumable' | 'key' | 'document' | 'misc';

export interface Item {
  id: string;
  worldId: string;
  name: string;
  description: string;
  itemType: ItemType | string;
  attributes: Record<string, unknown>;
  createdAt: Date;
}
