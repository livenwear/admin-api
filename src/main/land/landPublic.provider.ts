import { ProductCategory } from 'src/database/entities/product/product-category.entity';

export class LandPublicProvider {
  static categoryListItem(category: ProductCategory) {
    return {
      id: category.id,
      uuid: category.uuid,
      title: category.title,
      slug: category.slug,
    
    };
  }
}
