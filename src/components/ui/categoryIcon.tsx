import { Ellipsis, KeyRound, Mail, Monitor, PanelsTopLeft, Printer, Wifi } from "lucide-react";
import type { ReactNode } from "react";
import type { TicketCategory } from "@/lib/types";

/** One icon per category, used on the new-request tiles and in the employee's request table. */
export const CAT_ICON: Record<TicketCategory, ReactNode> = {
  hardware: <Monitor />,
  printer: <Printer />,
  network: <Wifi />,
  email: <Mail />,
  software: <PanelsTopLeft />,
  access: <KeyRound />,
  other: <Ellipsis />,
};
