from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from access_control.models import Role, StaffProfile


class Command(BaseCommand):
    help = ("Ensure every existing staff member has a staff profile mapped to "
            "the appropriate role (Super Admin for superusers, Legacy "
            "Administrator otherwise). Idempotent.")

    def handle(self, *args, **options):
        User = get_user_model()
        super_admin = Role.objects.filter(slug="super_admin").first()
        legacy_admin = Role.objects.filter(slug="legacy_administrator").first()

        created = 0
        assigned = 0
        for user in User.objects.filter(is_staff=True).iterator():
            modified = False
            profile, was_created = StaffProfile.objects.get_or_create(
                user=user, defaults={"status": "ACTIVE"})
            if was_created:
                created += 1
                modified = True

            if user.is_superuser and super_admin and not profile.roles.filter(
                    pk=super_admin.pk).exists():
                profile.roles.add(super_admin)
                assigned += 1
                modified = True
            elif not user.is_superuser and legacy_admin and not profile.roles.filter(
                    pk=legacy_admin.pk).exists():
                profile.roles.add(legacy_admin)
                assigned += 1
                modified = True

            if profile.status != StaffProfile.Status.ACTIVE and user.is_active:
                profile.status = StaffProfile.Status.ACTIVE
                profile.save()
                modified = True

            if modified:
                profile.save()

        self.stdout.write(self.style.SUCCESS(
            f"Profiles created: {created}, roles assigned: {assigned}. "
            f"Total staff with profiles: "
            f"{StaffProfile.objects.count()}."))