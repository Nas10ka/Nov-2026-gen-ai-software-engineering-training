import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null && 'error' in body && 'details' in body) {
        response.status(status).json(body);
        return;
      }
      const message = typeof body === 'string' ? body
        : (body as { message?: string | string[] }).message ?? exception.message;
      response.status(status).json({ error: message });
      return;
    }
    this.logger.error(exception);
    response.status(500).json({ error: 'Internal server error' });
  }
}
