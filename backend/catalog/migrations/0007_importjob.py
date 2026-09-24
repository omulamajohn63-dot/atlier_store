from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0006_productvariant_variant_sku_not_blank'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ImportJob',
            fields=[
                ('id', models.BigAutoField(auto_created=True,
                 primary_key=True, serialize=False, verbose_name='ID')),
                ('filename', models.CharField(max_length=255)),
                ('status', models.CharField(choices=[('uploaded', 'Uploaded'), ('validating', 'Validating'), ('ready', 'Ready'), ('processing', 'Processing'), (
                    'completed', 'Completed'), ('completed_with_errors', 'Completed with errors'), ('failed', 'Failed'), ('cancelled', 'Cancelled')], default='uploaded', max_length=30)),
                ('total_rows', models.PositiveIntegerField(default=0)),
                ('processed_rows', models.PositiveIntegerField(default=0)),
                ('successful_rows', models.PositiveIntegerField(default=0)),
                ('failed_rows', models.PositiveIntegerField(default=0)),
                ('created_products', models.PositiveIntegerField(default=0)),
                ('updated_products', models.PositiveIntegerField(default=0)),
                ('created_variants', models.PositiveIntegerField(default=0)),
                ('updated_variants', models.PositiveIntegerField(default=0)),
                ('uploaded_images', models.PositiveIntegerField(default=0)),
                ('error_count', models.PositiveIntegerField(default=0)),
                ('warning_count', models.PositiveIntegerField(default=0)),
                ('validation_report', models.JSONField(blank=True, default=dict)),
                ('result_summary', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('uploaded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                 related_name='bulk_import_jobs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ('-created_at',),
            },
        ),
    ]
