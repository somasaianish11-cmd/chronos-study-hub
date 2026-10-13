import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import UtcTrackingBadge from "@/components/timer/UtcTrackingBadge";

const TOOLTIP_TEXT =
  "Chronos tracks sessions using absolute universal time. Your focus time and streaks remain 100% accurate even if your screen locks, device sleeps, or tabs switch.";

const renderBadge = () =>
  render(
    <TooltipProvider delayDuration={0}>
      <UtcTrackingBadge />
    </TooltipProvider>
  );

// Radix renders the explanation twice (visible bubble + visually-hidden
// role="tooltip" node for screen readers), so assert presence, not uniqueness.
const expectExplanation = async () => {
  await waitFor(() =>
    expect(screen.getAllByText(TOOLTIP_TEXT).length).toBeGreaterThan(0)
  );
};

describe("UtcTrackingBadge", () => {
  it("shows the micro-copy under the timer controls", () => {
    renderBadge();
    expect(screen.getByText("Background-safe UTC tracking enabled")).toBeTruthy();
  });

  it("reveals the full explanation on focus", async () => {
    renderBadge();
    fireEvent.focus(screen.getByText("Background-safe UTC tracking enabled"));
    await expectExplanation();
  });

  it("reveals the full explanation on hover", async () => {
    renderBadge();
    fireEvent.pointerMove(screen.getByText("Background-safe UTC tracking enabled"));
    await expectExplanation();
  });
});
