from django.urls import path

from .views import ClientEventView

urlpatterns = [
    path("audit/events", ClientEventView.as_view(), name="audit-events"),
]