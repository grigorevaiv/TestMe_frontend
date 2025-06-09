import { inject, Injectable } from '@angular/core';
import {
  HttpInterceptor, HttpRequest, HttpHandler,
  HttpEvent, HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ToastService } from '../services/toast.service';

@Injectable({ providedIn: 'root' })
export class HttpErrorInterceptor implements HttpInterceptor {

  constructor(private toast: ToastService) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        const detail = error.error?.detail;

        if (typeof detail === 'string') {
          this.toast.show({
            message: detail,
            type: 'error'
          });
        } else if (Array.isArray(detail)) {
          const message = detail.map(d => d.msg || d).join('\n');
          this.toast.show({
            message: message,
            type: 'error'
          });
        } else {
          this.toast.show({
            message: 'An unexpected error occurred',
            type: 'error'
          });
        }

        return throwError(() => error);
      })
    );
  }
}

