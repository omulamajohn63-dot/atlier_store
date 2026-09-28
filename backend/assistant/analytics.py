"""Aggregations for the admin Assistant Analytics page.

Reads only metadata the assistant already stores (message counts, tool
names, insight aggregates) — never raw customer message content outside the
unanswered-question fragments the FAQ tracker is built for.
"""
from datetime import timedelta

from django.db.models import Avg, Count, Q
from django.utils import timezone

from .models import (AssistantConversation, AssistantInsight,
                     AssistantMessage, AssistantToolCall)


def assistant_analytics(days=30):
    days = max(1, min(int(days or 30), 365))
    start = timezone.now() - timedelta(days=days)

    messages = AssistantMessage.objects.filter(created_at__gte=start)
    replies = messages.filter(role=AssistantMessage.Role.ASSISTANT,
                              kind=AssistantMessage.Kind.REPLY)
    errors = messages.filter(role=AssistantMessage.Role.ASSISTANT,
                             kind=AssistantMessage.Kind.ERROR)
    questions = messages.filter(role=AssistantMessage.Role.USER)

    reply_count = replies.count()
    unanswered_count = replies.filter(unanswered=True).count()
    error_count = errors.count()
    question_count = questions.count()

    latency = replies.filter(latency_ms__isnull=False).aggregate(
        avg=Avg('latency_ms'))['avg'] or 0

    conversations = AssistantConversation.objects.filter(
        created_at__gte=start).count()

    tool_rows = (AssistantToolCall.objects.filter(created_at__gte=start)
                 .values('tool_name')
                 .annotate(calls=Count('id'),
                           failures=Count('id', filter=~Q(
                               status=AssistantToolCall.Status.OK)),
                           avg_ms=Avg('duration_ms'))
                 .order_by('-calls'))
    tool_usage = [
        {'name': row['tool_name'], 'calls': row['calls'],
         'failures': row['failures'],
         'avgMs': round(row['avg_ms'] or 0)}
        for row in tool_rows
    ]
    tool_calls = sum(row['calls'] for row in tool_usage)

    insights = (AssistantInsight.objects.filter(last_seen__gte=start)
                .values('kind').annotate(total=Count('count')))
    insight_totals = {row['kind']: row['total'] for row in insights}

    top_unanswered = [
        {'text': item.text, 'count': item.count}
        for item in AssistantInsight.objects.filter(
            kind=AssistantInsight.Kind.UNANSWERED, resolved=False)
        .order_by('-count', '-last_seen')[:10]
    ]

    # Daily question volume for the trend strip.
    daily = []
    for offset in range(days - 1, -1, -1):
        day = (timezone.now() - timedelta(days=offset)).date()
        daily.append({
            'date': day.isoformat(),
            'questions': questions.filter(created_at__date=day).count(),
            'unanswered': replies.filter(
                created_at__date=day, unanswered=True).count(),
        })

    return {
        'days': days,
        'totals': {
            'questions': question_count,
            'replies': reply_count,
            'conversations': conversations,
            'unanswered': unanswered_count,
            'errors': error_count,
            'escalations': insight_totals.get(AssistantInsight.Kind.ESCALATION, 0),
            'zeroResults': insight_totals.get(AssistantInsight.Kind.ZERO_RESULT, 0),
            'geminiErrors': insight_totals.get(AssistantInsight.Kind.GEMINI_ERROR, 0),
            'toolCalls': tool_calls,
            'avgLatencyMs': round(latency),
            'unansweredRate': (round(unanswered_count / reply_count * 100, 1)
                               if reply_count else 0.0),
        },
        'toolUsage': tool_usage,
        'topUnanswered': top_unanswered,
        'daily': daily,
    }
