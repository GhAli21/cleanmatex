/**
 * HFC P4: the printed receipt shows a CODE128 of the order number only when showOrderBarcode is on
 * (RECEIPT label config show_order_barcode, capped by human_codes_scan_labels); by default it prints as before.
 */
import "@testing-library/jest-dom";
import * as React from "react";
import { render, screen } from "@testing-library/react";
import type { ReadyOrder } from "@features/orders/model/ready-order-types";

const mockRenderQrSvg = jest.fn<string, [string, { size?: number }]>(
  () => '<svg viewBox="0 0 10 10"></svg>',
);

jest.mock("next-intl", () => ({
  useTranslations: (ns: string) => {
    const t = (key: string) => `${ns}.${key}`;
    t.has = () => false;
    return t;
  },
}));
jest.mock("@/lib/hooks/useRTL", () => ({ useRTL: () => false }));
jest.mock("@/lib/hooks/useLocale", () => ({ useLocale: () => "en" }));
jest.mock("@/lib/context/tenant-currency-context", () => ({
  useTenantCurrency: () => ({ currencyCode: "OMR", decimalPlaces: 3 }),
}));
jest.mock("@/lib/utils/barcode/qr", () => ({
  renderQrSvg: (value: string, options: { size?: number }) =>
    mockRenderQrSvg(value, options),
}));

import { OrderReceiptPrint } from "@features/orders/ui/order-receipt-print";

const order = {
  id: "o1",
  orderNo: "ORD-260101-0001",
  customer: { name: "Test Customer", phone: "90000000" },
  rackLocation: null,
  readyBy: null,
  total: 1,
  items: [],
  paymentSummary: { paid: 1, remaining: 0 },
} as ReadyOrder;

describe("OrderReceiptPrint order barcode", () => {
  beforeEach(() => {
    mockRenderQrSvg.mockClear();
  });

  it("is off by default", () => {
    render(<OrderReceiptPrint order={order} layout="thermal" />);
    expect(screen.queryByTestId("receipt-order-barcode")).toBeNull();
  });

  it("prints a CODE128 of the order no when on", () => {
    render(<OrderReceiptPrint order={order} layout="a4" showOrderBarcode />);
    const img = screen.getByRole("img", {
      name: "labels.template.orderBarcode ORD-260101-0001",
    });
    expect(img.querySelector("svg")).toBeTruthy();
    expect(screen.getByTestId("receipt-order-barcode")).toBeInTheDocument();
  });

  it("prints the customer QR with the opaque public URL, never an order identifier", () => {
    const publicTrackingUrl =
      "https://app.cleanmatex.com/track/opaque_customer_token_1234";
    render(
      <OrderReceiptPrint
        order={order}
        layout="thermal"
        publicTrackingUrl={publicTrackingUrl}
      />,
    );
    expect(
      screen.getByTestId("receipt-public-tracking-qr"),
    ).toBeInTheDocument();
    expect(mockRenderQrSvg).toHaveBeenCalledWith(publicTrackingUrl, {
      size: 88,
    });
    expect(mockRenderQrSvg).not.toHaveBeenCalledWith(
      expect.stringContaining(order.orderNo),
      expect.anything(),
    );
    expect(mockRenderQrSvg).not.toHaveBeenCalledWith(
      expect.stringContaining(order.id),
      expect.anything(),
    );
  });

  it("omits the customer QR when no active opaque tracking path is available", () => {
    render(
      <OrderReceiptPrint order={order} layout="a4" publicTrackingUrl={null} />,
    );
    expect(screen.queryByTestId("receipt-public-tracking-qr")).toBeNull();
    expect(mockRenderQrSvg).not.toHaveBeenCalled();
  });
});
