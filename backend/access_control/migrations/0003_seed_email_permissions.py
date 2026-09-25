from django.db import migrations


def forward(apps, schema_editor):
    """Add the Emails permission group to an already-seeded database.

    ``seed_system_permissions_and_roles`` is idempotent: it creates missing
    permissions, corrects changed metadata and re-syncs every default role's
    permission set from the catalog. Custom roles are left untouched, so an
    operator's own role definitions survive untouched.
    """
    from access_control.seed import seed_system_permissions_and_roles

    Permission = apps.get_model("access_control", "Permission")
    Role = apps.get_model("access_control", "Role")

    seed_system_permissions_and_roles(Permission, Role)


def backward(apps, schema_editor):
    from access_control.seed import seed_system_permissions_and_roles

    Permission = apps.get_model("access_control", "Permission")
    Role = apps.get_model("access_control", "Role")

    # No schema change is involved, so reversing simply re-runs the seeder.
    # The two Emails permissions stay behind: removing them would revoke
    # access from roles that may already be granting them explicitly.
    seed_system_permissions_and_roles(Permission, Role)


class Migration(migrations.Migration):

    dependencies = [
        ("access_control", "0002_seed_permissions_and_roles"),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
