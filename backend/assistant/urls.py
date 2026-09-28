from django.urls import path

from .views import ChatView, HistoryView, SuggestionsView

urlpatterns = [
    path('assistant/chat', ChatView.as_view(), name='assistant-chat'),
    path('assistant/history', HistoryView.as_view(), name='assistant-history'),
    path('assistant/suggestions', SuggestionsView.as_view(),
         name='assistant-suggestions'),
]
