import { LoggerService, Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.TRANSIENT })
export class Logger implements LoggerService {
  private context?: string;

  setContext(context: string) {
    this.context = context;
  }

  log(message: any, ...optionalParams: any[]) {
    this.printMessage(message, 'LOG', optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    this.printMessage(message, 'ERROR', optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    this.printMessage(message, 'WARN', optionalParams);
  }

  debug(message: any, ...optionalParams: any[]) {
    this.printMessage(message, 'DEBUG', optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]) {
    this.printMessage(message, 'VERBOSE', optionalParams);
  }

  private printMessage(message: any, level: string, optionalParams: any[]) {
    const timestamp = new Date().toISOString();
    const context = this.context ? `[${this.context}] ` : '';
    const params = optionalParams.length > 0 ? ` ${JSON.stringify(optionalParams)}` : '';

    console.log(`[${timestamp}] [${level}] ${context}${message}${params}`);
  }
}
