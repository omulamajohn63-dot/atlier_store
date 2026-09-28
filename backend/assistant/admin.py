from django.contrib import admin

from .models import (AssistantConversation, AssistantInsight,
                     AssistantMessage, AssistantToolCall)


class AssistantMessageInline(admin.TabularInline):
    model = AssistantMessage
    extra = 0
    can_delete = False
    readonly_fields = ('role', 'kind', 'content', 'unanswered',
                       'latency_ms', 'created_at')
    fields = readonly_fields

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(AssistantConversation)
class AssistantConversationAdmin(admin.ModelAdmin):
    list_display = ('short_id', 'owner', 'status', 'message_count',
                    'created_at', 'updated_at')
    list_filter = ('status', 'created_at')
    search_fields = ('id', 'user__email', 'session_key')
    readonly_fields = ('id', 'user', 'session_key', 'status',
                       'last_interaction_id', 'message_count',
                       'created_at', 'updated_at')
    inlines = (AssistantMessageInline,)
    date_hierarchy = 'created_at'

    @admin.display(description='Conversation')
    def short_id(self, obj):
        return str(obj.pk)[:8]

    @admin.display(description='Customer')
    def owner(self, obj):
        if obj.user_id:
            return obj.user.email
        return f'guest:{obj.session_key[:8]}' if obj.session_key else 'guest'


@admin.register(AssistantMessage)
class AssistantMessageAdmin(admin.ModelAdmin):
    list_display = ('conversation', 'role', 'kind', 'preview',
                    'unanswered', 'latency_ms', 'created_at')
    list_filter = ('role', 'kind', 'unanswered', 'created_at')
    search_fields = ('conversation__id', 'content')
    readonly_fields = ('conversation', 'role', 'kind', 'content',
                       'product_refs', 'actions', 'unanswered',
                       'latency_ms', 'usage', 'created_at')
    date_hierarchy = 'created_at'

    @admin.display(description='Content')
    def preview(self, obj):
        return obj.content[:60]


@admin.register(AssistantToolCall)
class AssistantToolCallAdmin(admin.ModelAdmin):
    list_display = ('tool_name', 'status', 'duration_ms', 'created_at')
    list_filter = ('tool_name', 'status', 'created_at')
    search_fields = ('conversation__id', 'tool_name')
    readonly_fields = ('conversation', 'message', 'tool_name', 'arguments',
                       'result_summary', 'status', 'error_code',
                       'duration_ms', 'created_at')
    date_hierarchy = 'created_at'


@admin.register(AssistantInsight)
class AssistantInsightAdmin(admin.ModelAdmin):
    list_display = ('kind', 'text', 'count', 'resolved', 'last_seen')
    list_filter = ('kind', 'resolved', 'last_seen')
    search_fields = ('normalized', 'text')
    readonly_fields = ('kind', 'text', 'normalized', 'count',
                       'first_seen', 'last_seen')
    date_hierarchy = 'last_seen'
