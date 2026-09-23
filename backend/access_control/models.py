import uuid

from django.conf import settings
from django.db import models


class Permission(models.Model):
    """A granular capability, e.g. ``orders.confirm``.

    Distinct from ``auth.Permission`` (which is tied to models/Czech
    permissions). These are capability codes used throughout MODEZA.
    """

    code = models.CharField(max_length=80, unique=True, db_index=True)
    label = models.CharField(max_length=160)
    group = models.CharField(max_length=40, db_index=True)
    description = models.TextField(blank=True, default="")
    is_sensitive = models.BooleanField(default=False)
    requires = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("group", "code")

    def __str__(self):
        return self.code


class Role(models.Model):
    """A named bundle of permissions that can be granted to staff members."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(max_length=80, unique=True, blank=True)
    name = models.CharField(max_length=160, unique=True)
    description = models.TextField(blank=True, default="")
    is_system_role = models.BooleanField(default=False)
    is_superadmin = models.BooleanField(default=False)
    permissions = models.ManyToManyField(
        Permission, related_name="roles", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return self.name


class StaffProfile(models.Model):
    """Extra data for a staff member under MODEZA access control."""

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="staff_profile",
        help_text="The Django user the staff record belongs to.",
    )
    roles = models.ManyToManyField(Role, related_name="staff_profiles", blank=True)
    direct_permissions = models.ManyToManyField(
        Permission,
        related_name="direct_staff_profiles",
        blank=True,
        help_text="Permissions granted outside of any role.",
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.ACTIVE,
        help_text="INACTIVE immediately revokes all admin access.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("user__first_name", "user__last_name", "user__username")

    def __str__(self):
        return f"Staff profile: {self.user.username}"

    def effective_permission_codes(self):
        codes = set(self.direct_permissions.values_list("code", flat=True))
        for role in self.roles.all():
            codes.update(role.permissions.values_list("code", flat=True))
        return codes