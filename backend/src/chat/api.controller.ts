import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { SessionService } from '../session/session.service';
import { TracesService } from '../traces/traces.service';
import { OkDto, SessionClearDto, TraceRecordDto } from '../http/dto';

/** System endpoints: health, session reset, and the trace-inspection endpoint. */
@ApiTags('system')
@Controller()
export class ApiController {
  constructor(
    private readonly session: SessionService,
    private readonly traces: TracesService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkResponse({ type: OkDto })
  health() {
    return { ok: true };
  }

  @Post('session/clear')
  @ApiOperation({ summary: 'Clear a session', description: 'Wipes messages, cart, and the captured model number for the given session.' })
  @ApiOkResponse({ type: OkDto })
  async clearSession(@Body() body: SessionClearDto) {
    if (body?.session_id) await this.session.clear(body.session_id);
    return { ok: true };
  }

  @Get('debug/trace/:turnId')
  @ApiOperation({
    summary: 'Fetch the trace for one turn',
    description: 'Returns the agent_traces row: tools, args, per-step latency, tokens, cache reads, model tier, scope verdict, and timings.',
  })
  @ApiParam({ name: 'turnId', description: 'The turn_id from a meta frame' })
  @ApiOkResponse({ type: TraceRecordDto })
  @ApiNotFoundResponse({ description: 'trace not found' })
  async trace(@Param('turnId') turnId: string) {
    const row = await this.traces.get(turnId);
    if (!row) throw new NotFoundException('trace not found');
    return row;
  }
}
