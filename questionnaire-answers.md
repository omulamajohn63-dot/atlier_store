# MODEZA Boutique Project Questionnaire Answers

> These answers are based on the current repository. Items marked **Not confirmed** or **Not implemented** need a business decision or further implementation.

## 1. Project & Business

1. **Project name:** MODEZA Boutique / Boutique Fashion Store
2. **Business:** Fashion ecommerce
3. **Type:** Ecommerce
4. **Target market:** Kenya appears to be the primary market
5. **Currency:** KES
6. **Already partially built:** Yes
7. **Technology:** React 19, TypeScript, Vite, Django 6.0.7, Django REST Framework, Python version not confirmed, SQLite, Tailwind CSS 4, Supabase Auth/PostgreSQL migrations, M-Pesa scaffolding, and Google Gemini integration.

## 2. React Customer Frontend

1. Current customer features include browsing, search, filtering, sorting, product details, guest cart, checkout, orders, order tracking, account/profile pages, notifications, wishlist, and promotional codes.
2. Customers can browse without an account.
3. Registration collects email, password, full name, and phone.
4. Login uses email and password through Supabase Auth.
5. Email verification is supported by the Supabase signup flow.
6. Password reset is not confirmed in the current frontend.
7. Profile metadata can be updated; email and phone change workflows are not fully confirmed.

## 3. Customer Data

1. Customer identity is stored in Supabase Auth. Django maps authenticated Supabase users to local Django users.
2. Current profile information includes email, full name, and phone.
3. Multiple delivery addresses are not implemented or confirmed.
4. Customer profiles are partially implemented.
5. Account deletion is not confirmed.
6. Loyalty points and membership levels are not implemented.

## 4. Admins & Staff

1. The system supports customer, staff, and admin roles.
2. The expected number of staff members is not specified.
3. Different permissions are supported through role checks:
   - Customer
   - Staff
   - Admin
4. Supabase JWT authentication is used by the API. Django's built-in authentication is also installed for local users and Django admin access.
5. Admins and customers are logically separated by roles, although authenticated Supabase users are mapped into Django's user table.

## 5. Products

1. Product fields include name, slug, description, tagline, details, price, compare-at price, images, category, SKU, size, color, stock quantity, status, and featured/new/best-seller flags.
2. Product variants are supported with SKU, size, color, color hex, price, and stock.
3. Categories are supported.
4. Subcategories and brands are not implemented.
5. Product attributes are partially supported through product details and variant fields.
6. Product reviews and ratings are not implemented.
7. Products are managed through Django admin and staff-facing dashboard workflows.

## 6. Inventory

1. Inventory management is supported.
2. Stock reservations and inventory transactions are implemented in the backend.
3. Reservation states support active, committed, released, and expired inventory.
4. The complete cancelled-order stock restoration flow needs verification.
5. Low-stock alerts are not confirmed.
6. Multiple warehouses and location-specific inventory are not implemented.

## 7. Shopping Cart

1. Guest carts are supported.
2. Guest cart identity persists through a browser cart identifier/local storage.
3. Automatic guest-cart merging after login is not confirmed.
4. Save-for-later is not implemented.
5. Wishlist functionality is implemented through Supabase and the frontend.

## 8. Orders

1. Orders contain the customer, cart, items, product/variant data, quantities, prices, shipping method, payment method/status, order status, currency, customer details, and timestamps.
2. Current order statuses include pending, confirmed, processing, shipped, delivered, received, and cancelled.
3. Payment statuses include pending, paid, failed, and refunded.
4. Customer cancellation is not fully confirmed.
5. Admin cancellation is supported by the backend model and admin workflow.
6. Order history and customer order tracking are implemented.
7. Downloadable invoices are not implemented or confirmed.

## 9. Payments

1. The payment model supports M-Pesa and card payments.
2. M-Pesa Daraja integration scaffolding is present.
3. Payment intents, confirmation endpoints, webhooks, and M-Pesa callbacks exist.
4. Refund status exists in the data model, but the complete refund workflow is not confirmed.
5. Refund permissions are not yet defined.

## 10. Delivery

1. Standard and express delivery methods are present.
2. Delivery locations are not specified.
3. Shipping cost is stored per order, but the pricing rules are not clearly defined.
4. Basic order tracking exists; courier integration is not confirmed.
5. Orders store customer/shipping information, but a dedicated multiple-address management system is not implemented.

## 11. Django Backend <-> React

1. React communicates with Django through REST-style API endpoints.
2. Django REST Framework is installed and used.
3. Existing API areas include products, categories, carts, orders, payments, authentication, and notifications.
4. Django currently uses SQLite.
5. Supabase PostgreSQL migrations exist, but Django is not currently configured to use Supabase PostgreSQL.
6. The current intended flow is:

```text
React
  -> Django REST API
  -> SQLite currently

Supabase Auth provides customer identity and JWTs.
```

7. The project still needs one authoritative commerce database decision: Django-managed PostgreSQL or Supabase PostgreSQL.

## 12. Supabase

1. A Supabase project appears to exist because Supabase URLs and frontend credentials are configured.
2. Migration files exist for profiles, products, variants, carts, orders, payments, reservations, audit logs, and wishlists.
3. Supabase Storage is not confirmed.
4. Supabase Auth is intended for customer authentication.
5. The intended customer structure is `auth.users` plus profile/customer data.

## 13. Authentication Architecture

1. The current direction is a hybrid version of Architecture B:

```text
Supabase Auth
  -> Customers, staff, and admins

Django API
  -> Validates Supabase JWTs and enforces roles
```

2. Admins can access dashboard/API functionality through staff or admin roles.
3. Customers should not access Django admin.
4. Django can identify authenticated Supabase customers through JWT verification.
5. Role-based permissions currently include customer, staff, and admin.

## 14. Security

1. Admin 2FA is not confirmed.
2. Customer inactivity logout is not confirmed.
3. Supabase migrations include audit logs, but complete Django integration is not confirmed.
4. Customer order isolation is included in the Supabase RLS design and must also remain enforced in Django views.
5. Django REST Framework rate limiting is configured.
6. Backup strategy is not specified.

## 15. Notifications

1. Customer notification categories include order, payment, delivery, account, and system.
2. Admin notification categories include order, payment, inventory, and system.
3. Email, SMS, and WhatsApp delivery are not implemented or confirmed.

## 16. Admin Dashboard

1. Existing dashboard functionality includes products, categories, orders, product imports, notifications, and inventory-related activity.
2. Sales analytics and charts are not confirmed.
3. Product import/export support exists, including Excel support through `openpyxl`.
4. CSV and PDF exports are not confirmed.

## 17. Discounts & Promotions

1. Promotional codes appear in the frontend checkout flow.
2. Percentage-based discounts are present in the current frontend data.
3. Fixed amount, product-specific, category-specific, and minimum-order discount rules are not confirmed.
4. Flash sales are not confirmed.
5. Promotional frontend data exists, but admin management of banners is not confirmed.

## 18. Search & SEO

1. Product search is implemented.
2. Filtering and sorting are implemented.
3. SEO has not been assessed.
4. The frontend uses React and Vite, not Next.js.

## 19. Deployment

1. Django hosting is not specified.
2. React hosting is not specified.
3. The current database is local SQLite.
4. Domain name is not specified.
5. Development, staging, and production environments are not confirmed.
6. GitHub Actions/CI/CD is not confirmed.

## 20. Existing Project

```text
boutique-fashion-store/
├── backend/
│   ├── manage.py
│   ├── accounts/
│   ├── catalog/
│   ├── cart/
│   ├── inventory/
│   ├── orders/
│   ├── payments/
│   └── admin_ui/
├── frontend/
│   ├── src/
│   ├── public/
│   ├── supabase/
│   └── package.json
└── README.md
```

1. Django and React are connected through the API contract and CORS configuration.
2. Catalog, categories, carts, orders, payments, authentication scaffolding, admin UI, inventory models, wishlist, and notifications exist.
3. The main incomplete areas are the production database choice, full Supabase integration, customer addresses, reviews, refunds, delivery integrations, external notifications, and analytics.
4. Existing Django models and API paths should be preserved unless a migration plan is agreed.
5. Existing React pages and components should also be preserved.
6. The existing project should be modified rather than rebuilt.

## Recommended Priorities

1. Choose the authoritative production database.
2. Complete Supabase customer authentication and Django JWT integration.
3. Connect the React catalog, cart, checkout, and orders fully to Django.
4. Complete and test M-Pesa confirmation and stock reservation behavior.
5. Secure and finish the admin dashboard with staff permissions, audit logs, and production settings.

## Important Security Note

The current `frontend/.env.example` contains a value labelled as a Supabase service-role key. Service-role keys must never be exposed to the browser or committed to a repository. This key should be revoked/rotated if it is real, and the example file should contain only a placeholder.
