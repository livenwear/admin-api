import { Blog } from '@liven/entities';
import { CreateSingleBlogDto, FetchAllBlogsDto } from './dto';

export class BlogAdminProvider {
  // static toBlogListItem(blog: Blog): FetchAllBlogsDto {
  //   const blogDto = new FetchAllBlogsDto();

  //   blogDto.uuid = blog.uuid;
  //   blogDto.id = blog.id;
  //   blogDto.title = blog.title;
  //   blogDto.slug = blog.slug;
  //   blogDto.content = blog.content;
  //   blogDto.excerpt = blog.excerpt;
  //   blogDto.featuredImage = blog.featuredImage;
  //   blogDto.metaTitle = blog.metaTitle;
  //   blogDto.metaDescription = blog.metaDescription;
  //   blogDto.metaKeywords = blog.metaKeywords;
  //   blogDto.status = blog.status;
  //   blogDto.publishedAt = blog.publishedAt;
  //   blogDto.priority = blog?.priority ?? 0;
  //   blogDto.canonicalUrl = blog.canonicalUrl;
  //   blogDto.createdAt = blog.createdAt;
  //   blogDto.updatedAt = blog.updatedAt;

  //   blogDto.author = {
  //     id: blog.author?.id,
  //     // ⚠️ You had `lastName` before — switched to `username` to match DTO spec
  //     username: blog.author?.lastName ?? '',
  //   };

  //   // ✅ Map categories (uuid → id, title, slug)
  //   blogDto.categories = blog.categories
  //     ? blog.categories.map(cat => ({
  //         id: cat.uuid, // your DTO expects string id, so use UUID here
  //         title: cat.title,
  //         slug: cat.slug,
  //       }))
  //     : [];

  //   // ✅ Map tags
  //   blogDto.tags = blog.tags
  //     ? blog.tags.map(tag => ({
  //         id: tag.uuid, // same here: UUID as string
  //         title: tag.title, // adjust if your entity has `name` instead
  //       }))
  //     : [];

  //   return blogDto;
  // }

  // static toCreateBlog(blog: Blog): CreateSingleBlogDto {
  //   const blogDto = new CreateSingleBlogDto();

  //   blogDto.slug = blog.slug ?? '';
  //   blogDto.content = blog.content ?? '';
  //   blogDto.excerpt = blog.excerpt ?? '';
  //   blogDto.featuredImage = blog.featuredImage ?? '';
  //   blogDto.metaTitle = blog.metaTitle ?? '';
  //   blogDto.metaDescription = blog.metaDescription ?? '';
  //   blogDto.metaKeywords = blog.metaKeywords ?? '';
  //   blogDto.status = blog.status;
  //   blogDto.publishedAt = blog.publishedAt ?? undefined;
  //   blogDto.priority = blog.priority ?? 0;
  //   blogDto.canonicalUrl = blog.canonicalUrl ?? '';
  //   blogDto.createdAt = blog.createdAt;
  //   blogDto.updatedAt = blog.updatedAt;

  //   blogDto.author = {
  //     id: blog.author?.id ?? 0,
  //     username: blog.author?.lastName ?? '',
  //   };

  //   return blogDto;
  // }
}
