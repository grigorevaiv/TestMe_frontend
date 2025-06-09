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

  setTestId(testId: number) {
    this.sessionStorage.setTestId(testId);
    this.triggerRefresh();
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
/*
import { inject, signal, computed, Injectable } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { SessionStorageService } from './session-storage.service';
import { TestService } from './test.service';

@Injectable({
  providedIn: 'root'
})

export class ResourceService {
  private sessionStorage = inject(SessionStorageService);
  private testService = inject(TestService);

  // 🎯 Реактивный testId
  private testIdSignal = signal<number | null>(this.sessionStorage.getTestId());

  // 🔁 Универсальный триггер на "перезагрузить всё"
  private refreshTrigger = signal(0);

  // 🧠 Метод установки testId (и опционально форса)
  setTestId(testId: number, forceRefresh = false) {
    this.sessionStorage.setTestId(testId);
    this.testIdSignal.set(testId);
    if (forceRefresh) this.triggerRefresh();
  }

  // 💥 Явный метод ручного рефреша
  triggerRefresh() {
    this.refreshTrigger.update(v => v + 1);
  }

  // 🛡️ Безопасный testId (кидает ошибку если null)
  private safeTestId = computed(() => {
    const id = this.testIdSignal();
    if (id === null) throw new Error('Test ID is not set.');
    return id;
  });

  // ⬇️ Ресурсы — зависят и от testId, и от refreshTrigger

  testResource = rxResource({
    request: () => {
      this.refreshTrigger();
      return this.safeTestId();
    },
    loader: ({ request }) => this.testService.getTestData(request)
  });

  blocksResource = rxResource({
    request: () => {
      this.refreshTrigger();
      return this.safeTestId();
    },
    loader: ({ request }) => this.testService.getBlocks(request)
  });

  questionsResource = rxResource({
    request: () => {
      this.refreshTrigger();
      return this.safeTestId();
    },
    loader: ({ request }) => this.testService.getQuestions(request)
  });

  answersResource = rxResource({
    request: () => {
      this.refreshTrigger();
      return this.safeTestId();
    },
    loader: ({ request }) => this.testService.getAnswers(request)
  });

  scalesResource = rxResource({
    request: () => {
      this.refreshTrigger();
      return this.safeTestId();
    },
    loader: ({ request }) => this.testService.getScales(request)
  });

  weightsResource = rxResource({
    request: () => {
      this.refreshTrigger();
      return this.safeTestId();
    },
    loader: ({ request }) => this.testService.getWeights(request)
  });

  normsResource = rxResource({
    request: () => {
      this.refreshTrigger();
      return this.safeTestId();
    },
    loader: ({ request }) => this.testService.getNorms(request)
  });

  interpretationsResource = rxResource({
    request: () => {
      this.refreshTrigger();
      return this.safeTestId();
    },
    loader: ({ request }) => this.testService.getInterpretations(request)
  });

  // 🔓 Глобальные ресурсы без testId
  testsResource = rxResource({
    request: () => this.refreshTrigger(), // можно перезагрузить вручную
    loader: () => this.testService.getTests()
  });

  allQuestionsResource = rxResource({
    request: () => this.refreshTrigger(),
    loader: () => this.testService.getAllQuestions()
  });

  allTagsResource = rxResource({
    request: () => this.refreshTrigger(),
    loader: () => this.testService.getAllTags()
  });
}
*/