from django.core.management.base import BaseCommand

from access_control.models import Permission, Role
from access_control.seed import seed_system_permissions_and_roles


class Command(BaseCommand):
    help = "Idempotently seed MODEZA permissions and system/default roles."

    def handle(self, *args, **options):
        created_permissions, created_roles, groups, declared = (
            seed_system_permissions_and_roles(Permission, Role))
        self.stdout.write(self.style.SUCCESS(
            f"Permissions present: {Permission.objects.count()} "
            f"({created_permissions} created) across {groups} groups."))
        self.stdout.write(self.style.SUCCESS(
            f"Roles present: {Role.objects.count()} "
            f"({created_roles} created)."))
        self.stdout.write(self.style.SUCCESS(
            "Seeding complete. Run `python manage.py map_staff` to ensure "
            "every existing staff member has a staff profile."))