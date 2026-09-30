// Central Connectivity Service for NARO
// Monitors network connectivity and notifies application components

type ConnectivityListener = (isOnline: boolean) => void;

class ConnectivityService {
  private online: boolean =
    typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true;
  private listeners: Set<ConnectivityListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  public get isOnline(): boolean {
    return this.online;
  }

  public subscribe(listener: ConnectivityListener): () => void {
    this.listeners.add(listener);
    // Notify immediately with current state
    listener(this.online);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private handleOnline = () => {
    this.online = true;
    this.notify();
  };

  private handleOffline = () => {
    this.online = false;
    this.notify();
  };

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.online);
      } catch (err) {
        console.error('Error in connectivity listener:', err);
      }
    });
  }

  /**
   * For testing or manual override
   */
  public setOnlineStatus(status: boolean) {
    if (this.online !== status) {
      this.online = status;
      this.notify();
    }
  }

  public destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
    this.listeners.clear();
  }
}

export const connectivityService = new ConnectivityService();
