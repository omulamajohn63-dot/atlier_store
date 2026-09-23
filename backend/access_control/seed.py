"""Idempotent seeding of system permissions and default system roles.

Used by the ``0002_seed_permissions_and_roles`` data migration (historical
models) and by the ``seed_roles`` management command (live models).
"""

from .permissions_catalog import DEFAULT_ROLES, GROUPS, PERMISSIONS


def seed_system_permissions_and_roles(Permission, Role):
    """Populate permissions + system/default roles.

    ``Permission`` and ``Role`` are model classes — pass historical models
    from a migration or the live models from a management command.
    """
    created_permissions = 0
    created_roles = 0

    for code, label, description, sensitive, requires in PERMISSIONS:
        group = code.split(".", 1)[0]
        obj, was_created = Permission.objects.get_or_create(
            code=code,
            defaults={
                "label": label,
                "group": group,
                "description": description,
                "is_sensitive": sensitive,
                "requires": list(requires),
            },
        )
        if was_created:
            created_permissions += 1
        else:
            changed = False
            if obj.label != label:
                obj.label = label
                changed = True
            if obj.group != group:
                obj.group = group
                changed = True
            if obj.is_sensitive != sensitive:
                obj.is_sensitive = sensitive
                changed = True
            if list(obj.requires or []) != list(requires):
                obj.requires = list(requires)
                changed = True
            if changed:
                obj.save(update_fields=["label", "group", "description",
                                        "is_sensitive", "requires"])

    for slug, name, description, is_system, is_superadmin, codes in DEFAULT_ROLES:
        role, was_created = Role.objects.get_or_create(
            slug=slug,
            defaults={
                "name": name,
                "description": description,
                "is_system_role": is_system,
                "is_superadmin": is_superadmin,
            },
        )
        if was_created:
            created_roles += 1
            role.name = name
            role.description = description
            role.is_system_role = is_system
            role.is_superadmin = is_superadmin
            role.save()

        if role.name != name:
            role.name = name
            role.save(update_fields=["name"])
        if role.description != description:
            role.description = description
            role.save(update_fields=["description"])
        if role.is_system_role != is_system:
            role.is_system_role = is_system
            role.save(update_fields=["is_system_role"])
        if role.is_superadmin != is_superadmin:
            role.is_superadmin = is_superadmin
            role.save(update_fields=["is_superadmin"])

        codes_queryset = Permission.objects.filter(code__in=codes)
        if list(role.permissions.all().values_list("code", flat=True)) != sorted(codes):
            role.permissions.set(codes_queryset)

    # Fill in any group metadata implied by codes that were not declared.
    declared_groups = {code.split(".", 1)[0] for code, *_ in PERMISSIONS}
    return created_permissions, created_roles, len(GROUPS), len(declared_groups)