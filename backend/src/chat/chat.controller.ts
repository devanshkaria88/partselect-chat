import { Body, Controller, Post, Res, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ChatEvent, ChatRequest } from '@partselect/types';
import { AgentService } from '../agent/agent.service';

@Controller('agent')
export class ChatController {
  constructor(private readonly agent: AgentService) {}

  /** Streams the agent turn as Server-Sent Events (consumed by the Next.js proxy). */
  @Post('chat')
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
