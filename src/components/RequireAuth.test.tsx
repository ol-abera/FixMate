import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { AuthUser } from "../data/mockData";
import { RequireAuth } from "./RequireAuth";

const state: { user: AuthUser | null; ready: boolean } = { user: null, ready: true };
vi.mock("../context/AppContext", () => ({ useApp: () => state }));

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/favorites" element={<RequireAuth roles={["customer"]}><p>secret favorites</p></RequireAuth>} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

const as = (role: AuthUser["role"]): AuthUser => ({ id: 1, name: "U", role, email: "u@x.test", avatar: "" });

describe("RequireAuth", () => {
  it("waits for the session check before deciding", () => {
    Object.assign(state, { user: null, ready: false });
    renderAt("/favorites");
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("sends guests to sign in, remembering where they were going", () => {
    Object.assign(state, { user: null, ready: true });
    renderAt("/favorites?x=1");
    expect(screen.getByTestId("where")).toHaveTextContent("/auth?next=%2Ffavorites%3Fx%3D1");
  });

  it("sends users with the wrong role to their own dashboard", () => {
    Object.assign(state, { user: as("provider"), ready: true });
    renderAt("/favorites");
    expect(screen.getByTestId("where")).toHaveTextContent("/provider-dashboard");
  });

  it("renders the page for the right role", () => {
    Object.assign(state, { user: as("customer"), ready: true });
    renderAt("/favorites");
    expect(screen.getByText("secret favorites")).toBeInTheDocument();
  });
});
