from django.urls import path

from . import views

urlpatterns = [
    path("config/", views.PaymentConfigView.as_view(), name="payments-config"),
    path("checkout/", views.CheckoutView.as_view(), name="payments-checkout"),
    path("session/<str:session_id>/", views.SessionView.as_view(), name="payments-session"),
    path("sync/", views.SyncView.as_view(), name="payments-sync"),
    path("mock/confirm/", views.MockConfirmView.as_view(), name="payments-mock-confirm"),
    path("webhook/", views.StripeWebhookView.as_view(), name="payments-webhook"),
]
