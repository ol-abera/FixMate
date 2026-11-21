import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../services/api";
import { ForgotPasswordPage, ResetPasswordPage } from "./Misc";

vi.mock("../context/AppContext", () => ({ useApp: () => ({}) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/auth" element={<p>sign in page</p>} />
    </Routes>
  </MemoryRouter>,
);

describe("ForgotPasswordPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("prefills the email and confirms without revealing whether the account exists", async () => {
    const spy = vi.spyOn(api, "requestPasswordReset").mockResolvedValue({ detail: "ok" });
    renderAt("/forgot-password?email=sam%40x.test");
    expect(screen.getByPlaceholderText("you@email.com")).toHaveValue("sam@x.test");
    await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(spy).toHaveBeenCalledWith("sam@x.test");
    expect(await screen.findByText("Check your inbox")).toBeInTheDocument();
    expect(screen.getByText(/If an account exists for sam@x.test/)).toBeInTheDocument();
  });

  it("validates the email before calling the API", async () => {
    const spy = vi.spyOn(api, "requestPasswordReset");
    renderAt("/forgot-password");
    await userEvent.type(screen.getByPlaceholderText("you@email.com"), "sam@localhost");
    await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(spy).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });
});

describe("ResetPasswordPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("explains an incomplete link", () => {
    renderAt("/reset-password?uid=abc");
    expect(screen.getByText("Invalid reset link")).toBeInTheDocument();
  });

  it("requires matching passwords, then resets and goes to sign in", async () => {
    const spy = vi.spyOn(api, "confirmPasswordReset").mockResolvedValue({ detail: "ok" });
    renderAt("/reset-password?uid=MjA&token=t-1");
    const [pw, confirm] = screen.getAllByPlaceholderText("••••••••");
    await userEvent.type(pw, "Brand-new-1!");
    await userEvent.type(confirm, "Brand-new-2!");
    await userEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(spy).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Passwords don't match");

    await userEvent.clear(confirm);
    await userEvent.type(confirm, "Brand-new-1!");
    await userEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(spy).toHaveBeenCalledWith("MjA", "t-1", "Brand-new-1!");
    expect(await screen.findByText("sign in page")).toBeInTheDocument();
  });
});
