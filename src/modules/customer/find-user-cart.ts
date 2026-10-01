import { Repository } from 'typeorm';
import { Cart } from 'src/entities';

/**
 * A user can end up with more than one cart (parallel create). Checkout used
 * an unordered findOne and sometimes returned the empty twin, so shipping
 * showed only the courier fee until a refresh hit the cart that had items.
 */
export async function findBestUserCart(
  cartRepo: Repository<Cart>,
  userId: number,
): Promise<Cart | null> {
  const raw = await cartRepo
    .createQueryBuilder('cart')
    .select('cart.id', 'id')
    .leftJoin('cart.items', 'ci')
    .where('cart.userId = :userId', { userId })
    .groupBy('cart.id')
    .addGroupBy('cart.updatedAt')
    .orderBy('COUNT(ci.id)', 'DESC')
    .addOrderBy('cart.updatedAt', 'DESC')
    .limit(1)
    .getRawOne<Record<string, unknown>>();

  const idValue = raw?.id ?? raw?.cart_id ?? raw?.cartId;
  const id = idValue != null ? Number(idValue) : NaN;
  if (!Number.isFinite(id)) return null;
  return cartRepo.findOne({ where: { id } });
}
