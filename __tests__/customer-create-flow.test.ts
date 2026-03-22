import { beforeEach, describe, expect, it, vi } from "vitest";

const { customerCreateMock } = vi.hoisted(() => ({
  customerCreateMock: vi.fn(),
}));

vi.mock("@/features/integrations/business/get-business-provider", () => ({
  getBusinessProvider: () => ({
    customerCreate: customerCreateMock,
  }),
}));

describe("customer_create flow", () => {
  beforeEach(() => {
    customerCreateMock.mockReset();
  });

  it("executes customer_create with only required fields", async () => {
    customerCreateMock.mockResolvedValue({
      ok: true,
      message: "Kunde C-123 wurde angelegt.",
      customer: {
        id: "customer-1",
        customerNumber: "C-123",
        companyName: "Christian Müller",
        contactName: "Christian Müller",
        phone: "+49 160 1234567",
        email: null,
        street: null,
        city: null,
        postalCode: null,
        notes: null,
        createdAt: "2026-03-22T00:00:00.000Z",
      },
      customerCreated: true,
      missingFields: [
        "contactName",
        "email",
        "street",
        "city",
        "postalCode",
        "note",
      ],
    });

    const { customerCreateTool } = await import(
      "@/features/ai/tools/defs/customer_create"
    );

    const result = await customerCreateTool.execute(
      {
        customerName: "Christian Müller",
        phone: "+49 160 1234567",
      },
      {},
      false,
    );

    expect(customerCreateMock).toHaveBeenCalledTimes(1);
    expect(customerCreateMock).toHaveBeenCalledWith(
      {
        customerName: "Christian Müller",
        phone: "+49 160 1234567",
      },
      false,
    );

    expect(result).toMatchObject({
      ok: true,
      customerCreated: true,
      missingFields: expect.arrayContaining(["email", "street"]),
    });
  });
});
