import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import { api, ApiError, toBooking, type PaymentSession } from "../services/api";
import { CheckoutReturnPage, MockCheckoutPage } from "./Checkout";

const refreshBookings = vi.fn();
vi.mock("../context/AppContext", () => ({ useApp: () => ({ refreshBookings }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const session = (over: Partial<PaymentSession> = {}): PaymentSession => ({
  bookingId: "7", title: "Fix sink", providerName: "Alex Rivera", amount: 140, currency: "usd",
  gateway: "mock", status: "pending", failureReason: "", ...over,
});

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/checkout/mock" element={<MockCheckoutPage />} />
      <Route path="/checkout/return" element={<CheckoutReturnPage />} />
    </Routes>
  </MemoryRouter>,
);

describe("MockCheckoutPage", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("shows the amount due and pays with the test card", async () => {
    vi.spyOn(api, "paymentSession").mockResolvedValue(session());
    const confirm = vi.spyOn(api, "confirmMockPayment").mockResolvedValue(session({ status: "paid" }));
    vi.spyOn(api, "syncPayment").mockResolvedValue(session({ status: "paid" }));
    renderAt("/checkout/mock?session_id=mock_abc");
    expect(await screen.findByText("Fix sink")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /pay \$140\.00/i }));
    expect(confirm).toHaveBeenCalledWith("mock_abc", "4242 4242 4242 4242");
    expect(await screen.findByText("Payment received")).toBeInTheDocument();
    expect(refreshBookings).toHaveBeenCalled();
  });

  it("keeps the customer on the form when the card is declined", async () => {
    vi.spyOn(api, "paymentSession").mockResolvedValue(session());
    vi.spyOn(api, "confirmMockPayment").mockRejectedValue(new ApiError(402, "Your card was declined."));
    renderAt("/checkout/mock?session_id=mock_abc");
    const input = await screen.findByLabelText(/card number/i);
    await userEvent.clear(input);
    await userEvent.type(input, "4000 0000 0000 0002");
    await userEvent.click(screen.getByRole("button", { name: /pay/i }));
    expect(toast.error).toHaveBeenCalledWith("Your card was declined.");
    expect(screen.getByRole("button", { name: /pay/i })).toBeEnabled();
  });

  it("explains a session that is not the customer's", async () => {
    vi.spyOn(api, "paymentSession").mockRejectedValue(new ApiError(404, "Payment session not found."));
    renderAt("/checkout/mock?session_id=nope");
    expect(await screen.findByText("Checkout unavailable")).toBeInTheDocument();
    expect(screen.getByText("Payment session not found.")).toBeInTheDocument();
  });
});

describe("CheckoutReturnPage", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("reports a failed payment without claiming a charge", async () => {
    vi.spyOn(api, "syncPayment").mockResolvedValue(session({ gateway: "stripe", status: "failed", failureReason: "Checkout session expired." }));
    renderAt("/checkout/return?session_id=cs_1");
    expect(await screen.findByText("Payment not completed")).toBeInTheDocument();
    expect(screen.getByText(/Checkout session expired\. You have not been charged/)).toBeInTheDocument();
  });
});

describe("toBooking payment mapping", () => {
  it("maps the payment summary and can_pay", () => {
    const b = toBooking({ id: 1, status: "COMPLETED", estimated_price: "100", final_price: "140.00", can_pay: false,
      payment: { status: "PAID", amount: "140.00", currency: "usd", gateway: "mock", paid_at: "2026-11-21T10:00:00Z" } });
    expect(b.payment).toEqual({ status: "paid", amount: 140, paidAt: "2026-11-21T10:00:00Z" });
    expect(b.canPay).toBe(false);
    expect(toBooking({ id: 2, status: "COMPLETED", estimated_price: "50", can_pay: true }).payment).toBeNull();
  });
});
