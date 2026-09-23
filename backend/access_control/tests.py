"""Test suite for MODEZA granular access control.

Covers the permission catalog, dependency resolution, the centralised
service checks, view-level 403 enforcement for the staff/roles UI, the DRF
AdminPermission class and the escalation protections (self-edit, last
active Super Admin, sensitive grants).
"""

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import Client, TestCase
from django.urls import reverse

from rest_framework.test import APIRequestFactory

from audit.models import AuditLog

from .drf_permissions import AdminPermission
from .models import Permission, Role, StaffProfile
from .permissions_catalog import (
    DEFAULT_ROLES,
    PERMISSIONS,
    resolve_dependencies as catalog_expand,
)
from .permissions_catalog import sensitive_codes
from .seed import seed_system_permissions_and_roles
from .services import (
    active_super_admin_count,
    can_assign_sensitive_permissions,
    effective_permissions,
    expand_with_dependencies,
    has_staff_access,
    is_super_admin,
    user_has_all_permissions,
    user_has_permission,
    would_leave_no_active_super_admin,
)

User = get_user_model()

CONFIRM_URL = '/admin/dashboard/confirm/?action=delete-product&product_id=00000000-0000-0000-0000-000000000000'


class AccessControlTestCase(TestCase):
    """Shared helpers: user/enrollment factories."""

    def make_user(self, username, *, is_staff=True, is_superuser=False,
                  is_active=True, password='Str0ngPass!x'):
        return User.objects.create_user(
            username=username,
            email=f'{username}@modeza.test',
            password=password,
            is_staff=is_staff,
            is_superuser=is_superuser,
            is_active=is_active,
        )

    def enroll(self, user, roles=(), codes=(), status=StaffProfile.Status.ACTIVE):
        profile = StaffProfile.objects.create(user=user, status=status)
        if roles:
            profile.roles.set(roles)
        if codes:
            profile.direct_permissions.set(
                Permission.objects.filter(code__in=codes))
        return profile

    def role(self, slug='test_role', codes=(), is_superadmin=False,
             is_system_role=False):
        role = Role.objects.create(
            slug=slug,
            name=slug.replace('_', ' ').title(),
            is_superadmin=is_superadmin,
            is_system_role=is_system_role,
        )
        if codes:
            role.permissions.set(Permission.objects.filter(code__in=codes))
        return role


# ---------------------------------------------------------------------------
# Permission catalog & seed integrity
# ---------------------------------------------------------------------------

class CatalogTests(AccessControlTestCase):

    def test_seed_populates_full_catalog(self):
        self.assertEqual(Permission.objects.count(), len(PERMISSIONS))
        self.assertEqual(Role.objects.count(), len(DEFAULT_ROLES))

    def test_permission_codes_unique(self):
        codes = list(Permission.objects.values_list('code', flat=True))
        self.assertEqual(len(codes), len(set(codes)))

    def test_sensitive_flags_match_catalog(self):
        db_sensitive = set(Permission.objects.filter(
            is_sensitive=True).values_list('code', flat=True))
        self.assertEqual(db_sensitive, sensitive_codes())

    def test_seed_is_idempotent(self):
        before_roles = Role.objects.count()
        before_perms = Permission.objects.count()
        created_perms, created_roles, _, _ = seed_system_permissions_and_roles(
            Permission, Role)
        self.assertEqual(created_perms, 0)
        self.assertEqual(created_roles, 0)
        self.assertEqual(Role.objects.count(), before_roles)
        self.assertEqual(Permission.objects.count(), before_perms)

    def test_super_admin_role_has_full_catalog(self):
        role = Role.objects.get(slug='super_admin')
        self.assertTrue(role.is_superadmin)
        self.assertTrue(role.is_system_role)
        self.assertEqual(role.permissions.count(), len(PERMISSIONS))

    def test_legacy_role_excludes_sensitive(self):
        role = Role.objects.get(slug='legacy_administrator')
        sensitive = role.permissions.filter(is_sensitive=True)
        self.assertFalse(sensitive.exists())

    def test_default_role_bundles_match_catalog(self):
        for slug, _name, _desc, is_system, is_superadmin, codes in DEFAULT_ROLES:
            role = Role.objects.get(slug=slug)
            self.assertEqual(role.is_system_role, is_system)
            self.assertEqual(role.is_superadmin, is_superadmin)
            self.assertEqual(
                set(role.permissions.values_list('code', flat=True)),
                set(codes))

    def test_dependency_resolution_expands_requires(self):
        self.assertEqual(
            catalog_expand(['products.create']),
            ['products.create', 'products.view'])
        self.assertEqual(
            catalog_expand(['products.restock']),
            ['inventory.view', 'products.restock', 'products.view'])
        self.assertTrue(
            set(catalog_expand(['staff.create'])).issuperset(
                {'staff.create', 'staff.view'}))

    def test_db_dependency_expansion_is_idempotent(self):
        expanded = expand_with_dependencies(
            ['products.create', 'products.restock'])
        self.assertIn('products.view', expanded)
        self.assertIn('inventory.view', expanded)
        self.assertEqual(
            expand_with_dependencies(expanded), expanded)


# ---------------------------------------------------------------------------
# Centralised service checks
# ---------------------------------------------------------------------------

class ServiceAccessTests(AccessControlTestCase):

    def test_superuser_bypasses_without_profile(self):
        user = self.make_user('boss', is_superuser=True)
        self.assertTrue(has_staff_access(user))
        self.assertTrue(user_has_permission(user, 'orders.refund'))
        self.assertEqual(
            effective_permissions(user),
            set(Permission.objects.values_list('code', flat=True)))

    def test_inactive_superuser_receives_nothing(self):
        user = self.make_user('boss',
                              is_superuser=True, is_active=False)
        self.assertFalse(has_staff_access(user))
        self.assertFalse(user_has_permission(user, 'products.view'))
        self.assertEqual(effective_permissions(user), set())

    def test_customer_denied(self):
        user = self.make_user('customer', is_staff=False)
        self.assertFalse(has_staff_access(user))
        self.assertFalse(user_has_permission(user, 'products.view'))
        self.assertEqual(effective_permissions(user), set())

    def test_staff_without_profile_is_fail_closed(self):
        user = self.make_user('unmanaged')
        self.assertFalse(has_staff_access(user))
        self.assertEqual(effective_permissions(user), set())

    def test_staff_with_role_and_expanded_permissions(self):
        role = self.role(slug='reviewer', codes=['products.update'])
        user = self.make_user('cat')
        profiles = self.enroll(user, roles=[role])
        self.assertTrue(has_staff_access(user))
        self.assertTrue(user_has_permission(user, 'products.update'))
        self.assertFalse(user_has_permission(user, 'orders.view'))

    def test_direct_permissions_count(self):
        user = self.make_user('direct')
        profiles = self.enroll(user, codes=['inventory.adjust'])
        self.assertTrue(user_has_permission(user, 'inventory.adjust'))

    def test_deactivation_revokes_access_immediately(self):
        role = self.role(slug='mitm', codes=['products.view'])
        user = self.make_user('victim')
        self.enroll(user, roles=[role])
        self.assertTrue(user_has_permission(user, 'products.view'))

        user.is_active = False
        user.save(update_fields=['is_active'])
        self.assertFalse(has_staff_access(user))
        self.assertFalse(user_has_permission(user, 'products.view'))
        self.assertEqual(effective_permissions(user), set())

    def test_inactive_profile_revokes_access_even_if_user_active(self):
        role = self.role(slug='sleeper', codes=['products.view'])
        user = self.make_user('sleeper')
        self.enroll(user, roles=[role],
                    status=StaffProfile.Status.INACTIVE)
        self.assertFalse(has_staff_access(user))
        self.assertFalse(user_has_permission(user, 'products.view'))
        self.assertEqual(effective_permissions(user), set())

    def test_user_has_all_permissions(self):
        role = self.role(slug='both', codes=['products.view', 'orders.view'])
        user = self.make_user('both')
        self.enroll(user, roles=[role])
        self.assertTrue(user_has_all_permissions(
            user, ['products.view', 'orders.view']))
        self.assertFalse(user_has_all_permissions(
            user, ['products.view', 'reports.view']))

    def test_super_admin_detection_via_role(self):
        user = self.make_user('roleadmin')
        role = self.role(slug='opsadmin', is_superadmin=True,
                         codes=['products.view'])
        self.enroll(user, roles=[role])
        self.assertTrue(is_super_admin(user))
        self.assertFalse(can_assign_sensitive_permissions(user))

    def test_can_assign_sensitive_permissions_is_superuser_only(self):
        self.assertFalse(can_assign_sensitive_permissions(self.make_user('peon')))
        self.assertTrue(can_assign_sensitive_permissions(
            self.make_user('root', is_superuser=True)))

    def test_would_leave_no_active_super_admin(self):
        admin = self.make_user('adm1', is_superuser=True)
        self.assertTrue(would_leave_no_active_super_admin(admin))
        self.assertEqual(active_super_admin_count(), 1)

        self.make_user('adm2', is_superuser=True)
        self.assertEqual(active_super_admin_count(), 2)
        self.assertFalse(would_leave_no_active_super_admin(admin))

    def test_unknown_code_fails_closed(self):
        user = self.make_user('boss', is_superuser=True)
        self.assertFalse(user_has_permission(user, 'nope.does_not_exist'))


# ---------------------------------------------------------------------------
# View-level enforcement (staff & roles UI under /admin/dashboard/)
# ---------------------------------------------------------------------------

class StaffViewAccessTests(AccessControlTestCase):

    def setUp(self):
        self.superuser = self.make_user('root', is_superuser=True)
        self.enroll(self.superuser, roles=[Role.objects.get(slug='super_admin')])
        self.superuser_client = Client()
        self.assertTrue(self.superuser_client.login(
            username='root', password='Str0ngPass!x'))

        self.view_perm = self.role(
            slug='viewer', codes=['staff.view'])
        self.actor = self.make_user('viewer')
        self.enroll(self.actor, roles=[self.view_perm])
        self.client = Client()
        self.assertTrue(self.client.login(
            username='viewer', password='Str0ngPass!x'))

    def test_anonymous_redirects_to_admin_login(self):
        response = Client().get(reverse('access-staff'))
        self.assertEqual(response.status_code, 302)
        self.assertIn('/admin/dashboard/login/', response['Location'])

    def test_staff_without_staff_permission_gets_403(self):
        bare = self.make_user('bare')
        role = self.role(slug='catalog', codes=['products.view'])
        self.enroll(bare, roles=[role])
        c = Client()
        c.login(username='bare', password='Str0ngPass!x')
        response = c.get(reverse('access-staff'))
        self.assertEqual(response.status_code, 403)
        response = c.get(reverse('access-roles'))
        self.assertEqual(response.status_code, 403)

    def test_staff_with_staff_view_can_list(self):
        response = self.client.get(reverse('access-staff'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'viewer')

    def test_superuser_can_list_and_detail(self):
        response = self.superuser_client.get(reverse('access-staff'))
        self.assertEqual(response.status_code, 200)
        response = self.superuser_client.get(
            reverse('access-staff-detail', args=[self.actor.pk]))
        self.assertEqual(response.status_code, 200)

    def test_create_requires_staff_create_permission(self):
        response = self.client.get(reverse('access-staff-create'))
        self.assertEqual(response.status_code, 403)

    def test_edit_requires_staff_update_permission(self):
        target = self.make_user('target')
        self.enroll(target, roles=[self.view_perm])
        response = self.client.get(
            reverse('access-staff-edit', args=[target.pk]))
        self.assertEqual(response.status_code, 403)

    def test_role_pages_require_roles_view(self):
        response = self.client.get(reverse('access-roles'))
        self.assertEqual(response.status_code, 403)
        response = self.client.get(reverse('access-matrix'))
        self.assertEqual(response.status_code, 403)
        response = self.client.get(reverse('access-role-create'))
        self.assertEqual(response.status_code, 403)

    def test_non_super_admin_cannot_create_super_admin(self):
        role = self.role(
            slug='hr', codes=['staff.view', 'staff.create', 'permissions.assign'])
        hr = self.make_user('hr')
        self.enroll(hr, roles=[role])
        c = Client()
        c.login(username='hr', password='Str0ngPass!x')

        super_admin = Role.objects.get(slug='super_admin')
        response = c.post(reverse('access-staff-create'), {
            'username': 'newadmin',
            'email': 'newadmin@modeza.test',
            'password': 'SecretPass123',
            'roles': [str(super_admin.pk)],
        })
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Only a Super Admin can create staff')
        self.assertFalse(User.objects.filter(username='newadmin').exists())

    def test_sensitive_direct_grant_requires_super_admin(self):
        role = self.role(
            slug='hr2', codes=['staff.view', 'staff.create', 'permissions.assign'])
        hr = self.make_user('hr2')
        self.enroll(hr, roles=[role])
        c = Client()
        c.login(username='hr2', password='Str0ngPass!x')
        refund = Permission.objects.get(code='orders.refund')
        response = c.post(reverse('access-staff-create'), {
            'username': 'fin',
            'email': 'fin@modeza.test',
            'password': 'SecretPass123',
            'direct_permissions': [str(refund.pk)],
        })
        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.filter(username='fin').exists())

    def test_super_admin_creates_staff_with_role(self):
        catalog_manager = Role.objects.get(slug='catalog_manager')
        with self.captureOnCommitCallbacks(execute=True):
            response = self.superuser_client.post(reverse('access-staff-create'), {
            'first_name': 'Carla',
            'last_name': 'Log',
            'username': 'carla',
            'email': 'carla@modeza.test',
            'password': 'SecretPass123',
            'roles': [str(catalog_manager.pk)],
            'direct_permissions': [],
        })
        self.assertEqual(response.status_code, 302)
        carla = User.objects.get(username='carla')
        self.assertTrue(carla.is_staff)
        self.assertFalse(carla.is_superuser)
        self.assertEqual(carla.staff_profile.status, StaffProfile.Status.ACTIVE)
        self.assertIn(catalog_manager, list(carla.staff_profile.roles.all()))
        self.assertTrue(AuditLog.objects.filter(
            action='staff_created', object_id=carla.pk).exists())

    def test_super_admin_create_expands_direct_permission_dependencies(self):
        response = self.superuser_client.post(reverse('access-staff-create'), {
            'username': 'stockie',
            'email': 'stockie@modeza.test',
            'password': 'SecretPass123',
            'roles': [],
            'direct_permissions': [
                str(Permission.objects.get(code='products.restock').pk),
            ],
        })
        self.assertEqual(response.status_code, 302)
        stockie = User.objects.get(username='stockie')
        codes = set(stockie.staff_profile.direct_permissions.values_list(
            'code', flat=True))
        self.assertTrue({'products.restock', 'products.view',
                         'inventory.view'}.issubset(codes))

    def test_cannot_edit_own_profile(self):
        role = self.role(
            slug='selfadmin',
            codes=['staff.view', 'staff.update', 'permissions.assign'])
        user = self.make_user('selfadmin')
        self.enroll(user, roles=[role])
        c = Client()
        c.login(username='selfadmin', password='Str0ngPass!x')
        response = c.post(
            reverse('access-staff-edit', args=[user.pk]),
            {'email': 'selfadmin@modeza.test', 'roles': [], 'direct_permissions': []})
        self.assertRedirects(response, reverse(
            'access-staff-detail', args=[user.pk]))
        user.refresh_from_db()
        self.assertTrue(user.is_active)

    def test_cannot_deactivate_own_account(self):
        response = self.superuser_client.post(
            reverse('access-staff-deactivate', args=[self.superuser.pk]),
            {'reason': 'oops'})
        self.assertRedirects(response, reverse(
            'access-staff-detail', args=[self.superuser.pk]))
        self.superuser.refresh_from_db()
        self.assertTrue(self.superuser.is_active)

    def test_deactivate_and_reactivate_revokes_and_restores(self):
        target = self.make_user('expendable')
        self.enroll(target, roles=[self.view_perm])
        with self.captureOnCommitCallbacks(execute=True):
            response = self.superuser_client.post(
                reverse('access-staff-deactivate', args=[target.pk]),
                {'reason': 'contract ended'})
        self.assertEqual(response.status_code, 302)
        target.refresh_from_db()
        self.assertFalse(target.is_active)
        self.assertEqual(target.staff_profile.status,
                         StaffProfile.Status.INACTIVE)
        self.assertFalse(has_staff_access(target))
        self.assertTrue(AuditLog.objects.filter(
            action='staff_deactivated', object_id=target.pk).exists())
        self.assertTrue(AuditLog.objects.filter(
            action='security_event', object_id=str(target.pk),
            severity='high').exists())

        with self.captureOnCommitCallbacks(execute=True):
            response = self.superuser_client.post(
                reverse('access-staff-reactivate', args=[target.pk]))
        self.assertEqual(response.status_code, 302)
        target.refresh_from_db()
        self.assertTrue(target.is_active)
        self.assertEqual(target.staff_profile.status,
                         StaffProfile.Status.ACTIVE)
        self.assertTrue(has_staff_access(target))

    def test_role_create_expands_dependencies_and_audits(self):
        role = self.role(slug='roler', codes=['roles.view', 'roles.create'])
        creator = self.make_user('roler')
        self.enroll(creator, roles=[role])
        c = Client()
        c.login(username='roler', password='Str0ngPass!x')
        with self.captureOnCommitCallbacks(execute=True):
            response = c.post(reverse('access-role-create'), {
                'name': 'Editor',
                'description': 'Edits products',
                'permissions': [str(Permission.objects.get(
                    code='products.create').pk)],
            })
        self.assertEqual(response.status_code, 302)
        created = Role.objects.get(name='Editor')
        codes = set(created.permissions.values_list('code', flat=True))
        self.assertIn('products.create', codes)
        self.assertIn('products.view', codes)
        self.assertTrue(AuditLog.objects.filter(
            action='role_created', object_id=str(created.pk)).exists())

    def test_system_role_cannot_be_deleted(self):
        super_admin = Role.objects.get(slug='super_admin')
        response = self.superuser_client.post(
            reverse('access-role-delete', args=[str(super_admin.pk)]))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(Role.objects.filter(pk=super_admin.pk).exists())

    def test_assigned_role_cannot_be_deleted(self):
        role = self.role(slug='busy', codes=['products.view'])
        holder = self.make_user('holder')
        self.enroll(holder, roles=[role])
        response = self.superuser_client.post(
            reverse('access-role-delete', args=[str(role.pk)]))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(Role.objects.filter(pk=role.pk).exists())

    def test_unassigned_custom_role_can_be_deleted(self):
        role = self.role(slug='lonely', codes=['products.view'])
        response = self.superuser_client.post(
            reverse('access-role-delete', args=[str(role.pk)]))
        self.assertEqual(response.status_code, 302)
        self.assertFalse(Role.objects.filter(pk=role.pk).exists())

    def test_role_detail_shows_readiness_warnings(self):
        role = self.role(slug='sloppy', codes=['products.create'])
        response = self.superuser_client.get(
            reverse('access-role-detail', args=[str(role.pk)]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "requires")


# ---------------------------------------------------------------------------
# Enforcement across the wider admin_ui surface
# ---------------------------------------------------------------------------

class AdminUiEnforcementTests(AccessControlTestCase):

    def setUp(self):
        self.superuser = self.make_user('root', is_superuser=True)
        self.superuser_client = Client()
        self.assertTrue(self.superuser_client.login(
            username='root', password='Str0ngPass!x'))

        self.unprivileged = self.make_user('roler')
        role = self.role(slug='roler', codes=['roles.view'])
        self.enroll(self.unprivileged, roles=[role])
        self.client = Client()
        self.assertTrue(self.client.login(
            username='roler', password='Str0ngPass!x'))

    def test_products_page_requires_products_permission(self):
        response = self.client.get('/admin/dashboard/products/')
        self.assertEqual(response.status_code, 403)

    def test_inventory_page_requires_inventory_permission(self):
        response = self.client.get('/admin/dashboard/inventory/')
        self.assertEqual(response.status_code, 403)

    def test_dashboard_renders_for_any_active_staff(self):
        response = self.client.get(reverse('admin-dashboard'))
        self.assertEqual(response.status_code, 200)

    def test_confirm_page_blocks_unpermitted_action(self):
        response = self.client.get(CONFIRM_URL)
        self.assertEqual(response.status_code, 403)
        response = self.client.post(
            '/admin/dashboard/confirm/',
            {'action': 'delete-product',
             'product_id': '00000000-0000-0000-0000-000000000000'})
        self.assertEqual(response.status_code, 403)

    def test_anonymous_confirm_action_redirects_to_login(self):
        response = Client().get(CONFIRM_URL)
        self.assertEqual(response.status_code, 302)
        self.assertIn('/admin/dashboard/login/', response['Location'])

    def test_superuser_can_access_confirm_action(self):
        response = self.superuser_client.get(CONFIRM_URL)
        self.assertEqual(response.status_code, 200)


# ---------------------------------------------------------------------------
# DRF AdminPermission
# ---------------------------------------------------------------------------

class DRFAdminPermissionTests(AccessControlTestCase):

    class _ProductsView:
        required_permissions = 'products.view'

    class _OpenView:
        required_permissions = None

    def setUp(self):
        self.factory = APIRequestFactory()
        self.permission = AdminPermission()
        self.superuser = self.make_user('root', is_superuser=True)

    def _req(self, user):
        request = self.factory.get('/admin/products/')
        request.user = user
        return request

    def test_anonymous_denied(self):
        from django.contrib.auth.models import AnonymousUser
        request = self._req(AnonymousUser())
        self.assertFalse(self.permission.has_permission(
            request, self._ProductsView()))

    def test_customer_denied(self):
        user = self.make_user('customer', is_staff=False)
        self.assertFalse(self.permission.has_permission(
            self._req(user), self._ProductsView()))

    def test_enrolled_staff_with_permission_allowed(self):
        role = self.role(slug='cat', codes=['products.view'])
        user = self.make_user('cat')
        self.enroll(user, roles=[role])
        self.assertTrue(self.permission.has_permission(
            self._req(user), self._ProductsView()))

    def test_enrolled_staff_without_permission_denied(self):
        role = self.role(slug='ord', codes=['orders.view'])
        user = self.make_user('ord')
        self.enroll(user, roles=[role])
        self.assertFalse(self.permission.has_permission(
            self._req(user), self._ProductsView()))

    def test_deactivated_staff_denied(self):
        role = self.role(slug='catx', codes=['products.view'])
        user = self.make_user('catx', is_active=False)
        self.enroll(user, roles=[role])
        self.assertFalse(self.permission.has_permission(
            self._req(user), self._ProductsView()))

    def test_open_view_allows_any_active_staff(self):
        role = self.role(slug='opn', codes=['products.view'])
        user = self.make_user('opn')
        self.enroll(user, roles=[role])
        self.assertTrue(self.permission.has_permission(
            self._req(user), self._OpenView()))

    def test_open_view_denies_customer(self):
        user = self.make_user('customer', is_staff=False)
        self.assertFalse(self.permission.has_permission(
            self._req(user), self._OpenView()))

    def test_active_legacy_staff_allowed(self):
        self.enroll(self.superuser, codes=[])
        self.assertTrue(self.permission.has_permission(
            self._req(self.superuser), self._ProductsView()))


# ---------------------------------------------------------------------------
# Management command: staff mapping
# ---------------------------------------------------------------------------

class MapStaffCommandTests(AccessControlTestCase):

    def test_map_staff_assigns_system_roles_idempotently(self):
        superuser = self.make_user('legacyroot', is_superuser=True)
        legacy = self.make_user('legacystaff')

        call_command('map_staff')

        self.assertEqual(superuser.staff_profile.status,
                         StaffProfile.Status.ACTIVE)
        self.assertTrue(superuser.staff_profile.roles.filter(
            slug='super_admin').exists())
        self.assertTrue(legacy.staff_profile.roles.filter(
            slug='legacy_administrator').exists())

        before = StaffProfile.objects.count()
        call_command('map_staff')
        self.assertEqual(StaffProfile.objects.count(), before)