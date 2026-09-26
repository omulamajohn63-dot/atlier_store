from django.db import migrations


def forward(apps, schema_editor):
    """Seed the Promotions permission group + promotion_manager role."""
    from access_control.seed import seed_system_permissions_and_roles

    Permission = apps.get_model("access_control", "Permission")
    Role = apps.get_model("access_control", "Role")

    seed_system_permissions_and_roles(Permission, Role)


def backward(apps, schema_editor):
    from access_control.seed import seed_system_permissions_and_roles

    Permission = apps.get_model("access_control", "Permission")
    Role = apps.get_model("access_control", "Role")

    seed_system_permissions_and_roles(Permission, Role)


class Migration(migrations.Migration):

    dependencies = [
        ("access_control", "0003_seed_email_permissions"),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
