import "@testing-library/jest-dom";
import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";

const ORDER_ID = "0a000000-0000-4000-8000-000000000001";

jest.mock("next/navigation", () => ({
  useParams: () => ({ orderId: ORDER_ID }),
  useRouter: () => ({ back: jest.fn() }),
}));
jest.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));
jest.mock("@/lib/hooks/useRTL", () => ({ useRTL: () => false }));
jest.mock("@/src/features/receipts/ui/receipt-preview", () => ({
  ReceiptPreview: () => <div data-testid="receipt-preview" />,
}));

import ReceiptPage from "@/app/dashboard/receipts/[orderId]/page";

describe("ReceiptPage order identity", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("shows the human order number and never renders the route UUID", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { order_no: "ORD-261107-0042", customer_type: "retail" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(<ReceiptPage />);

    await waitFor(() =>
      expect(screen.getByText("ORD-261107-0042")).toBeInTheDocument(),
    );
    expect(screen.queryByText(ORDER_ID)).toBeNull();
    expect(screen.getByTestId("receipt-preview")).toBeInTheDocument();
  });
});
