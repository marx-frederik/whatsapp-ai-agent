import { Command } from "./schema";

export const commandExamples: Command[] = [
  {
    name: "schedule.create",
    entities: {
      title: "Team Sync",
      date: "2026-02-18",
      time: "09:30",
      timezone: "Europe/Berlin",
    },
    confidence: 0.86,
    missingFields: [],
  },
  {
    name: "costumer.info",
    entities: {
      customerId: "CUST-1042",
      phone: "+491701234567",
    },
    confidence: 0.74,
    missingFields: ["email"],
  },
  {
    name: "order.create",
    entities: {
      items: [
        { sku: "SKU-001", qty: 2 },
        { sku: "SKU-014", qty: 1 },
      ],
      address: "Hauptstr. 1, 10115 Berlin",
    },
    confidence: 0.9,
    missingFields: [],
  },
  {
    name: "team.reminder",
    entities: {
      teamId: "ops",
      message: "Bitte Report bis 17:00",
      when: "2026-02-12T16:30:00+01:00",
    },
    confidence: 0.81,
    missingFields: [],
  },
];
