import { Column, Entity, Index, OneToMany } from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

/**
 * Homepage promo card strip (Digikala-style square cards).
 * Max 5 rows site-wide; each row holds up to 5 cards.
 * `slot` (1–5) controls interleave order between homepage sections.
 */
@Entity({ name: 'promo_card_rows' })
export class PromoCardRow extends AbstractEntity {
  @Column({ type: 'varchar' })
  title: string;

  /** Homepage placement order among interleave gaps (1–5) */
  @Index({ unique: true })
  @Column({ type: 'int' })
  slot: number;

  /** How many cards to render in the storefront (1–5) */
  @Column({ type: 'int', default: 5 })
  visibleCount: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany('PromoCard', 'row')
  cards: any[];
}
