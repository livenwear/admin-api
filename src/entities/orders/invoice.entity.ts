import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'invoices' })
export class Invoice extends AbstractEntity {
  @ManyToOne('Order', 'invoices', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: any;

  @Column({ name: 'order_id' })
  orderId: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', unique: true })
  invoiceNumber: string;

  @Column({ type: 'timestamptz' })
  issuedAt: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', nullable: true })
  pdfUrl: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
