export type DriverNotification = {
  notification_id: string;
  user_id: string | null;
  title: string | null;
  message: string | null;
  notification_type: string | null;
  status: string | null;
  delivery_id: string | null;
  is_read: boolean | null;
  created_at: string | null;
};
