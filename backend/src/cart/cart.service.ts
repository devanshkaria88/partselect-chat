import { Injectable } from '@nestjs/common';
import { CartBlock, OrderStatusBlock } from '@partselect/types';
import { CatalogService } from '../catalog/catalog.service';
import { OrdersService } from '../orders/orders.service';
import { SessionState } from '../session/session.service';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class CartService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly orders: OrdersService,
  ) {}

  private block(session: SessionState, note?: string): CartBlock {
    const subtotal = round2(session.cart.reduce((s, l) => s + (l.unit_price ?? 0) * l.qty, 0));
    return { kind: 'cart', items: session.cart, subtotal, currency: 'USD', note: note ?? null };
  }

  async add(session: SessionState, psOrMpn: string, qty = 1): Promise<{ block: CartBlock; ok: boolean; note: string }> {
    const part = await this.catalog.getByPsOrMpn(psOrMpn);
    if (!part) {
      return { block: this.block(session), ok: false, note: `Couldn't find part "${psOrMpn}".` };
    }
    if (part.price == null) {
      return {
        block: this.block(session, `${part.name} is call-for-price and can't be added to the cart.`),
        ok: false,
        note: `${part.ps_number} has no listed price (special order).`,
      };
    }
    const q = Math.max(1, Math.floor(qty));
    const existing = session.cart.find((l) => l.ps_number === part.ps_number);
    if (existing) existing.qty += q;
    else session.cart.push({ ps_number: part.ps_number, name: part.name, qty: q, unit_price: part.price });
    session.last_part_ps = part.ps_number;
    const note =
      part.availability && part.availability !== 'InStock'
        ? `Added — note this part is ${part.availability}.`
        : `Added ${q}× ${part.name} to your cart.`;
    return { block: this.block(session, note), ok: true, note };
  }

  view(session: SessionState): CartBlock {
    return this.block(session, session.cart.length ? undefined : 'Your cart is empty.');
  }

  /** Set an absolute quantity for a line; qty <= 0 removes it. Powers the cart drawer's +/-. */
  setQty(session: SessionState, psNumber: string, qty: number): CartBlock {
    const ps = psNumber.trim().toUpperCase();
    const line = session.cart.find((l) => l.ps_number.toUpperCase() === ps);
    if (line) {
      if (qty <= 0) session.cart = session.cart.filter((l) => l.ps_number.toUpperCase() !== ps);
      else line.qty = Math.floor(qty);
    }
    return this.block(session);
  }

  async checkout(session: SessionState): Promise<CartBlock | OrderStatusBlock> {
    if (!session.cart.length) return this.block(session, 'Your cart is empty — add a part first.');
    const total = round2(session.cart.reduce((s, l) => s + (l.unit_price ?? 0) * l.qty, 0));
    const order = await this.orders.create(session.cart, total);
    session.cart = []; // simulated checkout clears the cart
    return order;
  }
}
