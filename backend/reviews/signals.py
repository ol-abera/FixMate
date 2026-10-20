from django.db.models import Avg, Count
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import Review


def recalculate_provider_rating(provider):
    agg = provider.reviews.filter(is_published=True).aggregate(avg=Avg("rating"), n=Count("id"))
    rating = round(agg["avg"] or 0, 2)
    # .update() is safe even if the provider row is being deleted in the same cascade
    type(provider).objects.filter(pk=provider.pk).update(rating=rating, total_reviews=agg["n"])
    provider.rating, provider.total_reviews = rating, agg["n"]


@receiver(post_save, sender=Review)
@receiver(post_delete, sender=Review)
def _review_changed(sender, instance, **kwargs):
    recalculate_provider_rating(instance.provider)
