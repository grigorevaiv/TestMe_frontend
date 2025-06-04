import { inject, Injectable, signal } from '@angular/core';
import { filter, of, switchMap, tap } from 'rxjs';
import { SessionStorageService } from './session-storage.service';
import { TestService } from './test.service';
import { rxResource } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root'
})
export class ResourceService {
  constructor() {}

  private sessionStorage = inject(SessionStorageService);
  private testService = inject(TestService);
  private refreshTrigger = signal(0);

  triggerRefresh() {
    this.refreshTrigger.update(v => v + 1);
  }

  private testId$() {
    this.refreshTrigger();
    return of(this.sessionStorage.getTestId()).pipe(
      filter((testId): testId is number => testId !== null)
    );
  }

  testResource = rxResource({
    request: () => this.testId$(),
    loader: ({ request }) =>
      request.pipe(
        switchMap((testId) => this.testService.getTestData(testId))
      )
  });

  testsResource = rxResource({
    request: () => ({}),
    loader: () => this.testService.getTests()
  });

blocksResource = rxResource({
  request: () => this.testId$().pipe(
    tap((id) => console.log('📥 [blocksResource.request] testId =', id))
  ),
  loader: ({ request }) =>
    request.pipe(
      tap((id) => console.log('🚀 [blocksResource.loader] loading for testId:', id)),
      switchMap((testId) => this.testService.getBlocks(testId)),
      tap((blocks) => console.log('📦 [blocksResource.loader] loaded blocks:', blocks.map(b => b.id)))
    )
});


  scalesResource = rxResource({
    request: () => this.testId$(),
    loader: ({ request }) =>
      request.pipe(
        switchMap((testId) => this.testService.getScales(testId))
      )
  });

  questionsResource = rxResource({
    request: () => this.testId$(),
    loader: ({ request }) =>
      request.pipe(
        switchMap((testId) => this.testService.getQuestions(testId))
      )
  });

  answersResource = rxResource({
    request: () => this.testId$(),
    loader: ({ request }) =>
      request.pipe(
        switchMap((testId) => this.testService.getAnswers(testId))
      )
  });

  weightsResource = rxResource({
    request: () => this.testId$(),
    loader: ({ request }) =>
      request.pipe(
        switchMap((testId) => this.testService.getWeights(testId))
      )
  });

  normsResource = rxResource({
    request: () => this.testId$(),
    loader: ({ request }) =>
      request.pipe(
        switchMap((testId) => this.testService.getNorms(testId))
      )
  });

  interpretationsResource = rxResource({
    request: () => this.testId$(),
    loader: ({ request }) =>
      request.pipe(
        switchMap((testId) => this.testService.getInterpretations(testId))
      )
  });

  allQuestionsResource = rxResource({
    request: () => ({}),
    loader: () => this.testService.getAllQuestions()
  });

  allTagsResource = rxResource({
    request: () => ({}),
    loader: () => this.testService.getAllTags()
  });
}
