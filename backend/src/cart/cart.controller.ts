import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SessionService } from '../session/session.service';
import { CartService } from './cart.service';
import {
  CartAddDto,
  CartCheckoutDto,
  CartCheckoutResultDto,
  CartMutationDto,
  CartSetQtyDto,
  CartViewDto,
} from '../http/dto';

/** Direct REST cart so the storefront works as a normal cart WITHOUT the agent. Operates on
 *  the same Postgres-backed session cart the agent's tools use, so the two stay in sync. */
@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(
    private readonly session: SessionService,
    private readonly cart: CartService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'View the session cart' })
  @ApiQuery({ name: 'session_id', required: false, description: 'Created if absent' })
  @ApiOkResponse({ type: CartViewDto })
  async view(@Query('session_id') sessionId: string) {
    const s = await this.session.getOrCreate(sessionId);
    return { cart: this.cart.view(s) };
  }

  @Post('add')
  @ApiOperation({ summary: 'Add a part to the cart', description: 'Call-for-price parts (no listed price) are rejected with ok=false.' })
  @ApiOkResponse({ type: CartMutationDto })
  async add(@Body() body: CartAddDto) {
    const s = await this.session.getOrCreate(body.session_id);
    const r = await this.cart.add(s, body.ps_number, body.quantity ?? 1);
    await this.session.persist(s);
    return { cart: r.block, ok: r.ok, note: r.note, session_id: s.id };
  }

  @Post('set-qty')
  @ApiOperation({ summary: 'Set an absolute line quantity', description: 'Quantity of 0 or less removes the line. Powers the drawer +/- controls.' })
  @ApiOkResponse({ type: CartMutationDto })
  async setQty(@Body() body: CartSetQtyDto) {
    const s = await this.session.getOrCreate(body.session_id);
    const cart = this.cart.setQty(s, body.ps_number, body.quantity);
    await this.session.persist(s);
    return { cart, session_id: s.id };
  }

  @Post('checkout')
  @ApiOperation({ summary: 'Simulated checkout', description: 'Creates a simulated order and clears the cart. Returns an order_status block, or a cart block if the cart was empty.' })
  @ApiOkResponse({ type: CartCheckoutResultDto })
  async checkout(@Body() body: CartCheckoutDto) {
    const s = await this.session.getOrCreate(body.session_id);
    const result = await this.cart.checkout(s);
    await this.session.persist(s);
    return { result, session_id: s.id };
  }
}
