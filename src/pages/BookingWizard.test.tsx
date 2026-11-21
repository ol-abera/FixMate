import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { api } from "../services/api";
import type { Provider } from "../data/mockData";
import { BookingWizardPage } from "./Booking";

const provider = {
  id: "4", name: "Alex Rivera", title: "Plumber", avatar: "", city: "Austin", categoryIds: ["plumbing"],
  hourlyRate: 60, minJobPrice: 90, instantBook: false,
  services: [{ id: "9", title: "Leak repair", description: "", price: 120, durationMins: 90, categoryId: "plumbing", categoryName: "Plumbing", active: true }],
} as unknown as Provider;

vi.mock("../context/AppContext", () => ({
  useApp: () => ({
    user: { id: 1, name: "Sam Customer", role: "customer", email: "sam@x.test", avatar: "" },
    categories: [{ id: "plumbing", name: "Plumbing" }], cities: ["Austin"], addBooking: vi.fn(),
  }),
  useProviderById: () => ({ provider, loading: false, missing: false }),
}));

function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe("BookingWizardPage", () => {
  it("preselects the service from the URL and prices it like the server", async () => {
    vi.spyOn(api, "busySlots").mockResolvedValue([]);
    render(<MemoryRouter initialEntries={["/book/4?service=9"]}><Routes><Route path="/book/:providerId" element={<BookingWizardPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByDisplayValue("Leak repair · from $120")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Leak repair")).toBeInTheDocument();
  });

  it("disables slots the pro is already booked for and blocks continuing", async () => {
    vi.spyOn(api, "busySlots").mockResolvedValue([{ date: tomorrowIso(), time_slot: "09:00 - 11:00" }]);
    render(<MemoryRouter initialEntries={["/book/4"]}><Routes><Route path="/book/:providerId" element={<BookingWizardPage />} /></Routes></MemoryRouter>);
    await userEvent.type(screen.getByPlaceholderText("e.g. Kitchen sink leak"), "Leak");
    await userEvent.type(screen.getByPlaceholderText("Tell the pro what is going on..."), "Drips");
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByRole("button", { name: /08:00 - 10:00/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /10:00 - 12:00/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /12:00 - 14:00/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: /12:00 - 14:00/ }));
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
  });
});
