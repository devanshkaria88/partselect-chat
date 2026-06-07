import { Injectable } from '@nestjs/common';
import { CartLine, OrderStatusBlock } from '@partselect/types';
import { DbService } from '../db/db.service';

interface OrderRow {
  order_number: string;
  status: string;
  eta: string | null;
  total: number | null;
  items: Array<{ ps_number: string; name: string | null; qty: number }>;
}

@Injectable()
export class OrdersService {
  constructor(private readonly db: DbService) {}

  private orderNumber(): string {
    // Simulated, human-readable order id. (Backend runtime — Math.random is fine here.)
    const n = Math.floor(100000 + Math.random() * 900000);
    return `PS-${n}`;
  }

  async create(items: CartLine[], total: number): Promise<OrderStatusBlock> {
    const orderNumber = this.orderNumber();
    const payload = items.map((l) => ({ ps_number: l.ps_number, name: l.name, qty: l.qty }));
    await this.db.query(
      `INSERT INTO orders (order_number, status, eta, total, items)
       VALUES ($1, 'processing', $2, $3, $4::jsonb)`,
      [orderNumber, 'Ships in 1 business day', total, JSON.stringify(payload)],
    );
    return {
      kind: 'order_status',
      order_number: orderNumber,
      status: 'processing',
      eta: 'Ships in 1 business day',
      items: payload.map((i) => `${i.qty}× ${i.name ?? i.ps_number}`),
      total,
    };
  }

  async getStatus(orderNumber: string): Promise<OrderStatusBlock | null> {
    const row = await this.db.one<OrderRow>(
      `SELECT order_number, status, eta, total, items FROM orders WHERE upper(order_number) = $1`,
      [orderNumber.trim().toUpperCase()],
    );
    if (!row) return null;
    return {
      kind: 'order_status',
      order_number: row.order_number,
      status: row.status,
      eta: row.eta,
      items: (row.items ?? []).map((i) => `${i.qty}× ${i.name ?? i.ps_number}`),
      total: row.total,
    };
  }
}
