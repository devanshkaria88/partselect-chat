import { Injectable } from '@nestjs/common';
import { UnavailableBlock } from '@partselect/types';
import { CartService } from '../../cart/cart.service';
import { OrdersService } from '../../orders/orders.service';
import { AgentTool, ToolContext, ToolResult } from '../tool.types';

@Injectable()
export class AddToCartTool implements AgentTool {
  name = 'add_to_cart';
  description =
    'Add a part to the (simulated) cart by PS#, resolving "this part"/"it" from context. ' +
    'Call-for-price (no listed price) parts cannot be added.';
  inputSchema = {
    type: 'object',
    properties: {
      ps_number: { type: 'string', description: 'Part PS# (omit to use the part in context)' },
      quantity: { type: 'number', description: 'default 1' },
    },
  };
  constructor(private readonly cart: CartService) {}
  label(): string {
    return 'Adding to cart…';
  }
  async run(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const ps = (input.ps_number as string) || ctx.session.last_part_ps || '';
    if (!ps) return { data: { error: 'no_part' }, ui: [], summary: 'add_to_cart:no_part' };
    const r = await this.cart.add(ctx.session, ps, (input.quantity as number) ?? 1);
    return { data: { ok: r.ok, note: r.note, items: ctx.session.cart.length }, ui: [r.block], summary: `add_to_cart(${ps}) ok=${r.ok}` };
  }
}

@Injectable()
export class ViewCartTool implements AgentTool {
  name = 'view_cart';
  description = 'Show the current contents of the simulated cart with a subtotal.';
  inputSchema = { type: 'object', properties: {} };
  constructor(private readonly cart: CartService) {}
  label(): string {
    return 'Opening your cart…';
  }
  async run(_input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const block = this.cart.view(ctx.session);
    return { data: { items: block.items, subtotal: block.subtotal }, ui: [block], summary: `view_cart(${block.items.length})` };
  }
}

@Injectable()
export class CheckoutTool implements AgentTool {
  name = 'checkout';
  description = 'Place a simulated order for everything in the cart and return the order confirmation.';
  inputSchema = { type: 'object', properties: {} };
  constructor(private readonly cart: CartService) {}
  label(): string {
    return 'Placing your order…';
  }
  async run(_input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const block = await this.cart.checkout(ctx.session);
    const summary = block.kind === 'order_status' ? `checkout → ${block.order_number}` : 'checkout:empty';
    return { data: block, ui: [block], summary };
  }
}

@Injectable()
export class GetOrderStatusTool implements AgentTool {
  name = 'get_order_status';
  description = 'Look up the status of a simulated order by its order number (e.g. PS-123456).';
  inputSchema = {
    type: 'object',
    properties: { order_number: { type: 'string' } },
    required: ['order_number'],
  };
  constructor(private readonly orders: OrdersService) {}
  label(): string {
    return 'Checking order status…';
  }
  async run(input: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const num = String(input.order_number ?? '').trim();
    const block = await this.orders.getStatus(num);
    if (!block) {
      const u: UnavailableBlock = {
        kind: 'unavailable',
        capability: 'order_status',
        message: `I couldn't find an order matching "${num}". Double-check the order number?`,
      };
      return { data: { found: false }, ui: [u], summary: `get_order_status(${num}) → not found` };
    }
    return { data: block, ui: [block], summary: `get_order_status(${num}) → ${block.status}` };
  }
}
