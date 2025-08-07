import { env } from '../config/env';

// Simple logger utility
export class Logger {
  private static prefix = '[BookBot]';

  public static info(message: string, ...args: any[]) {
    if (env.NODE_ENV === 'production') return;
    console.info(this.prefix, message, ...args);
  }

  public static error(message: string, ...args: any[]) {
    console.error(this.prefix, message, ...args);
  }

  public static warn(message: string, ...args: any[]) {
    if (env.NODE_ENV === 'production') return;
    console.warn(this.prefix, message, ...args);
  }

  public static debug(message: string, ...args: any[]) {
    if (env.NODE_ENV !== 'development') return;
    console.debug(this.prefix, message, ...args);
  }
}

export default Logger;
