import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils.text import slugify


class Category(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    image_url = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('name',)

    def __str__(self):
        return f"{self.name}"


class Product(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        ACTIVE = 'ACTIVE', 'Active'
        ARCHIVED = 'ARCHIVED', 'Archived'

    @staticmethod
    def normalize_images(images):
        if not images:
            return []
        if isinstance(images, str):
            cleaned = images.strip()
            return [cleaned] if cleaned else []
        if isinstance(images, (list, tuple)):
            return [str(item).strip() for item in images if item and str(item).strip()]
        return []

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name='products')
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=100, unique=True, blank=True)
    tagline = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    details = models.JSONField(default=list, blank=True)
    price_minor = models.PositiveIntegerField(
        validators=[MinValueValidator(0)], default=0)
    compare_at_price_minor = models.PositiveIntegerField(null=True, blank=True)
    images = models.JSONField(default=list, blank=True)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.DRAFT)
    is_featured = models.BooleanField(default=False)
    is_new_arrival = models.BooleanField(default=False)
    is_best_seller = models.BooleanField(default=False)
    sku = models.CharField(max_length=80, unique=True, blank=True)
    size = models.CharField(max_length=80, blank=True)
    color = models.CharField(max_length=80, blank=True)
    stock_quantity = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)
        indexes = [
            models.Index(fields=('status', 'category')),
            models.Index(fields=('name',)),
        ]

    @property
    def price_display(self):
        return Decimal(self.price_minor) / Decimal('100')

    def save(self, *args, **kwargs):
        self.details = self.details or []
        self.images = self.normalize_images(self.images)
        if not self.slug:
            self.slug = slugify(self.name)[:100]
        if not self.sku:
            base = slugify(self.name) or 'product'
            base = (base[:40] or 'product').upper()
            suffix = str(uuid.uuid4().hex[:8]).upper()
            # Keep SKU globally unique without forcing callers to supply one.
            self.sku = f'{base}-{suffix}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name}"


class ProductImage(models.Model):
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name='product_images')
    image = models.ImageField(upload_to='products/', blank=True, null=True)
    image_url = models.URLField(blank=True)
    is_primary = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ('product', 'order', 'id')

    def __str__(self):
        return f"{self.product.name} image #{self.order}"


class ProductImportLog(models.Model):
    filename = models.CharField(max_length=255)
    rows_total = models.PositiveIntegerField(default=0)
    rows_success = models.PositiveIntegerField(default=0)
    rows_failed = models.PositiveIntegerField(default=0)
    error_details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f"Import log {self.filename} ({self.rows_success}/{self.rows_total})"


class ImportJob(models.Model):
    class Status(models.TextChoices):
        UPLOADED = 'uploaded', 'Uploaded'
        VALIDATING = 'validating', 'Validating'
        READY = 'ready', 'Ready'
        PROCESSING = 'processing', 'Processing'
        COMPLETED = 'completed', 'Completed'
        COMPLETED_WITH_ERRORS = 'completed_with_errors', 'Completed with errors'
        FAILED = 'failed', 'Failed'
        CANCELLED = 'cancelled', 'Cancelled'

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='bulk_import_jobs')
    filename = models.CharField(max_length=255)
    status = models.CharField(
        max_length=30, choices=Status.choices, default=Status.UPLOADED)
    total_rows = models.PositiveIntegerField(default=0)
    processed_rows = models.PositiveIntegerField(default=0)
    successful_rows = models.PositiveIntegerField(default=0)
    failed_rows = models.PositiveIntegerField(default=0)
    created_products = models.PositiveIntegerField(default=0)
    updated_products = models.PositiveIntegerField(default=0)
    created_variants = models.PositiveIntegerField(default=0)
    updated_variants = models.PositiveIntegerField(default=0)
    uploaded_images = models.PositiveIntegerField(default=0)
    error_count = models.PositiveIntegerField(default=0)
    warning_count = models.PositiveIntegerField(default=0)
    validation_report = models.JSONField(default=dict, blank=True)
    result_summary = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f"ImportJob {self.filename} ({self.status})"


class ProductVariant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name='variants')
    sku = models.CharField(max_length=80, unique=True)
    size = models.CharField(max_length=40, blank=True)
    color = models.CharField(max_length=80, blank=True)
    color_hex = models.CharField(max_length=7, blank=True)
    price_minor = models.PositiveIntegerField(null=True, blank=True)
    stock_quantity = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ('sku',)
        constraints = [
            models.UniqueConstraint(
                fields=('product', 'size', 'color'), name='unique_product_variant_option'),
            models.CheckConstraint(
                condition=~models.Q(sku=''), name='variant_sku_not_blank'),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        from catalog.variant_services import normalize_hex, sku_collides_within

        errors = {}
        sku = (self.sku or '').strip()
        if not sku:
            errors['sku'] = 'SKU cannot be blank.'
        if self.color_hex:
            try:
                self.color_hex = normalize_hex(self.color_hex)
            except ValidationError as exc:
                errors['color_hex'] = exc.messages[0]
        if not errors and sku_collides_within(
                self.product, self.size, self.color, exclude_id=self.pk):
            errors['size'] = 'This size and colour combination already exists.'
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        if self.size and self.color:
            return f"{self.sku} ({self.size} / {self.color})"
        if self.size or self.color:
            return f"{self.sku} ({self.size or self.color})"
        return self.sku
