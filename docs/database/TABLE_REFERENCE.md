# Database Table Reference (Live Audited)

Audited from live DB on 2026-03-05.

## `categories`

- `id` integer, PK, auto increment
- `name` varchar(255), not null

## `hero_slides`

- `id` integer, PK, auto increment
- `title` varchar(255)
- `subtitle` varchar(255)
- `image` varchar(500)
- `button_text` varchar(100)
- `status` boolean, default `true`
- `created_at` timestamp, default `CURRENT_TIMESTAMP`

## `orders`

- `id` integer, PK, auto increment
- `order_id` varchar(50), unique, not null
- `user_id` integer
- `customer_name` varchar(100), not null
- `mobile` varchar(20), not null
- `address_line1` varchar(200), not null
- `address_line2` varchar(200)
- `city` varchar(100), not null
- `state` varchar(100), not null
- `pin_code` varchar(10), not null
- `payment_method` varchar(50), not null
- `total_amount` numeric(10,2), not null
- `order_date` timestamp, default `CURRENT_TIMESTAMP`
- `status` varchar(50), default `pending`
- `created_at` timestamp, default `CURRENT_TIMESTAMP`
- `updated_at` timestamp, default `CURRENT_TIMESTAMP`

## `order_items`

- `id` integer, PK, auto increment
- `order_id` varchar(50), FK -> `orders.order_id`, on delete cascade
- `product_id` integer, not null
- `product_name` varchar(200), not null
- `quantity` integer, not null
- `unit_price` numeric(10,2), not null
- `total_price` numeric(10,2), not null
- `created_at` timestamp, default `CURRENT_TIMESTAMP`

## `products`

- `id` integer, PK, auto increment
- `name` varchar(200), not null
- `original_price` integer, not null
- `offer_price` integer, not null
- `discount` integer, not null
- `quantity` integer, not null, default `0`
- `image_url` text, not null
- `category_id` integer, FK -> `categories.id`
- `category_name` varchar(255)
- `is_best_selling` boolean, default `false`
- `created_at` timestamp, default `CURRENT_TIMESTAMP`
- `video_url` text

## `user_addresses`

- `id` integer, PK, auto increment
- `user_id` varchar(50), not null
- `name` varchar(80), not null
- `mobile` varchar(10), not null
- `line1` varchar(100), not null
- `line2` varchar(100)
- `city` varchar(50), not null
- `state` varchar(50), not null
- `pin` varchar(6), not null
- `is_default` boolean, default `false`
- `created_at` timestamp, default `CURRENT_TIMESTAMP`

## `users`

- `id` integer, PK, auto increment
- `full_name` varchar(255), not null
- `mobile` varchar(20), unique, not null
- `password` varchar(255), not null
- `role` varchar(50), default `user`
- `created_at` timestamp, default `CURRENT_TIMESTAMP`
- `updated_at` timestamp, default `CURRENT_TIMESTAMP`
