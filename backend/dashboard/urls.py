from django.urls import path

from .views import AdminDashboardView, CustomerDashboardView, ProviderDashboardView, PublicStatsView

urlpatterns = [
    path("customer/", CustomerDashboardView.as_view(), name="dashboard-customer"),
    path("provider/", ProviderDashboardView.as_view(), name="dashboard-provider"),
    path("admin/", AdminDashboardView.as_view(), name="dashboard-admin"),
    path("public/", PublicStatsView.as_view(), name="dashboard-public"),
]
