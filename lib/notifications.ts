import type { AlertItem } from "@/lib/domain/models";

export type NotificationChannel = "in-app" | "email" | "push" | "telegram";

export type NotificationPayload = Pick<AlertItem, "type" | "severity" | "title" | "message"> & {
  userId: string;
  channels: NotificationChannel[];
};

export type NotificationTransport = {
  channel: NotificationChannel;
  send(payload: NotificationPayload): Promise<void>;
};

export class NotificationService {
  constructor(private readonly transports: NotificationTransport[]) {}

  async dispatch(payload: NotificationPayload) {
    const selected = this.transports.filter((transport) => payload.channels.includes(transport.channel));
    await Promise.all(selected.map((transport) => transport.send(payload)));
  }
}

export const inAppNotificationTransport: NotificationTransport = {
  channel: "in-app",
  async send() {
    return undefined;
  }
};

