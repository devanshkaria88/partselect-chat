import { Injectable } from '@nestjs/common';
import { InstallGuide, InstallStep } from '@partselect/types';
import { DbService } from '../db/db.service';

interface InstallRow {
  ps_number: string;
  available: boolean;
  difficulty: string | null;
  time_estimate: string | null;
  video_url: string | null;
  tools: string[];
  steps: InstallStep[];
  repair_stories: string[];
  source_url: string | null;
  name: string | null;
  url: string | null;
}

export interface InstallResult {
  block: InstallGuide;
  /** Raw grounding the agent uses to compose numbered steps if `steps` is empty. */
  repair_stories: string[];
  description: string | null;
}

@Injectable()
export class InstallService {
  constructor(private readonly db: DbService) {}

  async get(psNumber: string): Promise<InstallResult> {
    const ps = psNumber.trim().toUpperCase();
    const row = await this.db.one<InstallRow & { description: string | null }>(
      `SELECT g.ps_number, g.available, g.difficulty, g.time_estimate, g.video_url,
              g.tools, g.steps, g.repair_stories, g.source_url,
              p.name, p.url, p.description
       FROM products p LEFT JOIN install_guides g ON g.ps_number = p.ps_number
       WHERE upper(p.ps_number) = $1`,
      [ps],
    );

    if (!row || !row.available) {
      return {
        block: {
          kind: 'install_guide',
          ps_number: ps,
          part_name: row?.name ?? null,
          available: false,
          source_url: row?.url ?? null,
        },
        repair_stories: [],
        description: row?.description ?? null,
      };
    }

    return {
      block: {
        kind: 'install_guide',
        ps_number: ps,
        part_name: row.name,
        available: true,
        difficulty: row.difficulty,
        time_estimate: row.time_estimate,
        tools: row.tools ?? [],
        steps: row.steps ?? [],
        video_url: row.video_url,
        source_url: row.source_url ?? row.url,
      },
      repair_stories: row.repair_stories ?? [],
      description: row.description,
    };
  }
}
