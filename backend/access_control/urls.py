from django.urls import path

from . import views

urlpatterns = [
    path("staff/", views.StaffListView.as_view(), name="access-staff"),
    path("staff/create/", views.StaffCreateView.as_view(), name="access-staff-create"),
    path("staff/<int:user_id>/", views.StaffDetailView.as_view(), name="access-staff-detail"),
    path("staff/<int:user_id>/edit/", views.StaffEditView.as_view(), name="access-staff-edit"),
    path("staff/<int:user_id>/deactivate/", views.StaffDeactivateView.as_view(), name="access-staff-deactivate"),
    path("staff/<int:user_id>/reactivate/", views.StaffReactivateView.as_view(), name="access-staff-reactivate"),
    path("roles/", views.RoleListView.as_view(), name="access-roles"),
    path("roles/matrix/", views.PermissionsMatrixView.as_view(), name="access-matrix"),
    path("roles/create/", views.RoleCreateView.as_view(), name="access-role-create"),
    path("roles/<uuid:role_id>/", views.RoleDetailView.as_view(), name="access-role-detail"),
    path("roles/<uuid:role_id>/edit/", views.RoleEditView.as_view(), name="access-role-edit"),
    path("roles/<uuid:role_id>/delete/", views.RoleDeleteView.as_view(), name="access-role-delete"),
]