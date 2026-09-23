from django.db import migrations


def forward(apps, schema_editor):
    from access_control.seed import seed_system_permissions_and_roles

    Permission = apps.get_model("access_control", "Permission")
    Role = apps.get_model("access_control", "Role")
    StaffProfile = apps.get_model("access_control", "StaffProfile")
    User = apps.get_model("auth", "User")

    seed_system_permissions_and_roles(Permission, Role)

    super_admin = Role.objects.filter(slug="super_admin").first()
    legacy_admin = Role.objects.filter(slug="legacy_administrator").first()

    staff_users = User.objects.filter(is_staff=True)
    for user in staff_users.iterator():
        modified = False
        profile, created = StaffProfile.objects.get_or_create(
            user=user, defaults={"status": "ACTIVE"})
        if created:
            modified = True

        if user.is_superuser:
            if super_admin and not profile.roles.filter(pk=super_admin.pk).exists():
                profile.roles.add(super_admin)
                modified = True
        elif legacy_admin:
            if not profile.roles.filter(pk=legacy_admin.pk).exists():
                profile.roles.add(legacy_admin)
                modified = True

        if modified:
            profile.save()


def backward(apps, schema_editor):
    Permission = apps.get_model("access_control", "Permission")
    Role = apps.get_model("access_control", "Role")
    StaffProfile = apps.get_model("access_control", "StaffProfile")

    StaffProfile.objects.all().delete()
    Role.objects.all().delete()
    Permission.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("access_control", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]