import { Injectable, signal } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface AppNotification {
  id: string;
  message: string;
  type: NotificationType;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSignal = signal<AppNotification[]>([]);
  public readonly notifications = this.notificationsSignal.asReadonly();

  show(message: string, type: NotificationType = 'error', durationMs: number = 4000) {
    const id = Math.random().toString(36).substring(2, 9);
    const newNotification: AppNotification = { id, message, type };

    this.notificationsSignal.update(current => [...current, newNotification]);

    setTimeout(() => {
      this.remove(id);
    }, durationMs);
  }

  remove(id: string) {
    this.notificationsSignal.update(current => current.filter(n => n.id !== id));
  }
}