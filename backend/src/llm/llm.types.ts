export type Tier = 'fast' | 'default' | 'deep';

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}
