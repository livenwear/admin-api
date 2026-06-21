import { ProductCategory } from '@liven/entities';

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
