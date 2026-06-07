import { Body, Controller, Post, Res, HttpException, HttpStatus } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ChatEvent, ChatRequest } from '@partselect/types';
import { AgentService } from '../agent/agent.service';
import { CHAT_EVENT_DTOS, ChatRequestDto } from '../http/dto';

@ApiTags('chat')
@ApiExtraModels(...CHAT_EVENT_DTOS)
@Controller('agent')
export class ChatController {
  constructor(private readonly agent: AgentService) {}

  /** Streams the agent turn as Server-Sent Events (consumed by the Next.js proxy). */
  @Post('chat')
  @ApiOperation({
    summary: 'Run one agent turn (streaming)',
    description:
      'Scope-guards the message, then runs the tool-use loop and streams the turn as ' +
      'Server-Sent Events. Each `data:` line is one ChatEvent frame (token | tool | ui | ' +
      'meta | done | error). OpenAPI cannot model the stream itself, so the schema below ' +
      'documents the individual frame shapes; the response is `text/event-stream`, not JSON.',
  })
  @ApiBody({ type: ChatRequestDto })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description: 'SSE stream of ChatEvent frames (one per `data:` line)',
    content: {
      'text/event-stream': {
        schema: { oneOf: CHAT_EVENT_DTOS.map((d) => ({ $ref: getSchemaPath(d) })) },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'message is required' })
  async chat(@Body() body: ChatRequest, @Res() res: Response): Promise<void> {
    const message = (body?.message ?? '').trim();
    if (!message) throw new HttpException('message is required', HttpStatus.BAD_REQUEST);

    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    const send = (e: ChatEvent) => res.write(`data: ${JSON.stringify(e)}\n\n`);
    try {
      for await (const ev of this.agent.run(body.session_id, message)) send(ev);
    } catch (e) {
      send({ type: 'error', message: (e as Error).message });
      send({ type: 'done' });
    } finally {
      res.end();
    }
  }
}
