# Liven Database Schema

Online clothing store schema. Source of truth for TypeORM entities under `api/src/entities/`.

**How to update:** When you add/change an entity, update the matching section here and the Mermaid diagram in the same domain group.

## Conventions

| Rule | Detail |
|------|--------|
| Table names | snake_case plural (exact list below) |
| Primary key | `id` (serial) + `uuid` on main entities via `AbstractEntity` |
| Soft delete | `deletedAt` on main entities only; junctions are hard-deleted |
| Money | `decimal(12,2)` on variants via `prices` / order snapshots |
| Variants | SKU, stock (`inventories`), and price live on `product_variants` |
| Attributes | Flexible EAV: Size / Color / Material without hardcoding |
| Roles | `roles` + `user_roles` — no enum column on `users` |

## Table inventory

### Auth
`users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `refresh_tokens`, `audit_logs`

### Catalog
`categories`, `brands`, `collections`, `tags`

### Products
`products`, `product_variants`, `attributes`, `attribute_values`, `variant_attribute_values`, `product_categories`, `product_images`, `product_files`, `product_tags`, `product_collections`, `product_related`, `product_labels`

### Pricing
`prices`, `tier_prices`, `discounts`, `discount_products`, `discount_categories`, `discount_brands`, `coupons`, `coupon_products`, `coupon_categories`

### Inventory
`warehouses`, `inventories`, `stock_movements`

### Shopping
`carts`, `cart_items`, `wishlists`, `wishlist_items`

### Orders
`orders`, `order_items`, `payments`, `shipments`, `invoices`

### Content
`posts`, `post_categories`, `post_tags`, `post_products`, `post_category_relations`, `post_tag_relations`, `comments`

### Media
`files`

### CMS
`banners`, `sliders`, `slider_items`, `menus`, `menu_items`, `pages`, `settings`

### Customer
`addresses`, `reviews`, `notifications`, `newsletter_subscribers`, `contact_messages`

---

## Auth

```mermaid
erDiagram
  users ||--o{ user_roles : has
  roles ||--o{ user_roles : has
  roles ||--o{ role_permissions : has
  permissions ||--o{ role_permissions : has
  users ||--o{ refresh_tokens : has
  users ||--o{ audit_logs : may_have

  users {
    int id PK
    uuid uuid UK
    string email UK
    string password
    bool isActive
  }
  roles {
    int id PK
    string slug UK
    string name
    bool isSystem
  }
  permissions {
    int id PK
    string slug UK
    string resource
    string action
  }
  user_roles {
    int id PK
    int user_id FK
    int role_id FK
  }
  role_permissions {
    int id PK
    int role_id FK
    int permission_id FK
  }
  refresh_tokens {
    int id PK
    int user_id FK
    string token UK
    timestamptz expiresAt
  }
  audit_logs {
    int id PK
    int user_id FK
    string action
    string entityType
  }
```

## Catalog + Products

```mermaid
erDiagram
  brands ||--o{ products : brands
  products ||--o{ product_variants : has
  products ||--o{ product_categories : in
  categories ||--o{ product_categories : in
  categories ||--o{ categories : parent
  products ||--o{ product_tags : tagged
  tags ||--o{ product_tags : tagged
  products ||--o{ product_collections : in
  collections ||--o{ product_collections : in
  products ||--o{ product_images : has
  products ||--o{ product_files : has
  products ||--o{ product_related : related
  products ||--o{ product_labels : labeled
  product_variants ||--o{ variant_attribute_values : has
  attribute_values ||--o{ variant_attribute_values : used
  attributes ||--o{ attribute_values : has
  files ||--o{ product_images : file
  files ||--o{ product_files : file

  products {
    int id PK
    string slug UK
    string name
    string type
    string status
    int brand_id FK
  }
  product_variants {
    int id PK
    int product_id FK
    string sku UK
    bool isDefault
  }
  attributes {
    int id PK
    string slug UK
    string type
  }
  attribute_values {
    int id PK
    int attribute_id FK
    string value
    string colorCode
  }
  categories {
    int id PK
    string slug UK
    int parent_id FK
  }
```

## Pricing + Inventory

```mermaid
erDiagram
  product_variants ||--o{ prices : priced
  product_variants ||--o{ tier_prices : tiers
  product_variants ||--o{ inventories : stock
  warehouses ||--o{ inventories : holds
  warehouses ||--o{ stock_movements : moves
  product_variants ||--o{ stock_movements : moves
  discounts ||--o{ discount_products : scopes
  discounts ||--o{ discount_categories : scopes
  discounts ||--o{ discount_brands : scopes
  coupons ||--o{ coupon_products : scopes
  coupons ||--o{ coupon_categories : scopes
  products ||--o{ discount_products : scoped
  categories ||--o{ discount_categories : scoped
  brands ||--o{ discount_brands : scoped

  prices {
    int id PK
    int variant_id FK
    decimal amount
    string currency
  }
  inventories {
    int id PK
    int warehouse_id FK
    int variant_id FK
    int quantity
    int reservedQuantity
  }
  stock_movements {
    int id PK
    string type
    int quantity
  }
```

## Shopping + Orders

```mermaid
erDiagram
  users ||--o{ carts : owns
  carts ||--o{ cart_items : has
  product_variants ||--o{ cart_items : added
  users ||--o{ wishlists : owns
  wishlists ||--o{ wishlist_items : has
  products ||--o{ wishlist_items : saved
  users ||--o{ orders : places
  orders ||--o{ order_items : has
  orders ||--o{ payments : paid
  orders ||--o{ shipments : shipped
  orders ||--o{ invoices : billed
  products ||--o{ order_items : snapshot
  product_variants ||--o{ order_items : snapshot

  orders {
    int id PK
    string orderNumber UK
    string status
    string paymentStatus
    decimal total
  }
  order_items {
    int id PK
    int order_id FK
    string productName
    int quantity
    decimal unitPrice
  }
  payments {
    int id PK
    int order_id FK
    string method
    string status
    decimal amount
  }
```

## Content + Media + CMS + Customer

```mermaid
erDiagram
  users ||--o{ posts : authors
  posts ||--o{ post_category_relations : categorized
  post_categories ||--o{ post_category_relations : categorized
  posts ||--o{ post_tag_relations : tagged
  post_tags ||--o{ post_tag_relations : tagged
  posts ||--o{ post_products : features
  products ||--o{ post_products : featured
  posts ||--o{ comments : has
  users ||--o{ comments : writes
  comments ||--o{ comments : replies
  users ||--o{ addresses : has
  users ||--o{ reviews : writes
  products ||--o{ reviews : about
  users ||--o{ notifications : receives
  sliders ||--o{ slider_items : has
  menus ||--o{ menu_items : has
  menu_items ||--o{ menu_items : parent

  files {
    int id PK
    string bucket
    string objectKey
    string publicUrl
  }
  posts {
    int id PK
    string slug UK
    string status
  }
  reviews {
    int id PK
    int rating
    bool isApproved
  }
  settings {
    int id PK
    string key UK
    string value
  }
```

## Seeded roles

| slug | name |
|------|------|
| `user` | User |
| `admin` | Admin |
| `super_admin` | Super Admin |

Default super admin (from env / seed): `superadmin@liven.local`

## Entity path map

```
api/src/entities/
  auth/       catalog/    products/   pricing/
  inventory/  shopping/   orders/     content/
  media/      cms/        customer/   enums/
  common/abstract.entity.ts
  index.ts    # ALL_ENTITIES
```
