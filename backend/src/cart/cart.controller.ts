import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { SessionService } from '../session/session.service';
import { CartService } from './cart.service';

/** Direct REST cart so the storefront works as a normal cart WITHOUT the agent. Operates on
 *  the same Postgres-backed session cart the agent's tools use, so the two stay in sync. */
@Controller('cart')
export class CartController {
  constructor(
    private readonly session: SessionService,
    private readonly cart: CartService,
  ) {}

  @Get()
  async view(@Query('session_id') sessionId: string) {
    const s = await this.session.getOrCreate(sessionId);
    return { cart: this.cart.view(s) };
  }

  @Post('add')
  async add(@Body() body: { session_id?: string; ps_number: string; quantity?: number }) {
    const s = await this.session.getOrCreate(body.session_id);
    const r = await this.cart.add(s, body.ps_number, body.quantity ?? 1);
    await this.session.persist(s);
    return { cart: r.block, ok: r.ok, note: r.note, session_id: s.id };
  }

  @Post('set-qty')
  async setQty(@Body() body: { session_id?: string; ps_number: string; quantity: number }) {
    const s = await this.session.getOrCreate(body.session_id);
    const cart = this.cart.setQty(s, body.ps_number, body.quantity);
    await this.session.persist(s);
    return { cart, session_id: s.id };
  }

  @Post('checkout')
  async checkout(@Body() body: { session_id?: string }) {
    const s = await this.session.getOrCreate(body.session_id);
    const result = await this.cart.checkout(s);
    await this.session.persist(s);
    return { result, session_id: s.id };
  }
}
