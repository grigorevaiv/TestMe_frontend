import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { TestService } from './test.service';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class StepRedirectService {
  constructor(private router: Router, private testService: TestService) {}

  async redirectIfStepAlreadyCompleted(
    mode: string,
    testId: number,
    step: number,
    getEditRoute: (id: number) => any[]
  ): Promise<boolean> {
    if (mode !== 'new' || !testId) return false;

    try {
      const test = await firstValueFrom(this.testService.getTestById(testId));
      const currentStep = test.state?.currentStep || 1;

      if (currentStep >= step) {
        const route = getEditRoute(testId);
        await this.router.navigate(route);
        return true;
      }
    } catch (err) {
      console.error('[StepRedirectService] Error during redirect check:', err);
    }

    return false;
  }
}
