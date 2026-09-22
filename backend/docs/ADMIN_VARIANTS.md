# Admin Product Variants

The custom MODEZA admin dashboard supports managing product variants such as clothing sizes, colours, SKUs, prices, and stock quantities.

## Variant model

Each `ProductVariant` belongs to one product and stores:

- `sku`: unique internal stock-keeping unit.
- `size`: for example `Small`, `Medium`, or `Large`.
- `color`: optional colour name.
- `color_hex`: optional hex colour used for storefront swatches.
- `price_minor`: optional variant-specific price in cents/minor currency units.
- `stock_quantity`: available quantity for that variant.
- `is_active`: whether the variant is available for sale.

The model enforces unique SKUs (with a non-blank SKU check constraint), no empty SKUs, and unique product/size/colour combinations compared case-insensitively. Two migrations ship with the feature: `backend/catalog/migrations/0006_productvariant_variant_sku_not_blank.py` and `backend/audit/migrations/0003_alter_auditlog_action.py` (broader audit action labels).

## Add a size matrix

From an admin product detail page, select **Add sizes** under the **Variants** section.

The matrix accepts:

- One shared colour and optional colour hex value.
- One shared optional price.
- Up to six size and quantity rows.

Example:

| Size | Quantity |
| --- | ---: |
| Small | 4 |
| Medium | 7 |
| Large | 2 |

Each non-empty row creates a separate variant. The shared colour and price are copied to every created variant.

### Generated SKUs

SKUs are generated from the product slug, size, and colour:

```text
PRODUCT-SIZE-COLOUR
```

For example:

```text
SIZE-MATRIX-PRODUCT-SMALL-BLACK
SIZE-MATRIX-PRODUCT-MEDIUM-BLACK
SIZE-MATRIX-PRODUCT-LARGE-BLACK
```

All tokens are normalized through `catalog/variant_services.py`: upper-cased, runs of non-alphanumeric characters collapsed to a single hyphen, then trimmed. For example size `Small/Medium` becomes `SMALL-MEDIUM`. The final SKU is truncated to the model's 80-character maximum, and a collision with an already-existing variant receives a numeric suffix (`-1`, `-2`, … up to `-99`) so the batch still succeeds. Collisions *within* the same submission (two rows that normalize to the same SKU) or a duplicated row option reject the whole batch atomically.

## Add one variant

Use **Add one** when a single variant needs detailed control. This form allows the admin to enter:

- Exact SKU.
- Size and colour.
- Colour hex value.
- Variant-specific price.
- Stock quantity.
- Active/inactive status.

Entered SKUs and colour hex values are normalized to the canonical stored form (`DRESSTOP-12`, `#2E5A44`). A malformed hex value is rejected on the form. The single-variant form is useful for corrections, unusual options, or variant-specific pricing.

## Edit and delete

Every variant displayed on the product detail page has **Edit** and **Delete** actions.

- **Edit** updates the variant's identity, pricing, stock, and active state. A changed stock value writes an inventory ledger transaction with reason `variant_edit` and an audit event with a before/after snapshot.
- **Delete** removes a variant only when it has never been referenced by an order and has no protected inventory history. Otherwise the variant is deactivated (`is_active = False`) so historical orders and stock records stay intact; the audit event records reason `used_in_history`.
- Stock changes can still be handled through the existing inventory adjustment workflow.

## Validation and atomicity

The admin prevents:

- Empty bulk submissions.
- Duplicate sizes in one matrix submission.
- Existing product/size/colour combinations (case-insensitive).
- Duplicate SKUs.
- Malformed colour hex values.
- Negative quantities or prices.

Bulk creation preflights every generated SKU before creating any records. Collisions in the database are resolved with a numeric suffix; collisions within the same submission and duplicate options reject the entire batch, and no partial batch is saved.

## Routes

The custom admin routes are product-scoped:

```text
GET/POST /admin/dashboard/products/<product_id>/variants/new/
GET/POST /admin/dashboard/products/<product_id>/variants/bulk/
GET/POST /admin/dashboard/products/<product_id>/variants/<variant_id>/edit/
POST     /admin/dashboard/products/<product_id>/variants/<variant_id>/delete/
```

All routes require an authenticated staff user.

## Audit logging

Variant mutations write catalog audit events:

- `create` when a variant is added.
- `update` when a variant is edited or deactivated by delete-with-history.
- `delete` when a variant is actually removed.

Variant audit metadata records the parent product ID (with `bulk: true` for matrix rows), and edit events include a `before` snapshot of the previous values. Records use `object_type` `productvariant`, which the admin UI displays as `Product Variant`.

## Implementation files

- `backend/catalog/variant_services.py`: canonical SKU and colour-hex normalization, SKU building, collision suffixing.
- `backend/catalog/models.py`: `ProductVariant` model, `clean()` validation, SKU check constraint.
- `backend/admin_ui/forms.py`: single and bulk variant forms.
- `backend/admin_ui/views.py`: variant CRUD and bulk creation views (stock edits through the inventory ledger, deactivation on delete-with-history).
- `backend/admin_ui/audit_ui.py`: `ProductVariant` audit label.
- `backend/admin_ui/urls.py`: product-scoped variant routes.
- `backend/admin_ui/templates/admin_ui/product_detail_page.html`: variant table, actions, and Restock / Increase stock.
- `backend/admin_ui/templates/admin_ui/variant_form_page.html`: single-variant form.
- `backend/admin_ui/templates/admin_ui/variant_bulk_form_page.html`: size/quantity matrix.
- `backend/orders/services.py`: checkout-time variant/product revalidation.
- `backend/admin_ui/tests.py`: CRUD, validation, collision, ledger, and deactivation tests.

## Verification

Run the backend checks from the repository root:

```powershell
python backend/manage.py check
python backend/manage.py makemigrations --check --dry-run
python backend/manage.py test admin_ui.tests.AdminDashboardTests.test_staff_can_bulk_create_size_variants_with_quantities admin_ui.tests.AdminDashboardTests.test_staff_can_create_edit_and_delete_product_variant admin_ui.tests.AdminDashboardTests.test_editing_stock_writes_inventory_transaction_and_audit admin_ui.tests.AdminDashboardTests.test_delete_deactivates_variant_used_in_orders admin_ui.tests.AdminDashboardTests.test_staff_can_increase_stock_from_product_detail_page
```

`store` and `inventory` must be run from inside `backend/` (`python manage.py test store inventory`). Note that `receipts/` has a pre-existing unrelated failure set (payment-confirm does not generate receipts until an admin confirms the order); counts are unchanged by the variant work.
