/** Cloud-sync status the server pushes to the kiosk. Never carries the device token. */
export interface CloudSyncStatus {
  available: boolean;
  configured?: boolean;
  linked?: boolean;
  enabled?: boolean;
  active?: boolean;
  endpoint?: string;
  pending?: number;
  pushed?: number;
  parked?: number;
}
